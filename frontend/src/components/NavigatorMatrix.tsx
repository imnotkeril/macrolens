"use client";

import type { NavigatorPosition } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  position: NavigatorPosition;
  history?: NavigatorPosition[];
  forward?: NavigatorPosition[];
  large?: boolean;
  ensembleCaption?: string | null;
  ensembleMix?: { growth: number; fed: number } | null;
  className?: string;
  title?: string;
}

// Grid order: TL Growth (blue), TR Risk On (green), BL Risk Off (red), BR Value (yellow) — UI spec
const QUADRANTS = [
  {
    key: "Q2_REFLATION",
    label: "GROWTH",
    labelClass: "text-[#4F8DF7]",
    bg: "bg-[#4F8DF7]/10",
    border: "border-[#4F8DF7]/20",
    pos: "rounded-tl-[10px]",
  },
  {
    key: "Q1_GOLDILOCKS",
    label: "Risk ON",
    labelClass: "text-[#49D17D]",
    bg: "bg-[#49D17D]/10",
    border: "border-[#49D17D]/20",
    pos: "rounded-tr-[10px]",
  },
  {
    key: "Q4_STAGFLATION",
    label: "Risk OFF",
    labelClass: "text-[#FF5C5C]",
    bg: "bg-[#FF5C5C]/10",
    border: "border-[#FF5C5C]/20",
    pos: "rounded-bl-[10px]",
  },
  {
    key: "Q3_OVERHEATING",
    label: "VALUE",
    labelClass: "text-[#F2C94C]",
    bg: "bg-[#F2C94C]/10",
    border: "border-[#F2C94C]/20",
    pos: "rounded-br-[10px]",
  },
] as const;

// History: API order [6m, 1y] typical — colors per spec chart palette
const HISTORY_DOTS = [
  { fill: "#A78BFA", border: "#C4B5FD", label: "6m ago" },
  { fill: "#5DA9FF", border: "#93C5FD", label: "1y ago" },
];
const FORWARD_DOTS = [
  { fill: "#63E39A", border: "#86EFAC", label: "6m fwd" },
  { fill: "#F2C94C", border: "#FDE047", label: "1y fwd" },
];

function scoreToPct(score: number) {
  return ((score + 2) / 4) * 100;
}

function fedToPlotY(fed: number) {
  return scoreToPct(fed);
}

function toPoint(p: { growth_score: number; fed_policy_score: number }) {
  return { x: scoreToPct(p.growth_score), y: fedToPlotY(p.fed_policy_score) };
}

