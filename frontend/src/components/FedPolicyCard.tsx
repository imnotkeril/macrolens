"use client";

import type { FedPolicyStatus } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  status: FedPolicyStatus;
}

const STANCE_COLORS: Record<string, string> = {
  very_easy: "text-accent-green",
  easy: "text-accent-green/80",
  neutral: "text-accent-amber",
  tight: "text-accent-red/80",
  very_tight: "text-accent-red",
};

const STANCE_LABELS: Record<string, string> = {
  very_easy: "Very Easy",
  easy: "Easy",
  neutral: "Neutral",
  tight: "Tight",
  very_tight: "Very Tight",
};

export function FedPolicyCard({ status }: Props) {
  const pct = ((status.policy_score + 2) / 4) * 100;

  return (
    <div className="card animate-fade-in">
      <div className="card-header">Fed Policy</div>

      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <span className="text-text-muted text-sm font-light">Target Rate</span>
          <span className="text-2xl font-extralight tabular-nums text-text-primary">
            {status.current_rate_lower.toFixed(2)}&ndash;{status.current_rate_upper.toFixed(2)}%
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-bg-card p-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Stance</div>
            <div className={cn("text-sm font-medium", STANCE_COLORS[status.stance])}>
              {STANCE_LABELS[status.stance] || status.stance}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-bg-card p-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Rate</div>
            <div className="text-sm font-light text-text-primary capitalize">{status.rate_direction}</div>
          </div>
          <div className="rounded-lg border border-border bg-bg-card p-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Balance</div>
            <div className="text-sm font-light text-text-primary">
              {status.balance_sheet_direction === "expanding" ? "QE"
                : status.balance_sheet_direction === "shrinking" ? "QT" : "Stable"}
            </div>
          </div>
        </div>

        {/* Policy gauge */}
        <div className="pt-2">
          <div className="flex items-center justify-between text-[10px] text-text-muted mb-2">
            <span>Very Easy</span>
            <span className="text-accent font-medium">{status.policy_score.toFixed(2)}</span>
            <span>Very Tight</span>
          </div>
          <div className="relative h-1 rounded-full bg-bg-elevated">
            <div
              className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-accent glow-dot transition-all duration-500"
              style={{ left: `${pct}%`, transform: `translate(-50%, -50%)` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
