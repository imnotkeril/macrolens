"use client";

import { Fragment, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type {
  CycleDriverContribution,
  ExpectedReturn,
  RecessionModelResult,
  TacticalAllocationRow,
} from "@/types";
import { nextDashboardCssTokenColors } from "@/components/next-dashboard/nextDashboardConfig";

/** Same semantic tokens as `useNextShellTheme().colors` — no legacy `accent-*` / `text-text-*` classes. */
export type NextRadarPalette = typeof nextDashboardCssTokenColors;

function sectionTitleStyle(): CSSProperties {
  return {
    fontSize: 18,
    lineHeight: 1,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--nd-text)",
  };
}

export function NextRadarSectionTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-1 shrink-0", className)} style={sectionTitleStyle()}>
      {children}
    </div>
  );
}

/** Upper semicircle (180°): θ from 180° (left) → 0° (right), four equal 45° bands. */
const GAUGE_SEGMENTS: Array<{
  start: number;
  end: number;
  label: string;
  palKey: keyof Pick<NextRadarPalette, "red" | "yellow" | "blue" | "green">;
}> = [
  { start: 180, end: 135, label: "Contraction", palKey: "red" },
  { start: 135, end: 90, label: "Slowdown", palKey: "yellow" },
  { start: 90, end: 45, label: "Recovery", palKey: "blue" },
  { start: 45, end: 0, label: "Expansion", palKey: "green" },
];

/** Maps backend cycle_score (−100…+100) to display z (−3…+3), same as timeline charts. */
export function cycleScoreToZ(score: number): number {
  return (score * 3) / 100;
}

/**
 * Coarse 4-band labels aligned with the gauge arc (equal score ranges), not `_map_phase` bucket names.
 * Backend uses finer thresholds (e.g. 0–20 = "Early Slowdown"); the needle still sits in the Recovery band for small positive scores.
 */
function gaugePhaseFromScore(score: number): {
  palKey: keyof Pick<NextRadarPalette, "red" | "yellow" | "blue" | "green">;
  title: string;
} {
  if (score >= 50) return { palKey: "green", title: "Expansion" };
  if (score >= 0) return { palKey: "blue", title: "Recovery" };
  if (score >= -50) return { palKey: "yellow", title: "Slowdown" };
  return { palKey: "red", title: "Contraction" };
}

export function NextRadarCycleGauge({
  palette: pal,
  score,
  phase: _phase,
  phaseLabel: _phaseLabel,
}: {
  palette: NextRadarPalette;
  score: number;
  phase: string;
  phaseLabel: string;
}) {
  const gauge = gaugePhaseFromScore(score);
  const accent = pal[gauge.palKey];
  const z = cycleScoreToZ(score);
  const phaseTitle = gauge.title;

  /** Pivot on the diameter (flat bottom); arc bends upward (smaller y). */
  const cx = 230;
  const cy = 136;
  const rOuter = 124;
  const rInner = 74;
  /** Map backend −100…+100 to θ 180°…0° along the semicircle. */
  const needleDeg = 180 - ((score + 100) / 200) * 180;

  const polar = (deg: number, r: number) => {
    const t = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(t), y: cy - r * Math.sin(t) };
  };

  const sectorPath = (startDeg: number, endDeg: number): string => {
    const sweepOuter = 1;
    const sweepInner = 0;
    const large = Math.abs(endDeg - startDeg) > 90 ? 1 : 0;
    const o1 = polar(startDeg, rOuter);
    const o2 = polar(endDeg, rOuter);
    const i2 = polar(endDeg, rInner);
    const i1 = polar(startDeg, rInner);
    return [
      `M ${o1.x} ${o1.y}`,
      `A ${rOuter} ${rOuter} 0 ${large} ${sweepOuter} ${o2.x} ${o2.y}`,
      `L ${i2.x} ${i2.y}`,
      `A ${rInner} ${rInner} 0 ${large} ${sweepInner} ${i1.x} ${i1.y}`,
      "Z",
    ].join(" ");
  };

  const labelPoint = (midDeg: number) => polar(midDeg, (rOuter + rInner) / 2);

  const needleTip = polar(needleDeg, rInner - 8);

  return (
    <div className="mx-auto flex w-full max-w-[min(100%,520px)] flex-col items-center justify-center overflow-visible py-0">
      <svg
        viewBox="0 0 460 228"
        className="h-auto w-full max-h-[min(70vw,360px)] overflow-visible sm:max-h-[380px]"
        preserveAspectRatio="xMidYMid meet"
      >
        {GAUGE_SEGMENTS.map((seg) => {
          const fill = pal[seg.palKey];
          return (
            <path
              key={seg.label}
              d={sectorPath(seg.start, seg.end)}
              fill={fill}
              fillOpacity={0.42}
              stroke="rgba(0,0,0,0.35)"
              strokeWidth={1}
            />
          );
        })}

        {GAUGE_SEGMENTS.map((seg) => {
          const mid = (seg.start + seg.end) / 2;
          const p = labelPoint(mid);
          return (
            <text
              key={`lbl-${seg.label}`}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(255,255,255,0.78)"
              fontSize={11}
              fontWeight={500}
              style={{ letterSpacing: "0.02em" }}
            >
              {seg.label}
            </text>
          );
        })}

        <line
          x1={cx}
          y1={cy}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke="rgba(255,255,255,0.92)"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={6} fill="rgba(255,255,255,0.95)" stroke="rgba(0,0,0,0.25)" strokeWidth={1} />

        <text
          x={cx}
          y={cy + 48}
          textAnchor="middle"
          fontSize={34}
          fontWeight={200}
          fill={accent}
          className="tabular-nums"
        >
          {z >= 0 ? "" : "−"}
          {Math.abs(z).toFixed(2)}
        </text>
        <text
          x={cx}
          y={cy + 74}
          textAnchor="middle"
          fontSize={15}
          fontWeight={300}
          fill={accent}
          style={{ letterSpacing: "0.04em" }}
        >
          {phaseTitle}
        </text>
      </svg>
    </div>
  );
}

