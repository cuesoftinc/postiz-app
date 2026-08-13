'use client';

import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DrawChart from 'chart.js/auto';
import dayjs from 'dayjs';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import {
  AnalyticsDataItem,
  formatMetricValue,
} from '@gitroom/frontend/components/platform-analytics/render.analytics';
import { ChartSkeleton } from '@gitroom/frontend/components/platform-analytics/analytics.skeletons';
import { SegmentedControl } from '@gitroom/frontend/components/cuesoft/toolbar/toolbar';
import { modeEmitter } from '@gitroom/frontend/components/layout/mode.component';

/* Single flat accent for the one plotted series, per theme: the page's
   data-positive green on the white surface (validated ≥3:1 there), the brand
   lime on dark, because #2f7d44 on the near-black card reads ~2:1 and
   vanishes
   (user report 2026-08-11). One series → no legend; the picker names it. */
const ACCENT_LIGHT = '#2f7d44';
const ACCENT_DARK = '#bfff72';

/* Buffer's chart is 1060 × 160 (measured live 2026-08-13), so the plot box is
   160 tall rather than the 220 this card used while it drew a line. */
const PLOT_HEIGHT = 160;

/* Chart.js needs literal colors, and the tokens live in CSS variables
   (--new-textColor is bare "R G B" components, --new-table-border a full
   rgba() string). Resolve at draw time from document.BODY: the theme class
   lives there (mode.component), so reading documentElement always returned
   the LIGHT values and dark mode drew ghost labels (same user report). */
const readChartInk = () => {
  const fallback = {
    muted: 'rgba(41, 41, 40, 0.6)',
    hairline: 'rgba(43, 32, 17, 0.12)',
    ink: 'rgba(41, 41, 40, 1)',
    surface: '#ffffff',
    accent: ACCENT_LIGHT,
  };
  if (typeof window === 'undefined') {
    return fallback;
  }
  const style = getComputedStyle(document.body);
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
    accent: document.body.classList.contains('dark')
      ? ACCENT_DARK
      : ACCENT_LIGHT,
  };
};

/** The per-day plot of ONE metric from the real per-platform payload
    (AnalyticsData.data: [{ total, date }]).

    BARS, not a line. Buffer's Insights trends charts are Recharts
    `recharts-bar` / `recharts-bar-rectangles` with gridlines VERTICAL only
    (`recharts-cartesian-grid-vertical`, 1px solid, no dasharray), an xAxis
    with ticks and tick-lines, no dot markers, no legend, and a tooltip
    (measured live 2026-08-13). This card previously drew a line series with
    the gridlines on the OTHER axis, which was the divergence.

    Two things Buffer does not do are kept on purpose: the y-axis tick labels
    (Buffer renders none and leans entirely on hover, which leaves the chart
    unreadable without a pointer) and the single-point state below. Neither
    adds a gridline, so the measured grid still matches. */
const MetricBars: FC<{ item: AnalyticsDataItem }> = ({ item }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const chart = useRef<DrawChart | null>(null);
  // theme flips re-ink the canvas: chart.js keeps literal colors, so the
  // chart must redraw when the mode toggles. The emitter fires BEFORE the
  // body class updates (mode.component emits, then commits), hence the
  // deferred tick.
  const [themeTick, setThemeTick] = useState(0);
  useEffect(() => {
    const onMode = () => setTimeout(() => setThemeTick((v) => v + 1), 50);
    modeEmitter.on('mode', onMode);
    return () => {
      modeEmitter.off('mode', onMode);
    };
  }, []);

  const points = useMemo(() => {
    return [...(item.data || [])]
      .filter((p) => p && p.date)
      .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
  }, [item]);

  useEffect(() => {
    if (!ref.current || !points.length) {
      return;
    }
    const colors = readChartInk();
    chart.current = new DrawChart(ref.current, {
      type: 'bar',
      options: {
        maintainAspectRatio: false,
        responsive: true,
        animation: { duration: 300, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        // top 12: at 4 the topmost y-axis tick label drew half-clipped
        // against the card edge
        layout: { padding: { left: 0, right: 0, top: 12, bottom: 0 } },
        scales: {
          y: {
            beginAtZero: true,
            // Buffer's grid is vertical ONLY, so the horizontal lines this
            // axis used to draw are gone. The tick LABELS stay (see above).
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: colors.muted,
              font: { size: 11 },
              maxTicksLimit: 5,
              callback: (value: any) =>
                formatMetricValue(item, Number(value), true),
            },
          },
          x: {
            // The measured grid: vertical, 1px, solid (no dasharray), on the
            // hairline token, with tick-lines on the axis.
            grid: {
              display: true,
              color: colors.hairline,
              lineWidth: 1,
              drawTicks: true,
              tickColor: colors.hairline,
              tickLength: 4,
            },
            border: { display: true, color: colors.hairline },
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
                `${item.label}: ${formatMetricValue(
                  item,
                  Number(ctx.parsed.y)
                )}`,
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
            backgroundColor: colors.accent,
            borderWidth: 0,
            // a one-point series would otherwise paint a bar the full width
            // of the plot, which reads as a filled panel rather than a bar
            maxBarThickness: 48,
          },
        ],
      },
    });
    return () => {
      chart.current?.destroy();
      chart.current = null;
    };
    // item.unit is in here because every tick label, tooltip and axis format
    // goes through formatMetricValue, which reads it.
  }, [points, item.label, item.average, item.unit, themeTick]);

  return <canvas className="w-full h-full" ref={ref} />;
};

