'use client';

import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import dayjs from 'dayjs';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { expandPostsList } from '@gitroom/helpers/utils/posts.list.minify';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import {
  AnalyticsDataItem,
  metricNumber,
  metricTotal,
} from '@gitroom/frontend/components/platform-analytics/render.analytics';
import { InsightCardsSkeleton } from '@gitroom/frontend/components/platform-analytics/analytics.skeletons';
import { SegmentedControl } from '@gitroom/frontend/components/cuesoft/toolbar/toolbar';

interface RecentPost {
  id: string;
  content: string;
  /* Nullable since Post.publishDate became DateTime? (undated drafts). This
     section only ever asks for state=published, and a published post always has
     a date, so in practice it is a string here. But the type said "always a
     string" while the wire says otherwise, and with strictNullChecks off that
     lie is the only thing standing between a null and a rendered date. */
  publishDate: string | null;
  releaseURL?: string;
  releaseId?: string;
  image?: unknown;
}

const SWR_OPTS = {
  refreshInterval: 0,
  refreshWhenHidden: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  revalidateIfStale: false,
  refreshWhenOffline: false,
  revalidateOnMount: true,
} as const;

/* Buffer ranks its Top 5 by the metric selected in the section's toggle, so
   the whole candidate pool needs its numbers before the top five can be
   picked. The pool is capped because each candidate costs one
   /analytics/post/:id call (Redis-cached server side, but still a call): ten
   is deep enough that the best five in a 7-to-31-day window are in it, and
   shallow enough not to fan out across a month of posts. */
const CANDIDATE_LIMIT = 10;

/* Buffer's own toggle reads `Reactions | Comments`, so those two lead when the
   payload has them; everything else keeps payload order behind them. */
const METRIC_PREFERENCE = [/reaction/i, /comment/i];

/* The post's media field is a JSON string of uploaded items ({ name, path }).
   Tolerate raw strings, arrays, single objects and broken payloads: a bad
   value must never break a card. Prefers the first IMAGE (a TikTok post's
   cover, not its mp4); a video-only post falls back to its first video.

   This duplicates a helper of the same name in launches/calendar.tsx, which
   is a module-local const there and not exported. Exporting it would mean
   editing that file, which this change does not own. */
const VIDEO_EXTENSION = /\.(mp4|mov|webm|avi|mkv|m4v)(\?|#|$)/i;
type MediaThumb = { url: string; isVideo: boolean };
const getFirstMediaThumb = (media: unknown): MediaThumb | undefined => {
  let firstVideo: string | undefined;
  try {
    const parsed =
      typeof media === 'string'
        ? media.trim()
          ? JSON.parse(media)
          : undefined
        : media;
    const items = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    for (const item of items) {
      const path =
        typeof item === 'string' ? item : item?.path || item?.url || '';
      if (typeof path !== 'string' || !path) continue;
      if (!VIDEO_EXTENSION.test(path)) return { url: path, isVideo: false };
      if (!firstVideo) firstVideo = path;
    }
  } catch {
    // broken media JSON: render the card without a thumbnail
  }
  return firstVideo ? { url: firstVideo, isVideo: true } : undefined;
};

const hasRelease = (post: RecentPost) =>
  !!post.releaseId && post.releaseId !== 'missing';

/** Renders nothing; it lifts one post's real per-post metrics
    (GET /analytics/post/:postId?date=<days>, providers' postAnalytics) up to
    the section, which is where the ranking and the metric toggle live. Same
    SWR key the cards read from, so nothing is fetched twice. */
const PostMetricsProbe: FC<{
  post: RecentPost;
  date: number;
  onLoad: (key: string, items: AnalyticsDataItem[] | undefined) => void;
}> = ({ post, date, onLoad }) => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    return (await fetch(`/analytics/post/${post.id}?date=${date}`)).json();
  }, [post.id, date]);

  const { data } = useSWR<AnalyticsDataItem[] | { missing: true }>(
    hasRelease(post) ? `/analytics-post-${post.id}-${date}` : null,
    load,
    SWR_OPTS
  );

  useEffect(() => {
    onLoad(`${post.id}-${date}`, Array.isArray(data) ? data : undefined);
  }, [post.id, date, data, onLoad]);

  return null;
};

