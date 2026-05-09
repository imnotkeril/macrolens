"use client";

import { useMemo, type ComponentProps } from "react";
import { format, parseISO } from "date-fns";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MergedChartRow } from "@/components/next-dashboard/analysis/relativePerformanceUtils";
import { RELATIVE_PERF_PERIOD_OPTIONS } from "@/components/next-dashboard/analysis/relativePerformanceUtils";
import type { RecessionBand } from "@/types";

const TIP: React.CSSProperties = {
  backgroundColor: "var(--nd-panel-soft)",
  border: "1px solid var(--nd-border-soft)",
  borderRadius: 4,
  fontSize: 11,
  color: "var(--nd-text)",
};

function roundedAutoDomain(values: number[], padPct = 0.12): [number, number] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(1e-9, hi - lo);
  const rawLo = lo - span * padPct;
  const rawHi = hi + span * padPct;
  const stepBase = Math.max(0.01, Math.abs(rawHi - rawLo) / 8);
  const pow10 = Math.pow(10, Math.floor(Math.log10(stepBase)));
  const step = Math.ceil(stepBase / pow10) * pow10;
  return [Math.floor(rawLo / step) * step, Math.ceil(rawHi / step) * step];
}

export type RelPerfSeriesDef = {
  dataKey: string;
  name: string;
  color: string;
  strokeWidth?: number;
  strokeDasharray?: string;
};

