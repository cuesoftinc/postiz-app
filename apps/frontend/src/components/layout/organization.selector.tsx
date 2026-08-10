'use client';

import React, { FC, useCallback, useMemo } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import clsx from 'clsx';
export const OrganizationSelector: FC<{ asOpenSelect?: boolean }> = ({
  asOpenSelect,
}) => {
  const fetch = useFetch();
  const user = useUser();
  const load = useCallback(async () => {
    return await (await fetch('/user/organizations')).json();
  }, []);
  const { isLoading, data } = useSWR('organizations', load, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
    revalidateOnReconnect: false,
  });
  const current = useMemo(() => {
    return data?.find((d: any) => d.id === user?.orgId);
  }, [data]);
  const withoutCurrent = useMemo(() => {
    return data?.filter((d: any) => d.id !== user?.orgId);
  }, [current, data]);
  const changeOrg = useCallback(
    (org: { name: string; id: string }) => async () => {
      await fetch('/user/change-org', {
        method: 'POST',
        body: JSON.stringify({
          id: org.id,
        }),
      });
      window.location.reload();
    },
    []
  );
  if (isLoading || (!isLoading && data?.length === 1)) {
    return null;
  }
  return (
    <>
      <div className="hover:text-newTextColor">
        <div className="group text-[12px] relative">
          {asOpenSelect && (
            <div
              data-cs
              className="bg-btnPrimary text-black rounded-[8px] h-[40px] text-[14px] font-[600] items-center justify-center !flex !relative max-w-[500px] mx-auto px-[16px]"
            >
              Select Organization
            </div>
          )}
          {!asOpenSelect && (
            <div className="flex items-center">
              <svg
                className={user?.tier.current === 'FREE' ? 'animate-bounce drop-shadow-glow': ''}
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M18 20a6 6 0 0 0-12 0" />
                <circle cx="12" cy="10" r="4" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            </div>
          )}
          {data?.length > 1 && (
            // kit popover: white r8 hairline panel + soft shadow, 32px rows.
            // Stays flush to the trigger (no margin gap — it opens on hover,
            // so a gap would drop the hover chain and close it); keeps the
            // bare `absolute top-[100%] end-0` classes the sidebar's
            // UTIL_FLIP retargets.
            <div
              className={clsx(
                'hidden group-hover:flex absolute top-[100%] end-0 cursor-pointer flex-col',
                'min-w-[200px] p-[4px] gap-[2px] bg-newBgColorInner rounded-[8px] border border-newTableBorder shadow-[0_1px_1px_rgba(0,0,0,.02),0_4px_8px_rgba(0,0,0,.04)] z-[600]',
                asOpenSelect ? '!flex !relative max-w-[500px] mx-auto mb-[10px]' : '',
              )}
            >
              {data?.map((org: { name: string; id: string }) => (
                <div
                  key={org.id}
                  onClick={changeOrg(org)}
                  data-cs
                  className="h-[32px] px-[8px] rounded-[6px] flex items-center gap-[8px] text-[14px] text-newTextColor hover:bg-boxHover transition-colors duration-150"
                >
                  <div
                    data-cs
                    className="w-[24px] h-[24px] rounded-full bg-newTableHeader border border-newTableBorder flex items-center justify-center text-[11px] font-[600] uppercase shrink-0"
                  >
                    {org.name?.trim()?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 truncate">{org.name}</div>
                  {org.id === user?.orgId && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {!asOpenSelect && <div className="w-[1px] h-[20px] bg-blockSeparator" />}
    </>
  );
};
