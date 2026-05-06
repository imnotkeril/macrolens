"use client";

import { useMemo, useState } from "react";
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
import type { NextShellThemeContextValue } from "@/components/next-dashboard/nextShellTheme";
import {
  ChartPeriodStrip,
  filterChartPeriod,
} from "@/components/next-dashboard/macro-sentiment/MacroSentimentChartBlocks";
import type { TimeSeriesPoint } from "@/types";
import { consecutiveInversionMonths } from "./yieldCurveUtils";

type C = NextShellThemeContextValue["colors"];

const TIP: React.CSSProperties = {
  backgroundColor: "var(--nd-panel-soft)",
  border: "1px solid var(--nd-border-soft)",
  borderRadius: 4,
  fontSize: 12,
  color: "var(--nd-text)",
};

function roundedAutoDomain(values: number[]): [number, number] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(1e-6, hi - lo);
  const rawLo = lo - span * 0.1;
  const rawHi = hi + span * 0.1;
  const stepBase = Math.max(0.1, Math.abs(rawHi - rawLo) / 8);
  const pow10 = Math.pow(10, Math.floor(Math.log10(stepBase)));
  const step = Math.ceil(stepBase / pow10) * pow10;
  return [Math.floor(rawLo / step) * step, Math.ceil(rawHi / step) * step];
}

export function YieldCurveSpreadHistoryCard({
  palette: C,
  cardTitle = "2Y-10Y spread history",
  contextNote,
  fullSeries,
  height = 240,
  pending,
  initialPeriod = "ALL",
}: {
  palette: C;
  /** Header label (e.g. 3M-10Y spread history). */
  cardTitle?: string;
  contextNote?: string;
  fullSeries: TimeSeriesPoint[] | undefined;
  height?: number;
  pending: boolean;
  initialPeriod?: string;
}) {
  const [period, setPeriod] = useState(initialPeriod);

  const sortedFull = useMemo(() => {
    if (!fullSeries?.length) return [];
    return [...fullSeries].sort((a, b) => a.date.localeCompare(b.date));
  }, [fullSeries]);

  const filtered = useMemo(() => filterChartPeriod(sortedFull, period), [sortedFull, period]);

  const invMonths = useMemo(() => consecutiveInversionMonths(sortedFull), [sortedFull]);

  const yDomain = useMemo(() => {
    if (!filtered.length) return [-1, 1] as [number, number];
    const vals = filtered.map((d) => d.value).filter(Number.isFinite);
    if (!vals.length) return [-1, 1];
    return roundedAutoDomain(vals);
  }, [filtered]);

  const lastVal = sortedFull.length ? sortedFull[sortedFull.length - 1]?.value : null;
  const showInvertedBadge = lastVal != null && Number.isFinite(lastVal) && lastVal < 0;

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-muted)" }}>
            {cardTitle}
          </div>
          {showInvertedBadge && invMonths != null ? (
            <div
              className="mt-1 inline-block rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{ background: String(C.red), color: "#fff" }}
            >
              Inverted · {invMonths} {invMonths === 1 ? "month" : "months"}
            </div>
          ) : null}
        </div>
        <ChartPeriodStrip period={period} onChange={setPeriod} />
      </div>
      {contextNote ? (
        <p className="text-[10px] leading-snug" style={{ color: "var(--nd-soft)" }}>
          {contextNote}
        </p>
      ) : null}

      {pending && !sortedFull.length ? (
        <div
          className="flex items-center justify-center rounded-[2px] text-[12px]"
          style={{ height, color: "var(--nd-muted)", background: "rgba(255,255,255,0.02)" }}
        >
          Loading…
        </div>
      ) : !filtered.length ? (
        <div
          className="flex items-center justify-center rounded-[2px] text-[12px]"
          style={{ height, color: "var(--nd-muted)", background: "rgba(255,255,255,0.02)" }}
        >
          No spread history.
        </div>
      ) : (
        <div style={{ width: "100%", height }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={filtered} margin={{ top: 6, right: 12, left: 2, bottom: 6 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="0" />
              <ReferenceArea
                y1={yDomain[0]}
                y2={0}
                fill={String(C.red)}
                fillOpacity={0.14}
              />
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
                tickFormatter={(v) => `${Math.round(v)} bp`}
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
                formatter={(v: unknown) => {
                  const n = typeof v === "number" ? v : Number(v);
                  return [Number.isFinite(n) ? `${n.toFixed(0)} bp` : "—", "Spread"];
                }}
              />
              <ReferenceLine
                y={0}
                stroke="rgba(255,255,255,0.35)"
                strokeDasharray="4 4"
                label={{
                  value: "Inversion threshold",
                  position: "right",
                  fill: "var(--nd-muted)",
                  fontSize: 10,
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                name="2Y-10Y"
                stroke={String(C.purple)}
                strokeWidth={1.75}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
