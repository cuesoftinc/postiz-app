'use client';

import React, {
  FC,
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
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
import { Button } from '@gitroom/react/form/button';
import { ModalBody } from '@gitroom/frontend/components/cuesoft/modal/modal-body';

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

const convertTimeFormatBasedOnLocality = (time: number) => {
  if (isUSCitizen()) {
    return `${time === 12 ? 12 : time % 12}:00 ${time >= 12 ? 'PM' : 'AM'}`;
  } else {
    return `${time}:00`;
  }
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
              {newDayjs()
                .utc()
                .startOf('day')
                .add(option[0].time, 'minute')
                .local()
                .format(isUSCitizen() ? 'hh:mm A' : 'LT')}
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
  const t = useT();

  // Use dayjs to get localized day names
  const localizedDays = useMemo(() => {
    const currentLanguage = i18next.resolvedLanguage || 'en';
    dayjs.locale(currentLanguage);

    const days = [];
    const weekStart = newDayjs(startDate);
    for (let i = 0; i < 7; i++) {
      const day = weekStart.add(i, 'day');
      days.push({
        name: day.format('dddd'),
        day: day.format('L'),
        date: day,
      });
    }
    return days;
  }, [i18next.resolvedLanguage, startDate]);

  return (
    <div className="flex flex-col text-textColor flex-1">
      <div className="flex-1 relative">
        <div className="grid [grid-template-columns:136px_repeat(7,_minmax(0,_1fr))] gap-[1px] bg-newTableBorder rounded-[10px] absolute h-full start-0 top-0 w-full overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
          <div className="z-10 bg-newTableHeader flex justify-center items-center flex-col h-[62px] sticky top-0"></div>
          {localizedDays.map((day, index) => (
            <div
              key={day.name}
              className="p-2 text-center bg-newTableHeader flex justify-center items-center flex-col h-[62px] sticky top-0 z-[20]"
            >
              <div className="text-[14px] font-[500] text-newTableText">
                {day.name}
              </div>
              <div
                className={clsx(
                  'text-[14px] font-[600] flex items-center justify-center gap-[6px]',
                  day.day === newDayjs().format('L') &&
                    'text-newTableTextFocused'
                )}
              >
                {day.day === newDayjs().format('L') && (
                  <div className="w-[6px] h-[6px] bg-newTableTextFocused rounded-full" />
                )}
                {day.day}
              </div>
            </div>
          ))}
          {hours.map((hour) => (
            <Fragment key={hour}>
              <div className="p-2 pe-4 text-center items-center justify-center flex text-[14px] text-newTableText bg-newBgColorInner">
                {convertTimeFormatBasedOnLocality(hour)}
              </div>
              {localizedDays.map((day, indexDay) => (
                <Fragment
                  key={`${startDate}-${day.date.format('YYYY-MM-DD')}-${hour}`}
                >
                  <div className="relative bg-newBgColorInner">
                    <CalendarColumn
                      getDate={day.date.hour(hour).startOf('hour')}
                    />
                  </div>
                </Fragment>
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
  const t = useT();

  // Use dayjs to get localized day names
  const localizedDays = useMemo(() => {
    const currentLanguage = i18next.resolvedLanguage || 'en';
    dayjs.locale(currentLanguage);

    const days = [];
    // Starting from Monday (1) to Sunday (7)
    for (let i = 1; i <= 7; i++) {
      days.push(newDayjs().day(i).format('dddd'));
    }
    return days;
  }, [i18next.resolvedLanguage]);

  const calendarDays = useMemo(() => {
    const monthStart = newDayjs(startDate);
    const currentMonth = monthStart.month();
    const currentYear = monthStart.year();

    const startOfMonth = newDayjs(new Date(currentYear, currentMonth, 1));

    // Calculate the day offset for Monday (isoWeekday() returns 1 for Monday)
    const startDayOfWeek = startOfMonth.isoWeekday(); // 1 for Monday, 7 for Sunday
    const daysBeforeMonth = startDayOfWeek - 1; // Days to show from the previous month

    // Get the start date (Monday of the first week that includes this month)
    const calendarStartDate = startOfMonth.subtract(daysBeforeMonth, 'day');

    // Create an array to hold the calendar days (6 weeks * 7 days = 42 days max)
    const calendarDays = [];
    let currentDay = calendarStartDate;
    for (let i = 0; i < 42; i++) {
      let label = 'current-month';
      if (currentDay.month() < currentMonth) label = 'previous-month';
      if (currentDay.month() > currentMonth) label = 'next-month';
      calendarDays.push({
        day: currentDay,
        label,
      });

      // Move to the next day
      currentDay = currentDay.add(1, 'day');
    }
    return calendarDays;
  }, [startDate]);

  return (
    <div className="flex flex-col text-textColor flex-1">
      <div className="flex-1 flex relative">
        <div className="grid grid-cols-7 grid-rows-[62px_auto] gap-[1px] bg-newTableBorder rounded-[10px] absolute start-0 top-0 overflow-auto w-full h-full scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
          {localizedDays.map((day) => (
            <div
              key={day}
              className="z-[20] p-2 bg-newTableHeader flex justify-center items-center flex-col h-full sticky top-0"
            >
              <div className="text-[14px] font-[500] text-newTableText">{day}</div>
            </div>
          ))}
          {calendarDays.map((date, index) => (
            <div
              key={index}
              className="text-center items-center justify-center flex bg-newBgColorInner"
            >
              <CalendarColumn
                getDate={newDayjs(date.day).endOf('day')}
                randomHour={true}
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
  const { integrations, loading, listPosts, listState } = useCalendar();
  const emptyMessage =
    listState === 'scheduled'
      ? t('no_upcoming_posts', 'No posts in your queue')
      : listState === 'draft'
      ? t('no_draft_posts', 'No draft posts')
      : listState === 'published'
      ? t('no_published_posts', 'No sent posts')
      : t('no_posts', 'No posts');

  // Use shared post actions hook
  const { editPost, deletePost, copyDebugJson, openStatistics, openMissingRelease } = usePostActions();

  // Group posts by date
  const groupedPosts = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    listPosts.forEach((post) => {
      const dateKey = newDayjs(post.publishDate).local().format('YYYY-MM-DD');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(post);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [listPosts]);

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <div className="text-textColor">{t('loading', 'Loading...')}</div>
      </div>
    );
  }

  if (listPosts.length === 0) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <div className="text-textColor text-[16px]">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[10px] flex-1 relative">
      <div className="absolute start-0 top-0 w-full h-full flex flex-col overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
        {groupedPosts.map(([dateKey, datePosts]) => (
          <Fragment key={dateKey}>
            {/* Buffer §Queue two-tone header: weekday prefix bright, rest muted
                (tones live in global.scss, keyed to this element's classes).
                Today/Tomorrow is pure presentation of the same date. */}
            <div className="text-start text-[17px] text-newTextColor font-[500] mt-[32px] first:mt-[8px] mb-[12px] px-[10px]">
              <span>
                {(newDayjs(dateKey).isSame(newDayjs(), 'day')
                  ? t('today', 'Today')
                  : newDayjs(dateKey).isSame(newDayjs().add(1, 'day'), 'day')
                  ? t('tomorrow', 'Tomorrow')
                  : newDayjs(dateKey).format('dddd')) + ','}
              </span>{' '}
              <span>
                {newDayjs(dateKey).format(isUSCitizen() ? 'MMMM D' : 'D MMMM')}
              </span>
            </div>
            <div className="cs-queue flex flex-col gap-[12px] mb-[16px] px-[10px]">
              {datePosts.map((post) => (
                <CalendarItem
                  key={post.id}
                  display="day"
                  isBeforeNow={false}
                  date={newDayjs(post.publishDate)}
                  state={post.state}
                  statistics={openStatistics(post.id)}
                  missingRelease={openMissingRelease(post.id)}
                  editPost={editPost(post, false)}
                  duplicatePost={editPost(post, true)}
                  copyDebugJson={user?.isSuperAdmin ? copyDebugJson(post) : undefined}
                  post={post}
                  integrations={integrations}
                  deletePost={deletePost(post)}
                  showTime={true}
                />
              ))}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
};

export const Calendar = () => {
  const { display } = useCalendar();
  return (
    <>
      {display === 'list' ? (
        <ListView />
      ) : display === 'day' ? (
        <DayView />
      ) : display === 'week' ? (
        <WeekView />
      ) : (
        <MonthView />
      )}
    </>
  );
};
export const CalendarColumn: FC<{
  getDate: dayjs.Dayjs;
  randomHour?: boolean;
}> = memo((props) => {
  const t = useT();

  const { getDate, randomHour } = props;
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
  return (
    <div
      className={clsx(
        'flex flex-col w-full min-h-full relative',
        isBeforeNow && 'repeated-strip',
        loading && 'animate-pulse',
        // week/month cells sit in a collapsed hairline grid (the 1px gaps carry
        // the border token) with a near-invisible wash; day view keeps its own
        // bordered rows
        display !== 'day' && 'bg-newTextColor/[0.02]',
        isBeforeNow
          ? 'cursor-not-allowed'
          : display === 'day'
          ? 'border border-newTableBorder rounded-[8px]'
          : ''
      )}
      ref={drop as any}
    >
      {display === 'month' && (
        <div
          className={clsx(
            'pt-[6px] px-[8px] text-[14px] text-start text-newTableText flex items-center gap-[6px]',
            getDate.isSame(newDayjs(), 'day') &&
              'cs-today text-newTableTextFocused'
          )}
        >
          {getDate.date()}
        </div>
      )}
      <div
        className={clsx(
          'relative flex flex-col flex-1 rounded-[8px] min-h-[70px]',
          canDrop && 'border border-forth'
        )}
      >
        <div
          className={clsx(
            'flex-col text-[12px] pointer w-full flex scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor',
            isBeforeNow ? 'flex-1' : 'cursor-pointer',
            isBeforeNow && postList.length === 0 && 'col-calendar'
          )}
        >
          {loading && (
            <div className="h-full w-full p-[5px] animate-pulse absolute left-0 top-0 z-[50]">
              <div className="h-full w-full bg-newSettings rounded-[10px]" />
            </div>
          )}
          {list.map((post) => (
            <div
              key={post.id}
              className={clsx(
                'text-textColor p-[2.5px] relative flex flex-col justify-center items-center'
              )}
            >
              <div className="relative w-full flex flex-col items-center p-[2.5px]">
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
              className="text-center cursor-pointer py-[5px] text-[14px] text-newTextColor/60 hover:text-newTextColor"
              onClick={showAllFunc}
            >
              <span aria-hidden="true">⌄</span> {postList.length - 3}{' '}
              {t('show_more', 'More')}
            </div>
          )}
          {showAll && postList.length > 3 && (
            <div
              className="text-center hover:underline py-[5px] text-forth"
              onClick={showLessFunc}
            >
              {t('show_less', '- Show less')}
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
                display === ('month' as any)
                  ? 'flex-1 min-h-[40px] w-full'
                  : !postList.length
                  ? 'min-h-full w-full p-[5px]'
                  : 'min-h-[40px] w-full',
                'flex items-center justify-center cursor-pointer pb-[2.5px]'
              )}
            >
              {display !== 'day' && (
                <div
                  className={clsx(
                    'group hover:before:h-[30px] w-full h-full rounded-[10px] flex justify-center items-center'
                  )}
                >
                  <div
                    className={`group-hover:before:content-["+"] pb-[5px] flex justify-center items-center rounded-[8px] transition-all group-hover:bg-btnPrimary w-full h-full max-w-[40px] max-h-[40px]`}
                  />
                </div>
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
  const showCreationMethodBadge =
    user?.impersonate &&
    post.creationMethod &&
    post.creationMethod !== 'UNKNOWN';
  const preview = useCallback(() => {
    window.open(`/p/` + post.id + '?share=true', '_blank');
  }, [post]);
  // Buffer parity: the card actions live in a labeled dropdown behind one
  // kebab, not a row of bare icons. Same handlers, new surface.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuItemCls =
    'flex items-center gap-[10px] px-[10px] py-[7px] rounded-[6px] hover:bg-boxHover cursor-pointer text-[13px] whitespace-nowrap text-newTextColor';
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
              (post.integration.providerIdentifier === 'x' &&
                disableXAnalytics) ||
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
          </div>
        </>
      )}
      <div
        onClick={editPost}
        className={clsx(
          'gap-[5px] w-full flex h-full flex-1 rounded-br-[10px] rounded-bl-[10px] text-[14px] bg-newColColor border border-newTableBorder',
          display === 'month' ? 'p-[5px] items-center' : 'p-[8px]',
          'relative',
          isBeforeNow && '!grayscale'
        )}
      >
        <div className={clsx('relative min-w-[20px]')}>
          <img
            className="w-[20px] h-[20px] rounded-[8px]"
            src={post.integration.picture! || '/no-picture.jpg'}
          />
          <img
            className="w-[12px] h-[12px] rounded-[8px] absolute z-10 top-[10px] end-0 border border-fifth"
            src={`/icons/platforms/${post.integration?.providerIdentifier}.png`}
          />
        </div>
        {display === 'month' ? (
          // Buffer month cells carry compact pills — platform icon + time,
          // no post text (the payload has no media thumbnail to show)
          <div className="flex-1 flex items-center text-[12px] text-newTextColor whitespace-nowrap">
            {state === 'DRAFT' ? t('draft', 'Draft') + ' · ' : ''}
            {newDayjs(post.publishDate)
              .local()
              .format(isUSCitizen() ? 'h:mm A' : 'HH:mm')}
          </div>
        ) : (
          <div className="w-full flex-1 flex flex-col min-h-[40px]">
            <div className="text-start">
              {state === 'DRAFT' ? t('draft', 'Draft') + ': ' : ''}
            </div>
            <div className="w-full relative">
              <div className="absolute top-0 start-0 w-full text-ellipsis break-words line-clamp-1 text-start">
                {stripHtmlValidation('none', post.content, false, true, false) ||
                  t('no_content', 'no content')}
              </div>
            </div>
          </div>
        )}
        {showTime && (
          <div className="text-newTextColor text-[15px] whitespace-nowrap flex items-center justify-end text-end">
            {newDayjs(post.publishDate).local().format(isUSCitizen() ? 'hh:mm A' : 'HH:mm')}
          </div>
        )}
      </div>
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
