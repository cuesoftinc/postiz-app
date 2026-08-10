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
// Images only: obvious video files are skipped.
const VIDEO_EXTENSION = /\.(mp4|mov|webm|avi|mkv|m4v)(\?|#|$)/i;
const getFirstImageUrl = (media: unknown): string | undefined => {
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
      if (typeof path === 'string' && path && !VIDEO_EXTENSION.test(path)) {
        return path;
      }
    }
  } catch {
    // broken media JSON — render the card without a thumbnail
  }
  return undefined;
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
          modal: 'w-[100%] max-w-[1400px] text-textColor',
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
  const { integrations, posts, startDate } = calendar;
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
        {options.map((option) => (
          <Fragment key={option[0].time}>
            <div className="text-center text-[14px] min-h-[21px]">
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
              className="min-h-[60px] rounded-[10px] flex justify-center items-center gap-[10px] mb-[20px]"
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
        ))}
      </div>
    </div>
  );
};
export const WeekView = () => {
  const { startDate, endDate } = useCalendar();
  const isPhone = useIsPhone();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Every day of the fetched range (a week on desktop; possibly a whole month
  // grid range when the phone 3-day view is standing in for month display).
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

  // Buffer phone: a rolling THREE-day hour grid starting today, sliced
  // client-side from the already-fetched range (never a new fetch). When
  // today is outside the range, the first three days of the range show.
  const visibleDays = useMemo(() => {
    if (!isPhone) {
      return localizedDays.slice(0, 7);
    }
    const today = newDayjs().startOf('day');
    const idx = localizedDays.findIndex((d) => d.date.isSame(today, 'day'));
    const start =
      idx === -1 ? 0 : Math.max(0, Math.min(idx, localizedDays.length - 3));
    return localizedDays.slice(start, start + 3);
  }, [localizedDays, isPhone]);

  // Buffer opens the hour grid scrolled to "now" (one row of context above).
  // Guard: only from the untouched top position — the force-dynamic page
  // remounts seconds after navigation, and re-jumping a grid the user already
  // scrolled reads as glitching.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || el.scrollTop !== 0) {
      return;
    }
    const now = newDayjs();
    const rangeStart = newDayjs(startDate).startOf('day');
    const rangeEnd = newDayjs(endDate).endOf('day');
    if (now.isBefore(rangeStart) || now.isAfter(rangeEnd)) {
      return;
    }
    el.scrollTop = Math.max(0, (now.hour() - 1) * (isPhone ? 80 : 106));
  }, [startDate, endDate, isPhone]);

  const today = newDayjs();
  return (
    <div className="flex flex-col text-textColor flex-1">
      <div className="flex-1 relative">
        <div
          ref={scrollRef}
          className="grid gap-[1px] bg-newGridLine border border-newGridLine rounded-[12px] absolute h-full start-0 top-0 w-full overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor"
          style={{
            gridTemplateColumns: isPhone
              ? `48px repeat(${visibleDays.length}, minmax(0, 1fr))`
              : `repeat(${visibleDays.length}, minmax(0, 1fr))`,
          }}
        >
          {isPhone && (
            <div className="z-[20] bg-newBgColorInner h-[36px] sticky top-0" />
          )}
          {visibleDays.map((day) => {
            const isToday = day.date.isSame(today, 'day');
            return (
              <div
                key={day.date.format('YYYY-MM-DD')}
                className={clsx(
                  'text-center bg-newBgColorInner flex justify-center items-center gap-[8px] h-[36px] sticky top-0 z-[20] text-[14px]',
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
                <div className="relative bg-newBgColorInner">
                  {hour % 2 === 0 && (
                    <div className="absolute end-[6px] top-0 -translate-y-1/2 z-[10] text-[12px] font-[500] text-newTableText pointer-events-none">
                      {formatHourLabel(hour)}
                    </div>
                  )}
                </div>
              )}
              {visibleDays.map((day, indexDay) => (
                <div
                  key={`${day.date.format('YYYY-MM-DD')}-${hour}`}
                  className={clsx(
                    'relative bg-newBgColorInner',
                    isPhone ? 'min-h-[79px]' : 'min-h-[105px]'
                  )}
                >
                  {!isPhone && indexDay === 0 && hour % 2 === 0 && (
                    <div className="absolute start-[10px] top-0 -translate-y-1/2 z-[10] text-[12px] font-[500] text-newTableText pointer-events-none">
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
    // Sunday (0) through Saturday (6)
    for (let i = 0; i <= 6; i++) {
      days.push(newDayjs().day(i).format('dddd'));
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
    <div className="flex flex-col text-textColor flex-1">
      <div className="flex-1 flex relative">
        {/* Buffer rounds the grid corners at 12px (border-separate table w/
            per-corner cell radii — measured 12px 0 0 on the first cell) */}
        <div
          ref={gridRef}
          // implicit rows stay `auto` — Chrome pins minmax(205px, auto)
          // tracks at the minimum and never grows them with content (verified
          // live); the 205px floor lives on each cell's min-h instead
          className="grid grid-cols-7 grid-rows-[36px] gap-[1px] bg-newGridLine border border-newGridLine rounded-[12px] absolute start-0 top-0 overflow-auto w-full h-full scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor"
        >
          {localizedDays.map((day) => (
            <div
              key={day}
              className="z-[20] p-2 bg-newBgColorInner flex justify-center items-center flex-col h-full sticky top-0"
            >
              <div className="text-[14px] font-[500] text-newTextColor/70">
                {day}
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
  const { integrations, loading, listPosts, listState } = useCalendar();
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
          'Tag a draft with "needs-approval" to route it here for review.'
        )
      : listState === 'published'
      ? t('sent_posts_appear_here', 'Posts you have sent will appear here.')
      : t('scheduled_posts_appear_here', 'Posts you schedule will appear here.');

  // Use shared post actions hook
  const { editPost, deletePost, copyDebugJson, openStatistics, openMissingRelease } = usePostActions();
  const displayTimezone = useDisplayTimezone();

  // Buffer §Queue: a floating comment bubble outside each card opens the
  // comments thread for the post's time slot (read/annotate only — the
  // existing comments component owns its own data)
  const openComments = useCallback(
    (post: any) => () => {
      modal.openModal({
        title: '',
        closeOnClickOutside: true,
        closeOnEscape: true,
        withCloseButton: false,
        classNames: {
          modal: 'w-[100%] max-w-[600px]',
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
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [listPosts, displayTimezone]);

  // "now", projected into the display timezone when set — only used to label
  // a group Today/Tomorrow; without a display timezone it is exactly newDayjs()
  const displayNow = displayTimezone
    ? newDayjs(dayjs().tz(displayTimezone).format('YYYY-MM-DD'))
    : newDayjs();

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <div className="text-textColor">{t('loading', 'Loading...')}</div>
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
        <div className="text-[16px] font-[600] text-newTextColor">
          {emptyMessage}
        </div>
        <div className="text-[14px] text-newTextColor/60">{emptySubline}</div>
      </div>
    );
  }

  // Buffer: the queue scrolls with the page — no nested scroll region
  return (
    // min-w-0: as a flex item this column's min-width:auto otherwise pins it
    // at content width (573px measured at 390) and the right side clips
    <div className="flex flex-col flex-1 min-w-0">
      {groupedPosts.map(([dateKey, datePosts]) => (
        <Fragment key={dateKey}>
          {/* Buffer §Queue two-tone header: weekday prefix bold/bright, date
              muted. Today/Tomorrow is pure presentation of the same date. */}
          <div className="text-start text-[16px] mt-[32px] first:mt-[8px] mb-[16px] px-[10px]">
            <span className="font-[600] text-newTextColor">
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
              <div key={post.id} className="flex items-start gap-[12px]">
                {/* Buffer time rail OUTSIDE the card: time full-ink 14/500,
                    pin + 'Custom' muted below */}
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
                {/* floating comment bubble outside the card, top-right */}
                <button
                  type="button"
                  onClick={openComments(post)}
                  aria-label={t('comments', 'Comments')}
                  className="w-[32px] h-[32px] min-w-[32px] rounded-[10px] border border-newTableBorder bg-newBgColorInner flex items-center justify-center text-newTextColor transition-all duration-150 hover:bg-boxHover"
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
            ))}
          </div>
        </Fragment>
      ))}
    </div>
  );
};

export const Calendar = () => {
  const calendar = useCalendar();
  const isPhone = useIsPhone();
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
  if (isPhone) {
    // Buffer phone renders a rolling 3-day hour grid instead of the month
    // grid. Reuse the week machinery over the already-fetched month range;
    // display is overridden so the hour cells filter posts per-hour.
    return (
      <CalendarContext.Provider value={{ ...calendar, display: 'week' }}>
        <WeekView />
      </CalendarContext.Provider>
    );
  }
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
          ? pList.format('YYYY-MM-DD HH:mm') ===
            getDate.format('YYYY-MM-DD HH:mm')
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
        modal: 'w-[100%] max-w-[1400px] text-textColor',
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
  const isToday = getDate.isSame(newDayjs(), 'day');
  const isOtherMonth = !!monthLabel && monthLabel !== 'current-month';
  return (
    <div
      className={clsx(
        'flex flex-col w-full relative group/cell',
        // month: `grow` (basis auto) — fills the cell when short AND lets
        // tall content grow the grid track (a % min-height cycles against
        // the track and pins it at 205px); the 205px row floor lives here
        // too. Week/day cells are block parents where only min-h-full fills
        display === 'month' ? 'grow min-h-[205px]' : 'min-h-full',
        display === 'month' && isBeforeNow && 'repeated-strip',
        loading && 'animate-pulse',
        // Buffer tint model (user-verified): the past wash is MONTH-only —
        // week hour cells stay white even in the past, and future weekends /
        // other-month days are flat white too
        display !== 'day' &&
          (display === 'month' && isBeforeNow
            ? 'bg-newTableHeader'
            : 'bg-newBgColorInner'),
        display === 'day' &&
          (isBeforeNow
            ? 'cursor-not-allowed'
            : 'border border-newTableBorder rounded-[8px]')
      )}
      ref={drop as any}
    >
      {display === 'month' && (
        <div className="pt-[6px] px-[8px] text-[14px] font-[500] text-start flex items-center">
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
          className="absolute top-[6px] end-[6px] z-[30] w-[24px] h-[24px] rounded-[6px] border border-newTableBorder bg-newBgColorInner flex items-center justify-center cursor-pointer opacity-0 pointer-events-none group-hover/cell:opacity-100 group-hover/cell:pointer-events-auto transition-opacity duration-150"
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
            <div className="h-full w-full p-[5px] animate-pulse absolute left-0 top-0 z-[50]">
              <div className="h-full w-full bg-newSettings rounded-[10px]" />
            </div>
          )}
          {list.map((post) => (
            // month: 6px + 2px = Buffer's measured 8px chip inset / 8px stack
            // gap; week: Buffer insets cards ~12px inside the day column
            <div
              key={post.id}
              className={clsx(
                'text-textColor relative flex flex-col justify-center items-center',
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
            <div
              className="h-[24px] flex items-center gap-[8px] ps-[10px] py-[4px] text-start text-[14px] font-[500] text-newTextColor cursor-pointer"
              onClick={showAllFunc}
            >
              <ExpandChevron />
              <span>
                {postList.length - 3} {t('show_more', 'More')}
              </span>
            </div>
          )}
          {showAll && postList.length > 3 && (
            <div
              className="h-[24px] flex items-center gap-[8px] ps-[10px] py-[4px] text-start text-[14px] font-[500] text-newTextColor cursor-pointer"
              onClick={showLessFunc}
            >
              <ExpandChevron up />
              <span>{t('show_less', 'Show less')}</span>
            </div>
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
                            className="rounded-[8px] absolute z-10 -bottom-[5px] -end-[5px] border border-fifth"
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
  const { reloadCalendarView, listState } = useCalendar();
  const displayTimezone = useDisplayTimezone();
  // First attached image of the post's media field (backend now selects it
  // through the minified payload); undefined when absent/broken/video-only
  const mediaUrl = useMemo(() => getFirstImageUrl(post.image), [post.image]);
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuItemCls =
    'flex items-center gap-[10px] px-[10px] py-[7px] rounded-[6px] hover:bg-boxHover cursor-pointer text-[13px] whitespace-nowrap text-newTextColor';
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
  // Approvals v1: 'request changes' = leave feedback on the post's comments
  const itemModals = useModals();
  const openCommentsForPost = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      itemModals.openModal({
        title: '',
        closeOnClickOutside: true,
        closeOnEscape: true,
        withCloseButton: false,
        classNames: {
          modal: 'w-[100%] max-w-[600px]',
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
  const actionMenuItems = (
    <>
      <div
        className={menuItemCls}
        onClick={() => {
          setMenuOpen(false);
          preview();
        }}
      >
        <Preview />
        {t('post_details', 'Post Details')}
      </div>
      <div
        className={menuItemCls}
        onClick={() => {
          setMenuOpen(false);
          duplicatePost();
        }}
      >
        <Duplicate />
        {t('duplicate', 'Duplicate')}
      </div>
      {!(
        (post.integration.providerIdentifier === 'x' && disableXAnalytics) ||
        !post.releaseId
      ) &&
        (post.releaseId === 'missing' && missingRelease ? (
          <div
            className={menuItemCls}
            onClick={() => {
              setMenuOpen(false);
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
              setMenuOpen(false);
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
            setMenuOpen(false);
            copyDebugJson();
          }}
        >
          <CopyDebug />
          {t('copy_debug_json', 'Copy Debug JSON')}
        </div>
      )}
      <div className="h-[1px] bg-tableBorder my-[4px]" />
      <div
        className={clsx(menuItemCls, '!text-red-400')}
        onClick={() => {
          setMenuOpen(false);
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
          className="absolute -top-[6px] -left-[6px] z-20 w-[18px] h-[18px] rounded-full bg-red-500 flex items-center justify-center text-white text-[11px] font-bold cursor-pointer"
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
          <div
            className={clsx(
              'text-[11px] max-h-[24px] h-[24px] min-h-[24px] w-full rounded-tr-[10px] rounded-tl-[10px] flex items-center justify-center gap-[10px] px-[5px] bg-btnPrimary'
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
            <div
              className={clsx(
                'hidden group-hover:flex items-center cursor-pointer px-[4px]',
                post?.tags?.[0]?.tag?.color && 'mix-blend-difference'
              )}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </div>
          </div>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-[290]"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
              />
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute top-[26px] end-0 z-[300] min-w-[180px] p-[6px] bg-fifth rounded-[8px] border border-tableBorder flex flex-col"
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
          <div className="flex items-center gap-[10px] px-[16px] pt-[12px]">
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
            <div className="text-[14px] font-[600] text-newTextColor truncate text-start">
              {post.integration.name}
            </div>
            {post.tags.length > 0 && (
              // the compact chips carry tags in the top strip; the card
              // carries them as quiet pills so the info survives the redesign
              <div className="ms-auto flex items-center gap-[4px] overflow-hidden">
                {post.tags.map((p) => (
                  <div
                    key={p.tag.name}
                    className="text-[12px] px-[8px] py-[2px] rounded-full border border-newTableBorder whitespace-nowrap"
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
              <div
                ref={contentRef}
                className={clsx(
                  'w-full text-[15px] text-start break-words',
                  !expanded && 'line-clamp-3'
                )}
              >
                {stripHtmlValidation('none', post.content, false, true, false)}
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
            </div>
            {/* media slot — renders only once the backend ships the image
                field on this payload (getFirstImageUrl); invisible until
                then */}
            {mediaUrl && (
              <img
                src={mediaUrl}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
                className="w-[180px] h-[180px] min-w-[180px] rounded-[8px] object-cover border border-newTableBorder phone:w-[96px] phone:h-[96px] phone:min-w-[96px]"
              />
            )}
          </div>
          <div className="h-[1px] bg-newTableBorder" />
          <div className="flex items-center gap-[8px] px-[16px] py-[8px]">
            <div className="flex-1 min-w-0 text-[14px] text-start truncate">
              <span className="font-[600] text-newTextColor">
                {t('you_created_this', 'You created this')}
              </span>{' '}
              <span className="text-newTextColor/60">
                {dayjs.utc(post.createdAt || post.publishDate).fromNow()}
              </span>
            </div>
            {state === 'QUEUE' && (
              <button
                type="button"
                onClick={publishNow}
                className="h-[32px] px-[10px] rounded-[8px] border border-newTableBorder bg-newBgColorInner flex items-center gap-[6px] text-[14px] font-[500] text-newTextColor whitespace-nowrap transition-all duration-150 hover:bg-boxHover"
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
            {state === 'DRAFT' && listState === 'approvals' && (
              <>
                <button
                  type="button"
                  onClick={openCommentsForPost}
                  className="h-[32px] px-[10px] rounded-[8px] border border-newTableBorder bg-newBgColorInner flex items-center gap-[6px] text-[14px] font-[500] text-newTextColor whitespace-nowrap transition-all duration-150 hover:bg-boxHover"
                >
                  {t('request_changes', 'Request changes')}
                </button>
                <button
                  type="button"
                  onClick={approvePost}
                  className="h-[32px] px-[10px] rounded-[8px] bg-btnPrimary text-black flex items-center gap-[6px] text-[14px] font-[500] whitespace-nowrap transition-all duration-150 hover:opacity-90"
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
                className="h-[32px] px-[10px] rounded-[8px] border border-newTableBorder bg-newBgColorInner flex items-center gap-[6px] text-[14px] font-[500] text-newTextColor whitespace-nowrap transition-all duration-150 hover:bg-boxHover"
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
            <button
              type="button"
              aria-label={t('edit_post', 'Edit Post')}
              onClick={(e) => {
                e.stopPropagation();
                editPost();
              }}
              className="w-[32px] h-[32px] min-w-[32px] rounded-[8px] border border-newTableBorder bg-newBgColorInner flex items-center justify-center text-newTextColor transition-all duration-150 hover:bg-boxHover"
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
                <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
                <path d="m15 5 4 4" />
              </svg>
            </button>
            <div className="relative">
              <button
                type="button"
                aria-label={t('more_actions', 'More actions')}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
                className="w-[32px] h-[32px] min-w-[32px] rounded-[8px] border border-newTableBorder bg-newBgColorInner flex items-center justify-center text-newTextColor transition-all duration-150 hover:bg-boxHover"
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
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[290]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                    }}
                  />
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-[36px] end-0 z-[300] min-w-[180px] p-[6px] bg-fifth rounded-[8px] border border-tableBorder flex flex-col"
                  >
                    {actionMenuItems}
                  </div>
                </>
              )}
            </div>
          </div>
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
          // Buffer month pill: 33px tall, r8, hairline border, 4px pad
          display === 'month' &&
            'h-[33px] min-h-[33px] rounded-[8px] p-[4px] items-center gap-[6px]',
          // Buffer week card: white r10 hairline, 10px padding, column layout.
          // Natural height — h-full pinned the card to the 105px hour row and
          // made tall content bleed across the grid line; sized to content,
          // the auto row grows instead
          display === 'week' &&
            'flex-col rounded-[10px] p-[10px] items-start gap-[6px]'
        )}
      >
        {display === 'month' ? (
          // Buffer month pill anatomy: [16px platform chip] [time] [~20px
          // media thumbnail right]
          <>
            <img
              className="w-[20px] h-[20px] min-w-[20px] rounded-[4px]"
              src={`/icons/platforms/${post.integration?.providerIdentifier}.png`}
              alt=""
            />
            <div className="flex-1 flex items-center gap-[6px] text-[12px] font-[500] text-newTextColor whitespace-nowrap overflow-hidden">
              <span className="truncate">
                {state === 'DRAFT' ? t('draft', 'Draft') + ' · ' : ''}
                {formatPostTime(post.publishDate, displayTimezone, 'h:mm A')}
              </span>
              {/* media slot — 23px r6 measured on Buffer's month pills */}
              {mediaUrl && (
                <img
                  src={mediaUrl}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                  className="w-[23px] h-[23px] min-w-[23px] rounded-[6px] object-cover ms-auto"
                />
              )}
            </div>
          </>
        ) : display === 'week' ? (
          // Buffer week card anatomy: [18px platform glyph + time] header,
          // then body row = 2-line snippet LEFT + 44px r6 thumbnail RIGHT
          <>
            <div className="w-full flex items-center gap-[6px]">
              <img
                className="w-[18px] h-[18px] min-w-[18px] rounded-[4px]"
                src={`/icons/platforms/${post.integration?.providerIdentifier}.png`}
                alt=""
              />
              <div className="text-[15px] font-[400] text-newTextColor whitespace-nowrap">
                {formatPostTime(post.publishDate, displayTimezone, 'h:mm A')}
              </div>
            </div>
            <div className="w-full flex items-start gap-[8px]">
              <div className="flex-1 min-w-0 text-[14px] text-start break-words line-clamp-2 text-newTextColor/80">
                {state === 'DRAFT' ? t('draft', 'Draft') + ': ' : ''}
                {stripHtmlValidation('none', post.content, false, true, false)}
              </div>
              {mediaUrl && (
                <img
                  src={mediaUrl}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                  className="w-[44px] h-[44px] min-w-[44px] rounded-[6px] object-cover"
                />
              )}
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
      <div className="text-textColor text-[14px]">
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

      <div className="flex gap-2 pt-2 border-t border-tableBorder">
        <button
          onClick={onContinueWithoutSet}
          className="flex-1 px-4 py-2 text-textColor border border-newTableBorder rounded-[8px] transition-colors hover:bg-boxHover"
        >
          {t('continue_without_set', 'Continue without set')}
        </button>
      </div>
    </div>
  );
};