export function NavigatorMatrix({
  position,
  history,
  forward,
  large,
  ensembleCaption,
  ensembleMix,
  className,
  title = "Macro Navigator",
}: Props) {
  const dotX = scoreToPct(position.growth_score);
  const dotY = fedToPlotY(position.fed_policy_score);
  const ensG = position.ensemble_growth_score;
  const ensF = position.ensemble_fed_policy_score;
  const hasEnsNow = ensG != null && ensF != null;
  const purpleG = ensembleMix != null ? ensembleMix.growth : ensG;
  const purpleF = ensembleMix != null ? ensembleMix.fed : ensF;
  const h6m = history?.[0] ? toPoint(history[0]) : null;
  const h1y = history?.[1] ? toPoint(history[1]) : null;
  const f6m = forward?.[0] ? toPoint(forward[0]) : null;
  const f1y = forward?.[1] ? toPoint(forward[1]) : null;

  const axisMuted = "text-[#6F7782]";

  return (
    <div className={cn("animate-fade-in", className ?? "card")}>
      <div className="mb-4 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-sans text-sm font-semibold uppercase tracking-[0.08em] text-[#E6E8EA]">
              {title}
            </h3>
            {ensembleCaption ? (
              <p className="mt-1 text-[11px] leading-snug text-[#9AA1A9]">{ensembleCaption}</p>
            ) : (
              <p className={cn("mt-1 text-[11px]", axisMuted)}>Click dots for details</p>
            )}
          </div>
          <span className="shrink-0 text-[11px] tabular-nums text-[#9AA1A9]">
            {(position.confidence * 100).toFixed(0)}% confidence
          </span>
        </div>
        {position.matrix_quadrant && position.matrix_quadrant !== position.quadrant ? (
          <p className="text-[10px] text-[#F2994A]">
            Matrix: {position.matrix_quadrant.replace(/_/g, " ")} · Regime:{" "}
            {position.quadrant.replace(/_/g, " ")}
          </p>
        ) : null}
      </div>

      <div className={cn("relative mx-auto w-full", large ? "h-[320px]" : "h-56")}>
        {/* Axis numeric ticks */}
        <div className={cn("absolute -top-3 left-1/2 z-10 -translate-x-1/2 text-[10px] tabular-nums", axisMuted)}>
          +1
        </div>
        <div className={cn("absolute -bottom-3 left-1/2 z-10 -translate-x-1/2 text-[10px] tabular-nums", axisMuted)}>
          -1
        </div>
        <div className={cn("absolute left-0 top-1/2 z-10 -translate-x-full -translate-y-1/2 pr-1 text-[10px] tabular-nums", axisMuted)}>
          -1
        </div>
        <div className={cn("absolute right-0 top-1/2 z-10 translate-x-full -translate-y-1/2 pl-1 text-[10px] tabular-nums", axisMuted)}>
          +1
        </div>

        <div className={cn("absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-medium uppercase tracking-wider", axisMuted)}>
          Fed policy (easy)
        </div>
        <div className={cn("absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-medium uppercase tracking-wider", axisMuted)}>
          Fed policy (tight)
        </div>
        <div className={cn("absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[calc(100%+8px)] text-center text-[10px] font-medium uppercase leading-tight tracking-wider", axisMuted)}>
          Macro
          <br />
          sentiment (−)
        </div>
        <div className={cn("absolute right-0 top-1/2 -translate-y-1/2 translate-x-[calc(100%+8px)] text-center text-[10px] font-medium uppercase leading-tight tracking-wider", axisMuted)}>
          Macro
          <br />
          sentiment (+)
        </div>

        <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-[10px] border border-[#23282F] bg-[#23282F]">
          {QUADRANTS.map((q) => (
            <div
              key={q.key}
              className={cn(
                "flex flex-col items-center justify-center border transition-colors duration-300",
                q.bg,
                q.border,
                q.pos,
                position.quadrant === q.key && "ring-1 ring-white/15"
              )}
            >
              <span className={cn("text-xs font-bold uppercase tracking-[0.06em]", q.labelClass)}>
                {q.label}
              </span>
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 rounded-[10px] border border-transparent">
          <div className="absolute inset-y-0 left-1/2 w-px bg-[#23282F]" />
          <div className="absolute inset-x-0 top-1/2 h-px bg-[#23282F]" />
        </div>

        {/* Connecting trajectories */}
        <svg className="pointer-events-none absolute inset-0 z-[9] h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {h1y && h6m ? (
            <line x1={h1y.x} y1={h1y.y} x2={h6m.x} y2={h6m.y} stroke="#5DA9FF" strokeWidth="0.5" strokeDasharray="2 1.4" />
          ) : null}
          {h6m ? (
            <line x1={h6m.x} y1={h6m.y} x2={dotX} y2={dotY} stroke="#A78BFA" strokeWidth="0.5" strokeDasharray="2 1.4" />
          ) : null}
          {f6m ? (
            <line x1={dotX} y1={dotY} x2={f6m.x} y2={f6m.y} stroke="#63E39A" strokeWidth="0.5" strokeDasharray="2 1.4" />
          ) : null}
          {f6m && f1y ? (
            <line x1={f6m.x} y1={f6m.y} x2={f1y.x} y2={f1y.y} stroke="#F2C94C" strokeWidth="0.5" strokeDasharray="2 1.4" />
          ) : null}
        </svg>

        {history &&
          history.map((h, i) => {
            const hx = scoreToPct(h.growth_score);
            const hy = fedToPlotY(h.fed_policy_score);
            const dotCfg = HISTORY_DOTS[i] ?? HISTORY_DOTS[0];
            return (
              <div key={`past-${h.date}-${i}`} className="absolute z-10 opacity-90 transition-all duration-500" style={{ left: `${hx}%`, top: `${hy}%`, transform: "translate(-50%, -50%)" }}>
                <div className="h-3 w-3 rounded-full border-2" style={{ backgroundColor: dotCfg.fill, borderColor: dotCfg.border }} />
              </div>
            );
          })}

        {forward &&
          forward.map((f, i) => {
            const fx = scoreToPct(f.growth_score);
            const fy = fedToPlotY(f.fed_policy_score);
            const dotCfg = FORWARD_DOTS[i] ?? FORWARD_DOTS[0];
            return (
              <div
                key={`fwd-${f.quadrant_label}-${i}`}
                className="absolute z-10 opacity-80 transition-all duration-500"
                style={{ left: `${fx}%`, top: `${fy}%`, transform: "translate(-50%, -50%)" }}
                title={`${dotCfg.label}: Sentiment ${f.growth_score}, Fed ${f.fed_policy_score}`}
              >
                <div
                  className="h-3 w-3 rounded-full border-2"
                  style={{ backgroundColor: dotCfg.fill, borderColor: dotCfg.border }}
                />
              </div>
            );
          })}

        {hasEnsNow && purpleG != null && purpleF != null ? (
          <div
            className="absolute z-[21] h-3 w-3 rounded-full border-2 border-[#E9D5FF] opacity-90 shadow-[0_0_0_3px_rgba(167,139,250,0.35)] transition-all duration-700 ease-out"
            style={{
              left: `${scoreToPct(purpleG)}%`,
              top: `${fedToPlotY(purpleF)}%`,
              transform: "translate(-50%, -50%)",
              backgroundColor: "#A78BFA",
            }}
            title="Forecast Lab ensemble"
          />
        ) : null}

        <div
          className="absolute z-20 h-3 w-3 rounded-full border-2 border-[#E6E8EA] shadow-[0_0_0_4px_rgba(230,232,234,0.25)] transition-all duration-700 ease-out"
          style={{
            left: `${dotX}%`,
            top: `${dotY}%`,
            transform: "translate(-50%, -50%)",
            backgroundColor: "#E6E8EA",
          }}
          title={`Now: Sentiment ${position.growth_score}, Fed ${position.fed_policy_score}`}
        />

        <div className="absolute z-20 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#111417]" style={{ left: `${dotX + 2}%`, top: `${dotY - 2}%` }}>
          NOW
        </div>

        {h6m ? (
          <div className="absolute z-20 text-[10px] font-semibold uppercase text-[#A78BFA]" style={{ left: `${h6m.x - 4}%`, top: `${h6m.y - 7}%` }}>
            6M AGO
          </div>
        ) : null}
        {h1y ? (
          <div className="absolute z-20 text-[10px] font-semibold uppercase text-[#5DA9FF]" style={{ left: `${h1y.x + 2}%`, top: `${h1y.y - 1}%` }}>
            1Y AGO
          </div>
        ) : null}
        {f6m ? (
          <div className="absolute z-20 text-[10px] font-semibold uppercase text-[#63E39A]" style={{ left: `${f6m.x + 3}%`, top: `${f6m.y - 2}%` }}>
            6M AHEAD
          </div>
        ) : null}
        {f1y ? (
          <div className="absolute z-20 text-[10px] font-semibold uppercase text-[#F2C94C]" style={{ left: `${f1y.x + 3}%`, top: `${f1y.y - 2}%` }}>
            1Y AHEAD
          </div>
        ) : null}
      </div>

      {(history?.length || forward?.length || hasEnsNow) ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] text-[#9AA1A9]">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-[#C4B5FD]" style={{ backgroundColor: "#A78BFA" }} />
            6m ago
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-[#93C5FD]" style={{ backgroundColor: "#5DA9FF" }} />
            1y ago
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-[#E6E8EA]" style={{ backgroundColor: "#E6E8EA" }} />
            Now (axes)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-[#E9D5FF]" style={{ backgroundColor: "#A78BFA" }} />
            FL ensemble
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-[#86EFAC]" style={{ backgroundColor: "#63E39A" }} />
            6m fwd
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-[#FDE047]" style={{ backgroundColor: "#F2C94C" }} />
            1y fwd
          </span>
        </div>
      ) : null}
    </div>
  );
}
