"use client";

import { useMemo } from "react";
import { TriangleAlert } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { NextNoData } from "@/components/next-dashboard/NextNoData";
import type { NextShellThemeContextValue } from "@/components/next-dashboard/nextShellTheme";
import type { FomcDashboard } from "@/types";

type Palette = NextShellThemeContextValue["colors"];

const RATE_PATH_ORDER = ["now", "y0", "y1", "y2", "lt"] as const;

const rechartsTooltipStyle = {
  backgroundColor: "var(--nd-panel-soft)",
  border: "1px solid var(--nd-border-soft)",
  borderRadius: 4,
  fontSize: 12,
  color: "var(--nd-text)",
};

type DotRow = { x: number; y: number };

function buildSeries(fomc: FomcDashboard): {
  ctPoints: DotRow[];
  rangePoints: DotRow[];
  fedMedian: DotRow[];
  market: DotRow[];
  xLabels: string[];
  yDomain: [number, number];
} {
  const ctPoints: DotRow[] = [];
  const rangePoints: DotRow[] = [];
  const fedMedian: DotRow[] = [];
  const market: DotRow[] = [];
  const xLabels: string[] = [];
  const ys: number[] = [];

  RATE_PATH_ORDER.forEach((key) => {
    const pt = fomc.rate_path[key];
    if (!pt) return;
    const idx = xLabels.length;
    xLabels.push(pt.label ?? key);
    fedMedian.push({ x: idx, y: pt.fed_median });
    ys.push(pt.fed_median);

    // Real SEP spread (FRED): central tendency and full range of participants' projections.
    for (const v of [pt.ct_low, pt.ct_high]) {
      if (v != null) {
        ctPoints.push({ x: idx, y: v });
        ys.push(v);
      }
    }
    for (const v of [pt.range_low, pt.range_high]) {
      if (v != null) {
        rangePoints.push({ x: idx, y: v });
        ys.push(v);
      }
    }
    if (pt.market != null) {
      market.push({ x: idx + 0.06, y: pt.market });
      ys.push(pt.market);
    }
  });

  const rawLo = Math.min(...ys, 2.5);
  const rawHi = Math.max(...ys, 5);
  const pad = Math.max(0.12, (rawHi - rawLo) * 0.06);
  let lo = Math.min(2.45, rawLo - pad);
  let hi = Math.max(5.05, rawHi + pad);
  lo = Math.floor(lo * 4) / 4;
  hi = Math.ceil(hi * 4) / 4;
  if (hi - lo < 1.25) {
    const mid = (hi + lo) / 2;
    lo = mid - 0.65;
    hi = mid + 0.65;
  }

  return { ctPoints, rangePoints, fedMedian, market, xLabels, yDomain: [lo, hi] };
}

