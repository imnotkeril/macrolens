"use client";

import {
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  createChart,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  LineStyle,
  CrosshairMode,
} from "lightweight-charts";
import type {
  IChartApi,
  ISeriesApi,
  SeriesType,
  Time,
  LineData,
  MouseEventParams,
  LogicalRange,
} from "lightweight-charts";
import { subMonths } from "date-fns";

/* ── Series configuration ─────────────────────────────────── */

export interface SeriesConfig {
  key: string;
  label: string;
  color: string;
  type?: "line" | "area" | "histogram";
  dashed?: boolean;
  lineWidth?: number;
  priceScaleId?: "left" | "right";
}

export interface ThresholdLine {
  value: number;
  color: string;
  label: string;
}

export interface RecessionBand {
  start: string;
  end: string;
}

export interface LWChartProps {
  data: Record<string, unknown>[];
  series: SeriesConfig[];
  thresholds?: ThresholdLine[];
  recessionBands?: RecessionBand[];
  height?: number;
  periodSelector?: boolean;
  scrollable?: boolean;
  formatValue?: (v: number) => string;
  yDomain?: [number | "auto", number | "auto"];
  autoSize?: boolean;
  onCrosshairMove?: (time: Time | null, point: { x: number; y: number } | null) => void;
  onVisibleRangeChange?: (range: LogicalRange | null) => void;
}

export interface LWChartHandle {
  chart: () => IChartApi | null;
  setCrosshair: (time: Time, point: { x: number; y: number }) => void;
  clearCrosshair: () => void;
  setVisibleRange: (range: LogicalRange) => void;
}

/* ── Period selector ──────────────────────────────────────── */

const PERIODS = [
  { label: "1M", months: 1 },
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "2Y", months: 24 },
  { label: "ALL", months: 0 },
] as const;

/* ── Dark theme ───────────────────────────────────────────── */

const DARK_THEME = {
  layout: {
    background: { color: "transparent" },
    textColor: "#71717a",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: 10,
  },
  grid: {
    vertLines: { color: "rgba(255,255,255,0.04)" },
    horzLines: { color: "rgba(255,255,255,0.04)" },
  },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: {
      width: 1 as const,
      color: "rgba(255,255,255,0.15)",
      style: LineStyle.Dashed,
      labelBackgroundColor: "#27272a",
    },
    horzLine: {
      color: "rgba(255,255,255,0.15)",
      style: LineStyle.Dashed,
      labelBackgroundColor: "#27272a",
    },
  },
  rightPriceScale: {
    borderVisible: false,
    scaleMargins: { top: 0.1, bottom: 0.05 },
  },
  leftPriceScale: {
    borderVisible: false,
    visible: false,
  },
  timeScale: {
    borderVisible: false,
    timeVisible: false,
    fixLeftEdge: true,
    fixRightEdge: true,
  },
};

/* ── Helper: recession bands as area series ───────────────── */

function addRecessionOverlay(
  chart: IChartApi,
  bands: RecessionBand[],
  allDates: string[]
) {
  if (!bands.length || !allDates.length) return null;
  const dateSet = new Set(allDates);
  const recessionPoints: LineData<Time>[] = [];

  for (const d of allDates) {
    const inRecession = bands.some((b) => d >= b.start && d <= b.end);
    recessionPoints.push({
      time: d as Time,
      value: inRecession ? 1e18 : 0,
    });
  }

  const series = chart.addSeries(AreaSeries, {
    priceScaleId: "recession",
    lineWidth: 0,
    topColor: "rgba(255,255,255,0.03)",
    bottomColor: "rgba(255,255,255,0.03)",
    lineColor: "transparent",
    crosshairMarkerVisible: false,
    lastValueVisible: false,
    priceLineVisible: false,
  });

  chart.priceScale("recession").applyOptions({
    scaleMargins: { top: 0, bottom: 0 },
    visible: false,
  });

  series.setData(recessionPoints);
  return series;
}

/* ── Component ────────────────────────────────────────────── */

