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
      {show && (
        <DropdownPanel surface="menu" anchor="start">
          <div
            className="flex gap-[12px] items-center"
            onClick={deleteChannel(tParty.id)}
          >
            <div className="text-[#F97066]">
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
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
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
