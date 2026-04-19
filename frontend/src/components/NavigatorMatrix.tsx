"use client";

import type { NavigatorPosition } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  position: NavigatorPosition;
  history?: NavigatorPosition[];
  forward?: NavigatorPosition[];
  large?: boolean;
  /** Short line under title, e.g. Forecast Lab phase + confidence */
  ensembleCaption?: string | null;
  /** Probability-weighted (macro, Fed) scores for ensemble dot position; from API mix_* when trained */
  ensembleMix?: { growth: number; fed: number } | null;
}

// Order: top-left, top-right, bottom-left, bottom-right (per macro_strategy_full.md)
// X = Macro Sentiment (left neg, right pos), Y = FED Policy (top easy, bottom tight)
const QUADRANTS = [
  { key: "Q2_REFLATION", label: "GROWTH", color: "text-emerald-400", bg: "bg-emerald-500/12", border: "border-emerald-500/25", pos: "rounded-tl-lg" },
  { key: "Q1_GOLDILOCKS", label: "Risk ON", color: "text-emerald-400", bg: "bg-emerald-500/12", border: "border-emerald-500/25", pos: "rounded-tr-lg" },
  { key: "Q4_STAGFLATION", label: "Risk OFF", color: "text-red-400", bg: "bg-red-500/12", border: "border-red-500/25", pos: "rounded-bl-lg" },
  { key: "Q3_OVERHEATING", label: "VALUE", color: "text-amber-400", bg: "bg-amber-500/12", border: "border-amber-500/25", pos: "rounded-br-lg" },
] as const;

const HISTORY_DOTS = [
  { color: "bg-red-300", border: "border-red-400", label: "6 months ago", opacity: "opacity-80" },
  { color: "bg-red-500", border: "border-red-600", label: "1 year ago", opacity: "opacity-90" },
];
const FORWARD_DOTS = [
  { color: "bg-emerald-300", border: "border-emerald-400", label: "6m forward", opacity: "opacity-80" },
  { color: "bg-emerald-500", border: "border-emerald-600", label: "1y forward", opacity: "opacity-90" },
];

function scoreToPct(score: number) {
  return ((score + 2) / 4) * 100;
}

/**
 * Vertical position: fed_policy_score is -2 (easy) … +2 (tight). Chart labels: EASY at top, TIGHT at bottom.
 * Must use +fed here — using -fed inverts the axis (tight fed was plotted under EASY).
 */
function fedToPlotY(fed: number) {
  return scoreToPct(fed);
}