/** "Trends" section: grey Buffer SECTION wrapper (r12, header inside) around
    a white hairline card holding a metric picker + the per-day bar chart.
    Fetches the SAME endpoint/key as RenderAnalytics, so SWR dedupes to one
    request per channel+range.

    Buffer hardcodes exactly two charts ("Followers", "Posts"); the picker is
    kept instead because provider payloads carry different metric sets and a
    fixed pair would print empty frames for most channels.

    ONE real point is still enough to draw, because an absent card was worse
    than a small one: it used to take two points, and the relay channels are
    the only two this instance publishes to.

    That single-point case is now rare rather than universal. The relay builds
    a genuine per-day series out of Buffer's per-post metrics, so it falls back
    to one point only when NOTHING was published in the window and there is
    honestly no shape to draw. Rate metrics also carry only the days that had
    posts, because a rate on a day with nothing published is undefined rather
    than zero, so their series can be shorter than the window. */
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

  // Only metrics that carry at least one real dated point.
  const chartable = useMemo(() => {
    return (Array.isArray(data) ? data : []).filter(
      (item) => (item?.data?.filter((p) => p && p.date) || []).length >= 1
    );
  }, [data]);

  // Clamped here rather than only at read time: the segmented control is
  // driven by this index, so a stale `selected` left over from a channel with
  // more metrics has to resolve to the segment that is actually plotted.
  const selectedIndex = Math.min(selected, chartable.length - 1);
  const current = chartable[selectedIndex];
  const pointCount = (current?.data || []).filter((p) => p && p.date).length;

  if (!isLoading && !chartable.length) {
    return null;
  }

  return (
    <div className="bg-newTableHeader rounded-[12px] p-[8px] flex flex-col gap-[12px]">
      <div className="flex flex-col gap-[2px] px-[8px] pt-[8px]">
        <div className="text-[16px] font-[550]">{t('trends', 'Trends')}</div>
        <div className="text-[12px] font-[400] text-newTextColor/60">
          {subtitle}
        </div>
      </div>
      <div className="bg-newBgColorInner border border-newTableBorder rounded-[8px] p-[16px] flex flex-col gap-[12px]">
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <>
            {/* Metric picker: the shared SegmentedControl, same as the range
                picker on the page above. It only sizes itself here — wrapping
                when a platform ships many metrics, and on phone becoming a
                single-row sideways scroll strip, because wrapping produced a
                ragged 2x2 cluster that read as a broken segmented control.
                The selection is carried as the metric's INDEX because that is
                what the chart is keyed on; labels are display strings and two
                providers could repeat one. */}
            <SegmentedControl
              className="flex-wrap self-start max-w-full phone:flex-nowrap phone:overflow-x-auto phone:[scrollbar-width:none]"
              itemClassName="shrink-0"
              value={String(selectedIndex)}
              onChange={(index) => setSelected(Number(index))}
              options={chartable.map((item, index) => ({
                value: String(index),
                label: item.label,
              }))}
            />
            <div style={{ height: PLOT_HEIGHT }} className="w-full">
              {current && (
                <MetricBars
                  key={`${integration.id}-${date}-${current.label}`}
                  item={current}
                />
              )}
            </div>
            {pointCount === 1 && (
              <div className="text-[12px] font-[400] text-newTextColor/60">
                {t(
                  'one_data_point_in_this_window',
                  'One data point in this window: there is a total to report but not enough days with posts to plot a shape.'
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
