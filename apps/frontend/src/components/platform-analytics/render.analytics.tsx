import { FC, useCallback, useMemo } from 'react';
import { Integration } from '@prisma/client';
import useSWR from 'swr';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { TilesSkeleton } from '@gitroom/frontend/components/platform-analytics/analytics.skeletons';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

export interface AnalyticsDataItem {
  label: string;
  /* `total` is a STRING on the wire: AnalyticsData in
     social.integrations.interface.ts types it `string`, and
     buffer.relay.provider literally String()s Buffer's number. Typing it
     honestly here is what forces every arithmetic site through Number():
     `acc + curr.total` used to concatenate ("0" + "12" + "5" = "0125" ÷ 1 =
     125 for a two-point series), which survived only because the relay ships
     ONE point per metric today. It would have broken the moment the relay
     grew a real per-day series. */
  data: Array<{ total: number | string; date: string }>;
  average?: boolean;
  percentageChange?: number;
  /* Absolute total of the comparison window. Buffer's Total Followers tile
     shows an absolute delta ("+5") where every other tile shows a percentage,
     and an absolute delta cannot be recovered from `percentageChange`: every
     provider rounds it to whole percent, so 1000 followers +4 rounds to 0%
     and the +4 is gone. The Buffer relay emits it from the comparison window
     it already fetches. */
  previousTotal?: number;
  /* The metric's real unit, straight from the provider. This REPLACES the
     label regex that used to stand in for it. */
  unit?: MetricUnit;
  /* The provider's own window figure, when it knows it better than this file
     can derive one. Deriving is exact for a count (sum the days) but wrong for
     a rate, whose window value is weighted by each day's audience: a plain
     mean of daily rates is a different number. The relay sends Buffer's own
     rollup here and a real per-day series in `data`, so the tile and the chart
     are both right. Undefined on every other provider, which keeps the
     derived behaviour exactly as it was. */
  total?: number;
}

/* Buffer's Total Followers tile is the one that switches to an absolute
   delta, and platform payloads name that metric a dozen ways (X "FOLLOWERS",
   YouTube "Subscribers Gained", Facebook "Fans"). */
const FOLLOWER_LABEL = /follower|subscriber|\bfans?\b|\bmembers?\b/i;

export type MetricUnit = 'percentage' | 'duration' | 'count';

/* The unit now comes off the wire. It used to be guessed from the label,
   because `average: true` says "this is a mean" without saying a mean of
   WHAT: youtube.provider set it on both 'Average View Duration' (SECONDS)
   and 'Average View Percentage' (percent), and the duration rendered as
   "182.00%". Both of those now send a real `unit`, as does the Buffer relay.
   `average` remains the fallback for providers that send neither, where it
   still means "a mean, and percent is the only mean they have". */
export const metricUnit = (item: AnalyticsDataItem): MetricUnit => {
  if (item?.unit) {
    return item.unit;
  }
  return item?.average ? 'percentage' : 'count';
};

/** Seconds -> "3m 2s". Durations must never carry a percent sign. */
const formatDuration = (seconds: number) => {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return minutes ? `${minutes}m ${rest}s` : `${rest}s`;
};

/** The window's own number, before any unit formatting. */
export const metricRawTotal = (item: AnalyticsDataItem) =>
  (item?.data || []).reduce(
    (acc, curr) => acc + (Number(curr?.total) || 0),
    0
  );

/** One value in the metric's own unit. `compact` is the terse form axis ticks
    need (12k, 40%); the long form is for totals and tooltips. */
export const formatMetricValue = (
  item: AnalyticsDataItem,
  value: number,
  compact = false
): string => {
  const unit = metricUnit(item);
  if (unit === 'percentage') {
    return compact ? `${Math.round(value)}%` : `${value.toFixed(2)}%`;
  }
  if (unit === 'duration') {
    return formatDuration(value);
  }
  return new Intl.NumberFormat(
    undefined,
    compact ? { notation: 'compact' } : undefined
  ).format(Math.round(value));
};

/** The metric's window figure as a NUMBER: sums for counts, means for rates
    and durations. Sorting and CSV need this: the formatted string sorts
    lexicographically ("9" after "1,204") and carries unit glyphs. */
