"use client";

import { format, parseISO } from "date-fns";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NextShellThemeContextValue } from "@/components/next-dashboard/nextShellTheme";
import type { CurveDynamics, RatioPoint } from "@/types";
import { normalizeYieldCurvePattern, YIELD_CURVE_PATTERN_UI } from "./yieldCurvePatternUi";

type C = NextShellThemeContextValue["colors"];
const TIP: React.CSSProperties = {
  backgroundColor: "var(--nd-panel-soft)",
  border: "1px solid var(--nd-border-soft)",
  borderRadius: 4,
  fontSize: 11,
  color: "var(--nd-text)",
};

function bpColor(v: number, palette: C): string {
  if (!Number.isFinite(v)) return "var(--nd-text)";
  if (v > 0) return String(palette.green);
  if (v < 0) return String(palette.red);
  return "var(--nd-muted)";
}

function patternHeadlineColor(patternKey: ReturnType<typeof normalizeYieldCurvePattern>, palette: C): string {
  const tone = YIELD_CURVE_PATTERN_UI[patternKey].coloring;
  if (tone === "yellow") return String(palette.yellow);
  if (tone === "green") return String(palette.green);
  if (tone === "red") return String(palette.red);
  if (tone === "blue") return String(palette.blue);
  return "var(--nd-soft)";
}

export function CurveDynamicsCard({
  palette: C,
  dynamics,
  pending,
  momentumRows,
  persistenceWeeks,
}: {
  palette: C;
  dynamics: CurveDynamics | undefined;
  pending: boolean;
  momentumRows?: RatioPoint[];
  persistenceWeeks?: number | null;
}) {
  if (pending && !dynamics) {
    return (
      <div className="flex flex-1 items-center justify-center py-8 text-[12px]" style={{ color: "var(--nd-muted)" }}>
        Loading…
      </div>
    );
  }

  if (!dynamics) {
    return (
      <div className="flex flex-1 items-center justify-center py-8 text-[12px]" style={{ color: "var(--nd-muted)" }}>
        No dynamics data.
      </div>
    );
  }

  const key = normalizeYieldCurvePattern(dynamics.pattern);
  const ui = YIELD_CURVE_PATTERN_UI[key];

  const tiles = [
    { label: "Short end (2Y) 1M", bp: dynamics.short_end_change_1m },
    { label: "Long end (10Y) 1M", bp: dynamics.long_end_change_1m },
    { label: "Short end (2Y) 3M", bp: dynamics.short_end_change_3m },
    { label: "Long end (10Y) 3M", bp: dynamics.long_end_change_3m },
  ];
  const steepness1m = dynamics.long_end_change_1m - dynamics.short_end_change_1m;
  const steepness3m = dynamics.long_end_change_3m - dynamics.short_end_change_3m;
  const sameSign = steepness1m === 0 || steepness3m === 0 || Math.sign(steepness1m) === Math.sign(steepness3m);
  const confidence = Math.max(
    5,
    Math.min(99, Math.round(Math.abs(steepness1m) * 6 + Math.abs(steepness3m) * 2 + (sameSign ? 10 : 0))),
  );
  const spark = (momentumRows ?? []).slice(-42);
  const lastMomentum = spark.length ? spark[spark.length - 1]?.value : null;
  const lo = spark.length ? Math.min(...spark.map((d) => d.value), 0) : -1;
  const hi = spark.length ? Math.max(...spark.map((d) => d.value), 0) : 1;
  const pad = Math.max(0.15, (hi - lo) * 0.12);
  const yDomain = [lo - pad, hi + pad] as [number, number];

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-muted)" }}>
        Curve dynamics
      </div>
      <div className="flex items-center justify-between gap-2">
        <div
          className="text-[clamp(1rem,2vw,1.35rem)] font-bold leading-tight tracking-wide"
          style={{ color: patternHeadlineColor(key, C) }}
        >
          {ui.label.toUpperCase()}
        </div>
        <div
          className="rounded-[2px] px-1.5 py-0.5 font-mono text-[10px] tabular-nums"
          style={{ border: "1px solid var(--nd-border)", color: "var(--nd-soft)" }}
          title="Regime persistence"
        >
          {persistenceWeeks != null ? `${persistenceWeeks}w` : "—"}
        </div>
      </div>
      <p className="text-[12px] leading-snug" style={{ color: "var(--nd-soft)" }}>
        {ui.mechanics}
      </p>
      <p className="text-[12px] leading-snug" style={{ color: "var(--nd-text)" }}>
        <span className="font-semibold" style={{ color: "var(--nd-soft)" }}>
          Positioning:
        </span>{" "}
        {ui.positioning}
      </p>
      <div className="mt-auto grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-[2px] px-2 py-2"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--nd-border-soft)" }}
          >
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--nd-muted)" }}>
              {t.label}
            </div>
            <div className="mt-1 text-[14px] font-semibold tabular-nums" style={{ color: bpColor(t.bp, C) }}>
              {`${t.bp >= 0 ? "+" : ""}${t.bp.toFixed(0)} bp`}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-[2px] border border-[var(--nd-border-soft)] px-2 py-2">
        <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-[0.08em]">
          <span style={{ color: "var(--nd-muted)" }}>Signal confidence</span>
          <span className="font-mono tabular-nums" style={{ color: "var(--nd-soft)" }}>
            {confidence}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded bg-[rgba(255,255,255,0.08)]">
          <div
            className="h-full rounded"
            style={{ width: `${confidence}%`, background: "linear-gradient(90deg, rgba(108,175,102,0.55), rgba(108,175,102,0.95))" }}
          />
        </div>
        <div className="mt-2 border-t border-[var(--nd-border-soft)] pt-2">
          <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-[0.08em]">
            <span style={{ color: "var(--nd-muted)" }}>2s-10s momentum</span>
            <span className="font-mono tabular-nums" style={{ color: "var(--nd-soft)" }}>
              {lastMomentum != null ? `${lastMomentum >= 0 ? "+" : ""}${lastMomentum.toFixed(2)}` : "—"}
            </span>
          </div>
          <div className="h-[64px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spark} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={yDomain} />
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
                    return [Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(2)} bp/mo` : "—", "2s-10s momentum"];
                  }}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.16)" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={String(C.green)}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
