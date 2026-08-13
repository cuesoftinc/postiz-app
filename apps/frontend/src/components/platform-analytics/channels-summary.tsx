'use client';

import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { ChannelAvatar } from '@gitroom/frontend/components/new-layout/channel-avatar';
import { Skeleton } from '@gitroom/frontend/components/layout/skeleton';
import { DropdownPanel } from '@gitroom/frontend/components/cuesoft/dropdown/dropdown-panel';
import { useDropdown } from '@gitroom/frontend/components/cuesoft/dropdown/use-dropdown';
import {
  AnalyticsDataItem,
  TrendIndicator,
  metricDelta,
  metricNumber,
  metricTotal,
} from '@gitroom/frontend/components/platform-analytics/render.analytics';

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

/* Buffer's Performance table is Channel · Posts · Reactions · Comments ·
   Eng. Rate (measured live 2026-08-13). Platform payloads name their metrics
   differently (X "FOLLOWERS", LinkedIn "Organic Followers", YouTube
   "Subscribers Gained", Buffer's relay "Reactions"/"Comments"/"Eng. Rate"
   verbatim), so each column matches the first REAL metric whose label fits
   and the cell prints that source label under the number: the value is
   always a real metric total, never a synthesized column.

   Buffer's `Posts` column has no counterpart here on purpose: post COUNT is
   not in the analytics payload at all, and inventing it would mean a second
   /posts/list request per channel.

   `defaultOn` is what the column chooser starts with: Buffer's four metric
   columns, with the fork's own two (Impressions, raw Engagement) available
   but off, so the table opens at Buffer's width instead of scrolling. */
const COLUMNS: Array<{
  key: string;
  title: string;
  patterns: RegExp[];
  exclude?: RegExp;
  defaultOn: boolean;
}> = [
  {
    key: 'reactions',
    title: 'Reactions',
    patterns: [/reaction/i, /^total likes$/i, /^likes?$/i],
    exclude: /rate/i,
    defaultOn: true,
  },
  {
    key: 'comments',
    title: 'Comments',
    patterns: [/comment/i, /\breplies\b/i],
    exclude: /rate/i,
    defaultOn: true,
  },
  {
    // Rate labels ONLY. A bare "Engagement" count under an "Eng. Rate" header
    // would read as a percentage that is actually a tally, so the raw count
    // gets its own column below instead of being a fallback for this one.
    key: 'engagementRate',
    title: 'Eng. Rate',
    patterns: [/eng\.?\s*rate/i, /engagement\s*rate/i],
    defaultOn: true,
  },
  {
    key: 'followers',
    title: 'Followers',
    patterns: [/follower/i, /subscriber/i, /\bfans?\b/i, /\bmembers?\b/i],
    exclude: /lost/i,
    defaultOn: true,
  },
  {
    key: 'impressions',
    title: 'Impressions',
    patterns: [/impression/i, /^page views$/i, /^views?$/i, /view/i],
    exclude: /average|duration|percentage|rate|minutes/i,
    defaultOn: false,
  },
  {
    key: 'engagement',
    title: 'Engagement',
    patterns: [/engagement/i],
    exclude: /rate/i,
    defaultOn: false,
  },
];

type Column = (typeof COLUMNS)[number];

const matchColumn = (data: AnalyticsDataItem[], column: Column) => {
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

interface ChannelPayload {
  data?: AnalyticsDataItem[];
  isLoading: boolean;
}

/** Renders nothing; it exists to pull one channel's /analytics payload up to
    the table so the table can SORT by it. The rows used to own their own
    fetch, which meant the parent never saw a number and no header could be
    sortable. Same SWR key as RenderAnalytics/the chart for the selected
    channel, so the page still issues ONE request per channel+range (Redis
    caches it server side besides). */
const ChannelDataProbe: FC<{
  integration: SummaryIntegration;
  date: number;
  onLoad: (key: string, payload: ChannelPayload) => void;
}> = ({ integration, date, onLoad }) => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    return (await fetch(`/analytics/${integration.id}?date=${date}`)).json();
  }, [integration.id, date]);

  const { data, isLoading } = useSWR<AnalyticsDataItem[]>(
    `/analytics-${integration.id}-${date}`,
    load,
    SWR_OPTS
  );

  useEffect(() => {
    onLoad(`${integration.id}-${date}`, { data, isLoading });
  }, [integration.id, date, data, isLoading, onLoad]);

  return null;
};