function DotShape({ cx, cy, fill, r = 4.5 }: { cx: number; cy: number; fill: string; r?: number }) {
  if (cx == null || cy == null || !Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return <circle cx={cx} cy={cy} r={r} fill={fill} stroke="rgba(0,0,0,0.35)" strokeWidth={0.5} />;
}

/** Plot height inside card (legend + axes fit in margins below). */
const CHART_H = 248;

export function FedRatePathDotPlot({
  fomc,
  palette: C,
  inputsMissing = false,
}: {
  fomc: FomcDashboard;
  palette: Palette;
  /** True when the Fed status reports no rate inputs: the path is a fallback, not an observation. */
  inputsMissing?: boolean;
}) {
  const { ctPoints, rangePoints, fedMedian, market, xLabels, yDomain } = useMemo(
    () => buildSeries(fomc),
    [fomc],
  );
  // Recharts 3: root chart `data` drives axis ticks; per-Scatter `data` alone can leave ticks empty → blank chart.
  const chartData = useMemo(
    () => [...rangePoints, ...ctPoints, ...fedMedian, ...market],
    [rangePoints, ctPoints, fedMedian, market],
  );
  const nowPt = fomc.rate_path.now;
  const divBps =
    nowPt != null && nowPt.market != null
      ? Math.round(Math.abs(nowPt.fed_median - nowPt.market) * 100)
      : null;
  const showAlert = divBps != null && divBps >= 15;

  const blue = String(C.blue);
  const green = String(C.green);
  const yellow = String(C.yellow);

  if (inputsMissing || !chartData.length) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-text)" }}>
          Rate path — dot plot vs market
        </div>
        <div className="flex w-full items-center justify-center" style={{ height: CHART_H }}>
          <NextNoData />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-2">
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-text)" }}>
          Rate path — dot plot vs market
        </div>
        {showAlert ? (
          <div
            className="flex shrink-0 items-center gap-1.5 rounded-[2px] border px-2 py-1.5"
            style={{ borderColor: "var(--nd-yellow)", background: "var(--nd-panel-soft)" }}
          >
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--nd-yellow)" }} aria-hidden />
            <div className="text-right leading-tight">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--nd-yellow)" }}>
                Divergence alert
              </div>
              <div className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--nd-yellow)" }}>
                {divBps}bp
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-1 w-full min-w-0 shrink-0" style={{ height: CHART_H }}>
        <ResponsiveContainer initialDimension={{ width: 320, height: 200 }} width="100%" height={CHART_H}>
          <ScatterChart data={chartData} margin={{ top: 32, right: 10, left: 2, bottom: 10 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" vertical={false} />
            <XAxis
              type="number"
              dataKey="x"
              domain={[-0.45, Math.max(xLabels.length - 1, 1) + 0.45]}
              ticks={xLabels.map((_, i) => i)}
              tick={{ fill: "var(--nd-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--nd-border-soft)" }}
              tickFormatter={(v: number) => (Number.isInteger(v) && v >= 0 && v < xLabels.length ? xLabels[v] : "")}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={yDomain}
              tick={{ fill: "var(--nd-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--nd-border-soft)" }}
              width={44}
              tickCount={7}
              tickFormatter={(v) => `${Number(v).toFixed(2)}`}
              label={{
                value: "Rate (%)",
                position: "top",
                offset: 10,
                fill: "var(--nd-muted)",
                fontSize: 11,
              }}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              contentStyle={rechartsTooltipStyle}
              formatter={(value: unknown) => {
                const y = typeof value === "number" ? value : Number(value);
                return [Number.isFinite(y) ? `${y.toFixed(2)}%` : "—", ""];
              }}
              labelFormatter={() => ""}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 2, color: "var(--nd-soft)" }}
              formatter={(value) => <span style={{ color: "var(--nd-soft)" }}>{value}</span>}
            />
            <Scatter
              name="SEP range"
              data={rangePoints}
              fill={blue}
              isAnimationActive={false}
              shape={(props: { cx?: number; cy?: number }) => (
                <DotShape cx={props.cx ?? 0} cy={props.cy ?? 0} fill="rgba(120,160,255,0.35)" r={3} />
              )}
            />
            <Scatter
              name="SEP central tendency"
              data={ctPoints}
              fill={blue}
              isAnimationActive={false}
              shape={(props: { cx?: number; cy?: number }) => (
                <DotShape cx={props.cx ?? 0} cy={props.cy ?? 0} fill={blue} r={4} />
              )}
            />
            <Scatter
              name="Fed median"
              data={fedMedian}
              fill={green}
              isAnimationActive={false}
              shape={(props: { cx?: number; cy?: number }) => (
                <DotShape cx={props.cx ?? 0} cy={props.cy ?? 0} fill={green} r={4.5} />
              )}
            />
            <Scatter
              name="Market pricing"
              data={market}
              fill={yellow}
              isAnimationActive={false}
              shape={(props: { cx?: number; cy?: number }) => (
                <DotShape cx={props.cx ?? 0} cy={props.cy ?? 0} fill={yellow} r={5} />
              )}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
