import React, {
  FC,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import useSWR from 'swr';
import DrawChart from 'chart.js/auto';
import dayjs from 'dayjs';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Select } from '@gitroom/react/form/select';
import { Skeleton } from '@gitroom/frontend/components/layout/skeleton';
import { EmptyState } from '@gitroom/frontend/components/cuesoft/empty-state';
import { MissingReleaseModal } from '@gitroom/frontend/components/launches/missing-release.modal';

interface AnalyticsData {
  label: string;
  data: Array<{ total: number; date: string }>;
  percentageChange: number;
  average?: boolean;
}

/* Buffer-flat chart ink (same recipe as platform-analytics/analytics-chart):
   one flat data-positive green accent, hairline gridlines, muted tick labels.
   Chart.js needs literal colors while the tokens live in CSS variables, so
   they are resolved at draw time with the Buffer-measured light values as
   fallbacks. */
const ACCENT = '#2f7d44';

const readChartInk = () => {
  const fallback = {
    muted: 'rgba(41, 41, 40, 0.6)',
    hairline: 'rgba(43, 32, 17, 0.12)',
    ink: 'rgba(41, 41, 40, 1)',
    surface: '#ffffff',
  };
  if (typeof window === 'undefined') {
    return fallback;
  }
  const style = getComputedStyle(document.documentElement);
  const parts = style
    .getPropertyValue('--new-textColor')
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  const rgb = parts.length === 3 ? parts.join(', ') : '41, 41, 40';
  return {
    muted: `rgba(${rgb}, 0.6)`,
    hairline:
      style.getPropertyValue('--new-table-border').trim() || fallback.hairline,
    ink: `rgba(${rgb}, 1)`,
    surface:
      style.getPropertyValue('--new-bgColorInner').trim() || fallback.surface,
  };
};

/** Flat sparkline for one metric card: 2px #2f7d44 line, no fill/gradient,
    hairline y-gridlines, muted 10px ticks, token-inked hover tooltip.
    Replaces the legacy purple/green/blue gradient ChartSocial (this modal was
    its only consumer). */
const FlatMetricLine: FC<{ item: AnalyticsData }> = ({ item }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const chart = useRef<DrawChart | null>(null);

  const points = useMemo(() => {
    const sorted = [...(item.data || [])]
      .filter((p) => p && p.date)
      .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
    // a single datapoint still draws a (flat) line, like the old chart did
    return sorted.length === 1 ? [sorted[0], sorted[0]] : sorted;
  }, [item]);

  useEffect(() => {
    if (!ref.current || points.length < 2) {
      return;
    }
    const colors = readChartInk();
    chart.current = new DrawChart(ref.current, {
      type: 'line',
      options: {
        maintainAspectRatio: false,
        responsive: true,
        animation: { duration: 300, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { left: 0, right: 0, top: 4, bottom: 0 } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: colors.hairline },
            border: { display: false },
            ticks: {
              color: colors.muted,
              font: { size: 10 },
              maxTicksLimit: 4,
              callback: (value: any) =>
                item.average
                  ? `${value}%`
                  : new Intl.NumberFormat(undefined, {
                      notation: 'compact',
                    }).format(Number(value)),
            },
          },
          x: {
            // the 120px card keeps its axis quiet; dates live in the tooltip
            display: false,
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: colors.surface,
            titleColor: colors.muted,
            bodyColor: colors.ink,
            borderColor: colors.hairline,
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            displayColors: false,
            titleFont: { size: 12, weight: 'normal' },
            bodyFont: { size: 14, weight: 'bold' },
            callbacks: {
              label: (ctx: any) =>
                `${item.label}: ${new Intl.NumberFormat().format(
                  ctx.parsed.y
                )}${item.average ? '%' : ''}`,
            },
          },
        },
      },
      data: {
        labels: points.map((p) => dayjs(p.date).format('MMM D')),
        datasets: [
          {
            label: item.label,
            data: points.map((p) => Number(p.total) || 0),
            borderColor: ACCENT,
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: ACCENT,
            pointHoverBorderColor: colors.surface,
            pointHoverBorderWidth: 2,
          },
        ],
      },
    });
    return () => {
      chart.current?.destroy();
      chart.current = null;
    };
  }, [points, item.label, item.average]);

  if (points.length < 2) {
    return null;
  }

  return <canvas className="w-full h-full" ref={ref} />;
};

