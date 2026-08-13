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
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { AnalyticsPageSkeleton } from '@gitroom/frontend/components/platform-analytics/analytics.skeletons';
import { AnalyticsChartSection } from '@gitroom/frontend/components/platform-analytics/analytics-chart';
import { ChannelsSummarySection } from '@gitroom/frontend/components/platform-analytics/channels-summary';
import { RecentPostsSection } from '@gitroom/frontend/components/platform-analytics/recent-posts';
import { ChannelsDropdown } from '@gitroom/frontend/components/new-layout/channels-dropdown';
import { EmptyState } from '@gitroom/frontend/components/cuesoft/empty-state';
import {
  PageHeader,
  PageShell,
} from '@gitroom/frontend/components/new-layout/page-header';
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
  // The Buffer relay channels. Their numbers come from Buffer rather than the
  // platform's own API, but they are real and belong on this page like any
  // other channel — a provider implementing analytics() is invisible here
  // unless its identifier is in this list.
  'linkedinbuffer',
  'tiktokbuffer',
];

// Which day ranges a provider can answer for. The Buffer relays get 7 and 30
// only: Buffer's free plan serves Insights for the last 31 days and refuses
// anything longer ("Free-plan Insights are limited to the last 31 days of
// history"), and an unanswerable range renders as "Channel needs a refresh",
// which blames the connection for a billing ceiling. Add 90 here if the
// account moves to a paid plan.
const RELAYS = ['linkedinbuffer', 'tiktokbuffer'];

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

export const PlatformAnalytics = () => {
  const fetch = useFetch();
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { disableXAnalytics } = useVariables();

  const [key, setKey] = useState(7);
  const [rangeSheetOpen, setRangeSheetOpen] = useState(false);
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
        ...RELAYS,
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
        ...RELAYS,
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
      <PageShell>
        {/* ONE shared page header (new-layout/page-header.tsx) — visible at
            every width; the old separate 56px phone copy is gone */}
        <PageHeader icon={<BarChartGlyph size={20} />} title={pageTitle} />
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
              <Button onClick={() => router.push('/schedule')}>
                {t(
                  'go_to_the_calendar_to_add_channels',
                  'Go to Publish to connect channels'
                )}
              </Button>
            }
          />
        </div>
      </PageShell>
    );
  }
  return (
    <PageShell>
      {/* ONE shared page header (new-layout/page-header.tsx) — visible at
          every width, so Buffer's 390 order (app bar → title → selector →
          content) holds with a single header instance */}
      <PageHeader icon={<BarChartGlyph size={20} />} title={pageTitle} />
      {!!options.length && (
        <div className="flex-1 flex flex-col gap-[14px]">
          {/* Buffer Insights toolbar: the shared channels dropdown (single-
              select — trigger shows the current channel's avatar + name;
              replaces BOTH the phone chip strip and sidebar-only desktop
              selection), then ONE white hairline container (32px, r8, 4px
              padding) holding 24px r6 radio segments — lowercase labels,
              active = green-tint fill, inactive borderless muted — separated
              from content by a full-width hairline. Same setter (setKey) +
              same bounded 7/30/90 per-platform option list the old chips
              drove. */}
          <div className="flex items-center gap-[10px] border-b border-newTableBorder pb-[12px]">
            <ChannelsDropdown
              integrations={sortedIntegrations}
              selectedIds={currentIntegration ? [currentIntegration.id] : []}
              anchor="start"
              onChange={(ids) => {
                if (!ids[0]) {
                  return;
                }
                // Same URL-driven selection as the sidebar rows / Channels
                // table — Next syncs useSearchParams from native replaceState
                // (same pattern as launches.component / calendar.context).
                // No refreshNeeded guard: a refresh-needed channel lands on
                // the pane, where RenderAnalytics's refresh card (with the
                // working Refresh Channel action) takes over — the same path
                // the Channels table rows already allow.
                window.history.replaceState(
                  null,
                  '',
                  `/analytics?integration=${ids[0]}`
                );
              }}
            />
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
              <div className="text-[16px] font-[550]">
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
    </PageShell>
  );
};