/** Buffer's 24×24 card action. `href` renders the anchor form (a permalink
    must be a real link, middle-clickable), otherwise it is a button. */
const IconButton: FC<{
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  href?: string;
  children: React.ReactNode;
}> = ({ label, onClick, href, children }) => {
  const className =
    'shrink-0 w-[24px] h-[24px] rounded-[6px] flex items-center justify-center text-newTextColor/60 hover:text-newTextColor hover:bg-boxHover transition-colors duration-150';
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={label}
        title={label}
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={className}
    >
      {children}
    </button>
  );
};

/* Buffer's insight card, measured live 2026-08-13: 212 × 179, radius 12, 1px
   hairline, header 210 × 32 with padding 0 12px holding the rank and the
   metric, then a platform glyph + date, a three-line excerpt, a 44 × 44 r6
   thumbnail, and up to three 24 × 24 actions.

   Buffer's fill is a very faint warm tint (rgba(51,34,0,0.059)) because its
   cards sit on the white page. Here they sit inside the fork's grey r12
   section, where that tint would disappear, so the card takes the same white
   inner surface every other card in these sections uses: the tint's job
   (separating card from page) is already done by the section.

   `data-cs` on the thumbnail: global.scss's ladder rewrites h-[44px] to 36px
   for anything without it, so a bare 44 would render 44 × 36. */
const InsightCard: FC<{
  post: RecentPost;
  rank: number;
  identifier: string;
  metric?: AnalyticsDataItem;
  metricPending: boolean;
}> = ({ post, rank, identifier, metric, metricPending }) => {
  const t = useT();
  const toaster = useToaster();
  const url = post.releaseURL?.split(',')[0];
  const thumb = useMemo(() => getFirstMediaThumb(post.image), [post.image]);
  const [thumbFailed, setThumbFailed] = useState(false);

  const copyLink = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!url) return;
      navigator.clipboard?.writeText(url);
      toaster.show(t('link_copied', 'Link copied'), 'success');
    },
    [url, toaster, t]
  );

  return (
    <div className="w-[212px] h-[179px] shrink-0 flex flex-col bg-newBgColorInner border border-newTableBorder rounded-[12px] overflow-hidden">
      <div className="h-[32px] shrink-0 flex items-center gap-[8px] px-[12px] border-b border-newTableBorder">
        <span className="text-[13px] font-[550] text-newTextColor/60">
          #{rank}
        </span>
        <span className="text-[13px] font-[550] text-newTextColor truncate">
          {metric
            ? `${metricTotal(metric)} ${metric.label}`
            : metricPending
            ? t('loading_stats', 'Loading stats')
            : t('no_stats', 'No stats')}
        </span>
      </div>
      <div className="flex-1 min-h-0 flex flex-col gap-[6px] p-[12px]">
        <div className="flex items-center gap-[6px]">
          {/* platform glyph, not the account avatar: Buffer names the network
              on the card and the channel in the section above it */}
          <img
            src={`/icons/platforms/${identifier}.png`}
            alt=""
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
            className="w-[16px] h-[16px] rounded-[4px] shrink-0"
          />
          <span className="text-[12px] text-newTextColor/60 truncate">
            {/* dayjs(null) formats as the literal string 'Invalid Date' and
                dayjs(undefined) formats as TODAY, a date the post never had,
                printed with full confidence. A dateless post has no date line. */}
            {post.publishDate
              ? dayjs(post.publishDate).format('MMM D, YYYY')
              : ''}
          </span>
        </div>
        <div className="flex-1 min-h-0 flex items-start gap-[8px]">
          <div className="flex-1 min-w-0 text-[12px] leading-[18px] text-newTextColor line-clamp-3 break-words">
            {stripHtmlValidation('none', post.content || '', false)}
          </div>
          {!!thumb &&
            !thumbFailed &&
            (thumb.isVideo ? (
              <video
                data-cs
                src={thumb.url + '#t=0.1'}
                muted
                playsInline
                preload="metadata"
                className="w-[44px] h-[44px] rounded-[6px] object-cover shrink-0"
              />
            ) : (
              <img
                data-cs
                src={thumb.url}
                alt=""
                onError={() => setThumbFailed(true)}
                className="w-[44px] h-[44px] rounded-[6px] object-cover shrink-0"
              />
            ))}
        </div>
        {/* Only actions that do something ship (the fork's no-dead-buttons
            rule): the post's own permalink, and copying it. Buffer's third
            slot is Boost/Share-as-Post, which has no counterpart here. */}
        {!!url && (
          <div className="flex items-center gap-[4px]">
            <IconButton label={t('view_post', 'View post')} href={url}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 3h6v6" />
                <path d="M10 14 21 3" />
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              </svg>
            </IconButton>
            <IconButton
              label={t('copy_link', 'Copy link')}
              onClick={copyLink}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </IconButton>
          </div>
        )}
      </div>
    </div>
  );
};

