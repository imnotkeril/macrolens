"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { format, parseISO } from "date-fns";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RatioPoint } from "@/types";
import { ChartPeriodStrip } from "@/components/next-dashboard/macro-sentiment/MacroSentimentChartBlocks";
import {
  computeBarColorFlags,
  filterSeriesByFrame,
  type InflationFrame,
  sortSeries,
} from "./inflationUtils";

const TIP: CSSProperties = {
  backgroundColor: "var(--nd-panel-soft)",
  border: "1px solid var(--nd-border-soft)",
  borderRadius: 4,
  fontSize: 12,
  color: "var(--nd-text)",
};

type LineDef = {
  dataKey: string;
  stroke: string;
  name: string;
};

export function InflationDualChartCard({
  title,
  subtitle,
  yoyPrimary,
  yoySecondary,
  mom,
  pending,
}: {
  title: string;
  subtitle?: string;
  yoyPrimary: { name: string; rows: RatioPoint[] | undefined; color: string };
  yoySecondary: { name: string; rows: RatioPoint[] | undefined; color: string };
  mom: { name: string; rows: RatioPoint[] | undefined };
  pending: boolean;
}) {
  const [frame, setFrame] = useState<InflationFrame>("1Y");

  const pSorted = useMemo(() => sortSeries(yoyPrimary.rows), [yoyPrimary.rows]);
  const sSorted = useMemo(() => sortSeries(yoySecondary.rows), [yoySecondary.rows]);
  const mSorted = useMemo(() => sortSeries(mom.rows), [mom.rows]);

  const pFiltered = useMemo(() => filterSeriesByFrame(pSorted, frame), [pSorted, frame]);
  const sFiltered = useMemo(() => filterSeriesByFrame(sSorted, frame), [sSorted, frame]);
  const mFiltered = useMemo(() => filterSeriesByFrame(mSorted, frame), [mSorted, frame]);

  const pDisplay = pFiltered.length ? pFiltered : pSorted;
  const sDisplay = sFiltered.length ? sFiltered : sSorted;
  const mDisplay = mFiltered.length ? mFiltered : mSorted;

  const yoyRows = useMemo(() => {
    const byDate = new Map<string, { date: string; primary?: number; secondary?: number }>();
    for (const r of pDisplay) byDate.set(r.date, { date: r.date, primary: r.value });
    for (const r of sDisplay) {
      const row = byDate.get(r.date);
      if (row) row.secondary = r.value;
      else byDate.set(r.date, { date: r.date, secondary: r.value });
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [pDisplay, sDisplay]);

  const momRows = useMemo(() => computeBarColorFlags(mDisplay), [mDisplay]);

  const yoyDomain = useMemo(() => {
    if (!yoyRows.length) return [0, 1] as [number, number];
    const vals = yoyRows.flatMap((r) => [r.primary, r.secondary]).filter((v): v is number => Number.isFinite(v));
    if (!vals.length) return [0, 1] as [number, number];
    const lo = Math.min(...vals, 2);
    const hi = Math.max(...vals, 2);
    const pad = Math.max(0.2, (hi - lo) * 0.16);
    return [lo - pad, hi + pad] as [number, number];
  }, [yoyRows]);

  const momDomain = useMemo(() => {
    if (!momRows.length) return [-1, 1] as [number, number];
    const vals = momRows.map((d) => d.value).filter(Number.isFinite);
    if (!vals.length) return [-1, 1] as [number, number];
    const lo = Math.min(...vals, 0);
    const hi = Math.max(...vals, 0);
    const pad = Math.max(0.08, (hi - lo) * 0.14);
    return [lo - pad, hi + pad] as [number, number];
  }, [momRows]);

  const lines: LineDef[] = [
    { dataKey: "primary", stroke: yoyPrimary.color, name: yoyPrimary.name },
    { dataKey: "secondary", stroke: yoySecondary.color, name: yoySecondary.name },
  ];

  const hasData = yoyRows.length > 0 || momRows.length > 0;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
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

      {pending && !hasData ? (
        <div className="flex min-h-[358px] items-center justify-center text-[12px]" style={{ color: "var(--nd-muted)" }}>
          Loading…
        </div>
      ) : !hasData ? (
        <div className="flex min-h-[358px] items-center justify-center text-[12px]" style={{ color: "var(--nd-muted)" }}>
          No observations.
        </div>
      ) : (
        <>
          <div style={{ width: "100%", height: 246 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={yoyRows} margin={{ top: 6, right: 10, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="0" />
                <XAxis dataKey="date" hide />
                <YAxis
                  domain={yoyDomain}
                  tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={42}
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
                  formatter={(v: unknown, _name, entry) => {
                    const n = typeof v === "number" ? v : Number(v);
                    return [Number.isFinite(n) ? `${n.toFixed(2)}%` : "—", String(entry.name)];
                  }}
                />
                <ReferenceLine
                  y={2}
                  stroke="rgba(255,255,255,0.3)"
                  strokeDasharray="4 4"
                  label={{ value: "Fed target", position: "right", fill: "var(--nd-muted)", fontSize: 10 }}
                />
                {lines.map((line) => (
                  <Line
                    key={line.dataKey}
                    type="monotone"
                    dataKey={line.dataKey}
                    name={line.name}
                    stroke={line.stroke}
                    strokeWidth={1.8}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
                <Legend
                  verticalAlign="top"
                  align="center"
                  iconType="line"
                  wrapperStyle={{ fontSize: 11, paddingTop: 2, color: "var(--nd-muted)" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="-mt-2 border-t border-[var(--nd-border-soft)] pt-2" style={{ width: "100%", height: 112 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={momRows} margin={{ top: 0, right: 10, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="0" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={18}
                  tickFormatter={(v: string) => {
                    try {
                      return format(parseISO(v), "MMM");
                    } catch {
                      return v;
                    }
                  }}
                />
                <YAxis
                  domain={momDomain}
                  tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                  tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
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
                    return [Number.isFinite(n) ? `${n.toFixed(2)}%` : "—", mom.name];
                  }}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
                <Bar dataKey="value" isAnimationActive={false} radius={[1, 1, 0, 0]}>
                  {momRows.map((row) => {
                    const fill = row.rising == null ? "var(--nd-muted)" : row.rising ? "var(--nd-red)" : "var(--nd-green)";
                    return <Cell key={row.date} fill={fill} />;
                  })}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

