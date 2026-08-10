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
import { SkeletonAvatarRow } from '@gitroom/frontend/components/layout/skeleton';

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
    // `relative` stays on the wrapper — it anchors the absolute DropdownPanel;
    // the 32px hover box (S4: quiet icon triggers get a visible box + a
    // >=32px tap target) lives on the button inside it.
    <div className="relative select-none" ref={ref}>
      <button
        type="button"
        onClick={changeShow}
        aria-label={t('integration_options', 'Integration options')}
        className="w-[32px] h-[32px] rounded-[8px] flex items-center justify-center cursor-pointer text-menuDots hover:text-menuDotsHover hover:bg-boxHover transition-colors duration-150"
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
      </button>
      {show && (
        // spec menu surface: white card, r6, p8, 32px r6 rows at 14/500
        // (the old 'menu' surface was the bg-fifth legacy generation).
        // !rounded-[6px] — the panel surface carries rounded-[12px]
        // (codebase precedent for radius overrides: filters.tsx:274).
        <DropdownPanel
          surface="panel"
          anchor="end"
          className="p-[8px] min-w-[200px] !rounded-[6px]"
        >
          <div
            className="flex gap-[12px] items-center h-[32px] px-[8px] rounded-[6px] text-[14px] font-[500] text-[#F97066] cursor-pointer hover:bg-boxHover transition-colors duration-150"
            onClick={deleteChannel(tParty.id)}
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
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
            <div>{t('delete_integration', 'Delete Integration')}</div>
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
  // pb-[56px]: the fixed bottom-center admin pill (S6) must hover over dead
  // space, never the last catalog row's Add buttons.
  return (
    <div className="bg-newBgColorInner flex-1 flex flex-col p-[20px] pb-[56px] gap-[24px] phone:p-[16px] phone:pb-[56px]">
      {/* S1 page header (filters.tsx PageHeader anatomy): 40px r10 hairline
          icon chip + 20/400 display-face h1. The generic 64px top bar is
          pathname-excluded for /third-party, so this row is the page title
          at BOTH widths (390 previously opened on the 'CONNECTED:' eyebrow
          with no title at all). No right action: adding an integration is
          per-card, so the page has no page-level primary. */}
      <div className="flex items-center gap-[10px] select-none">
        <div className="w-[40px] h-[40px] rounded-[10px] border border-newTableBorder flex items-center justify-center text-newTextColor shrink-0">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="7" height="7" x="3" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="14" rx="1" />
            <rect width="7" height="7" x="3" y="14" rx="1" />
          </svg>
        </div>
        <h1
          className="font-display text-[20px] font-[400] text-newTextColor truncate"
          data-cs
        >
          {t('integrations', 'Integrations')}
        </h1>
        <div className="flex-1" />
      </div>
      <div className="flex flex-col gap-[12px]">
        {/* 13px muted sentence-case section header — Buffer never uses
            tracked-uppercase eyebrows or trailing colons */}
        <div className="text-[13px] text-newTextColor/60">
          {t('connected_integrations', 'Connected integrations')}
        </div>
        {isLoading ? (
          // Buffer-style skeleton: two rows shaped like the ChannelRow list
          // below (40px round avatar + name bar in the bordered card) — never
          // a spinner where content is about to appear
          <div className="flex flex-col border border-newTableBorder rounded-[12px]">
            {[0, 1].map((i) => (
              <SkeletonAvatarRow
                key={i}
                size={40}
                className="px-[12px] py-[12px] border-b border-newTableBorder last:border-b-0"
              />
            ))}
          </div>
        ) : !data?.length ? (
          // S2 empty state: 64px muted circle + 24px stroke icon, 16/600
          // heading, 14px muted subline (the hero variant supplies the type
          // ramp) — replaces the bare one-line 'pane' message.
          <EmptyState
            variant="hero"
            className="pt-[40px] pb-[24px]"
            icon={
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
                  <path d="M12 22v-5" />
                  <path d="M9 8V2" />
                  <path d="M15 8V2" />
                  <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
                </svg>
              </div>
            }
            title={t('no_integrations_yet', 'No integrations yet')}
            description={t(
              'no_integrations_description',
              'Connect HeyGen or Reel.Farm to import media into your posts.'
            )}
          />
        ) : data?.length ? (
          // Bordered card list (radius 12). No overflow-hidden: the kebab's
          // DropdownPanel is `absolute top-[100%]` and must escape the card;
          // first/last radii keep the row hover fill inside the corners.
          <div className="flex flex-col border border-newTableBorder rounded-[12px]">
            {data.map((p: any) => (
              // Buffer channel-management row anatomy: 40px avatar, 15/600
              // name, ~64px row (py-[12px]), 12px gap.
              <ChannelRow
                key={p.id}
                integration={p}
                gap={12}
                center={false}
                roundedEnd={false}
                tooltip={p.title}
                className="px-[12px] py-[12px] border-b border-newTableBorder last:border-b-0 first:rounded-t-[12px] last:rounded-b-[12px]"
                nameProps={{ className: 'text-[15px] font-[600]' }}
                avatar={
                  <ChannelAvatar
                    picture={`/icons/third-party/${p.identifier}.png`}
                    fallback={`/icons/third-party/${p.identifier}.png`}
                    identifier={p.identifier}
                    name={p.title}
                    size={40}
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
