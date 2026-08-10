'use client';

import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { FC, useCallback, useState } from 'react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Skeleton } from '@gitroom/frontend/components/layout/skeleton';
import { DropdownPanel } from '@gitroom/frontend/components/cuesoft/dropdown/dropdown-panel';
import { useDropdown } from '@gitroom/frontend/components/cuesoft/dropdown/use-dropdown';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
function replaceLinks(text: string) {
  const urlRegex =
    /(\bhttps?:\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/gi;
  return text.replace(
    urlRegex,
    '<a class="cursor-pointer underline font-bold" target="_blank" href="$1">$1</a>'
  );
}
export const ShowNotification: FC<{
  notification: {
    createdAt: string;
    content: string;
  };
  lastReadNotification: string;
}> = (props) => {
  const { notification } = props;
  const [newNotification] = useState(
    new Date(notification.createdAt) > new Date(props.lastReadNotification)
  );
  const createdAt = dayjs(notification.createdAt);
  const isWithin24h = dayjs().diff(createdAt, 'hour') < 24;
  const fullDate = createdAt.format('MMM D, YYYY h:mm A');
  return (
    <div
      className={clsx(
        `text-textColor px-[16px] py-[10px] border-b border-tableBorder last:border-b-0 transition-colors`,
        newNotification && 'font-bold bg-seventh animate-newMessages'
      )}
    >
      <div
        className="break-words"
        dangerouslySetInnerHTML={{
          __html: replaceLinks(notification.content),
        }}
      />
      <div
        className="text-[12px] mt-[4px] text-newTextColor/60 font-normal"
        title={isWithin24h ? fullDate : undefined}
      >
        {isWithin24h ? createdAt.fromNow() : fullDate}
      </div>
    </div>
  );
};
export const NotificationOpenComponent = () => {
  const fetch = useFetch();
  const loadNotifications = useCallback(async () => {
    return await (await fetch('/notifications/list')).json();
  }, []);
  const t = useT();

  const { data, isLoading } = useSWR('notifications', loadNotifications);
  return (
    <DropdownPanel
      surface="panel"
      anchor="end"
      // 420px is wider than a phone and this is anchored end-0 to the bell, so
      // on mobile it hung off the left edge with its text cut off — hence the
      // max-w guard
      //: the elevated-surface token (#1e1e1e dark / #fff
      // light) — SURFACES.panel still carries the legacy bg-third navy, which
      // is darker than the page bg; override here until the shared surface
      // moves onto the token
      className="opacity-0 animate-normalFadeDown mt-[10px] w-[420px] max-w-[calc(100vw-48px)] min-h-[200px] flex flex-col"
    >
      <div
        className={`p-[16px] border-b border-tableBorder font-display text-[16px] font-[600]`}
      >
        {t('notifications', 'Notifications')}
      </div>

      <div className="flex flex-col max-h-[400px] overflow-y-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
        {isLoading && (
          // skeleton rows shaped like ShowNotification entries (date line +
          // content line) — never a spinner
          <div className="flex flex-col gap-[16px] p-[16px]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-[8px]">
                <Skeleton className="h-[12px] w-[35%]" />
                <Skeleton className="h-[14px] w-full" />
              </div>
            ))}
          </div>
        )}
        {!isLoading && !data.notifications.length && (
          <div className="text-center p-[16px] text-newTextColor/60 flex-1 flex justify-center items-center mt-[20px]">
            {t('no_notifications', 'No notifications')}
          </div>
        )}
        {!isLoading &&
          data.notifications.map(
            (
              notification: {
                createdAt: string;
                content: string;
              },
              index: number
            ) => (
              <ShowNotification
                notification={notification}
                lastReadNotification={data.lastReadNotifications}
                key={`notifications_${index}`}
              />
            )
          )}
      </div>
    </DropdownPanel>
  );
};
const NotificationComponent = () => {
  const fetch = useFetch();
  const { open: show, toggle, ref } = useDropdown();
  const loadNotifications = useCallback(async () => {
    return await (await fetch('/notifications')).json();
  }, []);
  const { data, mutate } = useSWR('notifications-list', loadNotifications);
  const changeShow = useCallback(() => {
    mutate(
      {
        ...data,
        total: 0,
      },
      {
        revalidate: false,
      }
    );
    toggle();
  }, [toggle, data]);
  return (
    <div className="relative cursor-pointer select-none" ref={ref}>
      <div onClick={changeShow}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="hover:text-newTextColor"
        >
          <path d="M10.268 21a2 2 0 0 0 3.464 0" />
          <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
          {data && data.total > 0 && (
            <circle
              cx="17.0625"
              cy="5"
              r="4"
              fill="var(--new-btn-primary)"
              stroke="var(--new-bgColorInner)"
              strokeWidth="2"
            />
          )}
        </svg>
      </div>
      {show && <NotificationOpenComponent />}
    </div>
  );
};
export default NotificationComponent;
