"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Info } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { paddedYDomainWithRefs } from "@/components/next-dashboard/analysis/chartYDomain";
import { IndexWeeklyPriceChart } from "@/components/next-dashboard/analysis/majorIndicesCharts";
import type { WeeklyIndexPoint } from "@/components/next-dashboard/analysis/majorIndicesUtils";
import type { RatioPoint } from "@/types";

const TIP: React.CSSProperties = {
  backgroundColor: "var(--nd-panel-soft)",
  border: "1px solid var(--nd-border-soft)",
  borderRadius: 4,
  fontSize: 11,
  color: "var(--nd-text)",
};

export const MARKET_BREADTH_TF_OPTIONS = [
  { key: "1Y" as const, days: 365 },
  { key: "2Y" as const, days: 730 },
  { key: "3Y" as const, days: 1095 },
  { key: "ALL" as const, days: 365 * 15 },
];

export type MarketBreadthTfKey = (typeof MARKET_BREADTH_TF_OPTIONS)[number]["key"];

export function MarketBreadthTfStrip({
  selectedKey,
  onSelect,
}: {
  selectedKey: MarketBreadthTfKey;
  onSelect: (key: MarketBreadthTfKey) => void;
}) {
  return (
    <div className="flex flex-shrink-0 flex-wrap justify-end gap-1">
      {MARKET_BREADTH_TF_OPTIONS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onSelect(p.key)}
          className="rounded-[2px] px-2 py-1 text-[10px] font-medium transition-colors"
          style={{
            border: `1px solid ${selectedKey === p.key ? "var(--nd-border)" : "transparent"}`,
            background: selectedKey === p.key ? "var(--nd-panel-soft)" : "transparent",
            color: selectedKey === p.key ? "var(--nd-text)" : "var(--nd-muted)",
          }}
        >
          {p.key}
        </button>
      ))}
    </div>
  );
}

