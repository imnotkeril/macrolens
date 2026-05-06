"use client";

import { useMemo, useState, type CSSProperties } from "react";
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
import type { RatioPoint } from "@/types";
import { ChartPeriodStrip } from "@/components/next-dashboard/macro-sentiment/MacroSentimentChartBlocks";
import { filterSeriesByFrame, type InflationFrame, sortSeries } from "./inflationUtils";

const TIP: CSSProperties = {
  backgroundColor: "var(--nd-panel-soft)",
  border: "1px solid var(--nd-border-soft)",
  borderRadius: 4,
  fontSize: 12,
  color: "var(--nd-text)",
};

export function InflationSingleLineCard({
  title,
  subtitle,
  rows,
  lineColor,
  pending,
}: {
  title: string;
  subtitle?: string;
  rows: RatioPoint[] | undefined;
  lineColor: string;
  pending: boolean;
}) {
  const [frame, setFrame] = useState<InflationFrame>("1Y");
  const sorted = useMemo(() => sortSeries(rows), [rows]);
  const filtered = useMemo(() => filterSeriesByFrame(sorted, frame), [sorted, frame]);
  const displayRows = filtered.length ? filtered : sorted;

  const yDomain = useMemo(() => {
    if (!displayRows.length) return [0, 1] as [number, number];
    const vals = displayRows.map((d) => d.value).filter(Number.isFinite);
    if (!vals.length) return [0, 1] as [number, number];
    const lo = Math.min(...vals, 2);
    const hi = Math.max(...vals, 2);
    const pad = Math.max(0.2, (hi - lo) * 0.14);
    return [lo - pad, hi + pad] as [number, number];
  }, [displayRows]);

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-text)" }}>
            {title}
          </div>
          {subtitle ? (
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--nd-muted)" }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        <ChartPeriodStrip period={frame} onChange={(p) => setFrame(p as InflationFrame)} />
      </div>

      {pending && !sorted.length ? (
        <div className="flex min-h-[264px] items-center justify-center text-[12px]" style={{ color: "var(--nd-muted)" }}>
          Loading…
        </div>
      ) : !displayRows.length ? (
        <div className="flex min-h-[264px] items-center justify-center text-[12px]" style={{ color: "var(--nd-muted)" }}>
          No observations.
        </div>
      ) : (
        <div style={{ width: "100%", height: 264 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={displayRows} margin={{ top: 6, right: 10, left: 10, bottom: 2 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="0" />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                minTickGap={26}
                tickFormatter={(v: string) => {
                  try {
                    return format(parseISO(v), "MMM");
                  } catch {
                    return v;
                  }
                }}
              />
              <YAxis
                orientation="right"
                domain={yDomain}
                tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={38}
                tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={TIP}
                labelFormatter={(v) => {
                  try {
                    return format(parseISO(String(v)), "MMM yyyy");
                  } catch {
                    return String(v);
                  }
                }}
                formatter={(v: unknown) => {
                  const n = typeof v === "number" ? v : Number(v);
                  return [Number.isFinite(n) ? `${n.toFixed(2)}%` : "—", title];
                }}
              />
              <ReferenceLine
                y={2}
                stroke="rgba(255,255,255,0.3)"
                strokeDasharray="4 4"
                label={{ value: "Fed target", position: "right", fill: "var(--nd-muted)", fontSize: 10 }}
              />
              <Line type="monotone" dataKey="value" stroke={lineColor} strokeWidth={1.8} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

