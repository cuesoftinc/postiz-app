'use client';

import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { ThirdPartyListComponent } from '@gitroom/frontend/components/third-parties/third-party.list.component';
import React, { FC, useCallback, useState } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { ChannelRow } from '@gitroom/frontend/components/new-layout/channel-row';
import { ChannelAvatar } from '@gitroom/frontend/components/new-layout/channel-avatar';
import { EmptyState } from '@gitroom/frontend/components/cuesoft/empty-state';
import { DropdownPanel } from '@gitroom/frontend/components/cuesoft/dropdown/dropdown-panel';
import { useDropdown } from '@gitroom/frontend/components/cuesoft/dropdown/use-dropdown';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';

export const ThirdPartyMenuComponent: FC<{
  reload: () => void;
  tParty: { id: string };
}> = (props) => {
  const { tParty, reload } = props;
  const fetch = useFetch();
  // useDropdown instead of a bare useState: the kebab gains click-away and
  // Escape dismissal (plan-flagged deliberate behavior change — it previously
  // only closed by re-clicking the kebab or picking an action)
  const { open: show, close, toggle: changeShow, ref } = useDropdown();
  const t = useT();
  const toaster = useToaster();

  const deleteChannel = (id: string) => async () => {
    close();
    if (
      !(await deleteDialog('Are you sure you want to delete this integration?'))
    ) {
      return;
    }

    const res = await fetch(`/third-party/${id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      toaster.show('Integration deleted successfully', 'success');
      reload();
    } else {
      const error = await res.json();
      console.error('Error deleting integration:', error);
    }
  };

  return (
    <div
      className="cursor-pointer relative select-none text-menuDots hover:text-menuDotsHover"
      onClick={changeShow}
      ref={ref}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M13.125 12C13.125 12.2225 13.059 12.44 12.9354 12.625C12.8118 12.81 12.6361 12.9542 12.4305 13.0394C12.225 13.1245 11.9988 13.1468 11.7805 13.1034C11.5623 13.06 11.3618 12.9528 11.2045 12.7955C11.0472 12.6382 10.94 12.4377 10.8966 12.2195C10.8532 12.0012 10.8755 11.775 10.9606 11.5695C11.0458 11.3639 11.19 11.1882 11.375 11.0646C11.56 10.941 11.7775 10.875 12 10.875C12.2984 10.875 12.5845 10.9935 12.7955 11.2045C13.0065 11.4155 13.125 11.7016 13.125 12ZM12 6.75C12.2225 6.75 12.44 6.68402 12.625 6.5604C12.81 6.43679 12.9542 6.26109 13.0394 6.05552C13.1245 5.84995 13.1468 5.62375 13.1034 5.40552C13.06 5.1873 12.9528 4.98684 12.7955 4.82951C12.6382 4.67217 12.4377 4.56503 12.2195 4.52162C12.0012 4.47821 11.775 4.50049 11.5695 4.58564C11.3639 4.67078 11.1882 4.81498 11.0646 4.99998C10.941 5.18499 10.875 5.4025 10.875 5.625C10.875 5.92337 10.9935 6.20952 11.2045 6.4205C11.4155 6.63147 11.7016 6.75 12 6.75ZM12 17.25C11.7775 17.25 11.56 17.316 11.375 17.4396C11.19 17.5632 11.0458 17.7389 10.9606 17.9445C10.8755 18.15 10.8532 18.3762 10.8966 18.5945C10.94 18.8127 11.0472 19.0132 11.2045 19.1705C11.3618 19.3278 11.5623 19.435 11.7805 19.4784C11.9988 19.5218 12.225 19.4995 12.4305 19.4144C12.6361 19.3292 12.8118 19.185 12.9354 19C13.059 18.815 13.125 18.5975 13.125 18.375C13.125 18.0766 13.0065 17.7905 12.7955 17.5795C12.5845 17.3685 12.2984 17.25 12 17.25Z"
          fill="currentColor"
        />
      </svg>
      {show && (
        <DropdownPanel surface="menu" anchor="start">
          <div
            className="flex gap-[12px] items-center"
            onClick={deleteChannel(tParty.id)}
          >
            <div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path
                  d="M13.5 3H11V2.5C11 2.10218 10.842 1.72064 10.5607 1.43934C10.2794 1.15804 9.89782 1 9.5 1H6.5C6.10218 1 5.72064 1.15804 5.43934 1.43934C5.15804 1.72064 5 2.10218 5 2.5V3H2.5C2.36739 3 2.24021 3.05268 2.14645 3.14645C2.05268 3.24021 2 3.36739 2 3.5C2 3.63261 2.05268 3.75979 2.14645 3.85355C2.24021 3.94732 2.36739 4 2.5 4H3V13C3 13.2652 3.10536 13.5196 3.29289 13.7071C3.48043 13.8946 3.73478 14 4 14H12C12.2652 14 12.5196 13.8946 12.7071 13.7071C12.8946 13.5196 13 13.2652 13 13V4H13.5C13.6326 4 13.7598 3.94732 13.8536 3.85355C13.9473 3.75979 14 3.63261 14 3.5C14 3.36739 13.9473 3.24021 13.8536 3.14645C13.7598 3.05268 13.6326 3 13.5 3ZM6 2.5C6 2.36739 6.05268 2.24021 6.14645 2.14645C6.24021 2.05268 6.36739 2 6.5 2H9.5C9.63261 2 9.75979 2.05268 9.85355 2.14645C9.94732 2.24021 10 2.36739 10 2.5V3H6V2.5ZM12 13H4V4H12V13ZM7 6.5V10.5C7 10.6326 6.94732 10.7598 6.85355 10.8536C6.75979 10.9473 6.63261 11 6.5 11C6.36739 11 6.24021 10.9473 6.14645 10.8536C6.05268 10.7598 6 10.6326 6 10.5V6.5C6 6.36739 6.05268 6.24021 6.14645 6.14645C6.24021 6.05268 6.36739 6 6.5 6C6.63261 6 6.75979 6.05268 6.85355 6.14645C6.94732 6.24021 7 6.36739 7 6.5ZM10 6.5V10.5C10 10.6326 9.94732 10.7598 9.85355 10.8536C9.75979 10.9473 9.63261 11 9.5 11C9.36739 11 9.24021 10.9473 9.14645 10.8536C9.05268 10.7598 9 10.6326 9 10.5V6.5C9 6.36739 9.05268 6.24021 9.14645 6.14645C9.24021 6.05268 9.36739 6 9.5 6C9.63261 6 9.75979 6.05268 9.85355 6.14645C9.94732 6.24021 10 6.36739 10 6.5Z"
                  fill="#F97066"
                />
              </svg>
            </div>
            <div className="text-[12px]">
              {t('delete_integration', 'Delete Integration')}
            </div>
          </div>
        </DropdownPanel>
      )}
    </div>
  );
};

export const ThirdPartyComponent = () => {
  const t = useT();
  const fetch = useFetch();

  const integrations = useCallback(async () => {
    return (await fetch('/third-party')).json();
  }, []);

  const { data, isLoading, mutate } = useSWR('third-party', integrations, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });

  // Buffer-true layout: no second panel — one full-width column with the
  // connected integrations as a section above the catalog grid. No
  // `transition-all` on this root: global.scss's phone Settings-sub-nav rule
  // keys on `.bg-newBgColorInner.flex.flex-col.transition-all` and would
  // chip-ify the rows. Phone stacks the same column, just tighter padding.
  return (
    <div className="bg-newBgColorInner flex-1 flex flex-col p-[20px] gap-[24px] phone:p-[12px]">
      <div className="flex flex-col gap-[12px]">
        <div className="text-[12px] uppercase tracking-[0.08em] text-newTextColor/60">
          {t('connected', 'Connected')}
        </div>
        {isLoading ? (
          <div className="flex justify-center py-[20px]">
            <LoadingComponent />
          </div>
        ) : !data?.length ? (
          <EmptyState title={t('no_integrations_yet', 'No integrations yet')} />
        ) : data?.length ? (
          // Bordered card list (radius 12). No overflow-hidden: the kebab's
          // DropdownPanel is `absolute top-[100%]` and must escape the card;
          // first/last radii keep the row hover fill inside the corners.
          <div className="flex flex-col border border-newTableBorder rounded-[12px]">
            {data.map((p: any) => (
              <ChannelRow
                key={p.id}
                integration={p}
                gap={8}
                center={false}
                roundedEnd={false}
                tooltip={p.title}
                className="px-[12px] py-[10px] border-b border-newTableBorder last:border-b-0 first:rounded-t-[12px] last:rounded-b-[12px]"
                avatar={
                  <ChannelAvatar
                    picture={`/icons/third-party/${p.identifier}.png`}
                    fallback={`/icons/third-party/${p.identifier}.png`}
                    identifier={p.identifier}
                    name={p.title}
                    size={32}
                    shape="round"
                    showBadge={false}
                  />
                }
                trailing={
                  <ThirdPartyMenuComponent reload={mutate} tParty={p} />
                }
              />
            ))}
          </div>
        ) : null}
      </div>
      <ThirdPartyListComponent reload={mutate} />
    </div>
  );
};