// X = Macro Sentiment (left negative, right positive), Y = FED Policy (top easy, bottom tight)
export function NavigatorMatrix({ position, history, forward, large, ensembleCaption, ensembleMix }: Props) {
  const dotX = scoreToPct(position.growth_score);
  const dotY = fedToPlotY(position.fed_policy_score);
  const ensG = position.ensemble_growth_score;
  const ensF = position.ensemble_fed_policy_score;
  const hasEnsNow = ensG != null && ensF != null;
  const purpleG = ensembleMix != null ? ensembleMix.growth : ensG;
  const purpleF = ensembleMix != null ? ensembleMix.fed : ensF;

  return (
    <div className="card animate-fade-in">
      <div className="flex flex-col gap-1 mb-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-widest text-text-muted">
            Trading Navigator
          </h3>
          <span className="text-xs text-text-muted">
            {(position.confidence * 100).toFixed(0)}% confidence
          </span>
        </div>
        {ensembleCaption ? (
          <p className="text-[10px] font-light text-violet-300/90 tracking-wide">{ensembleCaption}</p>
        ) : null}
        {position.matrix_quadrant && position.matrix_quadrant !== position.quadrant ? (
          <p className="text-[10px] font-light text-amber-200/80">
            Matrix (macro×Fed): {position.matrix_quadrant.replace(/_/g, " ")} · Regime (recommendations):{" "}
            {position.quadrant.replace(/_/g, " ")}
          </p>
        ) : null}
      </div>

      <div className={cn("relative w-full mx-auto", large ? "min-h-[420px] h-[420px]" : "h-56")}>
        {/* Axis labels: Y = FED (top easy, bottom tight), X = Macro Sentiment (left neg, right pos) */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] tracking-wider text-text-muted">
          EASY FED
        </div>
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] tracking-wider text-text-muted">
          TIGHT FED
        </div>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[calc(100%+6px)] text-[10px] tracking-wider text-text-muted">
          MACRO NEG
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[calc(100%+6px)] text-[10px] tracking-wider text-text-muted">
          MACRO POS
        </div>

        {/* Quadrants — ALL always colored */}
        <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-lg">
          {QUADRANTS.map((q) => (
            <div
              key={q.key}
              className={cn(
                "flex flex-col items-center justify-center border transition-all duration-300",
                q.bg, q.border, q.pos,
                position.quadrant === q.key && "ring-1 ring-white/10"
              )}
            >
              <span className={cn("text-[10px] font-medium tracking-wider", q.color)}>
                {q.label.toUpperCase()}
              </span>
            </div>
          ))}
        </div>

        {/* Crosshairs */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/8 pointer-events-none" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/8 pointer-events-none" />

        {/* Past: 1y ago, 6m ago (reds) — violet = current FL ensemble only */}
        {history && history.map((h, i) => {
          const hx = scoreToPct(h.growth_score);
          const hy = fedToPlotY(h.fed_policy_score);
          const dotCfg = HISTORY_DOTS[i] ?? HISTORY_DOTS[0];
          return (
            <div
              key={`past-${h.date}-${i}`}
              className={cn(
                "absolute h-2.5 w-2.5 rounded-full border-2 transition-all duration-500",
                dotCfg.color, dotCfg.border, dotCfg.opacity
              )}
              style={{ left: `${hx}%`, top: `${hy}%`, transform: "translate(-50%, -50%)" }}
              title={`${dotCfg.label}: Sentiment ${h.growth_score}, Fed ${h.fed_policy_score}`}
            />
          );
        })}

        {/* Forward: 6m, 1y (greens) */}
        {forward && forward.map((f, i) => {
          const fx = scoreToPct(f.growth_score);
          const fy = fedToPlotY(f.fed_policy_score);
          const dotCfg = FORWARD_DOTS[i] ?? FORWARD_DOTS[0];
          return (
            <div
              key={`fwd-${f.quadrant_label}-${i}`}
              className={cn(
                "absolute h-2.5 w-2.5 rounded-full border-2 transition-all duration-500",
                dotCfg.color, dotCfg.border, dotCfg.opacity
              )}
              style={{ left: `${fx}%`, top: `${fy}%`, transform: "translate(-50%, -50%)" }}
              title={`${dotCfg.label}: Sentiment ${f.growth_score}, Fed ${f.fed_policy_score}`}
            />
          );
        })}

        {/* Forecast Lab dot (violet): probability-weighted position in score space when mix is available */}
        {hasEnsNow && purpleG != null && purpleF != null ? (
          <div
            className="absolute h-3 w-3 rounded-full bg-violet-500/90 border-2 border-violet-200 shadow-[0_0_14px_rgba(139,92,246,0.45)] transition-all duration-700 ease-out z-[21]"
            style={{
              left: `${scoreToPct(purpleG)}%`,
              top: `${fedToPlotY(purpleF)}%`,
              transform: "translate(-50%, -50%)",
            }}
            title={
              ensembleMix
                ? `Forecast Lab ensemble (P-weighted mean in score space): macro ${purpleG.toFixed(2)}, fed ${purpleF.toFixed(2)}`
                : `Forecast Lab ensemble (phase corner anchor): macro ${purpleG.toFixed(2)}, fed ${purpleF.toFixed(2)}`
            }
          />
        ) : null}

        {/* Current position dot — fundamentals (gray) */}
        <div
          className="absolute h-3.5 w-3.5 rounded-full bg-zinc-400 border-2 border-zinc-500 shadow-[0_0_12px_rgba(113,113,122,0.5)] transition-all duration-700 ease-out z-10"
          style={{ left: `${dotX}%`, top: `${dotY}%`, transform: "translate(-50%, -50%)" }}
          title={`Now (macro×Fed axes): Sentiment ${position.growth_score}, Fed ${position.fed_policy_score}`}
        />
      </div>

      {/* Legend for dots */}
      {(history?.length || forward?.length || hasEnsNow) ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-300 border border-red-400" />
            6m ago
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500 border border-red-600" />
            1y ago
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-zinc-400 border-2 border-zinc-500" />
            Now (axes)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-500 border border-violet-200" />
            FL ensemble
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-300 border border-emerald-400" />
            6m fwd
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 border border-emerald-600" />
            1y fwd
          </span>
        </div>
      ) : null}
    </div>
  );
}