/** Per-column timeframe — matches Yield Curve / macro chart strips. */
export function RelPerfPeriodStrip({
  selectedDays,
  onSelect,
}: {
  selectedDays: number;
  onSelect: (days: number) => void;
}) {
  return (
    <div className="flex flex-shrink-0 flex-wrap justify-end gap-1">
      {RELATIVE_PERF_PERIOD_OPTIONS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => onSelect(p.days)}
          className="rounded-[2px] px-2 py-1 text-[10px] font-medium transition-colors"
          style={{
            border: `1px solid ${selectedDays === p.days ? "var(--nd-border)" : "transparent"}`,
            background: selectedDays === p.days ? "var(--nd-panel-soft)" : "transparent",
            color: selectedDays === p.days ? "var(--nd-text)" : "var(--nd-muted)",
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/** Multi-series % performance — same chrome as YieldCurveStripLineCard / BaseTimeSeriesLineChart. */
export function RelativePerformanceMainChart({
  data,
  series,
  yTickFormatter,
}: {
  data: MergedChartRow[];
  series: RelPerfSeriesDef[];
  yTickFormatter?: (v: number) => string;
}) {
  const yFmt = yTickFormatter ?? ((v: number) => `${v.toFixed(0)}%`);
  const yDomain = useMemo(() => {
    const vals: number[] = [];
    for (const row of data) {
      for (const s of series) {
        const v = row[s.dataKey];
        if (typeof v === "number" && Number.isFinite(v)) vals.push(v);
      }
    }
    if (vals.length === 0) return [-5, 5] as [number, number];
    const d = roundedAutoDomain(vals);
    if (d[0] > 0) return [Math.min(0, d[0] - 1), d[1]] as [number, number];
    if (d[1] < 0) return [d[0], Math.max(0, d[1] + 1)] as [number, number];
    return [Math.min(d[0], 0), Math.max(d[1], 0)] as [number, number];
  }, [data, series]);

  if (!data.length || !series.length) {
    return (
      <div
        className="flex h-full min-h-[120px] items-center justify-center rounded-[2px] text-[12px]"
        style={{ color: "var(--nd-muted)", background: "rgba(255,255,255,0.02)" }}
      >
        No series
      </div>
    );
  }

  return (
    <div className="h-full min-h-[80px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 8, left: 4, bottom: 6 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="0" />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
            tickFormatter={(v: string) => {
              try {
                return format(parseISO(v), "MMM yy");
              } catch {
                return v;
              }
            }}
          />
          <YAxis
            orientation="left"
            domain={yDomain}
            tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v) => yFmt(Number(v))}
          />
          <Tooltip
            contentStyle={TIP}
            labelFormatter={(v) => {
              try {
                return format(parseISO(String(v)), "MMM d, yyyy");
              } catch {
                return String(v);
              }
            }}
            formatter={
              ((value: unknown, name: unknown) => {
                const n = typeof value === "number" ? value : Number(value);
                return [
                  Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(2)}%` : "—",
                  String(name ?? ""),
                ];
              }) as NonNullable<ComponentProps<typeof Tooltip>["formatter"]>
            }
          />
          <ReferenceLine
            y={0}
            stroke="rgba(255,255,255,0.28)"
            strokeDasharray="4 4"
            strokeWidth={1}
          />
          {series.map((s) => (
            <Line
              key={s.dataKey}
              type="linear"
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color}
              strokeWidth={s.strokeWidth ?? 1.75}
              strokeDasharray={s.strokeDasharray}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

type MacroRow = { date: string; value: number };

/** Thin macro strip: one series, optional NBER recession shading (same idea as LWChart bands). */
export function RelativePerformanceMacroLine({
  rows,
  lineColor,
  tooltipLabel,
  valueFormat,
  recessionBands,
  stepped = false,
  showDateAxis = false,
  yAxisWidth = 40,
}: {
  rows: MacroRow[];
  lineColor: string;
  tooltipLabel: string;
  valueFormat: (v: number) => string;
  recessionBands?: RecessionBand[];
  stepped?: boolean;
  /** Only the bottom indicator in a stack shows shared timeline ticks. */
  showDateAxis?: boolean;
  yAxisWidth?: number;
}) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.date.localeCompare(b.date)),
    [rows],
  );

  const yDomain = useMemo(() => {
    if (!sorted.length) return [0, 1] as [number, number];
    const vals = sorted.map((d) => d.value).filter(Number.isFinite);
    if (!vals.length) return [0, 1];
    return roundedAutoDomain(vals, 0.15);
  }, [sorted]);

  if (!sorted.length) {
    return (
      <div className="flex h-full min-h-[32px] items-center text-[9px]" style={{ color: "var(--nd-muted)" }}>
        —
      </div>
    );
  }

  const bottomMargin = showDateAxis ? 18 : 4;
  const leftMargin = 8;

  return (
    <div className="absolute inset-0 min-h-[48px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={sorted}
          margin={{ top: 4, right: 6, left: leftMargin, bottom: bottomMargin }}
        >
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="0" />
          {recessionBands?.map((b, i) => (
            <ReferenceArea
              key={`${b.start}-${b.end}-${i}`}
              x1={b.start}
              x2={b.end}
              y1={yDomain[0]}
              y2={yDomain[1]}
              fill="rgba(255,255,255,0.1)"
              fillOpacity={0.35}
              strokeOpacity={0}
              ifOverflow="visible"
            />
          ))}
          <XAxis
            dataKey="date"
            type="category"
            hide={!showDateAxis}
            tick={{ fill: "var(--nd-muted)", fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            minTickGap={22}
            tickFormatter={(v: string) => {
              try {
                return format(parseISO(v), "MMM yy");
              } catch {
                return v;
              }
            }}
          />
          <YAxis
            orientation="left"
            domain={yDomain}
            tick={{ fill: "var(--nd-muted)", fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            width={yAxisWidth}
            tickFormatter={(v) => valueFormat(Number(v))}
          />
          <Tooltip
            contentStyle={{ ...TIP, fontSize: 10 }}
            labelFormatter={(v) => {
              try {
                return format(parseISO(String(v)), "MMM d, yyyy");
              } catch {
                return String(v);
              }
            }}
            formatter={
              ((v: unknown) => {
                const n = typeof v === "number" ? v : Number(v);
                return [
                  Number.isFinite(n) ? valueFormat(n) : "—",
                  tooltipLabel,
                ];
              }) as NonNullable<ComponentProps<typeof Tooltip>["formatter"]>
            }
          />
          <Line
            type={stepped ? "stepAfter" : "linear"}
            dataKey="value"
            stroke={lineColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
