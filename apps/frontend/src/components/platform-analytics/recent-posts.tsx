'use client';

import { FC, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import dayjs from 'dayjs';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { expandPostsList } from '@gitroom/helpers/utils/posts.list.minify';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { AnalyticsDataItem } from '@gitroom/frontend/components/platform-analytics/render.analytics';
import {
  PostRowsSkeleton,
  SkeletonBlock,
} from '@gitroom/frontend/components/platform-analytics/analytics.skeletons';

interface RecentPost {
  id: string;
  content: string;
  publishDate: string;
  releaseURL?: string;
  releaseId?: string;
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

/* Same total math as the Summary tiles — sum of the day totals, means for
   `average` metrics. */
const metricTotal = (item: AnalyticsDataItem) => {
  const value =
    (item?.data?.reduce(
      (acc: number, curr: { total: number }) => acc + (Number(curr.total) || 0),
      0
    ) || 0) / (item.average ? item.data.length || 1 : 1);
  if (item.average) {
    return value.toFixed(2) + '%';
  }
  return new Intl.NumberFormat().format(Math.round(value));
};

/** Per-post stat chips, backed by GET /analytics/post/:postId?date=<days>
    (providers' postAnalytics — real per-post metrics, Redis-cached server
    side). Posts without a releaseId never hit the endpoint. */
const PostStats: FC<{ post: RecentPost; date: number }> = ({ post, date }) => {
  const fetch = useFetch();
  const t = useT();

  const hasRelease = !!post.releaseId && post.releaseId !== 'missing';

  const load = useCallback(async () => {
    return (await fetch(`/analytics/post/${post.id}?date=${date}`)).json();
  }, [post.id, date]);

  const { data, isLoading } = useSWR<
    AnalyticsDataItem[] | { missing: true }
  >(hasRelease ? `/analytics-post-${post.id}-${date}` : null, load, SWR_OPTS);

  if (!hasRelease) {
    return (
      <span className="text-[12px] text-newTextColor/60">
        {t('no_stats_for_this_post', 'No stats for this post')}
      </span>
    );
  }

  if (isLoading) {
    return (
      <div className="flex gap-[8px]">
        <SkeletonBlock className="h-[16px] w-[72px]" />
        <SkeletonBlock className="h-[16px] w-[72px]" />
        <SkeletonBlock className="h-[16px] w-[72px]" />
      </div>
    );
  }

  const items = Array.isArray(data) ? data : [];

  if (!items.length) {
    return (
      <span className="text-[12px] text-newTextColor/60">
        {t('no_stats_for_this_post', 'No stats for this post')}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-x-[14px] gap-y-[4px]">
      {items.map((item) => (
        <span
          key={`${post.id}-${item.label}`}
          className="text-[12px] text-newTextColor/60 whitespace-nowrap"
        >
          <span className="text-[13px] font-[600] text-newTextColor">
            {metricTotal(item)}
          </span>{' '}
          {item.label}
        </span>
      ))}
    </div>
  );
};

/** "Recent posts" section: the channel's latest published posts inside the
    selected range (from GET /posts/list?state=published — publishDate desc),
    each with its real per-post stats and the releaseURL as an external link.
    Renders nothing while there are no published posts at all; shows a quiet
    inline empty line when the range just excludes them. */
export const RecentPostsSection: FC<{
  integration: { id: string };
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

  const posts = useMemo(() => {
    const since = dayjs().subtract(date, 'day');
    return (data || [])
      .filter((post) => dayjs(post.publishDate).isAfter(since))
      .slice(0, 5);
  }, [data, date]);

  // No published posts on this channel at all — the Summary empty/refresh
  // states already carry the page, so add no second empty hero.
  if (!isLoading && !(data || []).length) {
    return null;
  }

  return (
    <div className="bg-newTableHeader rounded-[12px] p-[8px] flex flex-col gap-[12px]">
      <div className="flex flex-col gap-[2px] px-[8px] pt-[8px]">
        <div className="text-[16px] font-[600]">
          {t('recent_posts', 'Recent posts')}
        </div>
        <div className="text-[14px] text-newTextColor/60">{subtitle}</div>
      </div>
      {isLoading ? (
        <PostRowsSkeleton />
      ) : posts.length ? (
        <div className="bg-newBgColorInner border border-newTableBorder rounded-[8px]">
          {posts.map((post, index) => {
            const url = post.releaseURL?.split(',')[0];
            return (
              <div
                key={post.id}
                className={
                  index === posts.length - 1
                    ? 'flex items-start gap-[12px] px-[16px] py-[12px]'
                    : 'flex items-start gap-[12px] px-[16px] py-[12px] border-b border-newTableBorder'
                }
              >
                <div className="flex-1 min-w-0 flex flex-col gap-[6px]">
                  <div className="text-[12px] text-newTextColor/60">
                    {dayjs(post.publishDate).format('MMM D, YYYY')}
                  </div>
                  <div className="text-[14px] text-newTextColor line-clamp-2 break-words">
                    {stripHtmlValidation('none', post.content || '', false)}
                  </div>
                  <PostStats post={post} date={date} />
                </div>
                {!!url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={t('view_post', 'View post')}
                    className="shrink-0 w-[28px] h-[28px] rounded-[6px] flex items-center justify-center text-newTextColor/60 hover:text-newTextColor hover:bg-boxHover transition-colors duration-150"
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
                      <path d="M15 3h6v6" />
                      <path d="M10 14 21 3" />
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    </svg>
                  </a>
                )}
              </div>
            );
          })}
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