const SortGlyph: FC<{ direction?: 'asc' | 'desc' }> = ({ direction }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={clsx(
      'shrink-0 transition-opacity duration-150',
      direction ? 'opacity-100' : 'opacity-0 group-hover:opacity-40',
      direction === 'asc' && 'scale-y-[-1]'
    )}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/** "Performance" section: one row per connected channel (avatar + name) with
    Buffer's metric columns filled from each channel's own /analytics payload,
    every metric header sortable, a per-cell delta on each number, and a
    column chooser. Clicking a row selects that channel via the same
    URL-driven replaceState the sidebar rows use.

    Buffer's geometry (measured): header row 49, `th` padding 12px 16px at
    14/500, body row 64. Buffer's first header cell carries a 12px 0 0 0
    radius because its table IS the surface; here the table sits in the
    fork's standard r8 hairline card inside the grey section, so the corner
    belongs to the card and the `th` stays square. */
export const ChannelsSummarySection: FC<{
  integrations: SummaryIntegration[];
  date: number;
  currentId?: string;
  subtitle: string;
}> = ({ integrations, date, currentId, subtitle }) => {
  const t = useT();
  const chooser = useDropdown<HTMLDivElement>();

  // Keyed by `${integrationId}-${date}`, never reset: a range change mints new
  // keys, so a stale window can never be sorted or exported as if it were the
  // current one, and no reset effect can race the probes' own effects.
  const [payloads, setPayloads] = useState<Record<string, ChannelPayload>>({});
  const onLoad = useCallback((key: string, payload: ChannelPayload) => {
    setPayloads((prev) => {
      const before = prev[key];
      // SWR hands back a stable `data` reference per key, so this settles
      // after one commit instead of looping.
      if (
        before &&
        before.data === payload.data &&
        before.isLoading === payload.isLoading
      ) {
        return prev;
      }
      return { ...prev, [key]: payload };
    });
  }, []);

  const [visible, setVisible] = useState<string[]>(() =>
    COLUMNS.filter((column) => column.defaultOn).map((column) => column.key)
  );
  const columns = useMemo(
    () => COLUMNS.filter((column) => visible.includes(column.key)),
    [visible]
  );

  const [sort, setSort] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  const rows = useMemo(() => {
    const built = integrations.map((integration) => {
      const payload = payloads[`${integration.id}-${date}`];
      const list = Array.isArray(payload?.data) ? payload!.data! : [];
      return {
        integration,
        isLoading: payload?.isLoading !== false,
        hasData: !!list.length,
        cells: columns.map((column) => matchColumn(list, column)),
      };
    });
    if (!sort) {
      return built;
    }
    const index = columns.findIndex((column) => column.key === sort.key);
    if (index === -1) {
      return built;
    }
    // A channel with no value for the sorted column sorts last in BOTH
    // directions: it has no rank, so it must not win an ascending sort.
    return [...built].sort((a, b) => {
      const left = a.cells[index];
      const right = b.cells[index];
      if (!left && !right) return 0;
      if (!left) return 1;
      if (!right) return -1;
      const diff = metricNumber(left) - metricNumber(right);
      return sort.direction === 'asc' ? diff : -diff;
    });
  }, [integrations, payloads, date, columns, sort]);

  const toggleSort = useCallback((key: string) => {
    setSort((prev) => {
      if (prev?.key !== key) {
        // first press ranks best-first, which is what a metric column is for
        return { key, direction: 'desc' };
      }
      return prev.direction === 'desc'
        ? { key, direction: 'asc' }
        : // third press clears it and the page order returns
          null;
    });
  }, []);

  if (!integrations.length) {
    return null;
  }

  return (
    <div className="bg-newTableHeader rounded-[12px] p-[8px] flex flex-col gap-[12px]">
      {integrations.map((integration) => (
        <ChannelDataProbe
          key={`probe-${integration.id}-${date}`}
          integration={integration}
          date={date}
          onLoad={onLoad}
        />
      ))}
      <div className="flex items-start gap-[8px] px-[8px] pt-[8px]">
        <div className="flex flex-col gap-[2px] min-w-0">
          <div className="text-[16px] font-[550]">
            {t('performance', 'Performance')}
          </div>
          <div className="text-[12px] font-[400] text-newTextColor/60">
            {subtitle}
          </div>
        </div>
        <div className="flex-1" />
        {/* Buffer's "Choose columns" control. Contained enough to build here:
            it is local state over the COLUMNS table, no persistence, no
            backend. */}
        <div className="relative shrink-0" ref={chooser.ref}>
          <button
            type="button"
            onClick={chooser.toggle}
            className="flex items-center gap-[6px] h-[32px] px-[12px] rounded-[8px] border border-newTableBorder bg-newBgColorInner text-[14px] font-[500] text-newTextColor hover:bg-boxHover transition-colors duration-150"
          >
            {t('choose_columns', 'Choose columns')}
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
          {chooser.open && (
            <DropdownPanel
              surface="panel"
              anchor="end"
              className="mt-[6px] w-[220px] p-[8px] flex flex-col gap-[2px]"
            >
              {COLUMNS.map((column) => {
                const on = visible.includes(column.key);
                return (
                  <button
                    key={column.key}
                    type="button"
                    // the last visible column cannot be removed: an all-blank
                    // table is not a state anyone chose
                    disabled={on && visible.length === 1}
                    onClick={() =>
                      setVisible((prev) =>
                        prev.includes(column.key)
                          ? prev.filter((key) => key !== column.key)
                          : COLUMNS.filter(
                              (candidate) =>
                                candidate.key === column.key ||
                                prev.includes(candidate.key)
                            ).map((candidate) => candidate.key)
                      )
                    }
                    className="flex items-center gap-[8px] h-[32px] px-[8px] rounded-[6px] text-[14px] text-newTextColor text-start hover:bg-boxHover disabled:opacity-40 disabled:hover:bg-transparent transition-colors duration-150"
                  >
                    <span className="w-[16px] flex items-center justify-center shrink-0">
                      {on && (
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
                    {t(column.key, column.title)}
                  </button>
                );
              })}
            </DropdownPanel>
          )}
        </div>
      </div>
      {/* the table scrolls inside its card on narrow screens: an over-wide
          child must never widen the layout viewport (breaks position:fixed) */}
      <div className="bg-newBgColorInner border border-newTableBorder rounded-[8px] overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="h-[49px] border-b border-newTableBorder">
              <th className="px-[16px] py-[12px] text-start text-[14px] font-[500] text-newTextColor/60">
                {t('channel', 'Channel')}
              </th>
              {columns.map((column) => {
                const direction =
                  sort?.key === column.key ? sort.direction : undefined;
                return (
                  <th
                    key={column.key}
                    // aria-sort belongs to the COLUMN HEADER cell, not to the
                    // control inside it; on the button it would be ignored.
                    aria-sort={
                      direction === 'asc'
                        ? 'ascending'
                        : direction === 'desc'
                        ? 'descending'
                        : 'none'
                    }
                    className="px-[16px] py-[12px] text-start text-[14px] font-[500]"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className={clsx(
                        'group flex items-center gap-[4px] cursor-pointer transition-colors duration-150',
                        direction
                          ? 'text-newTextColor'
                          : 'text-newTextColor/60 hover:text-newTextColor'
                      )}
                    >
                      {t(column.key, column.title)}
                      <SortGlyph direction={direction} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.integration.id}
                onClick={() =>
                  window.history.replaceState(
                    null,
                    '',
                    `/analytics?integration=${row.integration.id}`
                  )
                }
                className={clsx(
                  'h-[64px] border-b border-newTableBorder last:border-b-0 cursor-pointer transition-colors duration-150',
                  // newTableHeader is a raw var() token (no <alpha-value>), so
                  // no /60 opacity modifier: the full wash marks selection.
                  currentId === row.integration.id
                    ? 'bg-newTableHeader'
                    : 'hover:bg-boxHover'
                )}
              >
                <td className="px-[16px] py-[12px]">
                  <div className="flex items-center gap-[10px] min-w-0">
                    <ChannelAvatar
                      picture={row.integration.picture}
                      identifier={row.integration.identifier}
                      name={row.integration.name}
                      size={28}
                      badgeSize={14}
                      youtubeBadgeSize={14}
                      badgeOffset="bottom-[-3px] -end-[3px]"
                    />
                    <span className="text-[14px] font-[500] text-newTextColor truncate">
                      {row.integration.name}
                    </span>
                  </div>
                </td>
                {row.isLoading ? (
                  columns.map((column) => (
                    <td key={column.key} className="px-[16px] py-[12px]">
                      <Skeleton className="h-[16px] w-[64px]" />
                    </td>
                  ))
                ) : !row.hasData ? (
                  <td
                    colSpan={columns.length}
                    className="px-[16px] py-[12px] text-[14px] text-newTextColor/60"
                  >
                    {row.integration.refreshNeeded
                      ? t('channel_needs_a_refresh', 'Channel needs a refresh')
                      : t('no_data_for_this_period', 'No data for this period')}
                  </td>
                ) : (
                  row.cells.map((cell, index) => {
                    const delta = cell ? metricDelta(cell) : null;
                    return (
                      <td
                        key={columns[index].key}
                        className="px-[16px] py-[12px]"
                      >
                        {cell ? (
                          <div className="flex flex-col gap-[2px]">
                            {/* Buffer carries the arrow + change in EVERY
                                cell, not only in the Summary tiles */}
                            <div className="flex items-center gap-[6px]">
                              <span className="text-[14px] font-[550] text-newTextColor">
                                {metricTotal(cell)}
                              </span>
                              {!!delta && <TrendIndicator delta={delta} />}
                            </div>
                            <span className="text-[12px] text-newTextColor/60">
                              {cell.label}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[14px] text-newTextColor/40">
                            -
                          </span>
                        )}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
