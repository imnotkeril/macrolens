"use client";

import { useMemo, useState } from "react";
import { format, parseISO, subMonths } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NextShellThemeContextValue } from "@/components/next-dashboard/nextShellTheme";
import { cycleScoreToZ } from "@/components/next-dashboard/nextRadarPanels";
import type { RecessionBand } from "@/types";

type NextShellColors = NextShellThemeContextValue["colors"];

const PERIODS = [
  { label: "1M", months: 1 },
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "2Y", months: 24 },
  { label: "ALL", months: 0 },
] as const;

function filterByPeriod<T extends { date: string }>(
  data: T[],
  period: string,
): T[] {
  if (period === "ALL") return data;
  const p = PERIODS.find((x) => x.label === period);
  if (!p || p.months === 0) return data;
  const cutoff = subMonths(new Date(), p.months).toISOString().slice(0, 10);
  return data.filter((d) => d.date >= cutoff);
}

function PeriodStrip({
  period,
  onChange,
}: {
  period: string;
  onChange: (p: string) => void;
}) {
  return (
    <div className="mb-3 flex justify-end gap-1">
      {PERIODS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => onChange(p.label)}
          className="rounded-[2px] px-2.5 py-1 text-[10px] font-medium transition-colors"
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

const tooltipStyle = {
  backgroundColor: "var(--nd-panel-soft)",
  border: "1px solid var(--nd-border-soft)",
  borderRadius: 4,
  fontSize: 11,
  color: "var(--nd-text)",
};

export function RadarCycleScoreChart({
  palette: C,
  data,
  height,
  recessionBands,
}: {
  palette: NextShellColors;
  data: Array<{ date: string; cycle_score: number }>;
  height: number;
  recessionBands: RecessionBand[] | undefined;
}) {
  const [period, setPeriod] = useState("1Y");
  const filtered = useMemo(() => filterByPeriod(data, period), [data, period]);

  const chartData = useMemo(
    () =>
      filtered.map((d) => ({
        date: d.date,
        z: cycleScoreToZ(d.cycle_score),
      })),
    [filtered],
  );

  return (
    <div>
      <PeriodStrip period={period} onChange={setPeriod} />
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
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
              domain={[-3, 3]}
              ticks={[-3, -2, -1, 0, 1, 2, 3]}
              tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={36}
              tickFormatter={(v) => Number(v).toFixed(1)}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(v) => {
                try {
                  return format(parseISO(String(v)), "MMM d, yyyy");
                } catch {
                  return String(v);
                }
              }}
              formatter={(value) => [
                typeof value === "number" ? value.toFixed(2) : "—",
                "z-score",
              ]}
            />
            {recessionBands?.map((b, i) => (
              <ReferenceArea
                key={`rb-${i}`}
                x1={b.start}
                x2={b.end}
                y1={-3}
                y2={3}
                fill="rgba(255,255,255,0.04)"
                strokeOpacity={0}
                ifOverflow="extendDomain"
              />
            ))}
            {/* z = cycle_score * 3 / 100 (matches Cycle Score gauge). */}
            <ReferenceLine
              y={0}
              stroke="rgba(255,255,255,0.2)"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            {/* Gauge-style band edges in z-space: score ±50 → ±1.5 */}
            <ReferenceLine y={1.5} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" strokeWidth={1} />
            <ReferenceLine y={-1.5} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" strokeWidth={1} />
            <Line
              type="linear"
              dataKey="z"
              stroke={String(C.blue)}
              strokeWidth={1}
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

export function RadarRecessionProbChart({
  palette: C,
  data,
  height,
  recessionBands,
}: {
  palette: NextShellColors;
  data: Array<{ date: string; recession_prob: number }>;
  height: number;
  recessionBands: RecessionBand[] | undefined;
}) {
  const [period, setPeriod] = useState("1Y");
  const filtered = useMemo(() => filterByPeriod(data, period), [data, period]);

  const chartData = useMemo(
    () =>
      filtered.map((d) => ({
        date: d.date,
        p: d.recession_prob,
      })),
    [filtered],
  );

  return (
    <div>
      <PeriodStrip period={period} onChange={setPeriod} />
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
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
              domain={[10, 50]}
              ticks={[10, 15, 20, 25, 30, 35, 40, 45, 50]}
              tick={{ fill: "var(--nd-muted)", fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              width={36}
              tickFormatter={(v) => `${v}`}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(v) => {
                try {
                  return format(parseISO(String(v)), "MMM d, yyyy");
                } catch {
                  return String(v);
                }
              }}
              formatter={(value) => [
                typeof value === "number" ? `${value.toFixed(1)}%` : "—",
                "Prob.",
              ]}
            />
            <ReferenceArea
              y1={20}
              y2={40}
              fill="rgba(255,255,255,0.12)"
              strokeOpacity={0}
              ifOverflow="visible"
            />
            {recessionBands?.map((b, i) => (
              <ReferenceArea
                key={`rb-${i}`}
                x1={b.start}
                x2={b.end}
                y1={10}
                y2={50}
                fill="rgba(255,255,255,0.04)"
                strokeOpacity={0}
                ifOverflow="extendDomain"
              />
            ))}
            <ReferenceLine
              y={40}
              stroke={String(C.muted)}
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{
                value: "40%",
                position: "right",
                fill: "var(--nd-soft)",
                fontSize: 10,
              }}
            />
            <ReferenceLine
              y={20}
              stroke={String(C.muted)}
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{
                value: "20%",
                position: "right",
                fill: "var(--nd-soft)",
                fontSize: 10,
              }}
            />
            <Line
              type="linear"
              dataKey="p"
              stroke={String(C.red)}
              strokeWidth={1}
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
