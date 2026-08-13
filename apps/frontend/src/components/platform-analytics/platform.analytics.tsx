'use client';

import useSWR, { useSWRConfig } from 'swr';
import { FC, useCallback, useMemo, useState } from 'react';
import { capitalize, orderBy } from 'lodash';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import {
  AnalyticsDataItem,
  RenderAnalytics,
  metricDelta,
  metricTotal,
} from '@gitroom/frontend/components/platform-analytics/render.analytics';
import { Button } from '@gitroom/react/form/button';
import { useRouter, useSearchParams } from 'next/navigation';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { AnalyticsPageSkeleton } from '@gitroom/frontend/components/platform-analytics/analytics.skeletons';
import { AnalyticsChartSection } from '@gitroom/frontend/components/platform-analytics/analytics-chart';
import { ChannelsSummarySection } from '@gitroom/frontend/components/platform-analytics/channels-summary';
import { RecentPostsSection } from '@gitroom/frontend/components/platform-analytics/recent-posts';
import { ChannelsDropdown } from '@gitroom/frontend/components/new-layout/channels-dropdown';
import { DropdownPanel } from '@gitroom/frontend/components/cuesoft/dropdown/dropdown-panel';
import { useDropdown } from '@gitroom/frontend/components/cuesoft/dropdown/use-dropdown';
import { EmptyState } from '@gitroom/frontend/components/cuesoft/empty-state';
import {
  PageHeader,
  PageShell,
} from '@gitroom/frontend/components/new-layout/page-header';

/**
 * WHICH RANGES A CHANNEL CAN BE ASKED FOR: one table, deliberately.
 *
 * This used to be FOUR separate hand-written lists of quoted identifiers (the
 * page allowlist plus one gate per range), so every new provider had to be
 * added to all four and a miss was silent. Two live defects came out of that
 * shape, one of them Insights showing Facebook's numbers under a LinkedIn
 * channel's name. A single table cannot be half-updated: an identifier either
 * appears here with its ranges or the channel does not reach this page at all.
 *
 * Buffer's own control offers `7 days`, `30 days`, `Month to date` and
 * `Custom` (paid), measured live 2026-08-13. There is NO 90-day range in
 * Buffer, so ours is a fork extension, not parity; it is KEPT for the native
 * providers whose APIs genuinely serve it, because removing a working range
 * someone may rely on is a regression, and `Month to date` is added alongside
 * rather than in its place.
 */
type RangeId = '7' | '30' | 'mtd' | '90';

/* Providers whose own analytics APIs answer a 90-day window. */
const RANGES_WITH_90: readonly RangeId[] = ['7', '30', 'mtd', '90'];
/* Providers capped at a month. Two different reasons land on the same tuple
   and both are load-bearing, so they are not collapsed into one constant:
   the native four (instagram, instagram-standalone, threads, tiktok) are
   capped by their own APIs, while the Buffer relays are capped by Buffer's
   free plan, which serves the last 31 days of Insights and errors beyond it
   ("Free-plan Insights are limited to the last 31 days of history"). An
   unanswerable range renders as "Channel needs a refresh", which blames the
   connection for a billing ceiling. */
const RANGES_TO_30: readonly RangeId[] = ['7', '30', 'mtd'];
const RELAY_RANGES: readonly RangeId[] = RANGES_TO_30;

const CHANNEL_RANGES: Record<string, readonly RangeId[]> = {
  facebook: RANGES_WITH_90,
  instagram: RANGES_TO_30,
  'instagram-standalone': RANGES_TO_30,
  'linkedin-page': RANGES_WITH_90,
  tiktok: RANGES_TO_30,
  youtube: RANGES_WITH_90,
  gmb: RANGES_WITH_90,
  pinterest: RANGES_WITH_90,
  threads: RANGES_TO_30,
  x: RANGES_WITH_90,
  // The Buffer relay channels. Their numbers come from Buffer rather than the
  // platform's own API, but they are real and belong on this page like any
  // other channel: a provider implementing analytics() is invisible here
  // unless its identifier is in this table.
  linkedinbuffer: RELAY_RANGES,
  tiktokbuffer: RELAY_RANGES,
};

