'use client';

import { FC, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { ChannelAvatar } from '@gitroom/frontend/components/new-layout/channel-avatar';
import { AnalyticsDataItem } from '@gitroom/frontend/components/platform-analytics/render.analytics';

interface SummaryIntegration {
  id: string;
  name: string;
  identifier: string;
  picture?: string;
  refreshNeeded?: boolean;
}

const SWR_OPTS = {
  refreshInterval: 0,
  refreshWhenHidden: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  revalidateIfStale: false,
  refreshWhenOffline: false,
  revalidateOnMount: true,
} as const;

/* Buffer's Insights table reads followers / impressions / engagement per
   channel. Platform payloads name these differently (X "FOLLOWERS", LinkedIn
   "Organic Followers", YouTube "Subscribers Gained", Pinterest
   "Impressions"…), so each column matches the first REAL metric whose label
   fits, and the cell prints that source label under the number — the value
   is always a real metric total, never a synthesized column. */
const COLUMNS: Array<{
  key: string;
  title: string;
  patterns: RegExp[];
  exclude?: RegExp;
}> = [
  {
    key: 'followers',
    title: 'Followers',
    patterns: [/follower/i, /subscriber/i, /\bfans?\b/i, /\bmembers?\b/i],
    exclude: /lost/i,
  },
  {
    key: 'impressions',
    title: 'Impressions',
    patterns: [/impression/i, /^page views$/i, /^views?$/i, /view/i],
    exclude: /average|duration|percentage|rate|minutes/i,
  },
  {
    key: 'engagement',
    title: 'Engagement',
    patterns: [/engagement/i, /reaction/i, /^total likes$/i, /^likes?$/i],
    exclude: /rate/i,
  },
];

/* Same total math as the Summary tiles: sum of the day totals; `average`
   metrics are means rendered as percentages. */
const metricTotal = (item: AnalyticsDataItem) => {
  const value =
    (item?.data?.reduce(
      (acc: number, curr: { total: number }) => acc + (Number(curr.total) || 0),
      0
    ) || 0) / (item.average ? item.data.length || 1 : 1);
  if (item.average) {
    return value.toFixed(2) + '%';
  }
  return new Intl.NumberFormat().format(Math.round(value));
};

const matchColumn = (
  data: AnalyticsDataItem[],
  column: (typeof COLUMNS)[number]
) => {
  for (const pattern of column.patterns) {
    const hit = data.find(
      (item) =>
        pattern.test(item.label) &&
        !(column.exclude && column.exclude.test(item.label))
    );
    if (hit) {
      return hit;
    }
  }
  return undefined;
};

const ChannelRowCells: FC<{ integration: SummaryIntegration; date: number }> =
  ({ integration, date }) => {
    const fetch = useFetch();
    const t = useT();

    const load = useCallback(async () => {
      return (await fetch(`/analytics/${integration.id}?date=${date}`)).json();
    }, [integration.id, date]);

    // Same key as RenderAnalytics/the chart for the selected channel, so the
    // page still issues ONE request per channel+range (server side it is
    // Redis-cached besides).
    const { data, isLoading } = useSWR<AnalyticsDataItem[]>(
      `/analytics-${integration.id}-${date}`,
      load,
      SWR_OPTS
    );

    const cells = useMemo(() => {
      const list = Array.isArray(data) ? data : [];
      return COLUMNS.map((column) => {
        const hit = matchColumn(list, column);
        return hit ? { total: metricTotal(hit), label: hit.label } : null;
      });
    }, [data]);

    if (isLoading) {
      return (
        <>
          {COLUMNS.map((column) => (
            <td key={column.key} className="px-[12px] py-[10px]">
              <div className="bg-newTextColor/5 rounded-[8px] animate-pulse h-[16px] w-[64px]" />
            </td>
          ))}
        </>
      );
    }

    if (!Array.isArray(data) || !data.length) {
      return (
        <td
          colSpan={COLUMNS.length}
          className="px-[12px] py-[10px] text-[14px] text-newTextColor/60"
        >
          {integration.refreshNeeded
            ? t('channel_needs_a_refresh', 'Channel needs a refresh')
            : t('no_data_for_this_period', 'No data for this period')}
        </td>
      );
    }

    return (
      <>
        {cells.map((cell, index) => (
          <td key={COLUMNS[index].key} className="px-[12px] py-[10px]">
            {cell ? (
              <div className="flex flex-col gap-[1px]">
                <span className="text-[14px] font-[600] text-newTextColor">
                  {cell.total}
                </span>
                <span className="text-[11px] text-newTextColor/60">
                  {cell.label}
                </span>
              </div>
            ) : (
              <span className="text-[14px] text-newTextColor/40">—</span>
            )}
          </td>
        ))}
      </>
    );
  };

/** "Channels" section: one row per connected channel (avatar + name), with
    followers / impressions / engagement columns filled from each channel's
    own /analytics payload. Clicking a row selects that channel via the same
    URL-driven replaceState the sidebar rows use. */
export const ChannelsSummarySection: FC<{
  integrations: SummaryIntegration[];
  date: number;
  currentId?: string;
  subtitle: string;
}> = ({ integrations, date, currentId, subtitle }) => {
  const t = useT();

  if (!integrations.length) {
    return null;
  }

  return (
    <div className="bg-newTableHeader rounded-[12px] p-[8px] flex flex-col gap-[12px]">
      <div className="flex flex-col gap-[2px] px-[8px] pt-[8px]">
        <div className="text-[16px] font-[600]">
          {t('channels', 'Channels')}
        </div>
        <div className="text-[14px] text-newTextColor/60">{subtitle}</div>
      </div>
      {/* the table scrolls inside its card on narrow screens — an over-wide
          child must never widen the layout viewport (breaks position:fixed) */}
      <div className="bg-newBgColorInner border border-newTableBorder rounded-[8px] overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr className="border-b border-newTableBorder">
              <th className="px-[12px] py-[10px] text-start text-[13px] font-[500] text-newTextColor/60">
                {t('channel', 'Channel')}
              </th>
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  className="px-[12px] py-[10px] text-start text-[13px] font-[500] text-newTextColor/60"
                >
                  {t(column.key, column.title)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {integrations.map((integration) => (
              <tr
                key={integration.id}
                onClick={() =>
                  window.history.replaceState(
                    null,
                    '',
                    `/analytics?integration=${integration.id}`
                  )
                }
                className={clsx(
                  'border-b border-newTableBorder last:border-b-0 cursor-pointer transition-colors duration-150',
                  // newTableHeader is a raw var() token (no <alpha-value>), so
                  // no /60 opacity modifier — the full wash marks selection.
                  currentId === integration.id
                    ? 'bg-newTableHeader'
                    : 'hover:bg-boxHover'
                )}
              >
                <td className="px-[12px] py-[10px]">
                  <div className="flex items-center gap-[10px] min-w-0">
                    <ChannelAvatar
                      picture={integration.picture}
                      identifier={integration.identifier}
                      name={integration.name}
                      size={28}
                      badgeSize={14}
                      youtubeBadgeSize={14}
                      badgeOffset="bottom-[-3px] -end-[3px]"
                    />
                    <span className="text-[14px] font-[500] text-newTextColor truncate">
                      {integration.name}
                    </span>
                  </div>
                </td>
                <ChannelRowCells integration={integration} date={date} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

