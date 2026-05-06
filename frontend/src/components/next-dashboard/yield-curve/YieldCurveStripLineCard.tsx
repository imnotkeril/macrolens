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
  fontSize: 12,
  color: "var(--nd-text)",
};

type RefLine = { y: number; label: string };

function roundedAutoDomain(values: number[]): [number, number] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(1e-6, hi - lo);
  const rawLo = lo - span * 0.1;
  const rawHi = hi + span * 0.1;
  const stepBase = Math.max(0.0001, Math.abs(rawHi - rawLo) / 8);
  const pow10 = Math.pow(10, Math.floor(Math.log10(stepBase)));
  const step = Math.ceil(stepBase / pow10) * pow10;
  return [Math.floor(rawLo / step) * step, Math.ceil(rawHi / step) * step];
}

export function YieldCurveStripLineCard({
  title,
  subtitle,
  contextNote,
  rows,
  lineColor,
  height = 220,
  pending,
  yTickFormat,
  tooltipFormat,
  referenceLines,
  stepped = false,
  initialPeriod = "6M",
  includeReferenceLinesInDomain = false,
}: {
  title: string;
  subtitle?: string;
  /** Short explainer under the subtitle (macro context). */
  contextNote?: string;
  rows: RatioPoint[] | undefined;
  lineColor: string;
  height?: number;
  pending: boolean;
  yTickFormat: (v: number) => string;
  tooltipFormat: (v: number) => string;
  referenceLines?: RefLine[];
  /** ZQ-style piecewise constant paths render cleaner as steps. */
  stepped?: boolean;
  initialPeriod?: string;
  includeReferenceLinesInDomain?: boolean;
}) {
  const [period, setPeriod] = useState(initialPeriod);

  const sorted = useMemo(() => {
    if (!rows?.length) return [];
    return [...rows].sort((a, b) => a.date.localeCompare(b.date));
  }, [rows]);

  const filtered = useMemo(() => filterChartPeriod(sorted, period), [sorted, period]);
  const displayRows = filtered.length ? filtered : sorted;

  const yDomain = useMemo(() => {
    if (!displayRows.length) return [0, 1] as [number, number];
    const vals = displayRows.map((d) => d.value).filter(Number.isFinite);
    if (!vals.length) return [0, 1];
    if (includeReferenceLinesInDomain && referenceLines?.length) {
      const domainVals = [...vals];
      for (const r of referenceLines) {
        domainVals.push(r.y);
      }
      return roundedAutoDomain(domainVals);
    }
    return roundedAutoDomain(vals);
  }, [displayRows, referenceLines, includeReferenceLinesInDomain]);

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-muted)" }}>
            {title}
          </div>
          {subtitle ? (
            <div className="mt-0.5 text-[10px] leading-snug" style={{ color: "var(--nd-muted)" }}>
              {subtitle}
            </div>
          ) : null}
          {contextNote ? (
            <p className="mt-1.5 max-w-[42ch] text-[10px] leading-snug" style={{ color: "var(--nd-soft)" }}>
              {contextNote}
            </p>
          ) : null}
        </div>
        <ChartPeriodStrip period={period} onChange={setPeriod} />
      </div>

      {pending && !sorted.length ? (
        <div
          className="flex items-center justify-center rounded-[2px] text-[12px]"
          style={{ height, color: "var(--nd-muted)", background: "rgba(255,255,255,0.02)" }}
        >
          Loading…
        </div>
      ) : !displayRows.length ? (
        <div
          className="flex items-center justify-center rounded-[2px] text-[12px]"
          style={{ height, color: "var(--nd-muted)", background: "rgba(255,255,255,0.02)" }}
        >
          No observations.
        </div>
      ) : (
        <div style={{ width: "100%", height }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={displayRows} margin={{ top: 6, right: 10, left: 2, bottom: 6 }}>
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
                tickFormatter={(v) => yTickFormat(Number(v))}
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
                  return [Number.isFinite(n) ? tooltipFormat(n) : "—", title];
                }}
              />
              {referenceLines?.map((r) => (
                <ReferenceLine
                  key={r.label}
                  y={r.y}
                  stroke="rgba(255,255,255,0.35)"
                  strokeDasharray="4 4"
                  label={{ value: r.label, position: "right", fill: "var(--nd-muted)", fontSize: 10 }}
                />
              ))}
              <Line
                type={stepped ? "stepAfter" : "monotone"}
                dataKey="value"
                stroke={lineColor}
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
