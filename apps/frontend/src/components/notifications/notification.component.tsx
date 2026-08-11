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
    '<a class="cursor-pointer underline font-[650]" target="_blank" href="$1">$1</a>'
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
        // kit list row: min 32px, 14px ink, hairline divider; unread rows get
        // the header wash + semibold instead of the legacy seventh/third
        // keyframe flash. shrink-0: the row is a flex item of the scrollable
        // list column, and the explicit min-h-[32px] replaces the
        // min-height:auto floor, so a constrained list (the phone sheet)
        // squeezed every row toward 32px and the two text lines painted over
        // the next row; shrink-0 keeps rows full height and the list scrolls.
        `shrink-0 min-h-[32px] px-[16px] py-[8px] text-[14px] text-newTextColor border-b border-newTableBorder last:border-b-0 transition-colors`,
        newNotification && 'font-[550] bg-newTableHeader'
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
export const NotificationOpenComponent: FC<{
  close: () => void;
}> = (props) => {
  const fetch = useFetch();
  const loadNotifications = useCallback(async () => {
    return await (await fetch('/notifications/list')).json();
  }, []);
  const t = useT();

  const { data, isLoading } = useSWR('notifications', loadNotifications);

  // ONE body, two shells below: the exact same header + list rows render
  // inside the desktop DropdownPanel and the phone bottom sheet.
  const body = (
    <>
      <div
        className={`p-[16px] border-b border-newTableBorder text-[16px] font-[550] text-newTextColor`}
      >
        {t('notifications', 'Notifications')}
      </div>

      {/* phone:max-h-none: inside the bottom sheet the sheet's max-h-[70dvh]
          flex column governs; this list (a scroll container, so its flex min
          size is 0) shrinks to the space left under the pinned handle +
          header and scrolls internally. The 400px cap is the desktop
          dropdown's. */}
      <div className="flex flex-col max-h-[400px] phone:max-h-none overflow-y-auto scrollbar scrollbar-thumb-newTableBorder scrollbar-track-newBgColor">
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
    </>
  );

  return (
    <>
      {/* Desktop: the anchored dropdown, behavior unchanged (the portaled
          DropdownPanel's own viewport math flips it above the bell in the
          sidebar footer and clamps it inside the screen, replacing the old
          UTIL_FLIP retarget); phone:hidden only adds the max-767 cutoff and
          keeps working because the portal carries this className. */}
      <DropdownPanel
        surface="panel"
        anchor="end"
        // 420px is wider than a phone and this is anchored end-0 to the bell, so
        // on mobile it hung off the left edge with its text cut off — hence the
        // max-w guard.
        // !rounded-[8px]: the shared panel surface is the r12 Buffer card; the
        // bell menu is the r8 dropdown spec, so the radius is overridden here
        // while keeping the panel's shadow stack (which carries the light-mode
        // hairline ring) and dark-mode hairline border
        className="phone:hidden opacity-0 animate-normalFadeDown mt-[10px] !rounded-[8px] w-[420px] max-w-[calc(100vw-48px)] min-h-[200px] flex flex-col"
      >
        {body}
      </DropdownPanel>
      {/* Phone: the bell lives at the BOTTOM of the sidebar/drawer now, so the
          anchored panel opened off-canvas (measured L:-212 B:1303 at 402x874).
          Same rows as a bottom sheet instead, on the PhoneFilterSheet/
          PhoneCalendarSheet shell from launches/filters.tsx (fixed scrim,
          white rounded-t card, backdrop tap closes; h-[100dvh] because a
          fixed inset-0 box refuses to stretch between insets in this stack).
          `fixed` (not .absolute) keeps it clear of the footer's UTIL_FLIP
          retarget. No 'cs:surface-open' announcement: the drawer
          would yield (close) and unmount this sheet with it, and the scrim
          already covers the drawer; closing returns to it. */}
      <div
        className="hidden phone:flex fixed inset-0 h-[100dvh] w-full z-[650] bg-black/50 items-end"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.close();
        }}
      >
        <div className="w-full bg-newBgColorInner rounded-t-[16px] pb-[20px] max-h-[70dvh] overflow-y-auto flex flex-col">
          <div className="w-[36px] h-[4px] rounded-full bg-newTextColor/20 mx-auto my-[10px] shrink-0" />
          {body}
        </div>
      </div>
    </>
  );
};
const NotificationComponent = () => {
  const fetch = useFetch();
  const { open: show, toggle, close, ref } = useDropdown();
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
      {show && <NotificationOpenComponent close={close} />}
    </div>
  );
};
export default NotificationComponent;