export const metricNumber = (item: AnalyticsDataItem): number => {
  // The provider's own figure wins where it sent one: for a rate it is the
  // only correct answer, because a window rate is weighted by each day's
  // audience and the mean below cannot see those weights.
  if (typeof item?.total === 'number' && Number.isFinite(item.total)) {
    return item.total;
  }
  const points = item?.data || [];
  const sum = metricRawTotal(item);
  // rates and durations are means across the window, so they divide by the
  // point count; `|| 1` is the guard every sibling already had and this
  // function's ancestor here did not, which printed "NaN%" on an empty array.
  return metricUnit(item) === 'count' ? sum : sum / (points.length || 1);
};

/** The one formatter for a metric's window total. It lived in three copies
    (here, channels-summary, recent-posts) that had drifted: only this one
    divided by `p.data.length` UNGUARDED, and only this one skipped Number()
    on a string total. One copy, both bugs gone. */
export const metricTotal = (item: AnalyticsDataItem): string =>
  formatMetricValue(item, metricNumber(item));

export interface MetricDelta {
  /** Signed magnitude, already formatted with its unit. */
  text: string;
  positive: boolean;
}

/** Buffer prints no delta badge when it has no real comparison, and neither
    do we. Two cases are not real: a zero window total cannot have grown by a
    percentage, and `percentageChange` 5 is the literal placeholder that
    facebook, instagram, linkedin-page, threads and x still hardcode.

    That placeholder rule is scoped by `unit`, because it was also swallowing
    real numbers. A provider that sends a `unit` has been migrated and computes
    its comparison for real (the Buffer relay fetches the previous window to
    get it), so on those channels a 5% change is a 5% change and printing
    nothing would be a lie about a number we actually have. The providers that
    ship the placeholder send no `unit`, so they stay suppressed. */
export const metricDelta = (item: AnalyticsDataItem): MetricDelta | null => {
  const change = item?.percentageChange;
  if (change === undefined || change === 0) {
    return null;
  }
  if (change === 5 && !item.unit) {
    return null;
  }
  const total = metricNumber(item);
  if (!total) {
    return null;
  }
  const positive = change > 0;
  // Followers: absolute, per Buffer, never derived from the rounded percentage.
  if (item.previousTotal !== undefined && FOLLOWER_LABEL.test(item.label)) {
    const absolute = Math.round(total - item.previousTotal);
    return {
      text: `${absolute > 0 ? '+' : ''}${new Intl.NumberFormat().format(
        absolute
      )}`,
      positive: absolute > 0,
    };
  }
  // A change in a percentage is measured in percentage POINTS; a change in a
  // count or a duration is measured in percent.
  const suffix = metricUnit(item) === 'percentage' ? 'pp' : '%';
  return { text: `${Math.abs(change).toFixed(1)}${suffix}`, positive };
};

/* Buffer trend indicator: line-art trending arrow (vb24 stroke 2.2) in deep
   green #2f7d44, mirrored vertically and orange-red #c2410c when negative.
   Only the arrow is colored; the delta value stays ink 13/400. */
export const TrendIndicator: FC<{ delta: MetricDelta; className?: string }> = ({
  delta,
  className,
}) => (
  <div className={clsx('flex items-center gap-[4px]', className)}>
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={
        delta.positive ? 'text-[#2f7d44]' : 'text-[#c2410c] scale-y-[-1]'
      }
    >
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
    <span className="text-newTextColor text-[13px] font-[400]">
      {delta.text}
    </span>
  </div>
);

/* Buffer Insights stat tile, measured 216×77 r8 white, padding 12px 16px,
   gap 8px. Its border is #eae8e5, deliberately LIGHTER than the #dedcd9
   hairline used on every other card, so the token is the hairline var mixed
   down: #dedcd9 is ~13.7% ink on white and #eae8e5 ~8.6%, a ratio of ~0.63,
   which keeps the relationship in both themes instead of hardcoding a hex.
   Label 12/400 muted, value 20/400 with line-height 25, trend inline, a
   trailing (i). NO chart: Buffer's summary tiles carry no sparkline (only
   two Recharts instances exist on the whole page).

   `data-cs` on the value: global.scss's size ladder forces text-[20px] to
   16px for anything without it, which is why the tile number rendered 16px
   while the source said 20. (The ladder's PHONE rule at the bottom of
   global.scss has no :not([data-cs]) escape, so at 390 the number still steps
   to 15px; that file is not ours to change and a smaller number on a phone
   is the right outcome anyway.)

   basis-[216px] rather than min-w: global.scss's phone toolbar guard zeroes
   min-w-[…] outright. */
