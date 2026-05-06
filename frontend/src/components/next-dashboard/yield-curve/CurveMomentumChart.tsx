"use client";

import { useMemo, useState } from "react";
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
  ChartPeriodStrip,
  filterChartPeriod,
} from "@/components/next-dashboard/macro-sentiment/MacroSentimentChartBlocks";
import type { RatioPoint } from "@/types";

const TIP: React.CSSProperties = {
  backgroundColor: "var(--nd-panel-soft)",
  border: "1px solid var(--nd-border-soft)",
  borderRadius: 4,
  fontSize: 11,
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

/** Compact chart: 2Y–10Y spread momentum (bp/month from ~90d change). */
export function CurveMomentumChart({
  rows,
  lineColor,
  height = 118,
  pending,
  fillHeight = false,
  initialPeriod = "ALL",
}: {
  rows: RatioPoint[] | undefined;
  lineColor: string;
  height?: number;
  pending: boolean;
  fillHeight?: boolean;
  initialPeriod?: string;
}) {
  const [period, setPeriod] = useState(initialPeriod);

  const sorted = useMemo(() => {
    if (!rows?.length) return [];
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }, [rows]);

  const filtered = useMemo(() => filterChartPeriod(sorted, period), [sorted, period]);

  const yDomain = useMemo(() => {
    if (!filtered.length) return [-1, 1] as [number, number];
    const vals = filtered.map((d) => d.value).filter(Number.isFinite);
    if (!vals.length) return [-1, 1];
    return roundedAutoDomain(vals);
  }, [filtered]);

  const chartAreaStyle = fillHeight ? ({ width: "100%", height: "100%" } as const) : ({ width: "100%", height } as const);
  const chartAreaClass = fillHeight ? "min-h-[170px] flex-1" : "";

  return (
    <div className={`flex min-h-0 min-w-0 w-full flex-col gap-1.5 ${fillHeight ? "h-full" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-muted)" }}>
            Curve momentum
          </div>
        </div>
        <ChartPeriodStrip period={period} onChange={setPeriod} />
      </div>

      {pending && !sorted.length ? (
        <div
          className={`flex items-center justify-center rounded-[2px] text-[11px] ${chartAreaClass}`}
          style={{ ...chartAreaStyle, color: "var(--nd-muted)", background: "rgba(255,255,255,0.02)" }}
        >
          Loading…
        </div>
      ) : !filtered.length ? (
        <div
          className={`flex items-center justify-center rounded-[2px] text-[11px] ${chartAreaClass}`}
          style={{ ...chartAreaStyle, color: "var(--nd-muted)", background: "rgba(255,255,255,0.02)" }}
        >
          No observations.
        </div>
      ) : (
        <div className={chartAreaClass} style={chartAreaStyle}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={filtered} margin={{ top: 4, right: 8, left: 0, bottom: 2 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="0" />
              <XAxis
                dataKey="date"
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
                domain={yDomain}
                tick={{ fill: "var(--nd-muted)", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                width={38}
                tickFormatter={(v) => `${Number(v).toFixed(1)}`}
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
                  return [Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(2)} bp/mo` : "—", "Momentum"];
                }}
              />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.22)" strokeDasharray="3 3" />
              <Line
                type="monotone"
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
      )}
    </div>
  );
}