/** "Top 5 Posts": the channel's published posts inside the selected range,
    ranked by the metric chosen in the section's toggle, as Buffer's five
    cards in one row. Renders nothing while there are no published posts at
    all; shows a quiet inline line when the range just excludes them. */
export const RecentPostsSection: FC<{
  integration: { id: string; identifier: string };
  date: number;
  subtitle: string;
}> = ({ integration, date, subtitle }) => {
  const fetch = useFetch();
  const t = useT();

  const load = useCallback(async () => {
    const search = new URLSearchParams({
      page: '0',
      limit: '20',
      state: 'published',
      integration: integration.id,
    });
    const raw = expandPostsList(
      await (await fetch(`/posts/list?${search.toString()}`)).json()
    );
    return (raw.posts || []) as RecentPost[];
  }, [integration.id]);

  const { data, isLoading } = useSWR(
    `analytics-recent-posts-${integration.id}`,
    load,
    SWR_OPTS
  );

  const candidates = useMemo(() => {
    const since = dayjs().subtract(date, 'day');
    return (data || [])
      // The date test is stated explicitly rather than left to dayjs. A null
      // would give an Invalid Date, whose isAfter is false, so the post drops
      // out of the window quietly, but an ABSENT publishDate gives dayjs()
      // = now, which is always after `since`, so it would rank inside every
      // range and then print today as its publish date. Requiring the value
      // makes both cases the same, deliberate exclusion.
      .filter((post) => !!post.publishDate && dayjs(post.publishDate).isAfter(since))
      .slice(0, CANDIDATE_LIMIT);
  }, [data, date]);

  // Keyed by `${postId}-${date}` so a range change mints new keys rather than
  // needing a reset effect that could race the probes.
  const [metrics, setMetrics] = useState<
    Record<string, AnalyticsDataItem[] | undefined>
  >({});
  const onLoad = useCallback(
    (key: string, items: AnalyticsDataItem[] | undefined) => {
      setMetrics((prev) => {
        // SWR hands back a stable reference per key, so this settles after one
        // commit instead of looping.
        if (key in prev && prev[key] === items) {
          return prev;
        }
        return { ...prev, [key]: items };
      });
    },
    []
  );

  // The toggle's options are the metric labels the payloads actually carry:
  // Buffer's fixed Reactions/Comments pair would print an empty toggle on any
  // platform that names them otherwise.
  const metricLabels = useMemo(() => {
    const seen: string[] = [];
    for (const post of candidates) {
      for (const item of metrics[`${post.id}-${date}`] || []) {
        if (item?.label && !seen.includes(item.label)) {
          seen.push(item.label);
        }
      }
    }
    const preferred = METRIC_PREFERENCE.flatMap((pattern) =>
      seen.filter((label) => pattern.test(label))
    );
    return [...new Set([...preferred, ...seen])];
  }, [candidates, metrics, date]);

  const [selected, setSelected] = useState('');
  const activeMetric = metricLabels.includes(selected)
    ? selected
    : metricLabels[0] || '';

  const ranked = useMemo(() => {
    const withMetric = candidates.map((post) => {
      const items = metrics[`${post.id}-${date}`];
      const hit = activeMetric
        ? (items || []).find((item) => item.label === activeMetric)
        : undefined;
      return {
        post,
        metric: hit,
        // a post whose stats have not arrived (or which has no release to ask
        // about) has no rank yet, so it sorts last rather than to the top
        value: hit ? metricNumber(hit) : -1,
        pending: hasRelease(post) && !items,
      };
    });
    if (!activeMetric) {
      // nothing to rank by yet: the list already arrives publishDate desc
      return withMetric.slice(0, 5);
    }
    return [...withMetric].sort((a, b) => b.value - a.value).slice(0, 5);
  }, [candidates, metrics, date, activeMetric]);

  // No published posts on this channel at all: the Summary empty/refresh
  // states already carry the page, so add no second empty hero.
  if (!isLoading && !(data || []).length) {
    return null;
  }

  return (
    <div className="bg-newTableHeader rounded-[12px] p-[8px] flex flex-col gap-[12px]">
      {candidates.map((post) => (
        <PostMetricsProbe
          key={`probe-${post.id}-${date}`}
          post={post}
          date={date}
          onLoad={onLoad}
        />
      ))}
      {/* phone stacks this row. The toggle is `shrink-0` and measured 344px
          against 344px of available width, so in a row it consumed everything
          and the title column (which carries min-w-0) collapsed to width 0
          rather than overflowing — the heading then wrapped one word per line.
          Measured at 402px on a real iPhone. */}
      <div className="flex items-start gap-[8px] px-[8px] pt-[8px] phone:flex-col phone:items-stretch">
        <div className="flex flex-col gap-[2px] min-w-0">
          <div className="text-[16px] font-[550]">
            {t('top_5_posts', 'Top 5 Posts')}
          </div>
          <div className="text-[12px] font-[400] text-newTextColor/60">
            {subtitle}
          </div>
        </div>
        {/* the spacer only makes sense in a row; in the phone column it would
            just add an empty gap between the title and the toggle */}
        <div className="flex-1 phone:hidden" />
        {/* Buffer's ranking toggle, top right of the section: same segmented
            anatomy as the range and metric pickers */}
        {metricLabels.length > 1 && (
          <SegmentedControl
            className="shrink-0 max-w-full overflow-x-auto [scrollbar-width:none]"
            itemClassName="shrink-0"
            options={metricLabels.map((label) => ({ value: label, label }))}
            value={activeMetric}
            onChange={setSelected}
          />
        )}
      </div>
      {isLoading ? (
        <InsightCardsSkeleton />
      ) : ranked.length ? (
        /* Buffer sits its five cards in ONE row. Fixed-width cards overflow
           on a narrow column, so the strip scrolls inside itself: an
           over-wide child must never widen the layout viewport (it breaks
           position:fixed). */
        <div className="flex gap-[8px] overflow-x-auto [scrollbar-width:none]">
          {ranked.map((entry, index) => (
            <InsightCard
              key={entry.post.id}
              post={entry.post}
              rank={index + 1}
              identifier={integration.identifier}
              metric={entry.metric}
              metricPending={entry.pending}
            />
          ))}
        </div>
      ) : (
        <div className="bg-newBgColorInner border border-newTableBorder rounded-[8px] px-[16px] py-[20px] text-[14px] text-newTextColor/60">
          {t(
            'no_posts_published_in_this_period',
            'No posts were published in this period.'
          )}
        </div>
      )}
    </div>
  );
};
