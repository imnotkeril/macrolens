"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NextShellThemeContextValue } from "@/components/next-dashboard/nextShellTheme";
import {
  ChartPeriodStrip,
  filterChartPeriod,
} from "@/components/next-dashboard/macro-sentiment/MacroSentimentChartBlocks";
import type { NetLiquidityPoint, RatioPoint } from "@/types";

type NextShellColors = NextShellThemeContextValue["colors"];

const rechartsTooltipStyle = {
  backgroundColor: "var(--nd-panel-soft)",
  border: "1px solid var(--nd-border-soft)",
  borderRadius: 4,
  fontSize: 12,
  color: "var(--nd-text)",
};

function roundedAutoDomain(values: number[], minStep = 0.01): [number, number] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(1e-9, hi - lo);
  const rawLo = lo - span * 0.1;
  const rawHi = hi + span * 0.1;
  const stepBase = Math.max(minStep, Math.abs(rawHi - rawLo) / 8);
  const pow10 = Math.pow(10, Math.floor(Math.log10(stepBase)));
  const step = Math.ceil(stepBase / pow10) * pow10;
  return [Math.floor(rawLo / step) * step, Math.ceil(rawHi / step) * step];
}

export type FedFundsRateRow = {
  date: string;
  target_upper: number;
  target_lower: number;
  effr: number | null;
};

