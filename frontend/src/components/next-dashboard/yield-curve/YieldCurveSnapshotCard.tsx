"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NextShellThemeContextValue } from "@/components/next-dashboard/nextShellTheme";
import type { YieldCurveSnapshot } from "@/types";
import { SNAPSHOT_SERIES } from "./yieldCurveConstants";
import { buildSnapshotTenorRows, spreadBpByName } from "./yieldCurveUtils";

type C = NextShellThemeContextValue["colors"];

const TIP: React.CSSProperties = {
  backgroundColor: "var(--nd-panel-soft)",
  border: "1px solid var(--nd-border-soft)",
  borderRadius: 4,
  fontSize: 12,
  color: "var(--nd-text)",
};

function MetricBlock({
  label,
  value,
  valueColor,
  badge,
}: {
  label: string;
  value: string;
  valueColor: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
        {label}
      </div>
      <div className="mt-1 text-[15px] font-semibold tabular-nums" style={{ color: valueColor }}>
        {value}
      </div>
      {badge}
    </div>
  );
}

export function YieldCurveSnapshotCard({
  palette: C,
  snapshot,
  history,
  height = 300,
  fillHeight = false,
}: {
  palette: C;
  snapshot: YieldCurveSnapshot | undefined;
  history: YieldCurveSnapshot[] | undefined;
  height?: number;
  fillHeight?: boolean;
}) {
  const rows = useMemo(
    () => buildSnapshotTenorRows(snapshot?.points ?? [], history),
    [snapshot?.points, history],
  );

  const chartData = useMemo(() => {
    return rows.map((r) => ({
      tenor: r.tenor,
      now: r.now,
      ago3m: r.ago3m,
      ago6m: r.ago6m,
      ago1y: r.ago1y,
    }));
  }, [rows]);

  const yDomain = useMemo(() => {
    const vals: number[] = [];
    for (const d of chartData) {
      for (const k of ["now", "ago3m", "ago6m", "ago1y"] as const) {
        const v = d[k];
        if (v != null && Number.isFinite(v)) vals.push(v);
      }
    }
    if (!vals.length) return [0, 1] as [number, number];
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = Math.max(1e-6, (hi - lo) * 0.12);
    return [lo - pad, hi + pad] as [number, number];
  }, [chartData]);

  const spreads = snapshot?.spreads;

  const m2y10 = useMemo(() => {
    const v = spreadBpByName(spreads, "2Y10Y");
    return v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(0)} bp`;
  }, [spreads]);

  const m3m10 = useMemo(() => {
    const v = spreadBpByName(spreads, "3M10Y");
    return v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(0)} bp`;
  }, [spreads]);

  const real10 = useMemo(() => {
    const v = spreadBpByName(spreads, "10Y_REAL_YIELD");
    return v == null ? "—" : `${v.toFixed(2)}%`;
  }, [spreads]);

  const be10 = useMemo(() => {
    const v = spreadBpByName(spreads, "10Y_BREAKEVEN");
    return v == null ? "—" : `${v.toFixed(2)}%`;
  }, [spreads]);

  const spread2Color =
    spreadBpByName(spreads, "2Y10Y") == null
      ? "var(--nd-text)"
      : (spreadBpByName(spreads, "2Y10Y") ?? 0) >= 0
        ? String(C.green)
        : String(C.red);

  const v3m10 = spreadBpByName(spreads, "3M10Y");
  const spread3Color =
    v3m10 == null ? "var(--nd-text)" : v3m10 >= 0 ? String(C.green) : String(C.red);

  const inverted3m10 = v3m10 != null && v3m10 < 0;

  const histStroke = {
    light: "rgba(212,212,212,0.85)",
    mid: "rgba(156,163,175,0.9)",
    dark: "rgba(82,82,91,0.95)",
  };

  const chartAreaStyle = fillHeight ? ({ width: "100%", height: "100%" } as const) : ({ width: "100%", height } as const);
  const chartAreaClass = fillHeight ? "min-h-[250px] flex-1" : "min-h-[240px]";

  if (!snapshot?.points?.length) {
    return (
      <div
        className={`flex min-h-[320px] flex-col justify-center rounded-[2px] px-4 text-center text-[12px] ${fillHeight ? "h-full" : ""}`}
        style={{ color: "var(--nd-muted)", background: "rgba(255,255,255,0.02)" }}
      >
        No yield curve data.
      </div>
    );
  }

  return (
    <div className={`flex min-h-0 min-w-0 flex-col gap-3 ${fillHeight ? "h-full" : ""}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-muted)" }}>
        Yield curve snapshot
      </div>
      <div style={chartAreaStyle} className={`${chartAreaClass} min-w-0`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 10, left: 2, bottom: 8 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="0" />
            <XAxis
              dataKey="tenor"
              tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={yDomain}
              tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
            />
            <Tooltip
              contentStyle={TIP}
              formatter={(v: unknown, name: unknown) => {
                const n = typeof v === "number" ? v : Number(v);
                const label = typeof name === "string" && name.length ? name : "Value";
                return [Number.isFinite(n) ? `${n.toFixed(2)}%` : "—", label];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
              formatter={(value) => <span style={{ color: "var(--nd-soft)" }}>{value}</span>}
            />
            <Line
              type="monotone"
              dataKey="now"
              name="Now"
              stroke={String(C.green)}
              strokeWidth={2.5}
              dot={{ r: 3, fill: String(C.green), strokeWidth: 0 }}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="ago3m"
              name={SNAPSHOT_SERIES[1].label}
              stroke={histStroke.light}
              strokeWidth={1.25}
              strokeDasharray="5 5"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="ago6m"
              name={SNAPSHOT_SERIES[2].label}
              stroke={histStroke.mid}
              strokeWidth={1.25}
              strokeDasharray="5 5"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="ago1y"
              name={SNAPSHOT_SERIES[3].label}
              stroke={histStroke.dark}
              strokeWidth={1.25}
              strokeDasharray="5 5"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-3 border-t border-[var(--nd-border-soft)] pt-3 sm:grid-cols-4">
        <div className="text-center">
          <MetricBlock label="2Y-10Y spread" value={m2y10} valueColor={spread2Color} />
        </div>
        <div className="text-center">
          <MetricBlock
            label="3M-10Y spread"
            value={m3m10}
            valueColor={spread3Color}
            badge={
              inverted3m10 ? (
                <div
                  className="mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                  style={{ background: String(C.red), color: "#fff" }}
                >
                  Inverted
                </div>
              ) : null
            }
          />
        </div>
        <div className="text-center">
          <MetricBlock label="10Y real yield" value={real10} valueColor="var(--nd-text)" />
        </div>
        <div className="text-center">
          <MetricBlock label="10Y breakeven" value={be10} valueColor="var(--nd-text)" />
        </div>
      </div>
    </div>
  );
}