const AnalyticsCard: FC<{ item: AnalyticsDataItem }> = ({ item }) => {
  const t = useT();
  const delta = useMemo(() => metricDelta(item), [item]);

  return (
    <div className="grow basis-[216px] min-h-[77px] flex flex-col justify-center gap-[8px] bg-newBgColorInner border border-[color:color-mix(in_srgb,var(--new-table-border)_65%,transparent)] rounded-[8px] px-[16px] py-[12px]">
      <div className="flex items-start justify-between gap-[8px]">
        <span className="text-[12px] font-[400] text-newTextColor/60">
          {item.label}
        </span>
        <span
          data-tooltip-id="tooltip"
          data-tooltip-content={`${item.label} ${t(
            'over_the_selected_period',
            'over the selected period'
          )}`}
          className="text-newTextColor/40 mt-[2px] shrink-0 cursor-default"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </span>
      </div>
      <div className="flex items-center gap-[10px]">
        <span
          data-cs
          className="text-[20px] leading-[25px] font-[400] tracking-tight text-newTextColor"
        >
          {metricTotal(item)}
        </span>
        {!!delta && <TrendIndicator delta={delta} />}
      </div>
    </div>
  );
};

/* S2 refresh-needed empty state: 64px muted circle + 24px clock, 16/600
   heading + muted 14px subline (spec's "No Undated Drafts" pattern) on a
   white hairline card so it reads like the tiles inside the grey Summary
   section. The lime CTA stays; label weight drops to the 500 standard. */
const EmptyState: FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const t = useT();

  return (
    <div className="w-full flex flex-col items-center justify-center py-[48px] px-[24px] bg-newBgColorInner border border-newTableBorder rounded-[8px]">
      <div className="w-[64px] h-[64px] mb-[16px] rounded-full bg-newTextColor/5 flex items-center justify-center text-newTextColor/60">
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
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      </div>
      <div className="text-[16px] font-[550] mb-[4px]">
        {t('channel_needs_a_refresh', 'Channel needs a refresh')}
      </div>
      <p className="text-[14px] text-newTextColor/60 text-center mb-[16px]">
        {t(
          'this_channel_needs_to_be_refreshed',
          'This channel needs to be refreshed to display analytics'
        )}
      </p>
      <button
        onClick={onRefresh}
        className="inline-flex items-center gap-[6px] h-[40px] px-[16px] text-[14px] font-[500] bg-btnPrimary rounded-[8px] transition-colors duration-150"
      >
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
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M8 16H3v5" />
        </svg>
        {t('refresh_channel', 'Refresh Channel')}
      </button>
    </div>
  );
};

export const RenderAnalytics: FC<{
  integration: Integration;
  date: number;
}> = (props) => {
  const { integration, date } = props;
  const fetch = useFetch();

  const load = useCallback(async () => {
    return (await fetch(`/analytics/${integration.id}?date=${date}`)).json();
  }, [integration, date]);

  // SWR's own isLoading instead of the old setLoading-inside-the-fetcher:
  // the Trends chart shares this exact key, and with dedupe only ONE of the
  // two fetchers actually runs: state set inside a fetcher closure is not
  // guaranteed to fire, isLoading is.
  const { data, isLoading: loading } = useSWR(
    `/analytics-${integration?.id}-${date}`,
    load,
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

  const refreshChannel = useCallback(
    (
        integrationData: Integration & {
          identifier: string;
        }
      ) =>
      async () => {
        const { url } = await (
          await fetch(
            `/integrations/social/${integrationData.identifier}?refresh=${integrationData.internalId}`,
            {
              method: 'GET',
            }
          )
        ).json();
        window.location.href = url;
      },
    []
  );

  if (loading) {
    // Buffer loading: tile-shaped grey blocks in the tiles' own layout:
    // never a spinner.
    return <TilesSkeleton />;
  }

  // Buffer Summary tile row: ALL metrics in one wrapping row with 8px gaps
  // (one line at 1440, full-width stack at 390), not the old 3-col grid
  // that wrapped the 4th metric onto a lonely second row.
  return (
    <div className="flex flex-wrap gap-[8px]">
      {data?.length === 0 && (
        <EmptyState onRefresh={refreshChannel(integration as any)} />
      )}
      {data?.map((item: AnalyticsDataItem, index: number) => (
        <AnalyticsCard key={`analytics-${index}`} item={item} />
      ))}
    </div>
  );
};
