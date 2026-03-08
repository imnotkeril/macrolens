"use client";

import { cn } from "@/lib/utils";
import type { LightFCIComponent } from "@/types";

interface Props {
  score: number | null;
  gdpImpact: number | null;
  components: LightFCIComponent[];
}

const DIR_STYLE: Record<string, string> = {
  tightening: "text-accent-red",
  loosening: "text-accent-green",
  neutral: "text-text-muted",
};

export function LightFCICard({ score, gdpImpact, components }: Props) {
  if (score === null) {
    return (
      <div className="card">
        <div className="card-header">Light FCI (Financial Conditions)</div>
        <div className="py-6 text-center text-sm text-text-muted font-light">
          Insufficient data to compute FCI
        </div>
      </div>
    );
  }

  const fciColor =
    score > 0.5 ? "text-accent-red" :
    score < -0.5 ? "text-accent-green" : "text-accent-amber";

  return (
    <div className="card">
      <div className="card-header">Light FCI (Financial Conditions)</div>

      <div className="flex items-center gap-6 py-3">
        <div className="text-center">
          <div className={cn("text-3xl font-extralight tabular-nums", fciColor)}>
            {score >= 0 ? "+" : ""}{score.toFixed(2)}σ
          </div>
          <div className="text-xs text-text-muted mt-1">
            {score > 0.5 ? "Tight" : score < -0.5 ? "Easy" : "Neutral"}
          </div>
        </div>

        {gdpImpact !== null && (
          <div className="border-l border-border pl-6 text-center">
            <div className={cn(
              "text-2xl font-extralight tabular-nums",
              gdpImpact >= 0 ? "text-accent-green" : "text-accent-red",
            )}>
              {gdpImpact >= 0 ? "+" : ""}{gdpImpact.toFixed(1)} pp
            </div>
            <div className="text-xs text-text-muted mt-1">GDP impact (4Q)</div>
          </div>
        )}
      </div>

      {/* Component breakdown */}
      <div className="border-t border-border pt-3 space-y-1.5">
        {components.map((c) => (
          <div key={c.name} className="flex items-center justify-between text-xs">
            <div className="text-text-secondary font-light truncate max-w-[50%]">{c.name}</div>
            <div className="flex items-center gap-3">
              <span className="text-text-muted tabular-nums">
                {(c.weight * 100).toFixed(0)}%
              </span>
              <span className={cn(
                "tabular-nums font-medium w-14 text-right",
                c.z_score !== null ? DIR_STYLE[c.direction] : "text-text-muted",
              )}>
                {c.z_score !== null ? `${c.z_score >= 0 ? "+" : ""}${c.z_score.toFixed(2)}` : "N/A"}
              </span>
              <span className={cn(
                "text-[10px] capitalize w-16 text-right",
                DIR_STYLE[c.direction],
              )}>
                {c.direction}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