export const StatisticsModal: FC<{
  postId: string;
}> = (props) => {
  const { postId } = props;
  const t = useT();
  const fetch = useFetch();
  const [dateRange, setDateRange] = useState(7);

  const loadStatistics = useCallback(async () => {
    return (await fetch(`/posts/${postId}/statistics`)).json();
  }, [postId, fetch]);

  const loadPostAnalytics = useCallback(async () => {
    return (await fetch(`/analytics/post/${postId}?date=${dateRange}`)).json();
  }, [postId, dateRange, fetch]);

  const { data: statisticsData, isLoading: isLoadingStatistics } = useSWR(
    `/posts/${postId}/statistics`,
    loadStatistics
  );

  const { data: analyticsData, isLoading: isLoadingAnalytics, mutate: mutateAnalytics } = useSWR(
    `/analytics/post/${postId}?date=${dateRange}`,
    loadPostAnalytics,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      revalidateOnMount: true,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    }
  );

  const isMissing = analyticsData && !Array.isArray(analyticsData) && analyticsData.missing;

  const dateOptions = useMemo(() => {
    return [
      { key: 7, value: t('7_days', '7 Days') },
      { key: 30, value: t('30_days', '30 Days') },
      { key: 90, value: t('90_days', '90 Days') },
    ];
  }, [t]);

  const totals = useMemo(() => {
    if (!analyticsData || !Array.isArray(analyticsData)) return [];
    return analyticsData.map((p: AnalyticsData) => {
      const value =
        (p?.data?.reduce((acc: number, curr: any) => acc + Number(curr.total), 0) || 0) /
        (p.average ? p.data.length : 1);
      if (p.average) {
        return value.toFixed(2) + '%';
      }
      return Math.round(value);
    });
  }, [analyticsData]);

  const isLoading = isLoadingStatistics || isLoadingAnalytics;

  return (
    <div className="relative min-h-[200px]">
      {isLoading ? (
        // skeleton mirroring the analytics section below: header row
        // (title bar + range select) over the three chart cards
        <div className="flex flex-col gap-[14px]">
          <div className="flex items-center justify-between">
            <Skeleton className="h-[18px] w-[160px]" />
            <Skeleton className="h-[38px] w-[150px]" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[16px]">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex flex-col border border-newTableBorder rounded-[12px] p-[16px] gap-[12px]"
              >
                <Skeleton className="h-[15px] w-[40%]" />
                <Skeleton className="h-[120px] w-full" />
                <Skeleton className="h-[36px] w-[80px]" />
              </div>
            ))}
          </div>
        </div>
      ) : isMissing ? (
        <MissingReleaseModal postId={postId} onSuccess={() => mutateAnalytics()} />
      ) : (
        <div className="flex flex-col gap-[24px]">
          {/* Post Analytics Section */}
          {analyticsData && Array.isArray(analyticsData) && analyticsData.length > 0 && (
            <div className="flex flex-col gap-[14px]">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-[550] text-newTextColor">
                  {t('post_analytics', 'Post Analytics')}
                </h3>
                <div className="max-w-[150px]">
                  <Select
                    label=""
                    name="date"
                    disableForm={true}
                    hideErrors={true}
                    value={dateRange}
                    onChange={(e) => setDateRange(+e.target.value)}
                  >
                    {dateOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.value}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[16px]">
                {analyticsData.map((p: AnalyticsData, index: number) => (
                  <div key={`analytics-${index}`}>
                    <div className="flex flex-col h-full bg-newTableHeader border border-newTableBorder rounded-[12px] overflow-hidden">
                      <div className="flex items-center justify-between px-[16px] pt-[14px] pb-[8px]">
                        <div className="flex items-center gap-[10px]">
                          {/* single flat accent — the per-card purple/green/
                              blue variants left with the gradient chart */}
                          <div className="w-[8px] h-[8px] rounded-full bg-[#2f7d44]" />
                          <span className="text-[14px] font-medium text-newTableText">
                            {p.label}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 px-[12px] py-[8px]">
                        <div className="h-[120px] relative">
                          <FlatMetricLine item={p} key={`chart-${index}`} />
                        </div>
                      </div>
                      <div className="px-[16px] pb-[14px]">
                        <div className="text-[36px] leading-[42px] font-semibold tracking-tight text-newTextColor">
                          {totals[index]}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Short Links Statistics Section */}
          <div className="flex flex-col gap-[14px]">
            <h3 className="text-[16px] font-[550] text-newTextColor">
              {t('short_links_statistics', 'Short Links Statistics')}
            </h3>
            {statisticsData?.clicks?.length === 0 ? (
              <EmptyState
                variant="inline"
                title={t('no_short_link_results', 'No short link results')}
              />
            ) : (
              // kit table: hairline r8 frame, header wash, hairline row rules
              <div className="grid grid-cols-3 border border-newTableBorder rounded-[8px] overflow-hidden text-[14px] text-newTextColor">
                <div className="bg-newTableHeader px-[12px] py-[8px] font-[550] text-newTableText">
                  {t('short_link', 'Short Link')}
                </div>
                <div className="bg-newTableHeader px-[12px] py-[8px] font-[550] text-newTableText">
                  {t('original_link', 'Original Link')}
                </div>
                <div className="bg-newTableHeader px-[12px] py-[8px] font-[550] text-newTableText">
                  {t('clicks', 'Clicks')}
                </div>
                {statisticsData?.clicks?.map((p: any) => (
                  <Fragment key={p.short}>
                    <div className="px-[12px] py-[10px] border-t border-newTableBorder break-all">
                      {p.short}
                    </div>
                    <div className="px-[12px] py-[10px] border-t border-newTableBorder break-all">
                      {p.original}
                    </div>
                    <div className="px-[12px] py-[10px] border-t border-newTableBorder">
                      {p.clicks}
                    </div>
                  </Fragment>
                ))}
              </div>
            )}
          </div>

          {/* No analytics available message */}
          {(!analyticsData || !Array.isArray(analyticsData) || analyticsData.length === 0) &&
            (!statisticsData?.clicks || statisticsData.clicks.length === 0) && (
              <EmptyState
                title={t('no_statistics_available', 'No statistics available for this post')}
              />
            )}
        </div>
      )}
    </div>
  );
};
