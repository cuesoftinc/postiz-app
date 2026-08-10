'use client';

import useSWR from 'swr';
import { FC, useCallback, useMemo, useState } from 'react';
import { capitalize, orderBy } from 'lodash';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { RenderAnalytics } from '@gitroom/frontend/components/platform-analytics/render.analytics';
import { Button } from '@gitroom/react/form/button';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { AnalyticsPageSkeleton } from '@gitroom/frontend/components/platform-analytics/analytics.skeletons';
import { AnalyticsChartSection } from '@gitroom/frontend/components/platform-analytics/analytics-chart';
import { ChannelsSummarySection } from '@gitroom/frontend/components/platform-analytics/channels-summary';
import { RecentPostsSection } from '@gitroom/frontend/components/platform-analytics/recent-posts';
import { sidePanelRoot } from '@gitroom/frontend/components/new-layout/side-panel';
import {
  SidePanelHeader,
  useSidePanelCollapse,
} from '@gitroom/frontend/components/new-layout/side-panel-header';
import { ChannelRow } from '@gitroom/frontend/components/new-layout/channel-row';
import { EmptyState } from '@gitroom/frontend/components/cuesoft/empty-state';
const allowedIntegrations = [
  'facebook',
  'instagram',
  'instagram-standalone',
  'linkedin-page',
  'tiktok',
  'youtube',
  'gmb',
  'pinterest',
  'threads',
  'x',
];

/** Buffer Insights bar-chart glyph — shared by the page-header chip (20px)
    and the no-channels empty state (24px). vb24, stroke 2.2, round caps. */
const BarChartGlyph: FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <path d="M8 17v-3" />
    <path d="M13 17V9" />
    <path d="M18 17V5" />
  </svg>
);

/** S1 page header, cloned from the /launches pattern (filters.tsx):
    [40px r10 hairline icon chip w/ 20px glyph][h1 display 20/400][flex-1].
    No right-side actions — Postiz has no Export, so none is invented.
    data-cs on the chip keeps the ladder from squashing h-[40px] to 32 and
    rounded-[10px] to 8. Rendered twice: a desktop copy inside the content
    pane (phone:hidden) and a 56px phone row above the channel strip (the
    generic layout Title bar is phone:hidden, so 390 had no title at all). */
const AnalyticsHeaderRow: FC<{ title: string }> = ({ title }) => (
  <div className="flex w-full items-center gap-[10px] select-none min-w-0">
    <div
      data-cs
      className="w-[40px] h-[40px] rounded-[10px] border border-newTableBorder flex items-center justify-center text-newTextColor shrink-0"
    >
      <BarChartGlyph size={20} />
    </div>
    <h1
      className="font-display text-[20px] font-[400] text-newTextColor truncate min-w-0"
      data-cs
    >
      {title}
    </h1>
    <div className="flex-1" />
  </div>
);

