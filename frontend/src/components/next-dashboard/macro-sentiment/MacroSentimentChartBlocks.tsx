"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO, subMonths } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NextShellThemeContextValue } from "@/components/next-dashboard/nextShellTheme";
import {
  CHART_PERIODS,
  Z_ROLLING_WINDOW,
  Z_SCORE_BAND,
} from "@/components/next-dashboard/macro-sentiment/macroSentimentConstants";
import { fmtIndicator } from "@/components/next-dashboard/macro-sentiment/macroSentimentUtils";
import type { IndicatorWithLatest } from "@/types";

type NextShellColors = NextShellThemeContextValue["colors"];

const rechartsTooltipStyle = {
  backgroundColor: "var(--nd-panel-soft)",
  border: "1px solid var(--nd-border-soft)",
  borderRadius: 4,
  fontSize: 12,
  color: "var(--nd-text)",
};

export function filterChartPeriod<T extends { date: string }>(rows: T[], period: string): T[] {
  if (period === "ALL") return rows;
  const p = CHART_PERIODS.find((x) => x.label === period);
  if (!p || p.months === 0) return rows;
  const cutoff = subMonths(new Date(), p.months).toISOString().slice(0, 10);
  return rows.filter((d) => d.date >= cutoff);
}

export function ChartPeriodStrip({ period, onChange }: { period: string; onChange: (p: string) => void }) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {CHART_PERIODS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => onChange(p.label)}
          className="rounded-[2px] px-2 py-1.5 text-[11px] font-medium transition-colors"
          style={{
            border: period === p.label ? "1px solid var(--nd-border)" : "1px solid transparent",
            background: period === p.label ? "var(--nd-panel-soft)" : "transparent",
            color: period === p.label ? "var(--nd-text)" : "var(--nd-muted)",
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function MacroSentimentDetailChart({
  palette: C,
  rows,
  height,
  formatY,
  period,
}: {
  palette: NextShellColors;
  rows: Array<{ date: string; v: number }>;
  height: number;
  formatY: (v: number) => string;
  period: string;
}) {
  const filtered = useMemo(() => filterChartPeriod(rows, period), [rows, period]);

  const yDomain = useMemo(() => {
    if (!filtered.length) return [0, 1] as [number, number];
    const vals = filtered.map((d) => d.v).filter(Number.isFinite);
    if (!vals.length) return [0, 1];
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = Math.max(1e-9, (hi - lo) * 0.08);
    return [lo - pad, hi + pad] as [number, number];
  }, [filtered]);

  if (!filtered.length) {
    return (
      <div
        className="flex items-center justify-center rounded-[2px] text-[12px]"
        style={{ height, color: "var(--nd-muted)", background: "rgba(255,255,255,0.02)" }}
      >
        No observations in this range.
      </div>
    );
  }

  return (
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
            width={48}
            tickFormatter={(v) => formatY(Number(v))}
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
            formatter={(value) => {
              const v = typeof value === "number" ? value : Number(value);
              return [Number.isFinite(v) ? formatY(v) : "—", "Level"];
            }}
          />
          <Line
            type="linear"
            dataKey="v"
            stroke={String(C.blue)}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MacroSentimentZScoreChart({
  palette: C,
  rows,
  height,
  period,
}: {
  palette: NextShellColors;
  rows: Array<{ date: string; z: number | null }>;
  height: number;
  period: string;
}) {
  const filtered = useMemo(() => filterChartPeriod(rows, period), [rows, period]);

  const neutralZStroke = String(C.muted);

  const zDomain = useMemo(() => {
    const vals = filtered.map((d) => d.z).filter((z): z is number => z != null && Number.isFinite(z));
    if (!vals.length) return [-2.5, 2.5] as [number, number];
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    const span = hi - lo;
    const pad = Math.max(span * 0.12, 0.35);
    lo -= pad;
    hi += pad;
    lo = Math.max(lo, -4);
    hi = Math.min(hi, 4);
    if (hi - lo < 2) {
      const mid = (hi + lo) / 2;
      lo = mid - 1.1;
      hi = mid + 1.1;
    }
    return [lo, hi] as [number, number];
  }, [filtered]);

  const hasAnyZ = useMemo(
    () => filtered.some((d) => d.z != null && Number.isFinite(d.z)),
    [filtered],
  );

  if (!filtered.length || !hasAnyZ) {
    return (
      <div
        className="flex items-center justify-center rounded-[2px] text-[12px]"
        style={{ height, color: "var(--nd-muted)", background: "rgba(255,255,255,0.02)" }}
      >
        Need at least {Z_ROLLING_WINDOW} points before the rolling z appears (warm-up).
      </div>
    );
  }

  return (
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
            domain={zDomain}
            tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v) => Number(v).toFixed(1)}
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
            formatter={(value) => {
              if (value == null || value === "") return ["—", "Z"];
              const v = typeof value === "number" ? value : Number(value);
              return [Number.isFinite(v) ? v.toFixed(2) : "—", "Z"];
            }}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" strokeWidth={1} />
          <ReferenceLine
            y={Z_SCORE_BAND}
            stroke={String(C.green)}
            strokeDasharray="5 5"
            strokeWidth={1}
            label={{ value: "+2σ", fill: String(C.green), fontSize: 9 }}
          />
          <ReferenceLine
            y={-Z_SCORE_BAND}
            stroke={String(C.red)}
            strokeDasharray="5 5"
            strokeWidth={1}
            label={{ value: "−2σ", fill: String(C.red), fontSize: 9 }}
          />
          <Line
            type="linear"
            dataKey="z"
            stroke={neutralZStroke}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function IndicatorDetailCharts({
  palette: C,
  selectedRow,
  levelRows,
  zRows,
}: {
  palette: NextShellColors;
  selectedRow: IndicatorWithLatest;
  levelRows: Array<{ date: string; v: number }>;
  zRows: Array<{ date: string; z: number | null }>;
}) {
  const [period, setPeriod] = useState("1Y");

  useEffect(() => {
    setPeriod("1Y");
  }, [selectedRow.id]);

  return (
    <div className="flex flex-col px-4 pb-3 pt-2">
      <ChartPeriodStrip period={period} onChange={setPeriod} />
      <div className="mt-2 grid gap-3 lg:grid-cols-1">
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
            Level
          </div>
          <MacroSentimentDetailChart
            palette={C}
            rows={levelRows}
            period={period}
            height={200}
            formatY={(v) => fmtIndicator(v, selectedRow.unit)}
          />
        </div>
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
            Rolling z-score (window {Z_ROLLING_WINDOW})
          </div>
          <MacroSentimentZScoreChart palette={C} rows={zRows} period={period} height={172} />
        </div>
      </div>
    </div>
  );
}