const LWChart = forwardRef<LWChartHandle, LWChartProps>(function LWChart(
  {
    data,
    series: seriesConfigs,
    thresholds,
    recessionBands,
    height = 280,
    periodSelector = true,
    scrollable = false,
    formatValue,
    yDomain,
    autoSize = true,
    onCrosshairMove,
    onVisibleRangeChange,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<Map<string, ISeriesApi<SeriesType>>>(new Map());
  const legendRef = useRef<HTMLDivElement>(null);
  const mainSeriesKeyRef = useRef<string | null>(null);
  const filteredRef = useRef<Record<string, unknown>[]>([]);
  const [period, setPeriod] = useState("1Y");

  const filtered = useMemo(() => {
    if (!periodSelector || period === "ALL") return data;
    const p = PERIODS.find((pp) => pp.label === period);
    if (!p || p.months === 0) return data;
    const cutoff = subMonths(new Date(), p.months).toISOString().slice(0, 10);
    return data.filter((d) => (d.date as string) >= cutoff);
  }, [data, period, periodSelector]);

  mainSeriesKeyRef.current = seriesConfigs[0]?.key ?? null;
  filteredRef.current = filtered;

  const allDates = useMemo(
    () =>
      filtered
        .map((d) => d.date as string)
        .filter(Boolean)
        .sort(),
    [filtered]
  );

  /* ── Expose chart API via ref ──────────────────────────── */

  useImperativeHandle(
    ref,
    () => ({
      chart: () => chartRef.current,
      setCrosshair: (time, point) => {
        if (!chartRef.current || !time) return;
        const mainSeries = seriesRefs.current.values().next().value;
        if (!mainSeries) return;
        const key = mainSeriesKeyRef.current;
        const timeStr = String(time);
        const pt = key
          ? filteredRef.current.find((d) => String(d.date) === timeStr)
          : null;
        const value = pt && key && pt[key] != null ? (pt[key] as number) : null;
        try {
          if (value != null && Number.isFinite(value)) {
            chartRef.current.setCrosshairPosition(value, time, mainSeries);
          } else {
            chartRef.current.clearCrosshairPosition();
          }
        } catch {
          // Ignore crosshair sync errors (e.g. invalid range, destroyed chart)
        }
      },
      clearCrosshair: () => chartRef.current?.clearCrosshairPosition(),
      setVisibleRange: (range) =>
        chartRef.current?.timeScale().setVisibleLogicalRange(range),
    }),
    []
  );

  /* ── Legend update callback ────────────────────────────── */

  const fmtVal = formatValue ?? ((v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 }));

  const updateLegend = useCallback(
    (param: MouseEventParams<Time>) => {
      if (!legendRef.current) return;
      const parts: string[] = [];

      for (const cfg of seriesConfigs) {
        const s = seriesRefs.current.get(cfg.key);
        if (!s) continue;
        const d = param.seriesData?.get(s) as { value?: number } | undefined;
        if (d?.value !== undefined) {
          parts.push(
            `<span style="color:${cfg.color}">${cfg.label}: ${fmtVal(d.value)}</span>`
          );
        }
      }

      legendRef.current.innerHTML = parts.join(
        '<span style="color:#3f3f46;margin:0 6px">|</span>'
      );
    },
    [seriesConfigs, fmtVal]
  );

  /* ── Create / destroy chart ────────────────────────────── */

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      ...DARK_THEME,
      ...(scrollable && {
        timeScale: {
          ...DARK_THEME.timeScale,
          fixLeftEdge: false,
          fixRightEdge: false,
        },
      }),
      height,
      autoSize,
    } as Parameters<typeof createChart>[1]);

    chartRef.current = chart;

    /* Series */
    const sMap = new Map<string, ISeriesApi<SeriesType>>();

    for (const cfg of seriesConfigs) {
      const points: LineData<Time>[] = filtered
        .filter((d) => d[cfg.key] != null)
        .map((d) => ({
          time: (d.date as string) as Time,
          value: d[cfg.key] as number,
        }));

      let s: ISeriesApi<SeriesType>;

      if (cfg.type === "area") {
        s = chart.addSeries(AreaSeries, {
          lineColor: cfg.color,
          topColor: cfg.color + "18",
          bottomColor: "transparent",
          lineWidth: (cfg.lineWidth ?? 2) as 1 | 2 | 3 | 4,
          crosshairMarkerRadius: 3,
          crosshairMarkerBorderColor: cfg.color,
          crosshairMarkerBackgroundColor: cfg.color,
          lastValueVisible: false,
          priceLineVisible: false,
          priceScaleId: cfg.priceScaleId ?? "right",
        });
      } else if (cfg.type === "histogram") {
        s = chart.addSeries(HistogramSeries, {
          color: cfg.color,
          lastValueVisible: false,
          priceLineVisible: false,
          priceScaleId: cfg.priceScaleId ?? "right",
        });
      } else {
        s = chart.addSeries(LineSeries, {
          color: cfg.color,
          lineWidth: (cfg.lineWidth ?? 2) as 1 | 2 | 3 | 4,
          lineStyle: cfg.dashed ? LineStyle.Dashed : LineStyle.Solid,
          crosshairMarkerRadius: 3,
          crosshairMarkerBorderColor: cfg.color,
          crosshairMarkerBackgroundColor: cfg.color,
          lastValueVisible: false,
          priceLineVisible: false,
          priceScaleId: cfg.priceScaleId ?? "right",
        });
      }

      s.setData(points);
      sMap.set(cfg.key, s);

      /* Threshold price lines */
      if (thresholds) {
        for (const t of thresholds) {
          s.createPriceLine({
            price: t.value,
            color: t.color,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: false,
            title: t.label,
          });
        }
      }
    }

    seriesRefs.current = sMap;

    /* Auto-show left price scale when any series uses it */
    if (seriesConfigs.some((c) => c.priceScaleId === "left")) {
      chart.priceScale("left").applyOptions({
        visible: true,
        scaleMargins: { top: 0.1, bottom: 0.05 },
      });
    }

    /* Recession bands */
    if (recessionBands?.length) {
      addRecessionOverlay(chart, recessionBands, allDates);
    }

    /* Price format */
    if (formatValue) {
      chart.priceScale("right").applyOptions({
        // @ts-expect-error – runtime accepted
        formatPrice: (price: number) => formatValue(price),
      });
    }

    /* Y-axis domain clamp */
    if (yDomain) {
      const margins = { top: 0.05, bottom: 0.05 };
      if (yDomain[0] !== "auto" || yDomain[1] !== "auto") {
        chart.priceScale("right").applyOptions({ scaleMargins: margins });
      }
    }

    chart.timeScale().fitContent();

    /* Events */
    chart.subscribeCrosshairMove((param) => {
      updateLegend(param);
      if (onCrosshairMove) {
        onCrosshairMove(
          param.time ?? null,
          param.point ? { x: param.point.x, y: param.point.y } : null
        );
      }
    });

    if (onVisibleRangeChange) {
      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        onVisibleRangeChange(range);
      });
    }

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRefs.current.clear();
    };
    // Recreate chart whenever data or config changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, seriesConfigs, thresholds, recessionBands, height, autoSize, scrollable]);

  return (
    <div>
      {/* Period selector */}
      {periodSelector && (
        <div className="flex gap-1 mb-3">
          {PERIODS.map((p) => (
            <button
              key={p.label}
              onClick={() => setPeriod(p.label)}
              className={`px-2.5 py-1 text-[10px] font-medium rounded transition-colors ${
                period === p.label
                  ? "bg-accent/20 text-accent border border-accent/30"
                  : "text-text-muted hover:text-text-secondary border border-transparent"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Legend overlay */}
      <div
        ref={legendRef}
        className="text-[10px] font-light text-text-secondary mb-1 h-4 overflow-hidden whitespace-nowrap"
      />

      {/* Chart container */}
      <div ref={containerRef} style={{ height }} />
    </div>
  );
});

LWChart.displayName = "LWChart";
export default LWChart;