export function FedFundsHistoryRecharts({
  palette: C,
  rows,
  height = 300,
}: {
  palette: NextShellColors;
  rows: FedFundsRateRow[];
  height?: number;
}) {
  const [period, setPeriod] = useState("1Y");
  const filtered = useMemo(() => filterChartPeriod(rows, period), [rows, period]);

  const yDomain = useMemo(() => {
    if (!filtered.length) return [0, 1] as [number, number];
    const vals: number[] = [];
    for (const d of filtered) {
      vals.push(d.target_upper, d.target_lower);
      if (d.effr != null && Number.isFinite(d.effr)) vals.push(d.effr);
    }
    return roundedAutoDomain(vals, 0.01);
  }, [filtered]);

  if (!filtered.length) {
    return (
      <div
        className="flex items-center justify-center rounded-[2px] text-[12px]"
        style={{ height, color: "var(--nd-muted)", background: "rgba(255,255,255,0.02)" }}
      >
        No rate observations in this range.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ChartPeriodStrip period={period} onChange={setPeriod} />
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={filtered} margin={{ top: 6, right: 10, left: 2, bottom: 6 }}>
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
              domain={yDomain}
              tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v) => `${Number(v).toFixed(2)}%`}
            />
            <Tooltip
              contentStyle={rechartsTooltipStyle}
              labelFormatter={(v) => {
                try {
                  return format(parseISO(String(v)), "MMM d, yyyy");
                } catch {
                  return String(v);
                }
              }}
              formatter={(value: unknown, name) => {
                const v = typeof value === "number" ? value : Number(value);
                return [Number.isFinite(v) ? `${v.toFixed(2)}%` : "—", String(name ?? "")];
              }}
            />
            <Line
              type="stepAfter"
              dataKey="target_upper"
              name="Upper"
              stroke={String(C.red)}
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="stepAfter"
              dataKey="target_lower"
              name="Lower"
              stroke={String(C.green)}
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="effr"
              name="EFFR"
              stroke={String(C.purple)}
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

export function FedForwardRateRecharts({
  palette: C,
  rows,
  height = 300,
}: {
  palette: NextShellColors;
  rows: RatioPoint[];
  height?: number;
}) {
  const [period, setPeriod] = useState("1Y");
  const normalized = useMemo(
    () => rows.map((r) => ({ date: r.date, value: r.value })),
    [rows],
  );
  const filtered = useMemo(() => filterChartPeriod(normalized, period), [normalized, period]);

  const yDomain = useMemo(() => {
    if (!filtered.length) return [0, 1] as [number, number];
    const vals = filtered.map((d) => d.value).filter(Number.isFinite);
    return roundedAutoDomain(vals, 0.01);
  }, [filtered]);

  if (!filtered.length) {
    return (
      <div
        className="flex items-center justify-center rounded-[2px] text-[12px]"
        style={{ height, color: "var(--nd-muted)", background: "rgba(255,255,255,0.02)" }}
      >
        No forward curve data in this range.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ChartPeriodStrip period={period} onChange={setPeriod} />
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filtered} margin={{ top: 6, right: 10, left: 2, bottom: 6 }}>
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
              domain={yDomain}
              tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v) => `${Number(v).toFixed(2)}%`}
            />
            <Tooltip
              contentStyle={rechartsTooltipStyle}
              labelFormatter={(v) => {
                try {
                  return format(parseISO(String(v)), "MMM d, yyyy");
                } catch {
                  return String(v);
                }
              }}
              formatter={(value: unknown) => {
                const v = typeof value === "number" ? value : Number(value);
                return [Number.isFinite(v) ? `${v.toFixed(2)}%` : "—", "Forward"];
              }}
            />
            <Line
              type="linear"
              dataKey="value"
              stroke={String(C.yellow)}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function FedNetLiquidityRecharts({
  palette: C,
  rows,
  height = 300,
}: {
  palette: NextShellColors;
  rows: NetLiquidityPoint[];
  height?: number;
}) {
  const [period, setPeriod] = useState("1Y");
  const normalized = useMemo(
    () => rows.map((r) => ({ date: r.date, value: r.value })),
    [rows],
  );
  const filtered = useMemo(() => filterChartPeriod(normalized, period), [normalized, period]);

  const yDomain = useMemo(() => {
    if (!filtered.length) return [0, 1] as [number, number];
    const vals = filtered.map((d) => d.value).filter(Number.isFinite);
    return roundedAutoDomain(vals, 1);
  }, [filtered]);

  const fmtT = (v: number) => `$${(v / 1e6).toFixed(2)}T`;

  if (!filtered.length) {
    return (
      <div
        className="flex items-center justify-center rounded-[2px] text-[12px]"
        style={{ height, color: "var(--nd-muted)", background: "rgba(255,255,255,0.02)" }}
      >
        No liquidity series in this range.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ChartPeriodStrip period={period} onChange={setPeriod} />
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={filtered} margin={{ top: 6, right: 10, left: 2, bottom: 6 }}>
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
              domain={yDomain}
              tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v) => fmtT(Number(v))}
            />
            <Tooltip
              contentStyle={rechartsTooltipStyle}
              labelFormatter={(v) => {
                try {
                  return format(parseISO(String(v)), "MMM d, yyyy");
                } catch {
                  return String(v);
                }
              }}
              formatter={(value: unknown) => {
                const v = typeof value === "number" ? value : Number(value);
                return [Number.isFinite(v) ? fmtT(v) : "—", "Net liquidity"];
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={String(C.purple)}
              fill={String(C.purple)}
              fillOpacity={0.22}
              strokeWidth={1.5}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function FedRhetoricIndexRecharts({
  palette: C,
  rows,
  height = 200,
}: {
  palette: NextShellColors;
  rows: Array<{ date: string; hawk_index: number }>;
  height?: number;
}) {
  const [period, setPeriod] = useState("1Y");
  const filtered = useMemo(() => filterChartPeriod(rows, period), [rows, period]);

  if (!filtered.length) {
    return (
      <div
        className="flex items-center justify-center rounded-[2px] text-[12px]"
        style={{ height, color: "var(--nd-muted)", background: "rgba(255,255,255,0.02)" }}
      >
        No rhetoric history in this range.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <ChartPeriodStrip period={period} onChange={setPeriod} />
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filtered} margin={{ top: 2, right: 4, left: 0, bottom: 2 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="0" />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              minTickGap={20}
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
              tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <Tooltip
              contentStyle={rechartsTooltipStyle}
              labelFormatter={(v) => {
                try {
                  return format(parseISO(String(v)), "MMM d, yyyy");
                } catch {
                  return String(v);
                }
              }}
              formatter={(value: unknown) => {
                const v = typeof value === "number" ? value : Number(value);
                return [Number.isFinite(v) ? `${v.toFixed(0)}` : "—", "Index"];
              }}
            />
            <Line
              type="monotone"
              dataKey="hawk_index"
              stroke={String(C.purple)}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
