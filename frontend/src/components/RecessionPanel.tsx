"use client";

import { cn } from "@/lib/utils";
import type { RecessionModelResult, CycleDriverContribution } from "@/types";

interface Props {
  probability: number;
  models: RecessionModelResult[];
  drivers: CycleDriverContribution[];
}

export function RecessionPanel({ probability, models, drivers }: Props) {
  const probColor =
    probability < 20 ? "text-accent-green" :
    probability < 40 ? "text-accent-amber" : "text-accent-red";

  const probBg =
    probability < 20 ? "bg-accent-green/10 border-accent-green/20" :
    probability < 40 ? "bg-accent-amber/10 border-accent-amber/20" :
    "bg-accent-red/10 border-accent-red/20";

  // Gauge bar width
  const barWidth = Math.min(100, Math.max(0, probability));

  const top3 = drivers.slice(0, 3);

  return (
    <div className="card">
      <div className="card-header">Recession Probability 12M</div>

      {/* Main probability gauge */}
      <div className="flex flex-col items-center py-4">
        <div className={cn("text-5xl font-extralight tabular-nums", probColor)}>
          {probability.toFixed(0)}%
        </div>
        <div className="mt-3 w-full max-w-xs">
          <div className="h-2 w-full rounded-full bg-surface-lighter overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${barWidth}%`,
                background: probability < 20 ? "#10b981" : probability < 40 ? "#f59e0b" : "#ef4444",
              }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-text-muted">
            <span>0%</span>
            <span>20%</span>
            <span>40%</span>
            <span>60%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Three models */}
      <div className="space-y-2 border-t border-border pt-3">
        <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
          Model Breakdown
        </div>
        {models.map((m) => {
          const mc = m.probability < 20 ? "text-accent-green" :
            m.probability < 40 ? "text-accent-amber" : "text-accent-red";
          return (
            <div key={m.name} className="flex items-center justify-between text-sm">
              <div className="text-text-secondary font-light">{m.name}</div>
              <div className={cn("font-medium tabular-nums", mc)}>
                {m.probability.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Key Drivers (SHAP-style) */}
      <div className="mt-4 border-t border-border pt-3">
        <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
          Key Drivers
        </div>
        {top3.map((d) => (
          <div key={d.name} className="flex items-center justify-between text-sm py-1">
            <div className="text-text-secondary font-light truncate max-w-[60%]">{d.name}</div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "tabular-nums font-medium",
                d.direction === "positive" ? "text-accent-green" :
                d.direction === "negative" ? "text-accent-red" : "text-text-muted",
              )}>
                {d.contribution >= 0 ? "+" : ""}{d.contribution.toFixed(1)} pp
              </span>
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded border",
                d.direction === "positive"
                  ? "bg-accent-green/10 text-accent-green border-accent-green/20"
                  : d.direction === "negative"
                  ? "bg-accent-red/10 text-accent-red border-accent-red/20"
                  : "bg-surface-lighter text-text-muted border-border",
              )}>
                {d.direction === "positive" ? "+" : d.direction === "negative" ? "−" : "="}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
