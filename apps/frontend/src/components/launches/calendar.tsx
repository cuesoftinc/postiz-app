'use client';

import React, {
  FC,
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CalendarContext,
  Integrations,
  useCalendar,
} from '@gitroom/frontend/components/launches/calendar.context';
import dayjs from 'dayjs';
import useSWR from 'swr';
import 'dayjs/locale/en';
import 'dayjs/locale/he';
import 'dayjs/locale/ru';
import 'dayjs/locale/zh';
import 'dayjs/locale/fr';
import 'dayjs/locale/es';
import 'dayjs/locale/pt';
import 'dayjs/locale/de';
import 'dayjs/locale/it';
import 'dayjs/locale/ja';
import 'dayjs/locale/ko';
import 'dayjs/locale/ar';
import 'dayjs/locale/tr';
import 'dayjs/locale/vi';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { ExistingDataContextProvider } from '@gitroom/frontend/components/launches/helpers/use.existing.data';
import { useDrag, useDrop } from 'react-dnd';
import { Integration, Post, State, Tags } from '@prisma/client';
import { useAddProvider } from '@gitroom/frontend/components/launches/add.provider.component';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { groupBy, random, sortBy } from 'lodash';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { extend } from 'dayjs';
import { isUSCitizen } from './helpers/isuscitizen.utils';
import { useInterval } from '@mantine/hooks';
import { StatisticsModal } from '@gitroom/frontend/components/launches/statistics';
import { MissingReleaseModal } from '@gitroom/frontend/components/launches/missing-release.modal';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import i18next from 'i18next';
import { AddEditModal } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import { CreationMethodBadge } from '@gitroom/frontend/components/launches/creation.method.badge';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import copy from 'copy-to-clipboard';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { getCookie } from 'react-use-cookie';
import { ChannelAvatar } from '@gitroom/frontend/components/new-layout/channel-avatar';
import { Button } from '@gitroom/react/form/button';
import { ModalBody } from '@gitroom/frontend/components/cuesoft/modal/modal-body';
import { CommentComponent } from '@gitroom/frontend/components/launches/comments/comment.component';

// Extend dayjs with necessary plugins
extend(isSameOrAfter);
extend(isSameOrBefore);
extend(localizedFormat);

// Initialize language
const updateDayjsLocale = () => {
  const currentLanguage = i18next.resolvedLanguage || 'en';
  dayjs.locale(currentLanguage);
};

// Set dayjs locale whenever i18next language changes
i18next.on('languageChanged', () => {
  updateDayjsLocale();
});

// Initial setup
updateDayjsLocale();

// Buffer hour-rail label: 'h A' with no minutes ('12 AM', '2 PM')
const formatHourLabel = (hour: number) =>
  `${((hour + 11) % 12) + 1} ${hour >= 12 ? 'PM' : 'AM'}`;

// Buffer phone calendar swaps month/week for a rolling 3-day hour grid; the
// same breakpoint global.scss uses for its phone rules (max-width: 767px).
const useIsPhone = () => {
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isPhone;
};

// ---------------------------------------------------------------------------
// Display timezone — RENDER ONLY. When the calendar context carries a
// displayTimezone (or the app's timezone setting is explicitly set), displayed
// times are formatted in that zone via dayjs.tz. When nothing is set, the
// exact pre-existing format chains run so default rendering is unchanged.
// Scheduling, drag/drop and date-mutation math never go through these helpers.
// ---------------------------------------------------------------------------
// The value is cookie/localStorage-backed, so validate it (cached) before any
// .tz() call — a corrupt identifier must never crash a view.
const timezoneValidity = new Map<string, boolean>();
const toValidTimezone = (tz: string | null | undefined): string | undefined => {
  if (!tz) {
    return undefined;
  }
  let valid = timezoneValidity.get(tz);
  if (valid === undefined) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      valid = true;
    } catch {
      valid = false;
    }
    timezoneValidity.set(tz, valid);
  }
  return valid ? tz : undefined;
};

const useDisplayTimezone = (): string | undefined => {
  const calendar = useCalendar() as ReturnType<typeof useCalendar> & {
    displayTimezone?: string | null;
  };
  return (
    toValidTimezone(calendar.displayTimezone) ||
    (typeof window === 'undefined'
      ? undefined
      : toValidTimezone(localStorage.getItem('timezone')))
  );
};

// Format a UTC-based post date for display: in the display timezone when set,
// otherwise via the exact legacy chain (plain parse + .local()).
const formatPostTime = (
  value: string | Date,
  displayTimezone: string | undefined,
  format: string
) => {
  if (displayTimezone) {
    try {
      return dayjs.utc(value).tz(displayTimezone).format(format);
    } catch {
      // invalid timezone identifier — fall back to legacy rendering
    }
  }
  return newDayjs(value).local().format(format);
};

// The post's media field ("image" on the Post model) is a JSON string of
// uploaded items ({ name, path, ... }). Tolerate raw strings, arrays, single
// objects and broken payloads — a bad value must never break the card.
// Prefers the first IMAGE (a TikTok post's cover, not its mp4); a video-only
// post (story reshares) falls back to its first video so the card gets the
// same thumbnail anatomy as every other card instead of a special layout.
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
    // broken media JSON — render the card without a thumbnail
  }
  return firstVideo ? { url: firstVideo, isVideo: true } : undefined;
};

export const hours = Array.from(
  {
    length: 24,
  },
  (_, i) => i
);

// Shared hook for post actions (edit, delete, statistics)
const usePostActions = (onMutate?: () => void) => {
  const t = useT();
  const fetch = useFetch();
  const modal = useModals();
  const toaster = useToaster();
  const { integrations, reloadCalendarView } = useCalendar();

  const mutate = useCallback(() => {
    reloadCalendarView();
    onMutate?.();
  }, [reloadCalendarView, onMutate]);

  const editPost = useCallback(
    (loadPost: any, isDuplicate?: boolean) => async () => {
      const post = {
        ...loadPost,
        publishDate: loadPost.actualDate || loadPost.publishDate,
      };

      const data = await (await fetch(`/posts/group/${post.group}`)).json();
      const date = !isDuplicate
        ? null
        : (await (await fetch('/posts/find-slot')).json()).date;
      const publishDate = dayjs
        .utc(date || data.posts[0].publishDate)
        .local();
      const ExistingData = !isDuplicate
        ? ExistingDataContextProvider
        : Fragment;
      modal.openModal({
        id: 'add-edit-modal',
        closeOnClickOutside: false,
        removeLayout: true,
        closeOnEscape: false,
        withCloseButton: false,
        askClose: true,
        fullScreen: true,
        classNames: {
          modal: 'w-[100%] max-w-[1400px] text-newTextColor',
        },
        children: (
          <ExistingData value={data}>
            <AddEditModal
              {...(isDuplicate
                ? {
                    onlyValues: data.posts.map(
                      ({ image, settings, content }: any) => ({
                        image,
                        settings,
                        content,
                      })
                    ),
                  }
                : {})}
              allIntegrations={integrations.map((p) => ({ ...p }))}
              reopenModal={editPost(post)}
              mutate={mutate}
              integrations={
                isDuplicate
                  ? integrations
                  : integrations
                      .slice(0)
                      .filter((f) => f.id === data.integration)
                      .map((p) => ({
                        ...p,
                        picture: data.integrationPicture,
                      }))
              }
              date={publishDate}
            />
          </ExistingData>
        ),
        size: '80%',
        title: ``,
      });
    },
    [integrations, fetch, modal, mutate]
  );

  const copyDebugJson = useCallback(
    (post: any) => () => {
      modal.openModal({
        title: t('copy_debug_json', 'Copy Debug JSON'),
        closeOnClickOutside: true,
        closeOnEscape: true,
        withCloseButton: true,
        classNames: {
          modal: 'w-[100%] max-w-[500px]',
        },
        children: <DebugJsonModal post={post} />,
      });
    },
    [modal, t]
  );

  const deletePost = useCallback(
    (post: any) => async () => {
      if (
        !(await deleteDialog(
          t(
            'are_you_sure_you_want_to_delete_post',
            'Are you sure you want to delete post?'
          )
        ))
      ) {
        return;
      }

      await fetch(`/posts/${post.group}`, {
        method: 'DELETE',
      });

      toaster.show(
        t('post_deleted_successfully', 'Post deleted successfully'),
        'success'
      );

      mutate();
    },
    [toaster, t, fetch, mutate]
  );

  const openStatistics = useCallback(
    (id: string) => () => {
      modal.openModal({
        title: t('statistics', 'Statistics'),
        closeOnClickOutside: true,
        closeOnEscape: true,
        withCloseButton: true,
        classNames: {
          modal: 'w-[100%] max-w-[1400px]',
        },
        children: <StatisticsModal postId={id} />,
        size: '80%',
      });
    },
    [modal, t]
  );

  const openMissingRelease = useCallback(
    (id: string) => () => {
      modal.openModal({
        title: t('connect_post', 'Connect Post'),
        closeOnClickOutside: true,
        closeOnEscape: true,
        withCloseButton: true,
        classNames: {
          modal: 'w-[100%] max-w-[800px]',
        },
        children: (
          <MissingReleaseModal postId={id} onSuccess={mutate} />
        ),
        size: '60%',
      });
    },
    [modal, t, mutate]
  );

  return { editPost, deletePost, copyDebugJson, openStatistics, openMissingRelease };
};

