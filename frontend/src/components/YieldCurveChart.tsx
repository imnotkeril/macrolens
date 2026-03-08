"use client";

import { useRef, useEffect } from "react";
import type { YieldCurveSnapshot, YieldSpread } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  snapshot: YieldCurveSnapshot;
  history?: YieldCurveSnapshot[];
  /** Optional height for the chart area (default 320px / h-80) */
  chartHeight?: number;
}

const MATURITY_ORDER = ["3M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"];

const SPREAD_IS_PERCENT = new Set(["10Y_REAL_YIELD", "10Y_BREAKEVEN"]);

const SPREAD_LABELS: Record<string, string> = {
  "2Y10Y": "2Y-10Y Spread",
  "3M10Y": "3M-10Y Spread",
  "10Y_REAL_YIELD": "10Y Real Yield",
  "10Y_BREAKEVEN": "10Y Breakeven",
};

const HISTORY_COLORS = [
  { stroke: "#60a5fa", label: "3m ago" },
  { stroke: "#a78bfa", label: "6m ago" },
  { stroke: "#6b7280", label: "1y ago" },
];

function formatHistDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

/**
 * Yield curve is plotted with maturity on X (not time), so we use
 * a lightweight canvas renderer instead of the time-series LWChart.
 */
export function YieldCurveChart({ snapshot, history, chartHeight = 320 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const chartData = MATURITY_ORDER.map((m) => {
    const point = snapshot.points.find((p) => p.maturity === m);
    const row: { maturity: string; current: number | null; hist: (number | null)[] } = {
      maturity: m,
      current: point?.nominal_yield ?? null,
      hist: [],
    };
    history?.forEach((snap) => {
      const hp = snap.points.find((p) => p.maturity === m);
      row.hist.push(hp?.nominal_yield ?? null);
    });
    return row;
  }).filter((d) => d.current !== null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || chartData.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padL = 40;
    const padR = 16;
    const padT = 16;
    const padB = 28;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    // Find Y range
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const d of chartData) {
      if (d.current !== null) { yMin = Math.min(yMin, d.current); yMax = Math.max(yMax, d.current); }
      for (const v of d.hist) {
        if (v !== null) { yMin = Math.min(yMin, v); yMax = Math.max(yMax, v); }
      }
    }
    const yPad = (yMax - yMin) * 0.15 || 0.5;
    yMin -= yPad;
    yMax += yPad;

    const xOf = (i: number) => padL + (i / (chartData.length - 1)) * plotW;
    const yOf = (v: number) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const y = padT + (plotH / yTicks) * i;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
    }

    // Y-axis labels
    ctx.fillStyle = "#52525b";
    ctx.font = "10px Inter, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= yTicks; i++) {
      const v = yMax - ((yMax - yMin) / yTicks) * i;
      const y = padT + (plotH / yTicks) * i;
      ctx.fillText(`${v.toFixed(1)}%`, padL - 6, y);
    }

    // X-axis labels
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let i = 0; i < chartData.length; i++) {
      ctx.fillText(chartData[i].maturity, xOf(i), h - padB + 8);
    }

    // Helper to draw a curve
    const drawCurve = (
      values: (number | null)[],
      color: string,
      lineW: number,
      dashed: boolean,
      opacity: number,
      showDots: boolean
    ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineW;
      ctx.globalAlpha = opacity;
      ctx.setLineDash(dashed ? [5, 5] : []);
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (v === null) continue;
        const x = xOf(i);
        const y = yOf(v);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      if (showDots) {
        for (let i = 0; i < values.length; i++) {
          const v = values[i];
          if (v === null) continue;
          ctx.fillStyle = color;
          ctx.globalAlpha = opacity;
          ctx.beginPath();
          ctx.arc(xOf(i), yOf(v), 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    };

    // History curves (back to front)
    if (history) {
      for (let hi = (history.length - 1); hi >= 0; hi--) {
        const vals = chartData.map((d) => d.hist[hi] ?? null);
        const hc = HISTORY_COLORS[hi];
        if (hc) drawCurve(vals, hc.stroke, 1, true, 0.5 - hi * 0.1, false);
      }
    }

    // Current curve
    const currentVals = chartData.map((d) => d.current);
    drawCurve(currentVals, "#34d399", 2, false, 1, true);
  }, [chartData, history]);

  return (
    <div className="card animate-fade-in">
      <div className="card-header">Yield Curve</div>

      <div style={{ height: chartHeight }} className="w-full">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ display: "block" }}
        />
      </div>

      {/* Legend */}
      {history && history.length > 0 && (
        <div className="mt-3 flex items-center justify-center gap-5 text-[10px] text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-[#34d399] rounded-full" />
            Now
          </span>
          {history.map((snap, i) => (
            <span key={snap.date} className="flex items-center gap-1.5">
              <span
                className="h-0.5 w-4 rounded-full"
                style={{
                  backgroundColor: HISTORY_COLORS[i]?.stroke,
                  opacity: 0.5 - i * 0.1,
                }}
              />
              {formatHistDate(snap.date)}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {snapshot.spreads.map((s) => (
          <SpreadBadge key={s.name} spread={s} />
        ))}
      </div>
    </div>
  );
}

function SpreadBadge({ spread }: { spread: YieldSpread }) {
  const isPct = SPREAD_IS_PERCENT.has(spread.name);
  const label = SPREAD_LABELS[spread.name] || spread.name;

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border px-3 py-2 text-xs",
        spread.is_inverted
          ? "border-accent-red/20 bg-accent-red/5 text-accent-red"
          : "border-border bg-bg-card text-text-secondary"
      )}
    >
      <span className="font-light">{label}</span>
      <span className="tabular-nums font-medium">
        {isPct
          ? `${spread.value.toFixed(2)}%`
          : `${spread.value >= 0 ? "+" : ""}${spread.value.toFixed(0)}bp`}
      </span>
    </div>
  );
}
