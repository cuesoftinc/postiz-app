import { FC, useCallback, useMemo, useState } from 'react';
import { Integration } from '@prisma/client';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { TilesSkeleton } from '@gitroom/frontend/components/platform-analytics/analytics.skeletons';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

export interface AnalyticsDataItem {
  label: string;
  data: Array<{ total: number; date: string }>;
  average?: boolean;
  percentageChange?: number;
}

/* Buffer trend indicator: line-art trending arrow (vb24 stroke 2.2) in deep
   green #2f7d44 — mirrored vertically and orange-red #c2410c when negative.
   Only the arrow is colored; the delta value stays ink 13/400. */
const TrendIndicator: FC<{ value: number; average?: boolean }> = ({
  value,
  average,
}) => {
  if (value === 0) return null;

  const isPositive = value > 0;
  const displayValue = Math.abs(value).toFixed(1);

  return (
    <div className="flex items-center gap-[4px]">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={isPositive ? 'text-[#2f7d44]' : 'text-[#c2410c] scale-y-[-1]'}
      >
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M14 7h7v7" />
      </svg>
      <span className="text-newTextColor text-[13px] font-[400]">
        {displayValue}
        {average ? 'pp' : '%'}
      </span>
    </div>
  );
};

/* Buffer Insights stat tile (measured 216×77, r8, white, 1px hairline): muted
   14px label + 12px (i) tooltip top-right, ~20px/700 ink number with the
   trend inline. NO chart — Buffer summary tiles carry no sparkline, so the
   old 96px chart.js gradient bell-curve is gone. basis-[200px] (not
   min-w-[200px] — global.scss's phone toolbar guard zeroes that exact class)
   keeps all tiles on one row at 1440 and stacks them full-width at 390. */
const AnalyticsCard: FC<{
  item: AnalyticsDataItem;
  total: string | number;
}> = ({ item, total }) => {
  const t = useT();

  return (
    <div className="grow basis-[200px] min-h-[77px] flex flex-col justify-center gap-[6px] bg-newBgColorInner border border-newTableBorder rounded-[8px] px-[16px] py-[14px]">
      <div className="flex items-start justify-between gap-[8px]">
        <span className="text-[14px] text-newTextColor/60">{item.label}</span>
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
        <span className="text-[20px] leading-[24px] font-[700] tracking-tight text-newTextColor">
          {total}
        </span>
        {item.percentageChange !== undefined && (
          <TrendIndicator
            value={item.percentageChange}
            average={item.average}
          />
        )}
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
      <div className="text-[16px] font-[600] mb-[4px]">
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
  const [loading, setLoading] = useState(true);
  const fetch = useFetch();

  const load = useCallback(async () => {
    setLoading(true);
    const load = (
      await fetch(`/analytics/${integration.id}?date=${date}`)
    ).json();
    setLoading(false);
    return load;
  }, [integration, date]);

  const { data } = useSWR(`/analytics-${integration?.id}-${date}`, load, {
    refreshInterval: 0,
    refreshWhenHidden: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshWhenOffline: false,
    revalidateOnMount: true,
  });

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

  const totals = useMemo(() => {
    return data?.map((p: AnalyticsDataItem) => {
      const value =
        (p?.data.reduce(
          (acc: number, curr: { total: number }) => acc + curr.total,
          0
        ) || 0) / (p.average ? p.data.length : 1);
      if (p.average) {
        return value.toFixed(2) + '%';
      }
      return new Intl.NumberFormat().format(Math.round(value));
    });
  }, [data]);

  if (loading) {
    // Buffer loading: tile-shaped grey blocks in the tiles' own layout —
    // never a spinner.
    return <TilesSkeleton />;
  }

  // Buffer Summary tile row: ALL metrics in one wrapping row with 8px gaps
  // (one line at 1440, full-width stack at 390) — not the old 3-col grid
  // that wrapped the 4th metric onto a lonely second row.
  return (
    <div className="flex flex-wrap gap-[8px]">
      {data?.length === 0 && (
        <EmptyState onRefresh={refreshChannel(integration as any)} />
      )}
      {data?.map((item: AnalyticsDataItem, index: number) => (
        <AnalyticsCard
          key={`analytics-${index}`}
          item={item}
          total={totals[index]}
        />
      ))}
    </div>
  );
};