export function ChartCardHeader({
  title,
  subtitle,
  hint,
}: {
  title: string;
  subtitle?: string;
  hint?: string;
}) {
  return (
    <div className="mb-1 flex min-h-[36px] shrink-0 items-start justify-between gap-2">
      <div className="min-w-0">
        <div
          className="text-[10px] font-semibold uppercase leading-tight tracking-[0.08em]"
          style={{ color: "var(--nd-muted)" }}
        >
          {title}
        </div>
        {subtitle ? (
          <div className="mt-0.5 text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--nd-soft)" }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      {hint ? (
        <span title={hint} className="inline-flex shrink-0 cursor-help p-0.5" style={{ color: "var(--nd-muted)" }}>
          <Info size={14} strokeWidth={2} aria-hidden />
        </span>
      ) : null}
    </div>
  );
}

/** Line in 0–100% space with two dashed references (overbought / oversold). */
export function BreadthDualRefChart({
  rows,
  lineColor,
  refHigh,
  refLow,
  valueLabel,
  footnote,
}: {
  rows: RatioPoint[];
  lineColor: string;
  refHigh: number;
  refLow: number;
  valueLabel: string;
  footnote?: string;
}) {
  const sorted = useMemo(() => {
    return [...rows]
      .map((p) => ({ date: p.date, value: Number(p.value) }))
      .filter((p) => Number.isFinite(p.value))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [rows]);

  const last = sorted.length ? sorted[sorted.length - 1].value : null;

  if (!sorted.length) {
    return (
      <div
        className="flex min-h-0 flex-1 items-center justify-center text-[11px]"
        style={{ color: "var(--nd-muted)" }}
      >
        No data
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {last != null && Number.isFinite(last) ? (
        <div
          className="pointer-events-none absolute right-1 top-1 z-10 rounded border px-1.5 py-0.5 font-mono text-[10px] tabular-nums"
          style={{
            borderColor: "var(--nd-border-soft)",
            background: "var(--nd-panel-soft)",
            color: "var(--nd-text)",
          }}
        >
          {last.toFixed(1)}%
        </div>
      ) : null}
      <div className="min-h-0 w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={sorted} margin={{ top: 8, right: 10, left: 4, bottom: 20 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="0" />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--nd-muted)", fontSize: 9 }}
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
              domain={[0, 100]}
              tick={{ fill: "var(--nd-muted)", fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              width={32}
              tickFormatter={(v) => `${v}%`}
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
              formatter={(value: unknown) => {
                const n = typeof value === "number" ? value : Number(value);
                return [`${Number.isFinite(n) ? n.toFixed(1) : "—"}%`, valueLabel];
              }}
            />
            <ReferenceLine
              y={refHigh}
              stroke="var(--nd-red)"
              strokeDasharray="4 4"
              strokeOpacity={0.75}
              strokeWidth={1}
            />
            <ReferenceLine
              y={refLow}
              stroke="var(--nd-green)"
              strokeDasharray="4 4"
              strokeOpacity={0.75}
              strokeWidth={1}
            />
            <Line
              type="linear"
              dataKey="value"
              name={valueLabel}
              stroke={lineColor}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {footnote ? (
        <p className="mt-1 shrink-0 text-[8px] leading-snug" style={{ color: "var(--nd-muted)" }}>
          {footnote}
        </p>
      ) : null}
    </div>
  );
}

export function HighsLowsBarChart({
  data,
  colors,
}: {
  data: { date: string; highs: number | null; lows: number | null }[];
  colors: { high: string; low: string };
}) {
  const rows = useMemo(() => data.filter((d) => d.highs != null || d.lows != null), [data]);
  if (!rows.length) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-[11px]" style={{ color: "var(--nd-muted)" }}>
        No data
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 20 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="0" />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--nd-muted)", fontSize: 9 }}
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
          <YAxis tick={{ fill: "var(--nd-muted)", fontSize: 9 }} tickLine={false} axisLine={false} width={36} />
          <Tooltip
            contentStyle={{ ...TIP, fontSize: 10 }}
            labelFormatter={(v) => {
              try {
                return format(parseISO(String(v)), "MMM d, yyyy");
              } catch {
                return String(v);
              }
            }}
            formatter={(value: unknown, name?: string | number) => {
              const n = typeof value === "number" ? value : Number(value);
              const abs = Number.isFinite(n) ? Math.abs(n) : null;
              const label = name === "highs" ? "New highs" : "New lows";
              return [abs == null ? "—" : Math.round(abs).toLocaleString("en-US"), label];
            }}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
          <Bar dataKey="highs" name="highs" fill={colors.high} opacity={0.88} barSize={10} />
          <Bar dataKey="lows" name="lows" fill={colors.low} opacity={0.88} barSize={10} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** McClellan Summation + SPX close — dual Y-axis (classic cumulative NYSE A/D is not on Yahoo free tier). */
export function NysiVersusSpxChart({
  rows,
  colors,
}: {
  rows: { date: string; nysi: number; spx: number }[];
  colors: { nysi: string; spx: string };
}) {
  if (!rows.length) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-[11px]" style={{ color: "var(--nd-muted)" }}>
        No data
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 14, left: 4, bottom: 20 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="0" />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--nd-muted)", fontSize: 9 }}
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
            yAxisId="left"
            tick={{ fill: "var(--nd-muted)", fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: "var(--nd-muted)", fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            width={44}
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
          />
          <Line
            yAxisId="left"
            type="linear"
            dataKey="nysi"
            name="NYSI"
            stroke={colors.nysi}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            yAxisId="right"
            type="linear"
            dataKey="spx"
            name="SPX"
            stroke={colors.spx}
            strokeWidth={1.25}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TvolBarChart({
  rows,
  avgLine,
  color,
}: {
  rows: RatioPoint[];
  avgLine: number | null;
  color: string;
}) {
  const data = useMemo(() => {
    return [...rows]
      .map((p) => ({ date: p.date, value: Number(p.value) }))
      .filter((p) => Number.isFinite(p.value))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [rows]);

  if (!data.length) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-[11px]" style={{ color: "var(--nd-muted)" }}>
        No data
      </div>
    );
  }

  const last = data[data.length - 1]?.value;

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      {last != null ? (
        <div
          className="pointer-events-none absolute right-1 top-1 z-10 rounded border px-1.5 py-0.5 font-mono text-[10px] tabular-nums"
          style={{
            borderColor: "var(--nd-border-soft)",
            background: "var(--nd-panel-soft)",
            color: "var(--nd-text)",
          }}
        >
          {(last / 1e9).toFixed(1)}B
        </div>
      ) : null}
      <div className="min-h-0 w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 10, left: 4, bottom: 20 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="0" />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--nd-muted)", fontSize: 9 }}
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
            tick={{ fill: "var(--nd-muted)", fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v) => `${(Number(v) / 1e9).toFixed(0)}B`}
          />
          <Tooltip
            contentStyle={{ ...TIP, fontSize: 10 }}
            formatter={(value: unknown) => {
              const n = typeof value === "number" ? value : Number(value);
              return [Number.isFinite(n) ? (n / 1e9).toFixed(2) + "B" : "—", "Volume"];
            }}
          />
          {avgLine != null && Number.isFinite(avgLine) ? (
            <ReferenceLine
              y={avgLine}
              stroke="var(--nd-red)"
              strokeDasharray="5 5"
              strokeOpacity={0.8}
              label={{ value: "Avg", position: "left", fill: "var(--nd-muted)", fontSize: 9 }}
            />
          ) : null}
          <Bar dataKey="value" fill={color} opacity={0.82} radius={[2, 2, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}

export function LineMetricChart({
  rows,
  lineColor,
  valueLabel,
  formatY,
  references,
  domain,
}: {
  rows: RatioPoint[];
  lineColor: string;
  valueLabel: string;
  formatY: (n: number) => string;
  references: { y: number; stroke: string; dash?: string; label?: string }[];
  domain?: [number, number];
}) {
  const sorted = useMemo(() => {
    return [...rows]
      .map((p) => ({ date: p.date, value: Number(p.value) }))
      .filter((p) => Number.isFinite(p.value))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [rows]);

  const resolvedDomain = useMemo((): [number, number] => {
    if (domain !== undefined) return domain;
    const vals = sorted.map((p) => p.value);
    const refYs = references.map((r) => r.y);
    return paddedYDomainWithRefs(vals, refYs, 0.1);
  }, [domain, sorted, references]);

  const last = sorted.length ? sorted[sorted.length - 1].value : null;

  if (!sorted.length) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-[11px]" style={{ color: "var(--nd-muted)" }}>
        No data
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      {last != null ? (
        <div
          className="pointer-events-none absolute right-2 top-1 z-10 rounded border px-1.5 py-0.5 font-mono text-[10px] tabular-nums"
          style={{
            borderColor: "var(--nd-border-soft)",
            background: "var(--nd-panel-soft)",
            color: "var(--nd-text)",
          }}
        >
          {formatY(last)}
        </div>
      ) : null}
      <div className="min-h-0 w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
        {/* Wider margins — print/PDF + overflow:hidden tiles clip last px of plot/strokes without inset */}
        <ComposedChart data={sorted} margin={{ top: 10, right: 26, left: 12, bottom: 22 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="0" />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--nd-muted)", fontSize: 9 }}
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
            domain={resolvedDomain}
            tick={{ fill: "var(--nd-muted)", fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            width={36}
            tickFormatter={(v) => formatY(Number(v))}
          />
          <Tooltip
            contentStyle={{ ...TIP, fontSize: 10 }}
            formatter={(value: unknown) => {
              const n = typeof value === "number" ? value : Number(value);
              return [Number.isFinite(n) ? formatY(n) : "—", valueLabel];
            }}
          />
          {references.map((r, i) => (
            <ReferenceLine
              key={`${r.y}-${i}`}
              y={r.y}
              stroke={r.stroke}
              strokeDasharray={r.dash ?? "5 5"}
              strokeOpacity={0.75}
              strokeWidth={1}
              label={
                r.label
                  ? { value: r.label, position: "insideTopLeft", fill: "var(--nd-muted)", fontSize: 8 }
                  : undefined
              }
            />
          ))}
          <Line
            type="linear"
            dataKey="value"
            name={valueLabel}
            stroke={lineColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}

export function SpxWeeklyPricePanel({
  weekly,
  athPrice,
  colors,
}: {
  weekly: WeeklyIndexPoint[];
  athPrice: number | null;
  colors: { price: string; ma200: string };
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1">
        <IndexWeeklyPriceChart data={weekly} athPrice={athPrice} colors={colors} />
      </div>
    </div>
  );
}
