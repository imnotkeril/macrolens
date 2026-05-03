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
  ColorType,
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
import { rgbaFromCssColor, resolveCssColorForCanvas } from "@/lib/chartCssColor";

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
  data: Array<{ date: string }>;
  series: SeriesConfig[];
  thresholds?: ThresholdLine[];
  recessionBands?: RecessionBand[];
  height?: number;
  periodSelector?: boolean;
  scrollable?: boolean;
  formatValue?: (v: number) => string;
  yDomain?: [number | "auto", number | "auto"];
  /** Locks the right price scale (e.g. 0–100 for hawk/dovish index). Requires lightweight-charts v5 autoscaleInfoProvider. */
  fixedPriceRange?: { min: number; max: number };
  autoSize?: boolean;
  onCrosshairMove?: (time: Time | null, point: { x: number; y: number } | null) => void;
  onVisibleRangeChange?: (range: LogicalRange | null) => void;
  /** Solid chart pane background (e.g. `var(--nd-panel)` for `/next` shell). */
  layoutBackgroundColor?: string;
  /** Period selector + legend styling aligned with Next dashboard tokens instead of legacy `accent`. */
  uiVariant?: "default" | "next";
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

/* v5: layout.background must include ColorType or the library keeps default white. */
const DARK_THEME = {
  layout: {
    background: { type: ColorType.Solid, color: "#13131a" },
    textColor: "#a1a1aa",
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
    lineWidth: 1,
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
    fixedPriceRange,
    autoSize = true,
    onCrosshairMove,
    onVisibleRangeChange,
    layoutBackgroundColor,
    uiVariant = "default",
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<Map<string, ISeriesApi<SeriesType>>>(new Map());
  const legendRef = useRef<HTMLDivElement>(null);
  const mainSeriesKeyRef = useRef<string | null>(null);
  const filteredRef = useRef<Array<{ date: string }>>([]);
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
        const pointData = pt as Record<string, unknown> | undefined;
        const value =
          pointData && key && pointData[key] != null
            ? (pointData[key] as number)
            : null;
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

  const fmtVal = useMemo(
    () => formatValue ?? ((v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 })),
    [formatValue]
  );

  const updateLegend = useCallback(
    (param: MouseEventParams<Time>) => {
      if (!legendRef.current) return;
      const parts: string[] = [];
      const sepColor =
        uiVariant === "next" ? resolveCssColorForCanvas("var(--nd-muted)") : "#52525b";

      for (const cfg of seriesConfigs) {
        const s = seriesRefs.current.get(cfg.key);
        if (!s) continue;
        const d = param.seriesData?.get(s) as { value?: number } | undefined;
        if (d?.value !== undefined) {
          const legendColor = resolveCssColorForCanvas(cfg.color);
          parts.push(
            `<span style="color:${legendColor}">${cfg.label}: ${fmtVal(d.value)}</span>`
          );
        }
      }

      legendRef.current.innerHTML = parts.join(
        `<span style="color:${sepColor};margin:0 6px">|</span>`
      );
    },
    [seriesConfigs, fmtVal, uiVariant]
  );

  /* ── Create / destroy chart ────────────────────────────── */

  useEffect(() => {
    if (!containerRef.current) return;

    const layoutBgRaw =
      layoutBackgroundColor ??
      ((DARK_THEME.layout.background as { color?: string }).color || "#13131a");
    const layoutBg =
      layoutBgRaw === "transparent"
        ? "transparent"
        : resolveCssColorForCanvas(layoutBgRaw);

    const chart = createChart(containerRef.current, {
      ...DARK_THEME,
      layout: {
        ...DARK_THEME.layout,
        background: { type: ColorType.Solid, color: layoutBg },
      },
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
        .filter((d) => (d as Record<string, unknown>)[cfg.key] != null)
        .map((d) => ({
          time: (d.date as string) as Time,
          value: (d as Record<string, unknown>)[cfg.key] as number,
        }));

      let s: ISeriesApi<SeriesType>;

      if (cfg.type === "area") {
        const stroke = resolveCssColorForCanvas(cfg.color);
        s = chart.addSeries(AreaSeries, {
          lineColor: stroke,
          topColor: rgbaFromCssColor(cfg.color, 0.12),
          bottomColor: "transparent",
          lineWidth: (cfg.lineWidth ?? 2) as 1 | 2 | 3 | 4,
          crosshairMarkerRadius: 3,
          crosshairMarkerBorderColor: stroke,
          crosshairMarkerBackgroundColor: stroke,
          lastValueVisible: false,
          priceLineVisible: false,
          priceScaleId: cfg.priceScaleId ?? "right",
        });
      } else if (cfg.type === "histogram") {
        s = chart.addSeries(HistogramSeries, {
          color: resolveCssColorForCanvas(cfg.color),
          lastValueVisible: false,
          priceLineVisible: false,
          priceScaleId: cfg.priceScaleId ?? "right",
        });
      } else {
        const stroke = resolveCssColorForCanvas(cfg.color);
        s = chart.addSeries(LineSeries, {
          color: stroke,
          lineWidth: (cfg.lineWidth ?? 2) as 1 | 2 | 3 | 4,
          lineStyle: cfg.dashed ? LineStyle.Dashed : LineStyle.Solid,
          crosshairMarkerRadius: 3,
          crosshairMarkerBorderColor: stroke,
          crosshairMarkerBackgroundColor: stroke,
          lastValueVisible: false,
          priceLineVisible: false,
          priceScaleId: cfg.priceScaleId ?? "right",
        });
      }

      s.setData(points);
      sMap.set(cfg.key, s);

      if (fixedPriceRange) {
        s.applyOptions({
          autoscaleInfoProvider: () => ({
            priceRange: {
              minValue: fixedPriceRange.min,
              maxValue: fixedPriceRange.max,
            },
          }),
        });
      }
    }

    /* Threshold price lines (attach once to the main series to avoid duplicates) */
    const mainSeries = seriesConfigs[0] ? sMap.get(seriesConfigs[0].key) : undefined;
    if (mainSeries && thresholds?.length) {
      for (const t of thresholds) {
        mainSeries.createPriceLine({
          price: t.value,
          color: resolveCssColorForCanvas(t.color),
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: t.label,
        });
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
  }, [
    filtered,
    seriesConfigs,
    thresholds,
    recessionBands,
    height,
    autoSize,
    scrollable,
    yDomain,
    formatValue,
    fixedPriceRange,
    layoutBackgroundColor,
  ]);

  return (
    <div>
      {/* Period selector */}
      {periodSelector && (
        <div
          className={
            uiVariant === "next"
              ? "mb-3 flex justify-end gap-1"
              : "mb-3 flex gap-1"
          }
        >
          {PERIODS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setPeriod(p.label)}
              className={
                uiVariant === "next"
                  ? "rounded-[2px] px-2.5 py-1 text-[10px] font-medium transition-colors"
                  : `rounded px-2.5 py-1 text-[10px] font-medium transition-colors ${
                      period === p.label
                        ? "border border-accent/30 bg-accent/20 text-accent"
                        : "border border-transparent text-text-muted hover:text-text-secondary"
                    }`
              }
              style={
                uiVariant === "next"
                  ? {
                      border:
                        period === p.label ? "1px solid var(--nd-border)" : "1px solid transparent",
                      background: period === p.label ? "var(--nd-panel-soft)" : "transparent",
                      color: period === p.label ? "var(--nd-text)" : "var(--nd-muted)",
                    }
                  : undefined
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Legend overlay */}
      <div
        ref={legendRef}
        className={
          uiVariant === "next"
            ? "mb-1 h-4 overflow-hidden whitespace-nowrap text-[10px] font-light"
            : "mb-1 h-4 overflow-hidden whitespace-nowrap text-[10px] font-light text-text-secondary"
        }
        style={uiVariant === "next" ? { color: "var(--nd-soft)" } : undefined}
      />

      {/* Chart container */}
      <div ref={containerRef} style={{ height }} />
    </div>
  );
});

LWChart.displayName = "LWChart";
export default LWChart;
