"use client";

import { useMemo, useState } from "react";
import { subMonths } from "date-fns";
import type { NextShellThemeContextValue } from "@/components/next-dashboard/nextShellTheme";
import { BaseTimeSeriesLineChart } from "@/components/next-dashboard/charts/BaseTimeSeriesLineChart";
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
  const [period, setPeriod] = useState("ALL");
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
      <BaseTimeSeriesLineChart
        data={chartData}
        dataKey="z"
        height={height}
        lineColor={String(C.blue)}
        lineName="z-score"
        yTickFormatter={(v) => Number(v).toFixed(1)}
        tooltipValueFormatter={(v) => v.toFixed(2)}
        yMinStep={0.1}
        yAxisWidth={36}
        strokeWidth={1.3}
        referenceAreas={[
          ...(recessionBands?.map((b) => ({
            x1: b.start,
            x2: b.end,
            fill: "rgba(255,255,255,0.04)",
            ifOverflow: "visible" as const,
          })) ?? []),
        ]}
        referenceLines={[
          { y: 0, stroke: "rgba(255,255,255,0.2)", strokeDasharray: "3 3", strokeWidth: 1 },
          { y: 1.5, stroke: "rgba(255,255,255,0.08)", strokeDasharray: "4 4", strokeWidth: 1 },
          { y: -1.5, stroke: "rgba(255,255,255,0.08)", strokeDasharray: "4 4", strokeWidth: 1 },
        ]}
      />
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
  const [period, setPeriod] = useState("ALL");
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
      <BaseTimeSeriesLineChart
        data={chartData}
        dataKey="p"
        height={height}
        lineColor={String(C.red)}
        lineName="Prob."
        yTickFormatter={(v) => `${v.toFixed(0)}`}
        tooltipValueFormatter={(v) => `${v.toFixed(1)}%`}
        yMinStep={1}
        yAxisWidth={36}
        strokeWidth={1.3}
        referenceAreas={[
          { y1: 20, y2: 40, fill: "rgba(255,255,255,0.12)", ifOverflow: "visible" },
          ...(recessionBands?.map((b) => ({
            x1: b.start,
            x2: b.end,
            fill: "rgba(255,255,255,0.04)",
            ifOverflow: "visible" as const,
          })) ?? []),
        ]}
        referenceLines={[
          {
            y: 40,
            stroke: String(C.muted),
            strokeDasharray: "4 4",
            strokeWidth: 1,
            label: { value: "40%", position: "right", fill: "var(--nd-soft)", fontSize: 10 },
          },
          {
            y: 20,
            stroke: String(C.muted),
            strokeDasharray: "4 4",
            strokeWidth: 1,
            label: { value: "20%", position: "right", fill: "var(--nd-soft)", fontSize: 10 },
          },
        ]}
      />
    </div>
  );
}
