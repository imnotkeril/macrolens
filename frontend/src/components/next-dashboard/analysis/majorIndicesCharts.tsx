"use client";

import { useMemo, type ComponentProps } from "react";
import { format, parseISO } from "date-fns";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  MAJOR_INDICES_PERIOD_OPTIONS,
  type WeeklyIndexPoint,
} from "@/components/next-dashboard/analysis/majorIndicesUtils";
import type { RatioPoint } from "@/types";

const TIP: React.CSSProperties = {
  backgroundColor: "var(--nd-panel-soft)",
  border: "1px solid var(--nd-border-soft)",
  borderRadius: 4,
  fontSize: 11,
  color: "var(--nd-text)",
};

function fmtPriceCompact(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return v >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : v.toFixed(2);
}

export function MajorIndicesPeriodStrip({
  selectedDays,
  onSelect,
}: {
  selectedDays: number;
  onSelect: (days: number) => void;
}) {
  return (
    <div className="flex flex-shrink-0 flex-wrap justify-end gap-1">
      {MAJOR_INDICES_PERIOD_OPTIONS.map((p) => (
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

/** Weekly price + 200MA + optional ATH band — muted chrome (no loud red grid). */
export function IndexWeeklyPriceChart({
  data,
  athPrice,
  colors,
}: {
  data: WeeklyIndexPoint[];
  athPrice: number | null;
  colors: { price: string; ma200: string };
}) {
  const chartData = useMemo(() => {
    return data.map((row) => ({
      ...row,
      ma200: row.ma200 ?? null,
    }));
  }, [data]);

  const yDomain = useMemo(() => {
    const vals: number[] = [];
    for (const row of chartData) {
      vals.push(row.price);
      if (row.ma200 != null) vals.push(row.ma200);
    }
    if (athPrice != null) vals.push(athPrice);
    if (!vals.length) return [0, 1];
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = Math.max((hi - lo) * 0.06, hi * 0.02);
    return [Math.floor(lo - pad), Math.ceil(hi + pad)] as [number, number];
  }, [chartData, athPrice]);

  if (!chartData.length) {
    return (
      <div
        className="flex h-full min-h-[120px] items-center justify-center rounded-[2px] text-[12px]"
        style={{ color: "var(--nd-muted)", background: "rgba(255,255,255,0.02)" }}
      >
        No price data
      </div>
    );
  }

  return (
    <div className="h-full min-h-[80px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
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
            width={52}
            tickFormatter={(v) => fmtPriceCompact(Number(v))}
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
                  Number.isFinite(n) ? fmtPriceCompact(n) : "—",
                  String(name ?? ""),
                ];
              }) as NonNullable<ComponentProps<typeof Tooltip>["formatter"]>
            }
          />
          {athPrice != null && Number.isFinite(athPrice) ? (
            <ReferenceLine
              y={athPrice}
              stroke="rgba(160, 152, 140, 0.45)"
              strokeDasharray="7 5"
              strokeWidth={1}
              strokeOpacity={1}
              label={{
                value: `ATH ${fmtPriceCompact(athPrice)}`,
                position: "insideTopRight",
                fill: "var(--nd-muted)",
                fontSize: 9,
              }}
            />
          ) : null}
          <Line
            type="linear"
            dataKey="price"
            name="Price"
            stroke={colors.price}
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            type="linear"
            dataKey="ma200"
            name="200MA"
            stroke={colors.ma200}
            strokeWidth={1.25}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 0–100% breadth-style chart with one horizontal reference (50%, 60%, or 6%). */
export function BreadthPercentChart({
  rows,
  lineColor,
  referenceY,
  referenceLabel,
  valueLabel,
  domainMax = 100,
  yDomain: yDomainProp,
  showDateAxis = false,
}: {
  rows: RatioPoint[];
  lineColor: string;
  referenceY: number;
  referenceLabel: string;
  valueLabel: string;
  domainMax?: number;
  /** Override Y domain (e.g. stablecoin dominance ~0–15%). */
  yDomain?: [number, number];
  showDateAxis?: boolean;
}) {
  const sorted = useMemo(() => {
    return [...rows]
      .map((p) => ({ date: p.date, value: Number(p.value) }))
      .filter((p) => Number.isFinite(p.value))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [rows]);

  const last = sorted.length ? sorted[sorted.length - 1].value : null;

  const yDomain = yDomainProp ?? ([0, domainMax] as [number, number]);

  if (!sorted.length) {
    return (
      <div
        className="flex h-full min-h-[48px] items-center justify-center text-[10px]"
        style={{ color: "var(--nd-muted)" }}
      >
        No data
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[48px] w-full">
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
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={sorted}
          margin={{ top: 4, right: 8, left: 4, bottom: showDateAxis ? 18 : 4 }}
        >
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="0" />
          <XAxis
            dataKey="date"
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
            width={36}
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
            y={referenceY}
            stroke="rgba(160, 152, 140, 0.5)"
            strokeDasharray="5 5"
            strokeWidth={1}
            label={{
              value: referenceLabel,
              position: "insideTopLeft",
              fill: "var(--nd-muted)",
              fontSize: 9,
            }}
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
  );
}