export const DayView = () => {
  const calendar = useCalendar();
  const { integrations, posts, startDate, loading } = calendar;
  const t = useT();
  const displayTimezone = useDisplayTimezone();

  // Set dayjs locale based on current language
  const currentLanguage = i18next.resolvedLanguage || 'en';
  dayjs.locale(currentLanguage);

  const currentDay = dayjs.utc(startDate);

  const options = useMemo(() => {
    const createdPosts = posts.map((post) => ({
      integration: [integrations.find((i) => i.id === post.integration.id)!],
      image: post?.integration?.picture || '',
      identifier: post?.integration?.providerIdentifier || '',
      id: post?.integration?.id || '',
      name: post?.integration?.name || '',
      time: dayjs
        .utc(post.publishDate)
        .diff(dayjs.utc(post.publishDate).startOf('day'), 'minute'),
    }));
    return sortBy(
      Object.values(
        groupBy(
          [
            ...createdPosts,
            ...integrations.flatMap((p) =>
              p.time.flatMap((t) => ({
                integration: p,
                identifier: p?.identifier,
                name: p?.name,
                id: p?.id,
                image: p?.picture,
                time: t?.time,
              }))
            ),
          ],
          (p: any) => p.time
        )
      ),
      (p) => p[0].time
    );
  }, [integrations, posts]);

  return (
    <div className="flex flex-col gap-[10px] flex-1 relative">
      <div className="absolute start-0 top-0 w-full h-full flex flex-col overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
        {options.map((option) => {
          // options mixes real posts' times with every channel's PREFERRED
          // posting slots. Future empty slots invite scheduling (grayed
          // avatar cluster); a PAST empty slot has nothing to say and used
          // to render a bare band under its time label (looked like a
          // dropped card, user report + pixel critic x3). Skip it.
          const hasPost = posts.some(
            (p) =>
              dayjs
                .utc(p.publishDate)
                .diff(dayjs.utc(p.publishDate).startOf('day'), 'minute') ===
              option[0].time
          );
          const slotPast = currentDay
            .startOf('day')
            .add(option[0].time, 'minute')
            .isBefore(newDayjs().utc());
          if (!hasPost && slotPast) return null;
          return (
          // shrink-0 on BOTH row kinds: this column is a definite-height
          // (h-full) flex column with overflow-auto, so its items compress
          // before it scrolls; the explicit min-h floors below (21px/60px)
          // override min-height:auto and let every slot squeeze to the
          // floor, painting card/avatar content over the rows that follow.
          // shrink-0 keeps each row at natural height and the column scrolls.
          <Fragment key={option[0].time}>
            <div className="shrink-0 text-center text-[14px] min-h-[21px]">
              {/* display-only: the queue gutter label; the slot's drop-target
                  date below keeps the exact legacy chain */}
              {(displayTimezone
                ? newDayjs()
                    .utc()
                    .startOf('day')
                    .add(option[0].time, 'minute')
                    .tz(displayTimezone)
                : newDayjs()
                    .utc()
                    .startOf('day')
                    .add(option[0].time, 'minute')
                    .local()
              ).format(isUSCitizen() ? 'h:mm A' : 'LT')}
            </div>
            <div
              key={option[0].time}
              className="shrink-0 min-h-[60px] rounded-[10px] flex justify-center items-center gap-[10px] mb-[20px]"
            >
              <CalendarContext.Provider
                value={{
                  ...calendar,
                  integrations: option.flatMap((p) => p.integration),
                }}
              >
                <CalendarColumn
                  getDate={currentDay
                    .startOf('day')
                    .add(option[0].time, 'minute')
                    .local()}
                />
              </CalendarContext.Provider>
            </div>
          </Fragment>
          );
        })}
      </div>
      {/* Same guarantee as the week grid: a day with ZERO posts shows a
          lightweight centered notice instead of reading as broken. The queue
          slots underneath stay clickable (pointer-events-none). */}
      {!loading && posts.length === 0 && (
        <div className="absolute inset-0 z-[10] flex items-center justify-center pointer-events-none">
          <div className="text-[14px] text-newTextColor/60">
            {t('nothing_scheduled_day', 'Nothing scheduled this day')}
          </div>
        </div>
      )}
    </div>
  );
};
export const WeekView = () => {
  const { startDate, endDate, posts, loading } = useCalendar();
  const t = useT();
  const isPhone = useIsPhone();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Every day of the fetched week range (the phone rolling 3-day view
  // slices its window out of this below).
  const localizedDays = useMemo(() => {
    const currentLanguage = i18next.resolvedLanguage || 'en';
    dayjs.locale(currentLanguage);

    const days = [];
    const rangeStart = newDayjs(startDate).startOf('day');
    const rangeEnd = newDayjs(endDate).startOf('day');
    const total = Math.max(1, rangeEnd.diff(rangeStart, 'day') + 1);
    for (let i = 0; i < total; i++) {
      days.push({ date: rangeStart.add(i, 'day') });
    }
    return days;
  }, [i18next.resolvedLanguage, startDate, endDate]);

  // Buffer phone: the Week option renders either a rolling THREE-day hour
  // grid starting today (default) or the full 7-day week — the phone
  // date-picker sheet in filters.tsx writes the choice to the
  // 'phone-week-span' cookie ('3' | '7'). Read fresh each render: the
  // sheet's setFilters always publishes a new context object, so a cookie
  // flip re-renders this view and the memo recomputes. Sliced client-side
  // from the already-fetched range (never a new fetch). When today is
  // outside the range, the first days of the range show.
  const phoneWeekSpan =
    typeof document === 'undefined'
      ? '3'
      : getCookie('phone-week-span') || '3';
  // Buffer's phone 7-day week does NOT squeeze seven columns into 390: it
  // keeps 3-per-screen day columns (same exact-thirds width as the 3-day
  // span, sized in gridTemplateColumns below) and scrolls HORIZONTALLY
  // inside the grid. The sideways overflow lives on the existing
  // overflow-auto scroll container below — never the page — so
  // position:fixed overlays stay safe. The 3-day span and desktop keep the
  // exact fit-to-width behavior.
  const sevenSpan = isPhone && phoneWeekSpan === '7';
  // ONE today for the whole view — the 3-day slice anchor, the header
  // underline and the day-cell wash all derive from this key, so they can
  // never disagree. Compare by formatted date — isSame(_, 'day') on
  // tz-aware instances truncates in the machine-local zone (it let the
  // 3-day window slip to yesterday, and would let the wash/underline land
  // on a different column when the org display timezone differs from the
  // device zone).
  const todayKey = newDayjs().format('YYYY-MM-DD');
  const visibleDays = useMemo(() => {
    if (!isPhone || phoneWeekSpan === '7') {
      return localizedDays.slice(0, 7);
    }
    // Buffer anchors today as the FIRST column.
    const idx = localizedDays.findIndex(
      (d) => d.date.format('YYYY-MM-DD') === todayKey
    );
    const start =
      idx === -1 ? 0 : Math.max(0, Math.min(idx, localizedDays.length - 3));
    return localizedDays.slice(start, start + 3);
  }, [localizedDays, isPhone, phoneWeekSpan, todayKey]);

  // Buffer opens the hour grid scrolled to "now" (one row of context above).
  // Guard: only from the untouched top position — the force-dynamic page
  // remounts seconds after navigation, and re-jumping a grid the user already
  // scrolled reads as glitching.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const now = newDayjs();
    const rangeStart = newDayjs(startDate).startOf('day');
    const rangeEnd = newDayjs(endDate).endOf('day');
    if (now.isBefore(rangeStart) || now.isAfter(rangeEnd)) {
      return;
    }
    // The grid can mount before its flex ancestors have resolved a height —
    // against a 0/short scrollport the scrollTop assignment clamps back to 0
    // and the view "opens at midnight". Retry across frames (~2s cap) until
    // the container can actually scroll; bail the moment the user scrolls.
    let raf = 0;
    let tries = 0;
    const jump = () => {
      if (el.scrollTop !== 0) {
        return; // user already scrolled — never re-jump under their thumb
      }
      if (el.clientHeight > 0 && el.scrollHeight > el.clientHeight) {
        el.scrollTop = Math.max(
          0,
          (newDayjs().hour() - 1) * (isPhone ? 80 : 106)
        );
        return;
      }
      if (tries++ < 120) {
        raf = requestAnimationFrame(jump);
      }
    };
    jump();
    return () => cancelAnimationFrame(raf);
  }, [startDate, endDate, isPhone]);

  return (
    <div className="flex flex-col text-newTextColor flex-1">
      <div className="flex-1 relative">
        <div
          ref={scrollRef}
          className={clsx(
            'grid gap-[1px] bg-newGridLine border border-newGridLine rounded-[12px] absolute h-full start-0 top-0 w-full',
            // Buffer's phone grid shows NO scrollbar chrome: the `scrollbar`
            // utilities force classic 16px webkit bars that stole a
            // column-wide strip from the scrollport (read as a headerless
            // 4th-column sliver) and drew a thumb across the bottom chips —
            // phone hides both bars and pans like iOS; desktop keeps the
            // styled bars.
            isPhone
              ? 'scrollbar-none'
              : 'scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor',
            // 3-day divides the window exactly — any sub-pixel spill must
            // never draw a sideways scrollbar / 4th-column sliver
            isPhone && !sevenSpan
              ? 'overflow-y-auto overflow-x-hidden'
              : 'overflow-auto'
          )}
          style={{
            // phone: the 48px gutter + THREE day columns + their 3 column
            // gaps always fill the viewport width EXACTLY — Buffer's phone
            // reference fits 3 full columns with no partial column peeking.
            // The 3-day span therefore never overflows sideways; the 7-span
            // keeps the same per-column width and pans horizontally through
            // the remaining days (scrollbars hidden above). Desktop stays
            // minmax(0,1fr) fit-to-width.
            gridTemplateColumns: isPhone
              ? `48px repeat(${visibleDays.length}, calc((100% - 48px - 3px) / 3))`
              : `repeat(${visibleDays.length}, minmax(0, 1fr))`,
          }}
        >
          {isPhone && (
            // 7-span: the corner spacer pins on BOTH axes (sticky top+start)
            // and sits above the day headers (sticky-chrome band: headers 50,
            // spacer 52) so they slide under it during sideways scroll
            <div
              className={clsx(
                'bg-newBgColorInner h-[36px] sticky top-0 border-b border-newGridLine z-[52]',
                sevenSpan && 'start-0'
              )}
            />
          )}
          {visibleDays.map((day) => {
            const isToday = day.date.format('YYYY-MM-DD') === todayKey;
            // Buffer (re-verified live): fully past DAY columns carry the
            // warm wash (header and cells) while today and future columns
            // stay white on EVERY breakpoint. Date granularity only:
            // today's elapsed hours never wash. The old phone today-column
            // gray is gone: it collided with the past wash (the whole 3-day
            // window read beige); the green underline marks today alone.
            const isPast = day.date.format('YYYY-MM-DD') < todayKey;
            return (
              <div
                key={day.date.format('YYYY-MM-DD')}
                className={clsx(
                  'text-center flex justify-center items-center gap-[8px] h-[36px] sticky top-0 z-[50] text-[14px] border-b border-newGridLine',
                  isPast
                    ? 'repeated-strip bg-newTableHeader'
                    : 'bg-newBgColorInner',
                  isToday
                    ? 'font-[500] text-newTableTextFocused border-b-[2px] border-newTableTextFocused'
                    : 'text-newTextColor'
                )}
              >
                <span>{day.date.format(isPhone ? 'ddd' : 'dddd')}</span>
                <span>{day.date.format('D')}</span>
              </div>
            );
          })}
          {hours.map((hour) => (
            <Fragment key={hour}>
              {isPhone && (
                // 7-span: the 48px time gutter pins to the start edge so the
                // hour labels keep working while the days scroll sideways —
                // under the z-50 sticky day headers, over the day cells
                <div
                  className={clsx(
                    'bg-newBgColorInner',
                    sevenSpan ? 'sticky start-0 z-[48]' : 'relative'
                  )}
                >
                  {/* hour 0 skipped: half-translated up, its label clipped
                      mid-glyph against the sticky header border */}
                  {hour % 2 === 0 && hour !== 0 && (
                    // Buffer masks the grid line behind the label with the
                    // cell background
                    <div className="absolute end-[6px] top-0 -translate-y-1/2 z-[10] text-[12px] font-[500] text-newTableText pointer-events-none bg-newBgColorInner px-[4px] leading-[16px] rounded-[3px]">
                      {formatHourLabel(hour)}
                    </div>
                  )}
                </div>
              )}
              {visibleDays.map((day, indexDay) => (
                // NO min-height on the grid item — Chrome substitutes it for
                // the content contribution and pins the row, so stacked cards
                // paint over the rows below (same bug as the month grid);
                // the hour floor lives on the day view inside
                <div
                  key={`${day.date.format('YYYY-MM-DD')}-${hour}`}
                  className={clsx(
                    'relative flex flex-col',
                    // Buffer (re-verified live): past DAY columns wash at
                    // date level, matching the CalendarColumn inside
                    day.date.format('YYYY-MM-DD') < todayKey
                      ? 'repeated-strip bg-newTableHeader'
                      : 'bg-newBgColorInner'
                  )}
                >
                  {!isPhone && indexDay === 0 && hour % 2 === 0 && (
                    // same line-mask treatment as the phone rail labels
                    <div className="absolute start-[10px] top-0 -translate-y-1/2 z-[10] text-[12px] font-[500] text-newTableText pointer-events-none bg-newBgColorInner px-[4px] leading-[16px] rounded-[3px]">
                      {formatHourLabel(hour)}
                    </div>
                  )}
                  <CalendarColumn
                    getDate={day.date.hour(hour).startOf('hour')}
                  />
                </div>
              ))}
            </Fragment>
          ))}
        </div>
        {/* A legitimately empty week/3-day range must never read as a
            rendering failure: when the fetched range holds ZERO posts (and
            the fetch is done), a lightweight centered notice floats over the
            hour grid. pointer-events-none keeps the hour cells' add-post
            targets clickable; z-[10] keeps it under the sticky day headers
            (z-50) but over the cell layer. */}
        {!loading && posts.length === 0 && (
          <div className="absolute inset-0 z-[10] flex items-center justify-center pointer-events-none">
            <div className="text-[14px] text-newTextColor/60">
              {t('nothing_scheduled_week', 'Nothing scheduled this week')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export const MonthView = () => {
  const { startDate } = useCalendar();

  // Use dayjs to get localized day names — Buffer is Sunday-first
  const localizedDays = useMemo(() => {
    const currentLanguage = i18next.resolvedLanguage || 'en';
    dayjs.locale(currentLanguage);

    const days = [];
    // Sunday (0) through Saturday (6); short names for the ~51px phone
    // columns (same 'ddd' the phone week header uses)
    for (let i = 0; i <= 6; i++) {
      const day = newDayjs().day(i);
      days.push({ full: day.format('dddd'), short: day.format('ddd') });
    }
    return days;
  }, [i18next.resolvedLanguage]);

  const calendarDays = useMemo(() => {
    // The fetch range is either the exact month or the grid-extended
    // Sunday→Saturday range (calendar.context getDateRange); the middle of
    // either shape lands inside the displayed month.
    const monthAnchor = newDayjs(startDate).add(15, 'day');
    const currentMonth = monthAnchor.month();
    const currentYear = monthAnchor.year();

    const startOfMonth = newDayjs(new Date(currentYear, currentMonth, 1));

    // Days to show from the previous month — Sunday-first, so .day()
    // (0 = Sunday) is the offset directly
    const daysBeforeMonth = startOfMonth.day();

    // Get the start date (Sunday of the first week that includes this month)
    const calendarStartDate = startOfMonth.subtract(daysBeforeMonth, 'day');

    // Create an array to hold the calendar days (6 weeks * 7 days = 42 days max)
    const calendarDays = [];
    let currentDay = calendarStartDate;
    for (let i = 0; i < 42; i++) {
      let label = 'current-month';
      if (
        currentDay.month() !== currentMonth ||
        currentDay.year() !== currentYear
      ) {
        label = currentDay.isBefore(startOfMonth)
          ? 'previous-month'
          : 'next-month';
      }
      calendarDays.push({
        day: currentDay,
        label,
      });

      // Move to the next day
      currentDay = currentDay.add(1, 'day');
    }
    return calendarDays;
  }, [startDate]);

  // Buffer opens the month scrolled so today's week row sits at the top
  // (measured scrollTop 407 = two 205px rows + gaps behind the sticky
  // header). Only on mount, and only when the grid contains today.
  const gridRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = gridRef.current;
    if (!el || el.scrollTop !== 0 || !calendarDays.length) return;
    const idx = calendarDays.findIndex(({ day }) =>
      day.isSame(newDayjs(), 'day')
    );
    if (idx < 7) return; // today absent or already in the first row
    const row = Math.floor(idx / 7);
    const cell = el.children[7 + row * 7] as HTMLElement | undefined;
    if (cell) {
      // 37 = sticky weekday header (36px) + 1px grid gap
      el.scrollTop = Math.max(0, cell.offsetTop - 37);
    }
  }, [calendarDays]);

  return (
    <div className="flex flex-col text-newTextColor flex-1">
      <div className="flex-1 flex relative">
        {/* Buffer rounds the grid corners at 12px (border-separate table w/
            per-corner cell radii — measured 12px 0 0 on the first cell) */}
        <div
          ref={gridRef}
          // implicit rows stay `auto` — Chrome pins minmax(205px, auto)
          // tracks at the minimum and never grows them with content (verified
          // live); the 205px floor lives on each cell's min-h instead.
          // Columns are inline (same repeat(7, minmax(0,1fr)) the grid-cols-7
          // class emits) — global.scss pins `[class*="grid-cols-7"]` to
          // minmax(88px,1fr) on phone (7×88 = 616px sideways scroll), a
          // fallback from when phone month was coerced to the 3-day grid;
          // the month grid is real on phone now (Buffer) and must fit 390.
          className="grid grid-rows-[36px] gap-[1px] bg-newGridLine border border-newGridLine rounded-[12px] absolute start-0 top-0 overflow-auto w-full h-full scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor"
          style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}
        >
          {localizedDays.map((day) => (
            <div
              key={day.full}
              className="z-[50] p-2 bg-newBgColorInner flex justify-center items-center flex-col h-full sticky top-0 min-w-0 overflow-hidden border-b border-newGridLine"
            >
              <div className="text-[14px] font-[500] text-newTextColor/70">
                <span className="phone:hidden">{day.full}</span>
                <span className="hidden phone:inline">{day.short}</span>
              </div>
            </div>
          ))}
          {calendarDays.map((date, index) => (
            // items-stretch (not center) — when a day expands, the row track
            // grows and every cell in the row stretches with it (Buffer:
            // rows measured 205 -> 319 in flow); centering makes a taller
            // cell overflow both edges and float over adjacent rows
            // no min-height HERE: Chrome swaps a grid item's min-height in
            // for its content contribution, pinning the auto row at 205 even
            // when the day inside is taller — the floor lives on the day view
            <div
              key={index}
              className="flex flex-col min-w-0 bg-newBgColorInner"
            >
              <CalendarColumn
                getDate={newDayjs(date.day).endOf('day')}
                randomHour={true}
                monthLabel={date.label}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export const ListView = () => {
  const t = useT();
  const user = useUser();
  const modal = useModals();
  const fetch = useFetch();
  const { integrations, loading, listPosts, listState, reloadCalendarView } =
    useCalendar();
  // Approvals: schedule the whole feed behind one confirm (user-requested
  // "approve all"); each post goes through the same status route the
  // per-card Approve uses
  const approveAll = useCallback(async () => {
    if (
      !(
        await deleteDialog(
          t(
            'approve_all_description',
            `Approve all ${listPosts.length} posts? They will be scheduled at their planned times.`
          ),
          t('yes_approve_all', 'Yes, approve all!'),
          t('approve_all', 'Approve all')
        )
      )
    ) {
      return;
    }
    for (const post of listPosts) {
      await fetch(`/posts/${post.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'schedule' }),
      });
    }
    reloadCalendarView();
  }, [listPosts, fetch, reloadCalendarView, t]);
  const emptyMessage =
    listState === 'scheduled'
      ? t('no_upcoming_posts', 'No posts in your queue')
      : listState === 'draft'
      ? t('no_draft_posts', 'No draft posts')
      : listState === 'approvals'
      ? t('no_approval_posts', 'Nothing awaiting approval')
      : listState === 'published'
      ? t('no_published_posts', 'No sent posts')
      : t('no_posts', 'No posts');
  const emptySubline =
    listState === 'draft'
      ? t('drafts_appear_here', 'Drafts will appear here.')
      : listState === 'approvals'
      ? t(
          'approvals_appear_here',
          'When Ace drafts posts for you, they land here for your sign-off.'
        )
      : listState === 'published'
      ? t('sent_posts_appear_here', 'Posts you have sent will appear here.')
      : t('scheduled_posts_appear_here', 'Posts you schedule will appear here.');

  // Use shared post actions hook
  const { editPost, deletePost, copyDebugJson, openStatistics, openMissingRelease } = usePostActions();
  const displayTimezone = useDisplayTimezone();

  // Buffer §Queue: the Notes button on the time rail opens the comments
  // thread for the post's time slot (read/annotate only — the existing
  // comments component owns its own data). Buffer Notes geometry: a 446px
  // full-height RIGHT sheet, not a centered modal.
  const openComments = useCallback(
    (post: any) => () => {
      modal.openModal({
        title: '',
        closeOnClickOutside: true,
        closeOnEscape: true,
        withCloseButton: false,
        // fullScreen pins the shell to the viewport height (and drops the
        // overlay's bottom pad), size sets the 446px rail width, and the
        // shell classes square the corners and hug the end edge
        fullScreen: true,
        size: '446px',
        classNames: {
          modal: '!rounded-none !me-0 overflow-y-auto',
        },
        children: (
          <CommentComponent postId={post.id} date={dayjs.utc(post.publishDate)} />
        ),
      });
    },
    [modal]
  );

  // Group posts by date (display-only: which day header a card renders under;
  // projected into the display timezone so headers agree with the card times)
  const groupedPosts = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    listPosts.forEach((post) => {
      const dateKey = formatPostTime(
        post.publishDate,
        displayTimezone,
        'YYYY-MM-DD'
      );
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(post);
    });
    // Sent reads backwards in time: today first, then yesterday, matching
    // Buffer (verified in their UI — Sent runs Today, Yesterday, Monday…, and
    // newest-first inside each day too). The API already returns published
    // posts descending, so ascending headers here put the oldest day on top
    // with the newest posts inside it — the worst of both. Upcoming tabs stay
    // ascending: the next thing to go out belongs at the top.
    const newestFirst = listState === 'published';
    return Object.entries(groups).sort(([a], [b]) =>
      newestFirst ? b.localeCompare(a) : a.localeCompare(b)
    );
  }, [listPosts, displayTimezone, listState]);

  // "now", projected into the display timezone when set — only used to label
  // a group Today/Tomorrow; without a display timezone it is exactly newDayjs()
  const displayNow = displayTimezone
    ? newDayjs(dayjs().tz(displayTimezone).format('YYYY-MM-DD'))
    : newDayjs();

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <div className="text-newTextColor">{t('loading', 'Loading...')}</div>
      </div>
    );
  }

  if (listPosts.length === 0) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-[8px] py-[64px]">
        {/* Buffer empty pattern: doc icon in a 64px grey circle, bold heading,
            muted subline */}
        <div className="w-[64px] h-[64px] rounded-full bg-newTextColor/5 flex items-center justify-center text-newTextColor/60">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <path d="M10 9H8" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
          </svg>
        </div>
        {/* text-center: the subline wraps on phone and block-centering alone
            left-aligns the wrapped lines (user report, iPhone 16) */}
        <div className="text-[16px] font-[550] text-newTextColor text-center px-[24px]">
          {emptyMessage}
        </div>
        <div className="text-[14px] text-newTextColor/60 text-center px-[24px] max-w-[420px]">
          {emptySubline}
        </div>
      </div>
    );
  }

  // Buffer: the queue scrolls with the page — no nested scroll region
  return (
    // min-w-0: as a flex item this column's min-width:auto otherwise pins it
    // at content width (573px measured at 390) and the right side clips
    <div className="flex flex-col flex-1 min-w-0">
      {/* Buffer centers the queue block in the content pane (measured:
          date-header/time-rail 194px in, 699px cards, symmetric 195px right
          gap). The rail + card block rides one centered max-w-[800px]
          column; under 800px (phone) w-full keeps it full-width. */}
      <div className="mx-auto w-full max-w-[800px] flex flex-col">
      {listState === 'approvals' && listPosts.length > 0 && (
        <div className="flex justify-end mb-[8px]">
          <button
            type="button"
            onClick={approveAll}
            data-cs
            className="h-[32px] phone:h-[44px] px-[12px] rounded-[8px] bg-btnPrimary text-black flex items-center gap-[6px] text-[14px] font-[500] hover:opacity-90 transition-opacity duration-150"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 7 17l-5-5" />
              <path d="m22 10-7.5 7.5L13 16" />
            </svg>
            {t('approve_all', 'Approve all')} ({listPosts.length})
          </button>
        </div>
      )}
      {groupedPosts.map(([dateKey, datePosts]) => (
        <Fragment key={dateKey}>
          {/* Buffer §Queue two-tone header, measured 16px font-[550] on the
              whole line: weekday prefix full ink, date muted. Today/Tomorrow
              is pure presentation of the same date. */}
          <div className="text-start text-[16px] font-[550] mt-[32px] first:mt-[8px] mb-[16px] px-[10px]">
            <span className="text-newTextColor">
              {(newDayjs(dateKey).isSame(displayNow, 'day')
                ? t('today', 'Today')
                : newDayjs(dateKey).isSame(displayNow.add(1, 'day'), 'day')
                ? t('tomorrow', 'Tomorrow')
                : newDayjs(dateKey).format('dddd')) + ','}
            </span>{' '}
            <span className="text-newTextColor/60">
              {newDayjs(dateKey).format(isUSCitizen() ? 'MMMM D' : 'D MMMM')}
            </span>
          </div>
          <div className="cs-queue flex flex-col gap-[32px] mb-[16px] px-[10px]">
            {datePosts.map((post) => (
              // phone:relative anchors the comment bubble, which moves off
              // its desktop outside-gutter and into the card header (the
              // reserved column squeezed cards on a 402px screen)
              <div
                key={post.id}
                className="flex items-start gap-[12px] phone:relative"
              >
                {/* Buffer time rail OUTSIDE the card: time full-ink 14/500,
                    pin + 'Custom' muted below, and the Notes button riding
                    the same rail (Buffer time-row anatomy: time + 'Custom' +
                    Notes, left of the card) */}
                <div className="w-[100px] min-w-[100px] pt-[20px] flex flex-col gap-[2px] phone:w-[64px] phone:min-w-[64px]">
                  <div className="text-[14px] font-[500] text-newTextColor whitespace-nowrap text-start">
                    {formatPostTime(post.publishDate, displayTimezone, 'h:mm A')}
                  </div>
                  <div className="flex items-center gap-[4px] text-[12px] text-newTextColor/60">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 17v5" />
                      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
                    </svg>
                    {t('custom', 'Custom')}
                  </div>
                  {/* Notes trigger on the rail (kit 32px controls are r8);
                      phone overlays it INSIDE the card header, right of the
                      channel name — 40x40 there (tap floor; the glyph stays
                      16px), anchored by the row's phone:relative and cleared
                      by the header's phone:pe-[56px] */}
                  <button
                    type="button"
                    onClick={openComments(post)}
                    aria-label={t('comments', 'Comments')}
                    aria-haspopup="dialog"
                    className="mt-[6px] w-[32px] h-[32px] min-w-[32px] phone:w-[40px] phone:h-[40px] rounded-[8px] border border-newTableBorder bg-newBgColorInner flex items-center justify-center text-newTextColor transition-all duration-150 hover:bg-boxHover phone:absolute phone:top-[10px] phone:end-[10px] phone:z-[10] phone:mt-0"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 min-w-0 max-w-[700px]">
                  <CalendarItem
                    display="day"
                    isBeforeNow={false}
                    date={newDayjs(post.publishDate)}
                    state={post.state}
                    statistics={openStatistics(post.id)}
                    missingRelease={openMissingRelease(post.id)}
                    editPost={editPost(post, false)}
                    duplicatePost={editPost(post, true)}
                    copyDebugJson={
                      user?.isSuperAdmin ? copyDebugJson(post) : undefined
                    }
                    post={post}
                    integrations={integrations}
                    deletePost={deletePost(post)}
                  />
                </div>
              </div>
            ))}
          </div>
        </Fragment>
      ))}
      </div>
    </div>
  );
};

export const Calendar = () => {
  const calendar = useCalendar();
  const { display } = calendar;
  if (display === 'list') {
    return <ListView />;
  }
  if (display === 'day') {
    return <DayView />;
  }
  if (display === 'week') {
    return <WeekView />;
  }
  // Buffer phone: Month is a REAL 7-column grid (mini-tile chips) — the
  // rolling 3-day hour grid is what the Week option renders at phone width
  // (WeekView slices it itself). The view dropdown stays in the phone
  // toolbar, so display alone decides; no phone coercion here.
  return <MonthView />;
};
// Buffer 'N More' / 'Show less' chevron: quiet 16px stroke glyph, muted ink
const ExpandChevron: FC<{ up?: boolean }> = ({ up }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-newTextColor/60"
    aria-hidden="true"
  >
    <path d={up ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'} />
  </svg>
);

export const CalendarColumn: FC<{
  getDate: dayjs.Dayjs;
  randomHour?: boolean;
  /** month grid only: 'previous-month' | 'current-month' | 'next-month' */
  monthLabel?: string;
}> = memo((props) => {
  const t = useT();

  const { getDate, randomHour, monthLabel } = props;
  const [num, setNum] = useState(0);
  const user = useUser();
  const {
    integrations,
    posts,
    changeDate,
    display,
    reloadCalendarView,
    sets,
    signature,
    loading,
    startDate,
  } = useCalendar();
  const modal = useModals();
  const fetch = useFetch();

  // Use shared post actions hook
  const { editPost, deletePost, copyDebugJson, openStatistics, openMissingRelease } = usePostActions();
  const postList = useMemo(() => {
    return posts.filter((post) => {
      const pList = dayjs.utc(post.publishDate).local();
      const check =
        display === 'day'
          ? // instant compare at minute granularity, NOT formatted-string
            // equality. set.timezone.tsx patches `.local()` on the object
            // dayjs.utc() returns to `.tz(localStorage 'timezone')`, while
            // getDate arrives through a DERIVED chain
            // (utc(startDate).startOf('day').add(min).local()) whose
            // `.local()` is the machine-zone prototype method. With a
            // scheduling timezone set that differs from the machine zone the
            // two strings named the same instant on different wall clocks,
            // never matched, and every day-view slot rendered empty between
            // its time labels. isSame('minute') compares timestamps, which
            // no display zone can shift.
            pList.isSame(getDate, 'minute')
          : display === 'week'
          ? pList.isSameOrAfter(getDate.startOf('hour')) &&
            pList.isBefore(getDate.endOf('hour'))
          : pList.format('DD/MM/YYYY') === getDate.format('DD/MM/YYYY');
      return check;
    });
  }, [posts, display, getDate]);
  const [showAll, setShowAll] = useState(false);
  const showAllFunc = useCallback(() => {
    setShowAll(true);
  }, []);
  const showLessFunc = useCallback(() => {
    setShowAll(false);
  }, []);
  const list = useMemo(() => {
    if (showAll) {
      return postList;
    }
    return postList.slice(0, 3);
  }, [postList, showAll]);

  const isBeforeNow = useMemo(() => {
    const originalUtc = getDate.startOf('hour');
    return originalUtc
      .startOf('hour')
      .isBefore(newDayjs().startOf('hour').utc());
  }, [getDate, num]);

  const { start, stop } = useInterval(
    useCallback(() => {
      if (isBeforeNow) {
        return;
      }
      setNum(num + 1);
    }, [isBeforeNow]),
    random(120000, 150000)
  );

  useEffect(() => {
    start();
    return () => {
      stop();
    };
  }, []);
  const [{ canDrop }, drop] = useDrop(() => ({
    accept: 'post',
    drop: async (item: any) => {
      if (isBeforeNow) return;

      // Find the post to check its state
      const post = posts.find((p) => p.id === item.id);
      let action: 'schedule' | 'update' = 'schedule';

      // Check if post is already published or queued in the past
      if (
        post &&
        (post.state === 'PUBLISHED' ||
          (post.state === 'QUEUE' && dayjs().isAfter(dayjs.utc(post.publishDate))))
      ) {
        const whatToDo = await new Promise<'schedule' | 'update' | 'cancel'>(
          (resolve) => {
            modal.openModal({
              title: t('what_do_you_want_to_do', 'What do you want to do?'),
              children: (
                <div className="flex flex-col">
                  <div className="text-[20px] mb-[20px]">
                    {t(
                      'post_already_published_drag',
                      'This post was already published, what do you want to do?'
                    )}
                  </div>
                  <div className="flex w-full gap-[10px]">
                    <div className="flex-1 flex">
                      <Button
                        type="button"
                        className="flex-1"
                        onClick={() => {
                          modal.closeAll();
                          resolve('update');
                        }}
                      >
                        {t('just_update_post_details', 'Just update the post details')}
                      </Button>
                    </div>
                    <div className="flex-1 flex">
                      <Button
                        type="button"
                        className="flex-1"
                        onClick={() => {
                          modal.closeAll();
                          resolve('schedule');
                        }}
                      >
                        {t('reschedule_post', 'Reschedule the post')}
                      </Button>
                    </div>
                  </div>
                </div>
              ),
              onClose: () => resolve('cancel'),
            });
          }
        );

        if (whatToDo === 'cancel') {
          return;
        }
        action = whatToDo;
      }

      if (!item.interval) {
        changeDate(item.id, getDate);
      }
      const { status } = await fetch(`/posts/${item.id}/date`, {
        method: 'PUT',
        body: JSON.stringify({
          date: getDate.utc().format('YYYY-MM-DDTHH:mm:ss'),
          action,
        }),
      });
      if (status !== 500) {
        if (item.interval || action === 'schedule') {
          reloadCalendarView();
          return;
        }
        return;
      }
    },
    collect: (monitor) => ({
      canDrop: isBeforeNow ? false : !!monitor.canDrop() && !!monitor.isOver(),
    }),
  }), [posts]);

  const addModal = useCallback(async () => {
    const set: any = !sets.length
      ? undefined
      : await new Promise((resolve) => {
          modal.openModal({
            title: t('select_set', 'Select a Set'),
            closeOnClickOutside: true,
            askClose: false,
            closeOnEscape: true,
            withCloseButton: true,
            onClose: () => resolve('exit'),
            children: (
              <SetSelectionModal
                sets={sets}
                onSelect={(selectedSet) => {
                  resolve(selectedSet);
                  modal.closeAll();
                }}
                onContinueWithoutSet={() => {
                  resolve(undefined);
                  modal.closeAll();
                }}
              />
            ),
          });
        });

    if (set === 'exit') return;

    modal.openModal({
      id: 'add-edit-modal',
      closeOnClickOutside: false,
      removeLayout: true,
      closeOnEscape: false,
      withCloseButton: false,
      askClose: true,
      fullScreen: true,
      classNames: {
        modal: 'w-[100%] max-w-[1400px] text-newTextColor',
      },
      children: (
        <AddEditModal
          allIntegrations={integrations.map((p) => ({
            ...p,
          }))}
          integrations={integrations.slice(0).map((p) => ({
            ...p,
          }))}
          mutate={reloadCalendarView}
          {...(signature?.id && !set
            ? {
                onlyValues: [
                  {
                    content: '\n' + signature.content,
                  },
                ],
              }
            : {})}
          date={
            randomHour
              ? getDate.hour(Math.floor(Math.random() * 24))
              : getDate.format('YYYY-MM-DDTHH:mm:ss') ===
                newDayjs().startOf('hour').format('YYYY-MM-DDTHH:mm:ss')
              ? newDayjs().add(10, 'minute')
              : getDate
          }
          {...(set?.content ? { set: JSON.parse(set.content) } : {})}
          reopenModal={() => ({})}
        />
      ),
      size: '80%',
    });
  }, [integrations, getDate, sets, signature]);

  const addProvider = useAddProvider();
  // formatted-date comparison, same mechanism as WeekView's todayKey —
  // isSame(_, 'day') truncates in the machine-local zone and can disagree
  // with the column the 3-day slice anchored
  const isToday =
    getDate.format('YYYY-MM-DD') === newDayjs().format('YYYY-MM-DD');
  // Buffer past wash (re-verified live): FULLY past days only, at date
  // granularity; today (even its elapsed hours/slots) and future days stay
  // white, so this is never the hour-level isBeforeNow. Lexicographic
  // compare on the same formatted keys the week slice/underline use. The
  // day view keys on the VIEWED day (startDate) because its per-slot
  // getDate goes through .local() and can cross midnight at the day edges.
  const isPastDay =
    (display === 'day'
      ? newDayjs(startDate).format('YYYY-MM-DD')
      : getDate.format('YYYY-MM-DD')) < newDayjs().format('YYYY-MM-DD');
  const isOtherMonth = !!monthLabel && monthLabel !== 'current-month';
  return (
    <div
      className={clsx(
        'flex flex-col w-full relative group/cell',
        // month/week: `grow` (basis auto) — fills the cell when short AND
        // lets tall content grow the grid track (a % min-height cycles
        // against the track and pins it; a min-height on the grid item
        // itself gets substituted for its content contribution — both pin
        // the row). The row floors live HERE, inside the grid item.
        // phone month rows hug content: an 88px floor keeps empty weeks
        // modest (163px stretched every blank week to the busiest row's
        // height — August ran ~4.5 screens of dead space)
        display === 'month'
          ? 'grow min-h-[205px] phone:min-h-[88px]'
          : display === 'week'
          ? 'grow min-h-[105px] phone:min-h-[79px]'
          : 'min-h-full',
        isPastDay && 'repeated-strip',
        loading && 'animate-pulse',
        // Buffer tint model (re-verified live 2026-08-10): fully past DAYS
        // carry the warm wash in ALL views (month cells, week day columns
        // AND the day view) while today and future days stay flat white
        // (future weekends / other-month days included)
        display !== 'day' &&
          (isPastDay ? 'bg-newTableHeader' : 'bg-newBgColorInner'),
        // (no phone today-column wash here: it collided with the past-day
        // wash and painted the whole 3-day window beige; today stays white
        // like desktop, the green header underline marks it)
        // day view past treatment: same wash tokens; rounded like the live
        // slot cards so the tint stays inside the card silhouette
        display === 'day' && isPastDay && 'bg-newTableHeader rounded-[8px]',
        display === 'day' &&
          (isBeforeNow
            ? 'cursor-not-allowed'
            : 'border border-newTableBorder rounded-[8px]')
      )}
      ref={drop as any}
    >
      {display === 'month' && (
        // Buffer month cell (measured): number sits 12px from the top in a
        // 24px line box, 13px left inset, 4px gap to the first chip
        <div className="pt-[12px] px-[12px] h-[36px] text-[14px] font-[500] text-start flex items-center">
          {/* Buffer three-tone day numbers; today = filled circle (their green
              -> our lime; the global primary-surface rule paints black ink) */}
          <span
            className={clsx(
              isToday
                ? 'w-[24px] h-[24px] -ms-[4px] rounded-full bg-[#b7eb9d] text-[#292928] flex items-center justify-center'
                : isOtherMonth
                ? 'text-newTextColor/40'
                : isBeforeNow
                ? 'text-newTextColor/60'
                : 'text-newTextColor'
            )}
          >
            {getDate.date()}
          </span>
        </div>
      )}
      {display !== 'day' && !isBeforeNow && (
        // Buffer's add affordance: a small hairline '+' square pinned to the
        // cell's top-right, visible only while the cell is hovered
        <div
          onClick={integrations.length ? addModal : addProvider}
          className={clsx(
            // Buffer week cells (user-verified): + rides TOP-right while the
            // cell is empty, BOTTOM-right once the cell has content; month
            // cells keep it top-right
            display === 'week' && postList.length > 0
              ? 'bottom-[6px]'
              : 'top-[6px]',
            'phone:hidden absolute end-[6px] z-[30] w-[24px] h-[24px] rounded-[6px] border border-newTableBorder bg-newBgColorInner flex items-center justify-center cursor-pointer opacity-0 pointer-events-none group-hover/cell:opacity-100 group-hover/cell:pointer-events-auto hover:bg-boxHover transition-all duration-150'
          )}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            className="text-newTextColor/60"
            aria-hidden="true"
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </div>
      )}
      <div
        className={clsx(
          'relative flex flex-col flex-1 rounded-[8px]',
          display === 'day' && 'min-h-[70px]',
          canDrop && 'border border-forth'
        )}
      >
        <div
          className={clsx(
            // no scrollbar utilities here — they set overflow on the cell's
            // post list, which capped the cell at the 205px track and made
            // expanded content scroll internally; Buffer grows the row
            'flex-col text-[12px] pointer w-full flex',
            isBeforeNow ? 'flex-1' : 'cursor-pointer'
          )}
        >
          {loading && (
            <div className="h-full w-full p-[5px] animate-pulse absolute left-0 top-0 z-[40]">
              <div className="h-full w-full bg-newSettings rounded-[10px]" />
            </div>
          )}
          {list.map((post) => (
            // month: 6px + 2px = Buffer's measured 8px chip inset / 8px stack
            // gap; week: Buffer insets cards ~12px inside the day column
            <div
              key={post.id}
              className={clsx(
                'text-newTextColor relative flex flex-col justify-center items-center',
                display === 'week' ? 'py-[4px] px-[10px]' : 'py-[2px] px-[6px]'
              )}
            >
              <div className="relative w-full flex flex-col items-center p-[2px]">
                <CalendarItem
                  display={display as 'day' | 'week' | 'month'}
                  isBeforeNow={isBeforeNow}
                  date={getDate}
                  state={post.state}
                  statistics={openStatistics(post.id)}
                  missingRelease={openMissingRelease(post.id)}
                  editPost={editPost(post, false)}
                  duplicatePost={editPost(post, true)}
                  copyDebugJson={user?.isSuperAdmin ? copyDebugJson(post) : undefined}
                  post={post}
                  integrations={integrations}
                  deletePost={deletePost(post)}
                />
              </div>
            </div>
          ))}
          {!showAll && postList.length > 3 && (
            <>
              <div
                className={clsx(
                  'h-[24px] flex items-center gap-[8px] ps-[10px] py-[4px] text-start text-[14px] font-[500] text-newTextColor cursor-pointer',
                  // phone month has no expansion (Buffer) — the desktop
                  // expander hides; the display-only pill below replaces it
                  display === 'month' && 'phone:hidden'
                )}
                onClick={showAllFunc}
              >
                <ExpandChevron />
                <span>
                  {postList.length - 3} {t('show_more', 'More')}
                </span>
              </div>
              {display === 'month' && (
                // phone month overflow: bordered '+N' pill (Buffer anatomy)
                // that EXPANDS the cell on tap (user-requested; the cell
                // grows in flow like desktop)
                <div className="hidden phone:flex justify-center py-[2px]">
                  <span
                    data-cs
                    onClick={(e) => {
                      e.stopPropagation();
                      showAllFunc();
                    }}
                    className="h-[24px] px-[8px] flex items-center justify-center rounded-[8px] border border-newTableBorder bg-newBgColorInner text-[13px] font-[500] text-newTextColor cursor-pointer hover:bg-boxHover transition-colors duration-150"
                  >
                    +{postList.length - 3}
                  </span>
                </div>
              )}
            </>
          )}
          {showAll && postList.length > 3 && (
            <>
              <div
                className={clsx(
                  'h-[24px] flex items-center gap-[8px] ps-[10px] py-[4px] text-start text-[14px] font-[500] text-newTextColor cursor-pointer',
                  // phone month collapses via the compact pill below (the
                  // full label overflows a ~51px column)
                  display === 'month' && 'phone:hidden'
                )}
                onClick={showLessFunc}
              >
                <ExpandChevron up />
                <span>{t('show_less', 'Show less')}</span>
              </div>
              {display === 'month' && (
                <div className="hidden phone:flex justify-center py-[2px]">
                  <span
                    data-cs
                    onClick={(e) => {
                      e.stopPropagation();
                      showLessFunc();
                    }}
                    className="h-[24px] w-[32px] flex items-center justify-center rounded-[8px] border border-newTableBorder bg-newBgColorInner cursor-pointer hover:bg-boxHover transition-colors duration-150"
                  >
                    <ExpandChevron up />
                  </span>
                </div>
              )}
            </>
          )}
        </div>
        {!isBeforeNow && (
          <div
            className="pb-[2.5px] px-[5px] flex-1 flex"
            onClick={integrations.length ? addModal : addProvider}
          >
            <div
              className={clsx(
                // month: pure leftover-space click target (no minimum) so
                // dense cells sit at Buffer's uniform 205px row height
                display === ('month' as any)
                  ? 'flex-1 w-full'
                  : !postList.length
                  ? 'min-h-full w-full p-[5px]'
                  : 'min-h-[40px] w-full',
                'flex items-center justify-center cursor-pointer pb-[2.5px]'
              )}
            >
              {display !== 'day' && (
                // Buffer: no cell wash on hover — the visible affordance is
                // the small top-right '+' pinned on the cell (see below);
                // this strip stays as the invisible click target
                <div className="w-full h-full" />
              )}
              {display === 'day' && (
                <div
                  className={`w-full h-full rounded-[10px] py-[10px] flex-wrap hover:border hover:border-newTableBorder flex justify-center items-center gap-[20px] opacity-30 grayscale hover:grayscale-0 hover:opacity-100`}
                >
                  {integrations.map((selectedIntegrations) => (
                    <div
                      className="relative"
                      key={selectedIntegrations.identifier}
                    >
                      <div
                        className={clsx(
                          'relative w-[34px] h-[34px] rounded-[8px] flex justify-center items-center filter transition-all duration-500'
                        )}
                      >
                        <SafeImage
                          src={
                            selectedIntegrations.picture || '/no-picture.jpg'
                          }
                          className="rounded-[8px]"
                          alt={selectedIntegrations.identifier}
                          width={32}
                          height={32}
                        />
                        {selectedIntegrations.identifier === 'youtube' ? (
                          <img
                            src="/icons/platforms/youtube.svg"
                            className="absolute z-10 -bottom-[5px] -end-[5px]"
                            width={20}
                          />
                        ) : (
                          <SafeImage
                            src={`/icons/platforms/${selectedIntegrations.identifier}.png`}
                            className="rounded-[8px] absolute z-10 -bottom-[5px] -end-[5px] border border-newTableBorder"
                            alt={selectedIntegrations.identifier}
                            width={20}
                            height={20}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
// ---------------------------------------------------------------------------
// Buffer §Sent: per-card stats strip. Fed by GET /analytics/post/:postId
// ?date=30 — the exact fetch pattern of platform-analytics/recent-posts.tsx
// (providers' postAnalytics, Redis-cached server side; posts without a
// releaseId never hit the endpoint). Lazy per visible card: an
// IntersectionObserver arms the SWR key only once the card scrolls into
// view; 5-minute cache (dedupingInterval).
// ---------------------------------------------------------------------------
const SENT_STATS_SWR_OPTS = {
  refreshInterval: 0,
  refreshWhenHidden: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  revalidateIfStale: false,
  refreshWhenOffline: false,
  revalidateOnMount: true,
  dedupingInterval: 300000,
} as const;

// Same total math as the analytics Summary tiles / recent-posts chips (see
// metricTotal in platform-analytics/recent-posts.tsx): sum of the day
// totals, mean (as %) for `average` metrics.
const sentMetricTotal = (item: {
  average?: boolean;
  data: { total: number }[];
}) => {
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

const SentPostStats: FC<{
  post: { id: string; releaseId?: string | null };
}> = ({ post }) => {
  const fetch = useFetch();
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hasRelease = !!post.releaseId && post.releaseId !== 'missing';
  const load = useCallback(async () => {
    return (await fetch(`/analytics/post/${post.id}?date=30`)).json();
  }, [post.id]);
  // key matches recent-posts.tsx's PostStats at date=30 — one shared cache
  const { data } = useSWR(
    hasRelease && visible ? `/analytics-post-${post.id}-30` : null,
    load,
    SENT_STATS_SWR_OPTS
  );

  const items = Array.isArray(data) ? data : [];

  // the ref div always renders (the observer needs a target before data
  // exists); the divider + strip appear only once metrics are in
  return (
    <div ref={rootRef}>
      {items.length > 0 && (
        <>
          <div className="h-[1px] bg-newTableBorder" />
          {/* Buffer measured: metric label 14px ink + value, gap 16; the
              metric set is whatever the provider returns (Reactions/
              Comments/Impressions/Reach/Shares/Reposts…) */}
          <div className="flex flex-wrap items-center gap-x-[16px] gap-y-[4px] px-[16px] py-[8px]">
            {items.map((item: any) => (
              <span
                key={`${post.id}-${item.label}`}
                className="text-[14px] text-newTextColor whitespace-nowrap text-start"
              >
                <span className="font-[550]">{sentMetricTotal(item)}</span>{' '}
                {item.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const CalendarItem: FC<{
  date: dayjs.Dayjs;
  isBeforeNow: boolean;
  editPost: () => void;
  duplicatePost: () => void;
  copyDebugJson?: () => void;
  deletePost: () => void;
  statistics: () => void;
  missingRelease?: () => void;
  integrations: Integrations[];
  state: State;
  display: 'day' | 'week' | 'month';
  showTime?: boolean;
  post: Post & {
    integration: Integration;
    tags: {
      tag: Tags;
    }[];
  };
}> = memo((props) => {
  const t = useT();
  const {
    editPost,
    statistics,
    duplicatePost,
    copyDebugJson,
    post,
    date,
    isBeforeNow,
    state,
    display,
    deletePost,
    showTime,
    missingRelease,
  } = props;
  const { disableXAnalytics } = useVariables();
  const user = useUser();
  const fetch = useFetch();
  const {
    reloadCalendarView,
    listState,
    display: calendarDisplay,
  } = useCalendar();
  const displayTimezone = useDisplayTimezone();
  // First attached media of the post's field (backend selects it through the
  // minified payload): image preferred, video for video-only posts (story
  // reshares), undefined when absent/broken
  const mediaThumb = useMemo(() => getFirstMediaThumb(post.image), [post.image]);
  // Thumbnail load failure is React state, not an imperative DOM hide: the
  // old onError set display:none on the wrapper, which latched across
  // re-renders and left a caption-less card with NO body at all (the
  // avatar+label fallback below is gated on the thumbnail, so it must know
  // when the thumbnail dies).
  const [mediaFailed, setMediaFailed] = useState(false);
  useEffect(() => {
    setMediaFailed(false);
  }, [mediaThumb?.url]);
  const showMedia = !!mediaThumb && !mediaFailed;
  // Caption-less posts exist by design (Instagram/Facebook stories carry no
  // copy): the day card must never render an empty band. Strip once, and
  // when nothing is left name the post instead: platform + the composer's
  // post_type when the payload carries settings ('Instagram story'),
  // a generic 'post' otherwise.
  const contentText = useMemo(
    () =>
      stripHtmlValidation('none', post.content || '', false, true, false).trim(),
    [post.content]
  );
  const hasContent = contentText.length > 0;
  const postTypeLabel = useMemo(() => {
    const platform = (post.integration?.providerIdentifier || '').split('-')[0];
    const platformName = platform
      ? platform.charAt(0).toUpperCase() + platform.slice(1)
      : '';
    let type = 'post';
    try {
      const settings =
        typeof post.settings === 'string' && post.settings.trim()
          ? JSON.parse(post.settings)
          : undefined;
      if (typeof settings?.post_type === 'string' && settings.post_type) {
        type = settings.post_type;
      }
    } catch {
      // broken settings JSON - keep the generic noun
    }
    return `${platformName} ${type}`.trim();
  }, [post.settings, post.integration?.providerIdentifier]);
  const showCreationMethodBadge =
    user?.impersonate &&
    post.creationMethod &&
    post.creationMethod !== 'UNKNOWN';
  const preview = useCallback(() => {
    window.open(`/p/` + post.id + '?share=true', '_blank');
  }, [post]);
  // Buffer list cards clamp copy to ~3 lines and reveal a quiet lowercase
  // 'see more' only when the copy actually overflows the clamp
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (display !== 'day' || expanded) {
      return;
    }
    const el = contentRef.current;
    if (el) {
      setOverflowing(el.scrollHeight > el.clientHeight + 1);
    }
  }, [post.content, display, expanded]);
  // Buffer parity: the card actions live in a labeled dropdown behind one
  // kebab, not a row of bare icons. Same handlers, new surface.
  // Z scale (global.scss): the kebab menu is a page dropdown (band 100,
  // backdrop 99). It used to be `absolute` INSIDE the overflow-auto week/
  // month grids, which clipped it on edge/bottom cells - it is now
  // viewport-rooted: position:fixed at the trigger's rect, so no scroll
  // container can clip it (invariant 2: never fix this by re-clipping
  // ancestors). menuPos doubles as the open flag.
  const [menuPos, setMenuPos] = useState<{
    top?: number;
    bottom?: number;
    right: number;
  } | null>(null);
  const toggleMenu = useCallback((e: React.MouseEvent<HTMLElement>) => {
    // capture the rect eagerly - currentTarget is only valid during dispatch
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos((v) => {
      if (v) {
        return null;
      }
      const right = Math.max(
        8,
        document.documentElement.clientWidth - rect.right
      );
      // flip above the trigger when the (estimated, tallest ~320px) menu
      // would fall off the bottom of the viewport
      if (rect.bottom + 4 + 320 > window.innerHeight) {
        return { bottom: window.innerHeight - rect.top + 4, right };
      }
      return { top: rect.bottom + 4, right };
    });
  }, []);
  const closeMenu = useCallback(() => setMenuPos(null), []);
  // kit menu rows: fixed 32px tall, 14px/500
  const menuItemCls =
    'flex items-center gap-[10px] px-[10px] h-[32px] rounded-[6px] hover:bg-boxHover cursor-pointer text-[14px] font-[500] whitespace-nowrap text-newTextColor';
  // Buffer §Queue 'Publish Now': reuses the EXISTING reschedule endpoint —
  // PUT /posts/:id/date with action 'schedule' and date=now sets the post to
  // QUEUE and re-arms the publish workflow immediately (the same semantics
  // the composer's `type: 'now'` path uses in posts.service.ts). No new
  // backend surface.
  const publishNow = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (
        !(
          await deleteDialog(
            t(
              'publish_now_description',
              'This post will be published immediately. Continue?'
            ),
            t('yes_publish_now', 'Yes, publish now!'),
            t('publish_now', 'Publish Now')
          )
        )
      ) {
        return;
      }
      await fetch(`/posts/${post.id}/date`, {
        method: 'PUT',
        body: JSON.stringify({
          date: dayjs.utc().format('YYYY-MM-DDTHH:mm:ss'),
          action: 'schedule',
        }),
      });
      reloadCalendarView();
    },
    [fetch, post.id, reloadCalendarView, t]
  );
  // Draft 'Publish Now' (Buffer): move the date to now, then flip the state
  // to QUEUE via the status route — the workflow re-arms and fires
  // immediately. Both calls are existing/approved surface.
  const publishDraftNow = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (
        !(
          await deleteDialog(
            t(
              'publish_draft_now_description',
              'This draft will be published immediately. Continue?'
            ),
            t('yes_publish_now', 'Yes, publish now!'),
            t('publish_now', 'Publish Now')
          )
        )
      ) {
        return;
      }
      await fetch(`/posts/${post.id}/date`, {
        method: 'PUT',
        body: JSON.stringify({
          date: dayjs.utc().format('YYYY-MM-DDTHH:mm:ss'),
          action: 'schedule',
        }),
      });
      await fetch(`/posts/${post.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'schedule' }),
      });
      reloadCalendarView();
    },
    [fetch, post.id, reloadCalendarView, t]
  );
  // Buffer 'Move to Drafts': the status route already carries the reverse
  // direction (draft -> schedule); this is the same route with
  // status 'draft'. No new backend surface.
  const moveToDrafts = useCallback(async () => {
    await fetch(`/posts/${post.id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'draft' }),
    });
    reloadCalendarView();
  }, [fetch, post.id, reloadCalendarView]);
  // Approvals v1: 'request changes' = leave feedback on the post's comments
  // (Buffer Notes geometry: 446px full-height right sheet, not a centered
  // modal)
  const itemModals = useModals();
  const openCommentsForPost = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      itemModals.openModal({
        title: '',
        closeOnClickOutside: true,
        closeOnEscape: true,
        withCloseButton: false,
        // fullScreen pins the shell to the viewport height (and drops the
        // overlay's bottom pad), size sets the 446px rail width, and the
        // shell classes square the corners and hug the end edge
        fullScreen: true,
        size: '446px',
        classNames: {
          modal: '!rounded-none !me-0 overflow-y-auto',
        },
        children: (
          <CommentComponent
            postId={post.id}
            date={dayjs.utc(post.publishDate)}
          />
        ),
      });
    },
    [itemModals, post.id, post.publishDate]
  );
  // Approvals v1: approve = schedule the draft at its planned time
  const approvePost = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (
        !(
          await deleteDialog(
            t(
              'approve_post_description',
              'Approve this post? It will be scheduled at its planned time.'
            ),
            t('yes_approve', 'Yes, approve!'),
            t('approve', 'Approve')
          )
        )
      ) {
        return;
      }
      await fetch(`/posts/${post.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'schedule' }),
      });
      reloadCalendarView();
    },
    [fetch, post.id, reloadCalendarView, t]
  );
  const [{ opacity }, dragRef] = useDrag(
    () => ({
      type: 'post',
      item: {
        id: post.id,
        interval: !!post.intervalInDays,
        date,
      },
      collect: (monitor) => ({
        opacity: monitor.isDragging() ? 0 : 1,
      }),
    }),
    []
  );
  // One menu, two anchors: the hover pill on week/month chips and the footer
  // kebab on the list card render the same labeled items.
  // Buffer order: Move to Drafts, Duplicate, Post Details, Delete — the fork
  // extras (Statistics, Copy Debug JSON) ride between Post Details and the
  // divider so Delete stays terminal.
  const actionMenuItems = (
    <>
      {(state === 'QUEUE' || state === 'ERROR') && (
        <div
          className={menuItemCls}
          onClick={() => {
            closeMenu();
            moveToDrafts();
          }}
        >
          <MoveToDrafts />
          {t('move_to_drafts', 'Move to Drafts')}
        </div>
      )}
      <div
        className={menuItemCls}
        onClick={() => {
          closeMenu();
          duplicatePost();
        }}
      >
        <Duplicate />
        {t('duplicate', 'Duplicate')}
      </div>
      <div
        className={menuItemCls}
        onClick={() => {
          closeMenu();
          preview();
        }}
      >
        <Preview />
        {t('post_details', 'Post Details')}
      </div>
      {!(
        (post.integration.providerIdentifier === 'x' && disableXAnalytics) ||
        !post.releaseId
      ) &&
        (post.releaseId === 'missing' && missingRelease ? (
          <div
            className={menuItemCls}
            onClick={() => {
              closeMenu();
              missingRelease();
            }}
          >
            <Statistics />
            {t('statistics', 'Statistics')}
          </div>
        ) : post.releaseId !== 'missing' ? (
          <div
            className={menuItemCls}
            onClick={() => {
              closeMenu();
              statistics();
            }}
          >
            <Statistics />
            {t('statistics', 'Statistics')}
          </div>
        ) : null)}
      {copyDebugJson && (
        <div
          className={menuItemCls}
          onClick={() => {
            closeMenu();
            copyDebugJson();
          }}
        >
          <CopyDebug />
          {t('copy_debug_json', 'Copy Debug JSON')}
        </div>
      )}
      <div className="h-[1px] bg-newTableBorder my-[4px]" />
      <div
        className={clsx(menuItemCls, '!text-[#FF3F3F]')}
        onClick={() => {
          closeMenu();
          deletePost();
        }}
      >
        <DeletePost />
        {t('delete', 'Delete')}
      </div>
    </>
  );
  return (
    <div
      // @ts-ignore
      ref={dragRef}
      className={clsx(
        'w-full flex h-full flex-1 flex-col group',
        'relative',
        state === 'ERROR' && 'rounded-[8px] ring-2 ring-red-500'
      )}
      style={{
        opacity,
      }}
    >
      {state === 'ERROR' && (
        <div
          className="absolute -top-[6px] -left-[6px] z-20 w-[18px] h-[18px] rounded-full bg-red-500 flex items-center justify-center text-white text-[11px] font-[650] cursor-pointer"
          data-tooltip-id="tooltip"
          data-tooltip-content={post.error || 'An error occurred while publishing this post'}
        >
          !
        </div>
      )}
      {showCreationMethodBadge && (
        <div className="absolute -bottom-[4px] -right-[4px] z-10">
          <CreationMethodBadge
            creationMethod={post.creationMethod}
            ringColor="var(--new-bgColor)"
          />
        </div>
      )}
      {display !== 'day' && (
        <>
          {/* phone: Buffer shows no tag strip / kebab on calendar cards —
              touch keeps :hover alive and the pills read as stray dots */}
          <div
            className={clsx(
              'phone:hidden text-[12px] max-h-[24px] h-[24px] min-h-[24px] w-full rounded-tr-[10px] rounded-tl-[10px] flex items-center justify-center gap-[10px] px-[5px] bg-btnPrimary'
            )}
            style={{
              backgroundColor: post?.tags?.[0]?.tag?.color,
            }}
          >
            <div
              className={clsx(
                post?.tags?.[0]?.tag?.color ? 'mix-blend-difference' : '',
                'group-hover:hidden cursor-pointer'
              )}
            >
              {post.tags.map((p) => p.tag.name).join(', ')}
            </div>
            {/* fork affordance (Buffer chips carry no kebab): the 24px strip
                caps the trigger, so the hit area is the spec floor — a 24x24
                square, not the bare 16px glyph */}
            <div
              className={clsx(
                'hidden group-hover:flex items-center justify-center cursor-pointer w-[24px] h-[24px] min-w-[24px]',
                post?.tags?.[0]?.tag?.color && 'mix-blend-difference'
              )}
              onClick={(e) => {
                e.stopPropagation();
                toggleMenu(e);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </div>
          </div>
          {menuPos && (
            <>
              <div
                className="fixed inset-0 z-[99]"
                onClick={(e) => {
                  e.stopPropagation();
                  closeMenu();
                }}
              />
              <div
                onClick={(e) => e.stopPropagation()}
                style={menuPos}
                className="fixed z-[100] min-w-[195px] py-[12px] px-[8px] bg-newBgColorInner rounded-[12px] shadow-[0_0_0_1px_rgba(0,0,0,.08),0_1px_1px_rgba(0,0,0,.02),0_4px_8px_rgba(0,0,0,.04)] dark:border dark:border-tableBorder flex flex-col"
              >
                {actionMenuItems}
              </div>
            </>
          )}
        </>
      )}
      {display === 'day' ? (
        // Buffer §Queue list-card anatomy: white surface, hairline border,
        // r12; header = 32px channel avatar + name; body = 15px copy
        // (clamp-3 + 'see more') with the media thumbnail as a right column;
        // hairline divider; footer = 'You created this N ago' + actions.
        // data-cs: the card owns its own metrics — the size ladder in
        // global.scss must leave it alone.
        <div
          data-cs
          className="w-full flex-1 flex flex-col text-[14px] bg-newBgColorInner border border-newTableBorder rounded-[12px] relative"
        >
          {/* phone:pe-[64px]: the list view's 40px comment bubble overlays the
              header's top-right corner on phone (absolute, end-[10px] → 50px
              deep; see ListView). 56px left the tag chip clipping flush
              against the bubble's border (user report, iPhone 16) — 64px
              keeps 14px of air between the chip's ellipsis and the bubble */}
          <div className="flex items-center gap-[10px] px-[16px] pt-[12px] phone:pe-[64px]">
            <ChannelAvatar
              picture={post.integration.picture || ''}
              identifier={post.integration?.providerIdentifier || ''}
              name={post.integration.name}
              size={32}
              badgeSize={14}
              badgeOffset="-bottom-[3px] -end-[3px]"
              fallback="placeholder"
              className="min-w-[32px] min-h-[32px]"
            />
            <div className="text-[14px] font-[550] text-newTextColor truncate text-start">
              {post.integration.name}
            </div>
            {post.tags.length > 0 && (
              // the compact chips carry tags in the top strip; the card
              // carries them as quiet pills so the info survives the redesign
              <div className="ms-auto flex items-center gap-[4px] overflow-hidden">
                {post.tags.map((p) => (
                  // min-w-0 + truncate: on phone the header runs out of room
                  // and the chip must ellipsize ('needs-app…'), not clip
                  // mid-letter at the viewport edge (user report, iPhone 16)
                  <div
                    key={p.tag.name}
                    className="text-[12px] px-[8px] py-[2px] rounded-full border border-newTableBorder min-w-0 truncate"
                    style={{ backgroundColor: p.tag.color }}
                  >
                    <span className={clsx(p.tag.color && 'mix-blend-difference')}>
                      {p.tag.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div
            className="flex items-start gap-[16px] px-[16px] py-[12px] cursor-pointer"
            onClick={editPost}
          >
            <div className="flex-1 min-w-0 flex flex-col">
              {state === 'DRAFT' && (
                <div className="text-start text-[14px] text-newTextColor/60">
                  {t('draft', 'Draft')}
                </div>
              )}
              {hasContent ? (
                <>
                  <div
                    ref={contentRef}
                    className={clsx(
                      'w-full text-[15px] text-start break-words',
                      !expanded && 'line-clamp-3'
                    )}
                  >
                    {contentText}
                  </div>
                  {overflowing && !expanded && (
                    <div
                      className="mt-[4px] text-[14px] text-newTextColor/60 text-start cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpanded(true);
                      }}
                    >
                      {t('see_more', 'see more')}
                    </div>
                  )}
                </>
              ) : (
                (
                  // no copy (stories are caption-less by design): name the
                  // post (channel avatar with the platform badge + a muted
                  // type label) where the caption would sit, so the card
                  // keeps the same [text left | thumbnail right] anatomy as
                  // every other card and the body is never a blank band
                  <div className="flex items-center gap-[10px]">
                    <ChannelAvatar
                      picture={post.integration.picture || ''}
                      identifier={post.integration?.providerIdentifier || ''}
                      name={post.integration.name}
                      size={24}
                      badgeSize={12}
                      badgeOffset="-bottom-[2px] -end-[2px]"
                      fallback="placeholder"
                      className="min-w-[24px] min-h-[24px]"
                    />
                    <span className="text-[14px] text-newTextColor/60">
                      {postTypeLabel}
                    </span>
                  </div>
                )
              )}
              {/* Buffer card anatomy: an 'Add tags' affordance in the body
                  (below content) when the card carries no tags; a quiet ghost
                  that opens the editor, where tags live */}
              {post.tags.length === 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    editPost();
                  }}
                  className="self-start mt-[8px] -ms-[10px] h-[32px] px-[10px] rounded-[8px] flex items-center gap-[6px] text-[14px] font-[500] text-newTextColor/60 hover:bg-boxHover hover:text-newTextColor transition-all duration-150"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
                    <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
                  </svg>
                  {t('add_tags', 'Add tags')}
                </button>
              )}
            </div>
            {/* media slot — renders only once the backend ships the image
                field on this payload (getFirstImageUrl); invisible until
                then */}
            {/* object-contain + wash letterbox (was object-cover): the
                center-crop cut headlines off typographic brand tiles */}
            {showMedia && (
              // sized, rounded, overflow-hidden WRAPPER (not a bare img):
              // the raster is clipped to the thumbnail silhouette, so it can
              // never paint past the card's rounded corner; shrink-0 keeps
              // the box from compressing inside the body row. The card
              // itself cannot take overflow-hidden (the footer kebab menu
              // pops out below the card and would be clipped).
              // WIDTH is the only fixed axis: height hugs the image's aspect
              // up to a 180 (phone 96) cap. The old fixed h-[180px] basis
              // reserved a thumbnail-tall empty band on every short card
              // (landscape media letterboxed inside it, copy-short cards
              // stretched to it between 'Add tags' and 'View').
              // the box reforms to the image (user-picked option): BOTH axes
              // hug the raster up to the cap, so portrait tiles no longer
              // letterbox against a wash background; no wash, no border, a
              // clean rounded image like Buffer's thumbnails
              <div className="w-fit shrink-0 rounded-[8px] overflow-hidden relative">
                {mediaThumb!.isVideo ? (
                  // video-only posts (story reshares) get the SAME thumbnail
                  // anatomy as image cards: #t=0.1 makes the browser paint
                  // the first frame as a poster, the play badge says "video"
                  <>
                    <video
                      src={mediaThumb!.url + '#t=0.1'}
                      muted
                      playsInline
                      preload="metadata"
                      onError={() => setMediaFailed(true)}
                      className="w-auto h-auto max-w-[180px] max-h-[180px] phone:max-w-[96px] phone:max-h-[96px] object-contain"
                    />
                    <div className="absolute inset-0 grid place-items-center pointer-events-none">
                      <div className="w-[28px] h-[28px] rounded-full bg-black/50 grid place-items-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </>
                ) : (
                  <img
                    src={mediaThumb!.url}
                    alt=""
                    onError={() => {
                      // state, not a DOM hide: unmounts the whole tile (no
                      // lingering gray box) AND lets the avatar+label fallback
                      // above take over the body
                      setMediaFailed(true);
                    }}
                    className="w-auto h-auto max-w-[180px] max-h-[180px] phone:max-w-[96px] phone:max-h-[96px] object-contain"
                  />
                )}
              </div>
            )}
          </div>
          {/* Buffer card anatomy: a ghost 'View' button on the card surface
              between the media block and the byline row (desktop) — the same
              public preview the kebab's Post Details opens */}
          <div className="px-[16px] pb-[12px] flex phone:hidden">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                preview();
              }}
              className="h-[32px] phone:h-[40px] px-[10px] rounded-[8px] border border-newTableBorder bg-newBgColorInner flex items-center text-[14px] font-[500] text-newTextColor whitespace-nowrap transition-all duration-150 hover:bg-boxHover"
            >
              {t('view', 'View')}
            </button>
          </div>
          <div className="h-[1px] bg-newTableBorder" />
          {/* phone: the byline gets its own full-width line above the action
              buttons — squeezed into the button row it truncated to ~2
              characters ('Y..') */}
          <div className="hidden phone:block px-[16px] pt-[8px] text-[14px] text-start truncate">
            <span className="font-[550] text-newTextColor">
              {t('you_created_this', 'You created this')}
            </span>{' '}
            <span className="text-newTextColor/60">
              {dayjs.utc(post.createdAt || post.publishDate).fromNow()}
            </span>
          </div>
          {/* phone: the approvals state carries four buttons (Request changes,
              Approve, Edit, overflow) — they cannot fit one 390px row, and
              without wrap the card blows out the layout viewport (the same
              over-wide failure that broke position:fixed elsewhere) */}
          <div className="flex items-center gap-[8px] px-[16px] py-[8px] phone:justify-end phone:flex-wrap">
            <div className="flex-1 min-w-0 text-[14px] text-start truncate phone:hidden">
              <span className="font-[550] text-newTextColor">
                {t('you_created_this', 'You created this')}
              </span>{' '}
              <span className="text-newTextColor/60">
                {dayjs.utc(post.createdAt || post.publishDate).fromNow()}
              </span>
            </div>
            {/* A failed post's whole reason for being in this list is that it
                needs another go, so it gets the same action, labelled Retry. */}
            {state === 'ERROR' && (
              <div className="flex-1 min-w-0 text-[14px] text-start truncate text-red-400 phone:flex-none phone:w-full">
                {t('failed_to_publish', 'Failed to publish')}
              </div>
            )}
            {(state === 'QUEUE' || state === 'ERROR') && (
              <button
                type="button"
                onClick={publishNow}
                className="h-[32px] phone:h-[40px] px-[10px] rounded-[8px] border border-newTableBorder bg-newBgColorInner flex items-center gap-[6px] text-[14px] font-[500] text-newTextColor whitespace-nowrap transition-all duration-150 hover:bg-boxHover"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 3 14 9-14 9z" />
                </svg>
                {state === 'ERROR'
                  ? t('retry', 'Retry')
                  : t('publish_now', 'Publish Now')}
              </button>
            )}
            {state === 'DRAFT' && listState === 'approvals' && (
              <>
                <button
                  type="button"
                  onClick={openCommentsForPost}
                  className="h-[32px] phone:h-[40px] px-[10px] rounded-[8px] border border-newTableBorder bg-newBgColorInner flex items-center gap-[6px] text-[14px] font-[500] text-newTextColor whitespace-nowrap transition-all duration-150 hover:bg-boxHover"
                >
                  {t('request_changes', 'Request changes')}
                </button>
                <button
                  type="button"
                  onClick={approvePost}
                  className="h-[32px] phone:h-[40px] px-[10px] rounded-[8px] bg-btnPrimary text-black flex items-center gap-[6px] text-[14px] font-[500] whitespace-nowrap transition-all duration-150 hover:opacity-90"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {t('approve', 'Approve')}
                </button>
              </>
            )}
            {state === 'DRAFT' && listState !== 'approvals' && (
              <button
                type="button"
                onClick={publishDraftNow}
                className="h-[32px] phone:h-[40px] px-[10px] rounded-[8px] border border-newTableBorder bg-newBgColorInner flex items-center gap-[6px] text-[14px] font-[500] text-newTextColor whitespace-nowrap transition-all duration-150 hover:bg-boxHover"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 3 14 9-14 9z" />
                </svg>
                {t('publish_now', 'Publish Now')}
              </button>
            )}
            {/* Buffer action row: Edit is a LABELED text button (14/500 in a
                32px ghost control), not a bare pencil icon */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                editPost();
              }}
              className="h-[32px] phone:h-[40px] px-[10px] rounded-[8px] border border-newTableBorder bg-newBgColorInner flex items-center text-[14px] font-[500] text-newTextColor whitespace-nowrap transition-all duration-150 hover:bg-boxHover"
            >
              {t('edit', 'Edit')}
            </button>
            <div className="relative">
              <button
                type="button"
                aria-label={t('more_actions', 'More actions')}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMenu(e);
                }}
                className="w-[32px] h-[32px] min-w-[32px] phone:w-[40px] phone:h-[40px] phone:min-w-[40px] rounded-[8px] border border-newTableBorder bg-newBgColorInner flex items-center justify-center text-newTextColor transition-all duration-150 hover:bg-boxHover"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </button>
              {menuPos && (
                <>
                  <div
                    className="fixed inset-0 z-[99]"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeMenu();
                    }}
                  />
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={menuPos}
                    className="fixed z-[100] min-w-[195px] py-[12px] px-[8px] bg-newBgColorInner rounded-[12px] shadow-[0_0_0_1px_rgba(0,0,0,.08),0_1px_1px_rgba(0,0,0,.02),0_4px_8px_rgba(0,0,0,.04)] dark:border dark:border-tableBorder flex flex-col"
                  >
                    {actionMenuItems}
                  </div>
                </>
              )}
            </div>
          </div>
          {/* Buffer Sent tab: per-card stats strip in the card footer (list
              view only — DayView reuses this card shape and must not fetch) */}
          {calendarDisplay === 'list' && listState === 'published' && (
            <SentPostStats post={post} />
          )}
        </div>
      ) : (
      <div
        onClick={editPost}
        // data-cs: month pills and week cards own their compact Buffer
        // metrics — the global size ladder in global.scss must leave them
        // alone
        data-cs
        className={clsx(
          'w-full flex text-[14px] bg-newColColor border border-newTableBorder relative cursor-pointer',
          // Buffer hover (desktop, user-flagged): pills/cards lift to white
          // with a soft shadow — this wrapper is shared by BOTH month pills
          // and week cards, so the hover covers both; guarded to
          // hover-capable pointers so phone taps never latch a sticky
          // white/shadow state on the touch grid
          // the white hover pop is Buffer LIGHT-mode parity; in dark mode a
          // white card under light text is unreadable (user report), so dark
          // hovers lift to the elevated dark surface instead
          '[@media(hover:hover)]:hover:bg-white dark:[@media(hover:hover)]:hover:bg-newTableHeader [@media(hover:hover)]:hover:shadow-[0_2px_8px_rgba(43,32,17,0.14)] transition-shadow duration-150',
          // Buffer month pill: 33px tall, r8, hairline border, 4px pad.
          // Phone month (Buffer, screenshots at 390): the pill compacts to a
          // 30×30 r6 hairline mini-tile with the 20px platform icon centered
          // — NEVER a media thumbnail; time hidden.
          display === 'month' &&
            'h-[33px] min-h-[33px] rounded-[8px] p-[4px] items-center gap-[6px] phone:w-[30px] phone:min-w-[30px] phone:h-[30px] phone:min-h-[30px] phone:rounded-[6px] phone:p-0 phone:gap-0 phone:justify-center phone:overflow-hidden phone:mx-auto',
          // phone month past-day tiles render dimmed (Buffer screenshots)
          display === 'month' && isBeforeNow && 'phone:opacity-[0.55]',
          // Buffer week card: white r10 hairline, 10px padding, column layout.
          // Natural height — h-full pinned the card to the 105px hour row and
          // made tall content bleed across the grid line; sized to content,
          // the auto row grows instead.
          // Phone (Buffer screenshots): the card compacts to a single-row
          // 32px chip (Buffer measured 31px) — icon + time only
          // (snippet/thumb hidden below); r8, 18px icon, 15/400 time
          display === 'week' &&
            'flex-col rounded-[10px] p-[10px] items-start gap-[6px] phone:flex-row phone:items-center phone:gap-[6px] phone:h-[32px] phone:min-h-0 phone:rounded-[8px] phone:px-[8px] phone:py-0 phone:overflow-hidden'
        )}
      >
        {display === 'month' ? (
          // Buffer month pill anatomy: [16px platform chip] [time] [~20px
          // media thumbnail right]
          <>
            {/* phone mini-tile: the platform icon is ALWAYS the tile face
                (Buffer screenshots) — never the media thumbnail */}
            <img
              className="w-[20px] h-[20px] min-w-[20px] rounded-[4px]"
              src={`/icons/platforms/${post.integration?.providerIdentifier}.png`}
              alt=""
            />
            {/* phone mini-tile shows no time and no media — the whole row
                hides so the icon centers in the 30px tile */}
            <div className="flex-1 flex items-center gap-[6px] text-[12px] font-[500] text-newTextColor whitespace-nowrap overflow-hidden phone:hidden">
              <span className="truncate">
                {state === 'DRAFT' ? t('draft', 'Draft') + ' · ' : ''}
                {formatPostTime(post.publishDate, displayTimezone, 'h:mm A')}
              </span>
              {/* media slot — 23px r6 measured on Buffer's month pills
                  (desktop only); videos paint their first frame as poster */}
              {mediaThumb &&
                (mediaThumb.isVideo ? (
                  <video
                    src={mediaThumb.url + '#t=0.1'}
                    muted
                    playsInline
                    preload="metadata"
                    className="w-[23px] h-[23px] min-w-[23px] rounded-[6px] object-cover ms-auto"
                  />
                ) : (
                  <img
                    src={mediaThumb.url}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className="w-[23px] h-[23px] min-w-[23px] rounded-[6px] object-cover ms-auto"
                  />
                ))}
            </div>
          </>
        ) : display === 'week' ? (
          // Buffer week card anatomy: [18px platform glyph + time] header,
          // then body row = 2-line snippet LEFT + 44px r6 thumbnail RIGHT
          <>
            {/* min-w-0 + overflow-hidden: inert on desktop; on the 7-day
                phone grid (~49px cols) the nowrap time clips inside the chip
                instead of bleeding across the grid line */}
            <div className="w-full min-w-0 flex items-center gap-[6px]">
              <img
                className="w-[18px] h-[18px] min-w-[18px] rounded-[4px]"
                src={`/icons/platforms/${post.integration?.providerIdentifier}.png`}
                alt=""
              />
              <div className="min-w-0 overflow-hidden text-[15px] font-[400] text-newTextColor whitespace-nowrap">
                {formatPostTime(post.publishDate, displayTimezone, 'h:mm A')}
              </div>
            </div>
            {/* phone (Buffer screenshots): the chip is icon + time only —
                the snippet/thumbnail body row hides */}
            <div className="w-full flex items-start gap-[8px] phone:hidden">
              <div className="flex-1 min-w-0 text-[14px] text-start break-words line-clamp-2 text-newTextColor/80">
                {state === 'DRAFT' ? t('draft', 'Draft') + ': ' : ''}
                {stripHtmlValidation('none', post.content, false, true, false)}
              </div>
              {mediaThumb &&
                (mediaThumb.isVideo ? (
                  <video
                    src={mediaThumb.url + '#t=0.1'}
                    muted
                    playsInline
                    preload="metadata"
                    className="w-[44px] h-[44px] min-w-[44px] rounded-[6px] object-cover"
                  />
                ) : (
                  <img
                    src={mediaThumb.url}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className="w-[44px] h-[44px] min-w-[44px] rounded-[6px] object-cover"
                  />
                ))}
            </div>
          </>
        ) : null}
        {showTime && (
          <div className="text-newTextColor text-[14px] font-[500] whitespace-nowrap flex items-center justify-end text-end">
            {formatPostTime(
              post.publishDate,
              displayTimezone,
              isUSCitizen() ? 'h:mm A' : 'H:mm'
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
});
const DebugJsonModal: FC<{ post: any }> = ({ post }) => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const { closeCurrent } = useModals();

  const copyPostId = useCallback(() => {
    copy(post.id);
    toaster.show(
      t('post_id_copied', 'Post ID copied to clipboard'),
      'success'
    );
    closeCurrent();
  }, [post, toaster, t, closeCurrent]);

  const copyJson = useCallback(async () => {
    try {
      const data = await (
        await fetch(`/posts/group/${post.group}/debug-export`)
      ).json();
      copy(JSON.stringify(data, null, 2));
      toaster.show(
        t('debug_json_copied', 'Debug JSON copied to clipboard'),
        'success'
      );
      closeCurrent();
    } catch {
      toaster.show(
        t('debug_json_copy_failed', 'Failed to copy debug data'),
        'warning'
      );
    }
  }, [fetch, post, toaster, t, closeCurrent]);

  return (
    <ModalBody>
      <div className="text-newTextColor text-[14px]">
        {t('debug_choose_copy', 'Choose what you want to copy')}
      </div>
      <div className="flex gap-[10px]">
        <Button onClick={copyPostId}>
          {t('copy_post_id', 'Copy post id')}
        </Button>
        <Button secondary onClick={copyJson}>
          {t('copy_debug_json', 'Copy Debug JSON')}
        </Button>
      </div>
    </ModalBody>
  );
};
const CopyDebug = () => {
  const t = useT();
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      data-tooltip-id="tooltip"
      data-tooltip-content={t('copy_debug_json', 'Copy Debug JSON')}
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
};
const MoveToDrafts = () => {
  const t = useT();
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      data-tooltip-id="tooltip"
      data-tooltip-content={t('move_to_drafts', 'Move to Drafts')}
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
};
const Duplicate = () => {
  const t = useT();
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      data-tooltip-id="tooltip"
      data-tooltip-content={t('duplicate_post', 'Duplicate Post')}
    >
      <line x1="15" x2="15" y1="12" y2="18" />
      <line x1="12" x2="18" y1="15" y2="15" />
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
};
const Preview = () => {
  const t = useT();
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      data-tooltip-id="tooltip"
      data-tooltip-content={t('preview_post', 'Post Details')}
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
};
export const Statistics = () => {
  const t = useT();
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      data-tooltip-id="tooltip"
      data-tooltip-content={t('post_statistics', 'Post Statistics')}
    >
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
};

export const DeletePost = () => {
  const t = useT();
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      data-tooltip-id="tooltip"
      data-tooltip-content={t('delete_post', 'Delete Post')}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
};

export const SetSelectionModal: FC<{
  sets: any[];
  onSelect: (set: any) => void;
  onContinueWithoutSet: () => void;
}> = ({ sets, onSelect, onContinueWithoutSet }) => {
  const t = useT();

  return (
    <div className="flex flex-col gap-4">
      <div className="text-lg font-medium">
        {t('choose_set_or_continue', 'Choose a set or continue without one')}
      </div>

      <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
        {sets.map((set) => (
          <div
            key={set.id}
            onClick={() => onSelect(set)}
            className="p-3 border border-newTableBorder rounded-lg cursor-pointer transition-colors hover:bg-boxHover"
          >
            <div className="font-medium">{set.name}</div>
            {set.description && (
              <div className="text-[13px] text-newTextColor/60 mt-1">
                {set.description}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2 border-t border-newTableBorder">
        <button
          onClick={onContinueWithoutSet}
          className="flex-1 px-4 py-2 text-newTextColor border border-newTableBorder rounded-[8px] transition-colors hover:bg-boxHover"
        >
          {t('continue_without_set', 'Continue without set')}
        </button>
      </div>
    </div>
  );
};