function probAccent(palette: NextRadarPalette, p: number): string {
  if (p < 20) return palette.green;
  if (p < 40) return palette.yellow;
  return palette.red;
}

export function NextRadarRecession12m({
  palette: pal,
  probability,
  models,
  drivers,
}: {
  palette: NextRadarPalette;
  probability: number;
  models: RecessionModelResult[];
  drivers: CycleDriverContribution[];
}) {
  const pct = Math.min(100, Math.max(0, probability));
  const accent = probAccent(pal, pct);
  const top3 = drivers.slice(0, 3);
  const modelRows = models.slice(0, 3);

  return (
    <div className="flex h-full min-h-0 flex-col justify-between">
      {/* Extra pt pushes the % + bar down; justify-between keeps Model/Key drivers pinned to the card bottom */}
      <div className="flex shrink-0 flex-col items-center pb-1.5 pt-6 max-xl:pt-5">
        <div className="text-[32px] font-extralight leading-none tabular-nums" style={{ color: accent }}>
          {probability.toFixed(0)}%
        </div>
        <div className="relative mt-1.5 w-full">
          <div
            className="relative h-2.5 w-full overflow-visible rounded-[3px]"
            style={{
              background: `linear-gradient(90deg, ${pal.green}, ${pal.yellow}, ${pal.red})`,
            }}
          >
            {/* Obvious marker: ring + dot (readable on any gradient stop) */}
            <span
              className="pointer-events-none absolute top-1/2 z-10 box-border h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_1px_4px_rgba(0,0,0,0.55)] ring-2 ring-black/40"
              style={{
                left: `${pct}%`,
                background: "var(--nd-panel)",
              }}
              aria-hidden
            />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[10px]" style={{ color: "var(--nd-muted)" }}>
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Gutter column centers a 1px rule so text in both halves stays clear of the divider */}
      <div
        className="mt-0 grid shrink-0 border-t pt-2"
        style={{
          borderColor: "var(--nd-border-soft)",
          gridTemplateColumns: "minmax(0, 1fr) 22px minmax(0, 1fr)",
          gridTemplateRows: "auto repeat(3, auto)",
        }}
      >
        <div
          className="pb-1.5 pr-3 text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ gridColumn: 1, gridRow: 1, color: "var(--nd-text)" }}
        >
          Model breakdown
        </div>
        <div
          className="relative h-full min-h-[4rem] min-w-[22px] justify-self-center"
          style={{ gridColumn: 2, gridRow: "1 / -1" }}
          aria-hidden
        >
          <div
            className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2"
            style={{ background: "var(--nd-border-soft)" }}
          />
        </div>
        <div
          className="pb-1.5 pl-3 text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ gridColumn: 3, gridRow: 1, color: "var(--nd-text)" }}
        >
          Key drivers
        </div>

        {Array.from({ length: 3 }).map((_, i) => {
          const m = modelRows[i];
          const d = top3[i];
          const row = i + 2;
          return (
            <Fragment key={`row-${i}`}>
              <div
                className="flex min-h-[34px] items-center justify-between gap-1.5 border-b py-0.5 pr-3 text-[11px] leading-snug"
                style={{ gridColumn: 1, gridRow: row, borderColor: "var(--nd-border-soft)" }}
              >
                {m ? (
                  <>
                    <span className="min-w-0 flex-1 truncate font-light" style={{ color: "var(--nd-soft)" }}>
                      {m.name}
                    </span>
                    <span className="shrink-0 tabular-nums font-medium" style={{ color: probAccent(pal, m.probability) }}>
                      {m.probability.toFixed(1)}%
                    </span>
                  </>
                ) : (
                  <span className="text-[10px]" style={{ color: "var(--nd-muted)" }}>
                    —
                  </span>
                )}
              </div>
              <div
                className="flex min-h-[34px] items-center justify-between gap-1.5 border-b py-0.5 pl-3 text-[11px] leading-snug"
                style={{ gridColumn: 3, gridRow: row, borderColor: "var(--nd-border-soft)" }}
              >
                {d ? (
                  <>
                    <span className="min-w-0 flex-1 truncate font-light" style={{ color: "var(--nd-soft)" }}>
                      {d.name}
                    </span>
                    <span
                      className="shrink-0 tabular-nums font-medium"
                      style={{
                        color:
                          d.direction === "positive"
                            ? pal.green
                            : d.direction === "negative"
                              ? pal.red
                              : "var(--nd-muted)",
                      }}
                    >
                      {d.contribution >= 0 ? "+" : ""}
                      {d.contribution.toFixed(1)} pp
                    </span>
                  </>
                ) : (
                  <span className="text-[10px]" style={{ color: "var(--nd-muted)" }}>
                    —
                  </span>
                )}
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

const PHASE_LABEL: Record<string, string> = {
  recovery: "Recovery",
  expansion: "Expansion",
  slowdown: "Slowdown",
  contraction: "Contraction",
};

const PHASE_KEYS = ["recovery", "expansion", "slowdown", "contraction"] as const;
type PhaseKey = (typeof PHASE_KEYS)[number];

/** Header tint per phase (reference: Recovery=blue, Expansion=green, Slowdown=amber, Contraction=red). */
const PHASE_HEADER_COLOR: Record<PhaseKey, keyof Pick<NextRadarPalette, "blue" | "green" | "yellow" | "red">> = {
  recovery: "blue",
  expansion: "green",
  slowdown: "yellow",
  contraction: "red",
};

function phaseAccentColor(palette: NextRadarPalette, phase: string): string {
  const k = phase.toLowerCase();
  if (k === "recovery" || k === "expansion" || k === "slowdown" || k === "contraction") {
    return palette[PHASE_HEADER_COLOR[k as PhaseKey]];
  }
  return "var(--nd-soft)";
}

function countPhaseMatches(allocation: TacticalAllocationRow[], phase: PhaseKey): number {
  return allocation.filter((row) => row[phase] === row.current_signal).length;
}

/** Phase column that matches Current OW/UW/N the most; ties broken by `regimePhase` hint then stable order. */
function bestMatchingPhaseColumn(allocation: TacticalAllocationRow[], regimePhase: string): PhaseKey {
  const scored = PHASE_KEYS.map((p) => ({ p, n: countPhaseMatches(allocation, p) }));
  const maxN = Math.max(0, ...scored.map((s) => s.n));
  const winners = scored.filter((s) => s.n === maxN);
  if (winners.length === 1) return winners[0].p;
  const norm = regimePhase.toLowerCase();
  const hint = winners.find((w) => w.p === norm);
  if (hint) return hint.p;
  return winners.sort((a, b) => PHASE_KEYS.indexOf(a.p) - PHASE_KEYS.indexOf(b.p))[0].p;
}

function weightTone(palette: NextRadarPalette, w: string): { bg: string; fg: string; border: string; label: string } {
  if (w === "overweight") {
    return {
      bg: "rgba(114,173,102,0.14)",
      fg: palette.green,
      border: "rgba(114,173,102,0.35)",
      label: "OW",
    };
  }
  if (w === "underweight") {
    return {
      bg: "rgba(212,93,114,0.14)",
      fg: palette.red,
      border: "rgba(212,93,114,0.35)",
      label: "UW",
    };
  }
  return {
    bg: "var(--nd-panel-soft)",
    fg: "var(--nd-muted)",
    border: "var(--nd-border-soft)",
    label: "N",
  };
}

export function NextRadarTacticalTable({
  palette: pal,
  allocation,
  currentPhase,
}: {
  palette: NextRadarPalette;
  allocation: TacticalAllocationRow[];
  currentPhase: string;
}) {
  const phases = PHASE_KEYS;
  const matchPhase = bestMatchingPhaseColumn(allocation, currentPhase);
  const matchAccent = pal[PHASE_HEADER_COLOR[matchPhase]];

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr
            className="border-b text-[10px] uppercase tracking-[0.08em]"
            style={{ borderColor: "var(--nd-border-soft)", color: "var(--nd-muted)" }}
          >
            <th className="pb-2 text-center font-medium">Asset class</th>
            {phases.map((p) => (
              <th
                key={p}
                className="pb-2 text-center font-medium"
                style={{ color: pal[PHASE_HEADER_COLOR[p]] }}
              >
                {PHASE_LABEL[p]}
              </th>
            ))}
            <th className="pb-2 text-center font-medium">
              <span
                className="inline-block rounded-[4px] px-2.5 py-1"
                style={{
                  color: matchAccent,
                  background: `color-mix(in srgb, ${matchAccent} 18%, var(--nd-panel))`,
                  boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${matchAccent} 45%, transparent)`,
                }}
              >
                Current
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {allocation.map((row) => (
            <tr key={row.asset_class} className="border-b" style={{ borderColor: "var(--nd-border-soft)" }}>
              <td className="py-2 px-1 text-center font-light whitespace-nowrap" style={{ color: "var(--nd-text)" }}>
                {row.asset_class}
              </td>
              {phases.map((p) => {
                const w = row[p];
                const t = weightTone(pal, w);
                return (
                  <td key={p} className="px-1 py-2 text-center">
                    <span
                      className="inline-block min-w-[28px] rounded-[2px] border px-1.5 py-0.5 text-[11px] font-medium"
                      style={{
                        background: t.bg,
                        color: t.fg,
                        borderColor: t.border,
                      }}
                    >
                      {t.label}
                    </span>
                  </td>
                );
              })}
              <td className="px-1 py-2 text-center">
                {(() => {
                  const cur = weightTone(pal, row.current_signal);
                  return (
                    <span
                      className="inline-block min-w-[32px] rounded-[2px] border px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        background: cur.bg,
                        color: cur.fg,
                        borderColor: cur.border,
                      }}
                    >
                      {cur.label}
                    </span>
                  );
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NextRadarExpectedReturnsTable({
  palette: pal,
  rows,
  currentPhase,
}: {
  palette: NextRadarPalette;
  rows: ExpectedReturn[];
  currentPhase: string;
}) {
  if (!rows.length) {
    return <div className="mt-2 text-[13px] font-light" style={{ color: "var(--nd-muted)" }}>No expected returns for this phase.</div>;
  }

  const phaseName = PHASE_LABEL[currentPhase] ?? currentPhase;
  const phaseHue = phaseAccentColor(pal, currentPhase);

  return (
    <div className="mt-3 overflow-x-auto pt-2">
      <p className="mb-2 text-[11px] uppercase tracking-[0.08em]">
        <span style={{ color: "var(--nd-muted)" }}>Current phase: </span>
        <span style={{ color: phaseHue }}>{phaseName}</span>
      </p>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr
            className="border-b text-[10px] uppercase tracking-[0.08em]"
            style={{ borderColor: "var(--nd-border-soft)", color: "var(--nd-muted)" }}
          >
            <th className="pb-2 text-center font-medium">Asset</th>
            <th className="pb-2 text-center font-medium">Avg return</th>
            <th className="pb-2 text-center font-medium">Sharpe</th>
            <th className="pb-2 text-center font-medium">Beta to cycle</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.asset_class} className="border-b" style={{ borderColor: "var(--nd-border-soft)" }}>
              <td className="py-1.5 text-center font-light" style={{ color: "var(--nd-text)" }}>
                {r.asset_class}
              </td>
              <td
                className="py-1.5 text-center tabular-nums font-medium"
                style={{ color: r.avg_return >= 0 ? pal.green : pal.red }}
              >
                {r.avg_return >= 0 ? "+" : ""}
                {r.avg_return.toFixed(1)}%
              </td>
              <td className="py-1.5 text-center tabular-nums" style={{ color: "var(--nd-soft)" }}>
                {r.sharpe.toFixed(2)}
              </td>
              <td
                className="py-1.5 text-center tabular-nums"
                style={{ color: r.beta_to_cycle >= 0 ? pal.green : pal.yellow }}
              >
                {r.beta_to_cycle >= 0 ? "+" : ""}
                {r.beta_to_cycle.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
