"use client";

import { cn } from "@/lib/utils";

interface NavigatorKpiBarProps {
  regimeLabel: string;
  regimeColor: "teal" | "blue" | "orange" | "red";
  growthScore: number;
  fedPolicyScore: number;
  confidencePct: number;
  cpiYoy: number | null;
  cpiMomDirection?: "up" | "down" | "flat";
}

const REGIME_COLORS: Record<string, string> = {
  teal: "text-emerald-400",
  blue: "text-blue-400",
  orange: "text-amber-400",
  red: "text-red-400",
};

export function NavigatorKpiBar({
  regimeLabel,
  regimeColor,
  growthScore,
  fedPolicyScore,
  confidencePct,
  cpiYoy,
  cpiMomDirection,
}: NavigatorKpiBarProps) {
  const cpiColor =
    cpiYoy === null
      ? "text-text-muted"
      : cpiYoy <= 2.5
        ? "text-accent-green"
        : cpiYoy <= 3.5
          ? "text-accent-amber"
          : "text-accent-red";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <div className="rounded-lg border border-border bg-bg-card px-4 py-3 min-h-[72px] flex flex-col justify-center">
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">Regime</div>
        <div className={cn("text-base font-light capitalize", REGIME_COLORS[regimeColor] || "text-text-primary")}>
          {regimeLabel}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-bg-card px-4 py-3 min-h-[72px] flex flex-col justify-center">
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">Growth Score</div>
        <div className={cn("text-lg font-light tabular-nums", growthScore >= 0 ? "text-accent-green" : "text-accent-red")}>
          {(growthScore >= 0 ? "+" : "") + growthScore.toFixed(2)}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-bg-card px-4 py-3 min-h-[72px] flex flex-col justify-center">
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">Fed Policy</div>
        <div className="text-lg font-light tabular-nums text-accent">
          {(fedPolicyScore >= 0 ? "+" : "") + fedPolicyScore.toFixed(2)}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-bg-card px-4 py-3 min-h-[72px] flex flex-col justify-center">
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">Confidence</div>
        <div className="text-lg font-light tabular-nums text-text-primary">
          {confidencePct.toFixed(0)}%
        </div>
      </div>
      <div className="rounded-lg border border-border bg-bg-card px-4 py-3 min-h-[72px] flex flex-col justify-center">
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">CPI YoY</div>
        <div className="flex items-center gap-1.5">
          <span className={cn("text-lg font-light tabular-nums", cpiColor)}>
            {cpiYoy !== null ? `${(cpiYoy >= 0 ? "+" : "") + cpiYoy.toFixed(1)}%` : "—"}
          </span>
          {cpiMomDirection === "up" && <span className="text-accent-red text-xs">↑</span>}
          {cpiMomDirection === "down" && <span className="text-accent-green text-xs">↓</span>}
          {cpiMomDirection === "flat" && <span className="text-text-muted text-xs">→</span>}
        </div>
      </div>
    </div>
  );
}