export const PlatformAnalytics = () => {
  const fetch = useFetch();
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { disableXAnalytics } = useVariables();

  const [key, setKey] = useState(7);
  const [rangeSheetOpen, setRangeSheetOpen] = useState(false);
  const { collapsed, toggle } = useSidePanelCollapse();
  const toaster = useToaster();
  const load = useCallback(async () => {
    const int = (
      await (await fetch('/integrations/list')).json()
    ).integrations.filter((f: any) => {
      if (f.identifier === 'x' && disableXAnalytics) {
        return false;
      }
      return true;
    });
    return int.filter((f: any) => allowedIntegrations.includes(f.identifier));
  }, []);
  const { data, isLoading } = useSWR('analytics-list', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    fallbackData: [],
  });
  const sortedIntegrations = useMemo(() => {
    return orderBy(
      data,
      ['type', 'disabled', 'identifier'],
      ['desc', 'asc', 'asc']
    );
  }, [data]);
  // URL-driven selection (Buffer parity): the global sidebar's channel rows
  // link to /analytics?integration=<id>; unknown/absent ids fall back to the
  // first channel, exactly like the old index-0 default.
  const integrationParam = searchParams.get('integration');
  const currentIntegration = useMemo(() => {
    return (
      sortedIntegrations.find((p: any) => p.id === integrationParam) ??
      sortedIntegrations[0]
    );
  }, [integrationParam, sortedIntegrations]);
  const options = useMemo(() => {
    if (!currentIntegration) {
      return [];
    }
    const arr = [];
    if (
      [
        'facebook',
        'instagram',
        'instagram-standalone',
        'linkedin-page',
        'pinterest',
        'youtube',
        'threads',
        'gmb',
        'x',
        'tiktok',
      ].indexOf(currentIntegration.identifier) !== -1
    ) {
      arr.push({
        key: 7,
        value: t('7_days', '7 Days'),
      });
    }
    if (
      [
        'facebook',
        'instagram',
        'instagram-standalone',
        'linkedin-page',
        'pinterest',
        'youtube',
        'threads',
        'gmb',
        'x',
        'tiktok',
      ].indexOf(currentIntegration.identifier) !== -1
    ) {
      arr.push({
        key: 30,
        value: t('30_days', '30 Days'),
      });
    }
    if (
      ['facebook', 'linkedin-page', 'pinterest', 'youtube', 'x', 'gmb'].indexOf(
        currentIntegration.identifier
      ) !== -1
    ) {
      arr.push({
        key: 90,
        value: t('90_days', '90 Days'),
      });
    }
    return arr;
  }, [currentIntegration]);
  const keys = useMemo(() => {
    if (!currentIntegration) {
      return 7;
    }
    if (options.find((p) => p.key === key)) {
      return key;
    }
    return options[0]?.key;
  }, [key, currentIntegration]);

  // Buffer's Summary subline shows the concrete range ("Jul 12 - Aug 10,
  // 2026"), not an echo of the selected chip. No "Compared to" — there is no
  // comparison data in the API.
  const dateRangeLabel = useMemo(() => {
    if (!keys) {
      return '';
    }
    return `${dayjs().subtract(keys, 'day').format('MMM D')} – ${dayjs().format(
      'MMM D, YYYY'
    )}`;
  }, [keys]);

  const pageTitle = t('analytics', 'Insights');

  if (isLoading) {
    // Buffer loading: the page's own shape in soft grey blocks (header chip,
    // toolbar, Summary section with tile blocks) — never a spinner.
    return <AnalyticsPageSkeleton />;
  }

  if (!sortedIntegrations.length && !isLoading) {
    return (
      <>
        {/* S1 phone header — 56px title row (the generic layout bar is
            phone:hidden, so this is the page's only title at 390) */}
        <div className="hidden phone:flex bg-newBgColorInner h-[56px] px-[12px] items-center shrink-0">
          <AnalyticsHeaderRow title={pageTitle} />
        </div>
        <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[12px]">
          <div className="phone:hidden">
            <AnalyticsHeaderRow title={pageTitle} />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center">
            {/* S2 empty state: 64px muted circle + 24px stroke glyph instead
                of the old /peoplemarketplace.svg marketing illustration */}
            <EmptyState
              variant="hero"
              image={
                <div className="w-[64px] h-[64px] rounded-full bg-newTextColor/5 flex items-center justify-center text-newTextColor/60">
                  <BarChartGlyph size={24} />
                </div>
              }
              title={t('can_t_show_analytics_yet', "Can't show insights yet")}
              description={
                <>
                  {t(
                    'you_have_to_add_social_media_channels',
                    'You have to add Social Media channels'
                  )}
                  <br />
                  {t('supported', 'Supported:')}{' '}
                  {allowedIntegrations.map((p) => capitalize(p)).join(', ')}
                </>
              }
              action={
                <Button onClick={() => router.push('/launches')}>
                  {t(
                    'go_to_the_calendar_to_add_channels',
                    'Go to Publish to connect channels'
                  )}
                </Button>
              }
            />
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      {/* S1 phone header — sits above the channel strip, mirroring Buffer's
          390 order: app bar → title row → selector → content */}
      <div className="hidden phone:flex bg-newBgColorInner h-[56px] px-[12px] items-center shrink-0">
        <AnalyticsHeaderRow title={pageTitle} />
      </div>
      {/* Buffer has no second channel panel on desktop — the global sidebar's
          channel rows drive selection via /analytics?integration=<id>. Phones
          have no sidebar, so this strip stays as the phone-only selector (the
          global.scss ladder renders it as a horizontal chip row). */}
      <div
        data-side-panel="flow"
        className={clsx(
          'bg-newBgColorInner p-[20px] hidden phone:flex flex-col gap-[15px] transition-all phone:p-[12px]',
          sidePanelRoot(collapsed)
        )}
      >
        <div className="flex gap-[12px] flex-col">
          <SidePanelHeader title={t('channels')} onToggle={toggle} />
          {sortedIntegrations.map((integration) => (
            <ChannelRow
              key={integration.id}
              integration={integration}
              onClick={() => {
                if (integration.refreshNeeded) {
                  toaster.show(
                    'Please refresh the channel from Publish',
                    'warning'
                  );
                  return;
                }
                // Presentation of the same URL-driven selection — Next syncs
                // useSearchParams from native replaceState (same pattern as
                // launches.component / calendar.context).
                window.history.replaceState(
                  null,
                  '',
                  `/analytics?integration=${integration.id}`
                );
              }}
              dimmed={currentIntegration.id !== integration.id}
              // S5: Buffer never ghosts controls. ChannelRow's dimmed state is
              // opacity-20 (near-invisible chips on the phone strip); the
              // phone: variant is emitted after the base utility so it wins
              // at 390 and lifts unselected chips to a legible .55. The
              // SELECTED chip is marked with an ink border instead of pure
              // opacity contrast (! beats global.scss's hard-coded
              // rgba(128,128,128,.32) chip border). This strip is
              // hidden phone:flex, so neither class ever acts on desktop.
              className={
                currentIntegration.id !== integration.id
                  ? 'phone:opacity-[0.55]'
                  : 'phone:!border-newTextColor'
              }
            />
          ))}
        </div>
      </div>
      <div className="bg-newBgColorInner flex-1 flex-col flex p-[20px] gap-[12px]">
        {/* S1 desktop header (the phone copy renders above the strip) */}
        <div className="phone:hidden">
          <AnalyticsHeaderRow title={pageTitle} />
        </div>
        {!!options.length && (
          <div className="flex-1 flex flex-col gap-[14px]">
            {/* Buffer Insights toolbar: ONE white hairline container (32px,
                r8, 4px padding) holding 24px r6 radio segments — lowercase
                labels, active = green-tint fill, inactive borderless muted —
                separated from content by a full-width hairline. Same setter
                (setKey) + same bounded 7/30/90 per-platform option list the
                old chips drove. */}
            <div className="flex items-center border-b border-newTableBorder pb-[12px]">
              <div
                data-cs
                className="phone:hidden inline-flex items-center h-[32px] p-[4px] gap-[2px] rounded-[8px] border border-newTableBorder bg-newBgColorInner"
              >
                {options.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setKey(option.key)}
                    className={clsx(
                      'h-[24px] px-[10px] rounded-[6px] text-[14px] font-[500] lowercase whitespace-nowrap cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#325ea6]',
                      keys === option.key
                        ? 'bg-boxFocused text-textItemFocused'
                        : 'text-textItemBlur hover:bg-boxHover'
                    )}
                  >
                    {option.value}
                  </button>
                ))}
              </div>
              {/* Buffer 390 collapses the picker to a single bordered
                  "30 days ▾" trigger opening a bottom sheet */}
              <button
                type="button"
                data-cs
                onClick={() => setRangeSheetOpen(true)}
                className="hidden phone:inline-flex items-center gap-[8px] h-[40px] px-[12px] rounded-[8px] border border-newTableBorder bg-newBgColorInner text-[14px] font-[500] lowercase text-newTextColor"
              >
                {options.find((option) => option.key === keys)?.value}
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
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </div>
            {/* Buffer wraps each Insights block in a warm-grey SECTION (r12,
                tiles inset 8px, title inset 16px) with the header INSIDE:
                "Summary" 16/600 body face + muted concrete date range. */}
            <div className="bg-newTableHeader rounded-[12px] p-[8px] flex flex-col gap-[12px]">
              <div className="flex flex-col gap-[2px] px-[8px] pt-[8px]">
                <div className="text-[16px] font-[600]">
                  {t('summary', 'Summary')}
                </div>
                <div className="text-[14px] text-newTextColor/60">
                  {dateRangeLabel}
                </div>
              </div>
              <div className="flex-1">
                {/* key remounts the analytics on channel change — replaces the
                    old setRefresh(true)/setTimeout unmount trick. */}
                {!!keys && !!currentIntegration && (
                  <RenderAnalytics
                    key={currentIntegration.id}
                    integration={currentIntegration}
                    date={keys}
                  />
                )}
              </div>
            </div>
            {/* Insights enrichment — every number below is a real payload:
                Trends re-reads the SAME /analytics/:id response the tiles use
                (shared SWR key, one request); Recent posts joins
                /posts/list?state=published with /analytics/post/:id; Channels
                fans the per-channel /analytics call across the connected
                list. Sections that have nothing real to show render null. */}
            {!!keys && !!currentIntegration && (
              <>
                <AnalyticsChartSection
                  key={`chart-${currentIntegration.id}-${keys}`}
                  integration={currentIntegration}
                  date={keys}
                  subtitle={dateRangeLabel}
                />
                <RecentPostsSection
                  key={`recent-${currentIntegration.id}-${keys}`}
                  integration={currentIntegration}
                  date={keys}
                  subtitle={dateRangeLabel}
                />
                <ChannelsSummarySection
                  integrations={sortedIntegrations}
                  date={keys}
                  currentId={currentIntegration.id}
                  subtitle={dateRangeLabel}
                />
              </>
            )}
          </div>
        )}
      </div>
      {/* Phone date-range bottom sheet — same shell as the launches filter
          sheet (scrim, rounded top, drag handle), rows w/ check LEFT of the
          selected option per the spec's select-menu anatomy. */}
      {rangeSheetOpen && (
        <div
          // h-[100dvh]: in this stack a fixed inset-0 box refuses to stretch
          // between insets (verified live on the launches sheet) — explicit
          // viewport height is what actually pins the scrim over the page
          className="hidden phone:flex fixed inset-0 h-[100dvh] w-full z-[650] bg-black/50 items-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRangeSheetOpen(false);
          }}
        >
          <div className="w-full bg-newBgColorInner rounded-t-[16px] px-[8px] pb-[20px] max-h-[70vh] overflow-y-auto">
            <div className="w-[36px] h-[4px] rounded-full bg-newTextColor/20 mx-auto my-[10px]" />
            <div className="flex flex-col gap-[2px]">
              {options.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    setKey(option.key);
                    setRangeSheetOpen(false);
                  }}
                  className="flex items-center gap-[10px] w-full h-[44px] px-[12px] rounded-[8px] text-[14px] font-[500] lowercase text-newTextColor hover:bg-boxHover text-start"
                >
                  <span className="w-[16px] flex items-center justify-center shrink-0">
                    {keys === option.key && (
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
                    )}
                  </span>
                  {option.value}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