/* The page allowlist is now DERIVED, so it can never disagree with the range
   gates above. Insertion order is the order the empty state lists. */
const allowedIntegrations = Object.keys(CHANNEL_RANGES);

const RELAYS = ['linkedinbuffer', 'tiktokbuffer'];

/* Mirrors BUFFER_HISTORY_DAYS in buffer.relay.provider.ts. The relay fetches a
   comparison window only when `date * 2` fits inside it, so the page can say
   whether a delta exists instead of printing a silent blank. */
const BUFFER_FREE_HISTORY_DAYS = 31;

/**
 * A range in the only vocabulary /analytics/:integration?date= has: a count of
 * CALENDAR DAYS ending today, inclusive of both ends. 7 means the 7 days whose
 * last one is today, which is what the window label under each heading prints
 * ("Jul 15 - Aug 13" for 30), and Month to date is therefore just the day of
 * the month: on the 13th it is 13 days, the 1st through the 13th.
 *
 * Month to date is now EXACT. It used to send `date() - 1` and the provider
 * turned that into `now.subtract(date, 'day')`, so the window opened on the 1st
 * at whatever time of day it happened to be and slid forward all day, quietly
 * losing the morning of the 1st. The count is the boundary; it just has to be
 * snapped to midnight, which the provider now does. No start/end parameter is
 * needed on the endpoint, so the provider signature stays as it is.
 */
const rangeDays = (id: RangeId): number =>
  id === 'mtd' ? dayjs().date() : Number(id);

/** Buffer Insights bar-chart glyph: shared by the page-header chip (20px)
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

const ChevronDown: FC = () => (
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
);

/* Buffer's segmented item spec (measured, identical to the List/Calendar
   segmented in Publish): height 24, radius 6, padding 0 8, 14px/500; inactive
   label #5a5a59; ACTIVE label #337046 on #95cd8f at alpha 0.322. The brand
   mapping is the fork's lime token washed to 32%, which is the same construct
   launches/filters.tsx already uses for its segmented, so Buffer's green never
   gets hardcoded and both themes follow the token. */
const SEG_ACTIVE =
  'bg-[color:color-mix(in_srgb,var(--new-btn-primary)_32%,transparent)] text-newTableTextFocused';
const SEG_INACTIVE =
  'text-newTextColor/60 hover:text-newTextColor hover:bg-boxHover';
const SEG_ITEM =
  'h-[24px] px-[8px] rounded-[6px] text-[14px] font-[500] whitespace-nowrap cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#325ea6]';

const csvCell = (value: string) =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/** Client-side CSV of data the page has already fetched: no backend, no
    second request. Buffer's Export is a report download; this is the same
    affordance at the scope we can honestly serve. */
const downloadCsv = (filename: string, rows: string[][]) => {
  const body = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  // Excel reads a bare UTF-8 CSV as latin-1 and mangles any non-ASCII
  // channel name, so the file leads with a byte-order mark. Built from a
  // char code on purpose: a literal U+FEFF in the source is invisible to
  // the next reader and travels through copy/paste as a silent hazard.
  const byteOrderMark = String.fromCharCode(0xfeff);
  const blob = new Blob([byteOrderMark + body], {
    type: 'text/csv;charset=utf-8',
  });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
};

const CSV_HEADER = [
  'Channel',
  'Metric',
  'Total',
  'Change',
  'Window start',
  'Window end',
];

const csvRowsFor = (
  channelName: string,
  items: AnalyticsDataItem[],
  windowStart: string,
  windowEnd: string
) =>
  items.map((item) => {
    const delta = metricDelta(item);
    return [
      channelName,
      item.label,
      metricTotal(item),
      delta ? `${delta.positive ? '+' : '-'}${delta.text}` : '',
      windowStart,
      windowEnd,
    ];
  });

