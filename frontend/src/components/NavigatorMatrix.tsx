"use client";

import type { NavigatorPosition } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  position: NavigatorPosition;
  history?: NavigatorPosition[];
  forward?: NavigatorPosition[];
  large?: boolean;
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

// X = Macro Sentiment (left negative, right positive), Y = FED Policy (top easy, bottom tight)
export function NavigatorMatrix({ position, history, forward, large }: Props) {
  const dotX = scoreToPct(position.growth_score);
  const dotY = scoreToPct(-position.fed_policy_score);

  return (
    <div className="card animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xs font-medium uppercase tracking-widest text-text-muted">
          Trading Navigator
        </h3>
        <span className="text-xs text-text-muted">
          {(position.confidence * 100).toFixed(0)}% confidence
        </span>
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

        {/* Past: 1y ago, 6m ago (reds) */}
        {history && history.map((h, i) => {
          const hx = scoreToPct(h.growth_score);
          const hy = scoreToPct(-h.fed_policy_score);
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
          const fy = scoreToPct(-f.fed_policy_score);
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

        {/* Current position dot (gray) */}
        <div
          className="absolute h-3.5 w-3.5 rounded-full bg-zinc-400 border-2 border-zinc-500 shadow-[0_0_12px_rgba(113,113,122,0.5)] transition-all duration-700 ease-out z-10"
          style={{ left: `${dotX}%`, top: `${dotY}%`, transform: "translate(-50%, -50%)" }}
          title={`Now: Sentiment ${position.growth_score}, Fed ${position.fed_policy_score}`}
        />
      </div>

      {/* Score strip: Macro Sentiment (growth_score), FED Policy (fed_policy_score) */}
      <div className="mt-6 flex items-center justify-center gap-8 text-sm font-light">
        <div>
          <span className="text-text-muted">Macro Sentiment </span>
          <span className={position.growth_score >= 0 ? "text-accent-green" : "text-accent-red"}>
            {position.growth_score >= 0 ? "+" : ""}{position.growth_score.toFixed(2)}
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div>
          <span className="text-text-muted">FED Policy </span>
          <span className={position.fed_policy_score <= 0 ? "text-accent-green" : "text-accent-red"}>
            {position.fed_policy_score >= 0 ? "+" : ""}{position.fed_policy_score.toFixed(2)}
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div>
          <span className="text-text-muted">Direction </span>
          <span className="text-text-primary">{position.direction}</span>
        </div>
      </div>

      {/* Legend for dots */}
      {(history?.length || forward?.length) ? (
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
            Now
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
