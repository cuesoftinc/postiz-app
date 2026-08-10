'use client';

import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DrawChart from 'chart.js/auto';
import clsx from 'clsx';
import dayjs from 'dayjs';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { AnalyticsDataItem } from '@gitroom/frontend/components/platform-analytics/render.analytics';
import { ChartSkeleton } from '@gitroom/frontend/components/platform-analytics/analytics.skeletons';

/* Single flat accent for the one plotted series — the page's existing
   data-positive green (validated ≥3:1 on the white surface). One series →
   no legend; the metric picker names it. */
const ACCENT = '#2f7d44';

/* Chart.js needs literal colors, and the tokens live in CSS variables
   (--new-textColor is bare "R G B" components, --new-table-border a full
   rgba() string). Resolve at draw time with the Buffer-measured light values
   as fallbacks, so the chart re-inks itself per theme like the rest of the
   page. */
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

/** The per-day plot of ONE metric from the real per-platform payload
    (AnalyticsData.data: [{ total, date }]). Buffer-flat: 2px accent line, no
    fill/gradients, hairline y-gridlines only, muted 11px tick labels, hover
    crosshair tooltip. */
const MetricLine: FC<{ item: AnalyticsDataItem }> = ({ item }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const chart = useRef<DrawChart | null>(null);

  const points = useMemo(() => {
    return [...(item.data || [])]
      .filter((p) => p && p.date)
      .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
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
              font: { size: 11 },
              maxTicksLimit: 5,
              callback: (value: any) =>
                item.average
                  ? `${value}%`
                  : new Intl.NumberFormat(undefined, {
                      notation: 'compact',
                    }).format(Number(value)),
            },
          },
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: colors.muted,
              font: { size: 11 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8,
            },
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

  return <canvas className="w-full h-full" ref={ref} />;
};

/** "Trends" section: grey Buffer SECTION wrapper (r12, header inside) around
    a white hairline card holding a metric picker + the per-day line chart.
    Fetches the SAME endpoint/key as RenderAnalytics, so SWR dedupes to one
    request per channel+range. Renders nothing when no metric has ≥2 daily
    points — no invented data, no empty frame. */
export const AnalyticsChartSection: FC<{
  integration: { id: string };
  date: number;
  subtitle: string;
}> = ({ integration, date, subtitle }) => {
  const fetch = useFetch();
  const t = useT();
  const [selected, setSelected] = useState(0);

  const load = useCallback(async () => {
    return (await fetch(`/analytics/${integration.id}?date=${date}`)).json();
  }, [integration.id, date]);

  const { data, isLoading } = useSWR<AnalyticsDataItem[]>(
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

  // Only metrics that can actually be charted (≥2 real daily points).
  const chartable = useMemo(() => {
    return (Array.isArray(data) ? data : []).filter(
      (item) => (item?.data?.filter((p) => p && p.date) || []).length >= 2
    );
  }, [data]);

  const current = chartable[Math.min(selected, chartable.length - 1)];

  if (!isLoading && !chartable.length) {
    return null;
  }

  return (
    <div className="bg-newTableHeader rounded-[12px] p-[8px] flex flex-col gap-[12px]">
      <div className="flex flex-col gap-[2px] px-[8px] pt-[8px]">
        <div className="text-[16px] font-[600]">{t('trends', 'Trends')}</div>
        <div className="text-[14px] text-newTextColor/60">{subtitle}</div>
      </div>
      <div className="bg-newBgColorInner border border-newTableBorder rounded-[8px] p-[16px] flex flex-col gap-[12px]">
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <>
            {/* Metric picker — same segmented anatomy as the range picker
                (24px r6 segments, active = green-tint fill), wrapping when a
                platform ships many metrics. */}
            <div
              data-cs
              className="flex flex-wrap items-center p-[4px] gap-[2px] rounded-[8px] border border-newTableBorder bg-newBgColorInner self-start max-w-full"
            >
              {chartable.map((item, index) => (
                <button
                  key={`metric-${item.label}`}
                  type="button"
                  onClick={() => setSelected(index)}
                  className={clsx(
                    'h-[24px] px-[10px] rounded-[6px] text-[14px] font-[500] whitespace-nowrap cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#325ea6]',
                    current === item
                      ? 'bg-boxFocused text-textItemFocused'
                      : 'text-textItemBlur hover:bg-boxHover'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="h-[220px] w-full">
              {current && (
                <MetricLine
                  key={`${integration.id}-${date}-${current.label}`}
                  item={current}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