export const PlatformAnalytics = () => {
  const fetch = useFetch();
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { disableXAnalytics } = useVariables();
  const { cache } = useSWRConfig();
  const exportMenu = useDropdown<HTMLDivElement>();

  const [rangeId, setRangeId] = useState<RangeId>('7');
  const [rangeSheetOpen, setRangeSheetOpen] = useState(false);
  const load = useCallback(async () => {
    const int = (
      await (await fetch('/integrations/list')).json()
    ).integrations.filter((f: any) => {
      // the single-platform kill switch, not a range gate: X analytics can be
      // turned off instance-wide
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
    const ids = CHANNEL_RANGES[currentIntegration?.identifier] || [];
    return ids.map((id) => ({
      id,
      days: rangeDays(id),
      label:
        id === 'mtd'
          ? t('month_to_date', 'Month to date')
          : t(`${id}_days`, `${id} days`),
    }));
  }, [currentIntegration, t]);

  // Selection is tracked by RANGE ID, not by day count. Month to date IS a day
  // count, and on the 8th of a month it is 7 and on the 31st it is 30, so with
  // a numeric key those days would light up two segments at once and duplicate
  // a React key.
  const activeRange = useMemo(
    () => options.find((option) => option.id === rangeId) ?? options[0],
    [options, rangeId]
  );
  const keys = activeRange?.days;

  const isRelay = RELAYS.includes(currentIntegration?.identifier);
  // The relay only fetches a comparison window when it fits inside Buffer's
  // free-plan history, so on the 30-day relay view there is deliberately no
  // percentage change at all. Saying so beats printing a silent blank.
  const comparisonAvailable =
    !isRelay || !keys || keys * 2 <= BUFFER_FREE_HISTORY_DAYS;

  /* Buffer states the comparison window explicitly under each section heading
     at 12px/400: "Jul 15 - Aug 13, 2026 · Compared to Jun 15 - Jul 14, 2026".
     A delta with nothing named to compare against is unfalsifiable to the
     reader, which is what we shipped before.

     The dates are INCLUSIVE of both ends, which is how Buffer labels them
     (Aug 13 minus 29 days = Jul 15 for a 30-day window). The relay's request
     is built the same way and snapped to midnight, so the label and the window
     actually fetched are now the same days rather than differing by however
     much of today has already elapsed. */
  const windowLabels = useMemo(() => {
    if (!keys) {
      return { start: '', end: '', range: '', subtitle: '' };
    }
    const end = dayjs();
    const start = end.subtract(keys - 1, 'day');
    const priorEnd = start.subtract(1, 'day');
    const priorStart = priorEnd.subtract(keys - 1, 'day');
    const range = `${start.format('MMM D')} - ${end.format('MMM D, YYYY')}`;
    return {
      start: start.format('YYYY-MM-DD'),
      end: end.format('YYYY-MM-DD'),
      range,
      subtitle: comparisonAvailable
        ? `${range} · ${t('compared_to', 'Compared to')} ${priorStart.format(
            'MMM D'
          )} - ${priorEnd.format('MMM D, YYYY')}`
        : `${range} · ${t(
            'no_comparison_window_free_plan',
            "No comparison: the previous window is outside Buffer's 31 days of free-plan history"
          )}`,
    };
  }, [keys, comparisonAvailable, t]);

  /* The current channel's own payload, on the SAME SWR key RenderAnalytics and
     the chart use, so this subscribes to their response rather than issuing a
     fifth request. It exists for Export: a button that cannot see the data
     cannot export it. */
  const analyticsLoad = useCallback(async () => {
    return (
      await fetch(`/analytics/${currentIntegration.id}?date=${keys}`)
    ).json();
  }, [currentIntegration?.id, keys]);
  const { data: currentAnalytics } = useSWR<AnalyticsDataItem[]>(
    currentIntegration && keys
      ? `/analytics-${currentIntegration.id}-${keys}`
      : null,
    analyticsLoad,
    {
      refreshInterval: 0,
      refreshWhenHidden: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      refreshWhenOffline: false,
      revalidateOnMount: true,
    }
  );

  const summaryRows = Array.isArray(currentAnalytics) ? currentAnalytics : [];

  const exportSummary = useCallback(() => {
    exportMenu.close();
    downloadCsv(
      `insights-${currentIntegration?.name || 'channel'}-${
        windowLabels.start
      }-to-${windowLabels.end}.csv`.replace(/\s+/g, '-'),
      [
        CSV_HEADER,
        ...csvRowsFor(
          currentIntegration?.name || '',
          summaryRows,
          windowLabels.start,
          windowLabels.end
        ),
      ]
    );
  }, [currentIntegration, summaryRows, windowLabels, exportMenu]);

  /* Every channel the Performance table has already loaded. Those rows fetch
     on the shared `/analytics-<id>-<days>` keys, so the SWR cache is where the
     data already is: reading it costs nothing and invents nothing. Channels
     whose row has not resolved are skipped rather than exported blank. */
  const cachedChannelRows = useMemo(() => {
    if (!keys) {
      return [];
    }
    return sortedIntegrations.flatMap((integration: any) => {
      const entry: any = cache.get(`/analytics-${integration.id}-${keys}`);
      const items = Array.isArray(entry?.data) ? entry.data : [];
      return items.length
        ? csvRowsFor(
            integration.name,
            items,
            windowLabels.start,
            windowLabels.end
          )
        : [];
    });
  }, [sortedIntegrations, keys, cache, windowLabels]);

  const exportChannels = useCallback(() => {
    exportMenu.close();
    downloadCsv(
      `insights-all-channels-${windowLabels.start}-to-${windowLabels.end}.csv`,
      [CSV_HEADER, ...cachedChannelRows]
    );
  }, [cachedChannelRows, windowLabels, exportMenu]);

  const pageTitle = t('analytics', 'Insights');

  if (isLoading) {
    // Buffer loading: the page's own shape in soft grey blocks (header chip,
    // toolbar, Summary section with tile blocks), never a spinner.
    return <AnalyticsPageSkeleton />;
  }

  if (!sortedIntegrations.length && !isLoading) {
    return (
      <PageShell>
        {/* ONE shared page header (new-layout/page-header.tsx): visible at
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
      {/* ONE shared page header (new-layout/page-header.tsx): visible at
          every width, so Buffer's 390 order (app bar → title → selector →
          content) holds with a single header instance. Buffer's Export sits
          top right, a 110×32 secondary button with a chevron; both menu items
          write a real file from data already on the page, and the whole
          control is absent when there is nothing to write (this fork deletes
          buttons that do nothing: Templates and AI went for that reason). */}
      <PageHeader
        icon={<BarChartGlyph size={20} />}
        title={pageTitle}
        actions={
          (!!summaryRows.length || !!cachedChannelRows.length) && (
            <div className="relative shrink-0" ref={exportMenu.ref}>
              <button
                type="button"
                data-cs
                onClick={exportMenu.toggle}
                className="flex items-center justify-center gap-[4px] w-[110px] h-[32px] px-[12px] rounded-[8px] border border-newTableBorder bg-newBgColorInner text-[14px] font-[500] text-newTextColor hover:bg-boxHover transition-colors duration-150"
              >
                {t('export', 'Export')}
                <ChevronDown />
              </button>
              {exportMenu.open && (
                <DropdownPanel
                  surface="panel"
                  anchor="end"
                  className="mt-[6px] w-[240px] p-[8px] flex flex-col gap-[2px]"
                >
                  {!!summaryRows.length && (
                    <button
                      type="button"
                      onClick={exportSummary}
                      className="flex items-center h-[32px] px-[8px] rounded-[6px] text-[14px] text-newTextColor text-start hover:bg-boxHover transition-colors duration-150"
                    >
                      {t('this_channel_csv', 'This channel (CSV)')}
                    </button>
                  )}
                  {!!cachedChannelRows.length && (
                    <button
                      type="button"
                      onClick={exportChannels}
                      className="flex items-center h-[32px] px-[8px] rounded-[6px] text-[14px] text-newTextColor text-start hover:bg-boxHover transition-colors duration-150"
                    >
                      {t('all_channels_csv', 'All channels (CSV)')}
                    </button>
                  )}
                </DropdownPanel>
              )}
            </div>
          )
        }
      />
      {!!options.length && (
        <div className="flex-1 flex flex-col gap-[14px]">
          {/* Buffer Insights toolbar: the shared channels dropdown (single-
              select: trigger shows the current channel's avatar + name;
              replaces BOTH the phone chip strip and sidebar-only desktop
              selection), then ONE white hairline container (32px, r8, 4px
              padding, 4px gap) holding 24px r6 segments: active = lime-tint
              fill, inactive borderless muted, separated from content by a
              full-width hairline. The option list is the per-channel table at
              the top of this file, so a channel can never be offered a range
              its provider cannot answer. */}
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
                // table: Next syncs useSearchParams from native replaceState
                // (same pattern as launches.component / calendar.context).
                // No refreshNeeded guard: a refresh-needed channel lands on
                // the pane, where RenderAnalytics's refresh card (with the
                // working Refresh Channel action) takes over: the same path
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
              className="phone:hidden inline-flex items-center h-[32px] p-[4px] gap-[4px] rounded-[8px] border border-newTableBorder bg-newBgColorInner"
            >
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setRangeId(option.id)}
                  className={clsx(
                    SEG_ITEM,
                    activeRange?.id === option.id ? SEG_ACTIVE : SEG_INACTIVE
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {/* Buffer 390 collapses the picker to a single bordered
                "30 days ▾" trigger opening a bottom sheet */}
            <button
              type="button"
              data-cs
              onClick={() => setRangeSheetOpen(true)}
              className="hidden phone:inline-flex items-center gap-[8px] h-[40px] px-[12px] rounded-[8px] border border-newTableBorder bg-newBgColorInner text-[14px] font-[500] text-newTextColor"
            >
              {activeRange?.label}
              <ChevronDown />
            </button>
          </div>
          {/* Buffer wraps each Insights block in a warm-grey SECTION (r12,
              tiles inset 8px, title inset 16px) with the header INSIDE:
              "Summary" 16/550 body face + the muted 12/400 window subtitle
              that now names what the deltas are measured against. */}
          <div className="bg-newTableHeader rounded-[12px] p-[8px] flex flex-col gap-[12px]">
            <div className="flex flex-col gap-[2px] px-[8px] pt-[8px]">
              <div className="text-[16px] font-[550]">
                {t('summary', 'Summary')}
              </div>
              <div className="text-[12px] font-[400] text-newTextColor/60">
                {windowLabels.subtitle}
              </div>
            </div>
            <div className="flex-1">
              {/* key remounts the analytics on channel change: replaces the
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
          {/* Insights enrichment. Every number below is a real payload:
              Trends re-reads the SAME /analytics/:id response the tiles use
              (shared SWR key, one request); Top 5 Posts joins
              /posts/list?state=published with /analytics/post/:id;
              Performance fans the per-channel /analytics call across the
              connected list. Sections with nothing real to show render null. */}
          {!!keys && !!currentIntegration && (
            <>
              <AnalyticsChartSection
                key={`chart-${currentIntegration.id}-${keys}`}
                integration={currentIntegration}
                date={keys}
                subtitle={windowLabels.subtitle}
              />
              <RecentPostsSection
                key={`recent-${currentIntegration.id}-${keys}`}
                integration={currentIntegration}
                date={keys}
                subtitle={windowLabels.subtitle}
              />
              <ChannelsSummarySection
                integrations={sortedIntegrations}
                date={keys}
                currentId={currentIntegration.id}
                subtitle={windowLabels.subtitle}
              />
            </>
          )}
        </div>
      )}
      {/* Phone date-range bottom sheet: same shell as the launches filter
          sheet (scrim, rounded top, drag handle), rows w/ check LEFT of the
          selected option per the spec's select-menu anatomy. */}
      {rangeSheetOpen && (
        <div
          // h-[100dvh]: in this stack a fixed inset-0 box refuses to stretch
          // between insets (verified live on the launches sheet): explicit
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
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setRangeId(option.id);
                    setRangeSheetOpen(false);
                  }}
                  className="flex items-center gap-[10px] w-full h-[44px] px-[12px] rounded-[8px] text-[14px] font-[500] text-newTextColor hover:bg-boxHover text-start"
                >
                  <span className="w-[16px] flex items-center justify-center shrink-0">
                    {activeRange?.id === option.id && (
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
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
};
