"use client";

import { cn } from "@/lib/utils";

interface RadarKpiBarProps {
  currentPhase: string;
  phaseColor: string;
  cycleScore: number;
  recessionProb12m: number;
  fciScore: number | null;
  dataCoveragePct: number;
}

export function RadarKpiBar({
  currentPhase,
  phaseColor,
  cycleScore,
  recessionProb12m,
  fciScore,
  dataCoveragePct,
}: RadarKpiBarProps) {
  const cycleColor =
    cycleScore >= 20 ? "text-accent-green" : cycleScore >= -20 ? "text-accent-amber" : "text-accent-red";
  const recColor =
    recessionProb12m < 30 ? "text-accent-green" : recessionProb12m <= 50 ? "text-accent-amber" : "text-accent-red";
  const fciColor =
    fciScore === null
      ? "text-text-muted"
      : fciScore > 0.5
        ? "text-accent-red"
        : fciScore < -0.5
          ? "text-accent-green"
          : "text-accent-amber";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <div className="rounded-lg border border-border bg-bg-card px-4 py-3 min-h-[72px] flex flex-col justify-center">
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">Current Phase</div>
        <div className="text-base font-light capitalize" style={{ color: phaseColor }}>
          {currentPhase}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-bg-card px-4 py-3 min-h-[72px] flex flex-col justify-center">
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">Cycle Score</div>
        <div className={cn("text-lg font-light tabular-nums", cycleColor)}>
          {(cycleScore >= 0 ? "+" : "") + cycleScore.toFixed(0)}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-bg-card px-4 py-3 min-h-[72px] flex flex-col justify-center">
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">Recession Prob 12M</div>
        <div className={cn("text-lg font-light tabular-nums", recColor)}>
          {recessionProb12m.toFixed(0)}%
        </div>
      </div>
      <div className="rounded-lg border border-border bg-bg-card px-4 py-3 min-h-[72px] flex flex-col justify-center">
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">FCI Score</div>
        <div className={cn("text-lg font-light tabular-nums", fciColor)}>
          {fciScore != null ? `${(fciScore >= 0 ? "+" : "") + fciScore.toFixed(2)}σ` : "—"}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-bg-card px-4 py-3 min-h-[72px] flex flex-col justify-center">
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">Data Coverage</div>
        <div className="text-lg font-light tabular-nums text-accent-amber">
          {dataCoveragePct.toFixed(0)}%
        </div>
      </div>
    </div>
  );
}
