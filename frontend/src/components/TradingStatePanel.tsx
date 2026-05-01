"use client";

import type { TradingState } from "@/types";
import { cn } from "@/lib/utils";

interface TradingStatePanelProps {
  tradingState: TradingState;
}

const STATE_LABEL: Record<TradingState["state"], string> = {
  risk_on: "Risk On",
  neutral: "Neutral",
  defensive: "Defensive",
};

const VOL_LABEL: Record<TradingState["vol_regime"], string> = {
  low: "Low Vol",
  normal: "Normal Vol",
  high: "High Vol",
};

const MODE_LABEL: Record<TradingState["transition_mode"], string> = {
  fast_risk_off: "Fast Risk-Off",
  slow_risk_on: "Slow Risk-On",
  hold_neutral: "Hold Neutral",
};

const REASON_LABELS: Record<string, string> = {
  VOLATILITY_STRESS: "Volatility stress",
  CURVE_RECESSION_SIGNAL: "Curve recession signal",
  TIGHT_FINANCIAL_CONDITIONS: "Tight financial conditions",
  DOLLAR_STRENGTH: "Dollar strength",
  BALANCED_CROSS_ASSET_SIGNALS: "Balanced cross-asset signals",
};

export function TradingStatePanel({ tradingState }: TradingStatePanelProps) {
  const exposurePct = Math.max(0, Math.min(100, tradingState.target_exposure * 100));
  const scorePct = Math.max(0, Math.min(100, ((tradingState.score + 1) / 2) * 100));

  return (
    <div className="card mb-4">
      <div className="card-header">Trading State</div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "badge text-[10px]",
                tradingState.state === "risk_on" && "bg-accent-green/10 text-accent-green border-accent-green/20",
                tradingState.state === "defensive" && "bg-accent-red/10 text-accent-red border-accent-red/20",
                tradingState.state === "neutral" && "bg-accent-amber/10 text-accent-amber border-accent-amber/20"
              )}
            >
              {STATE_LABEL[tradingState.state]}
            </span>
            <span className="text-xs text-text-muted">{VOL_LABEL[tradingState.vol_regime]}</span>
          </div>
          <span className="text-xs text-text-secondary">{MODE_LABEL[tradingState.transition_mode]}</span>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] text-text-muted">
            <span>Target exposure</span>
            <span className="tabular-nums">{exposurePct.toFixed(0)}%</span>
          </div>
          <div className="h-2 rounded-full bg-bg-card border border-border overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                tradingState.state === "risk_on" && "bg-accent-green",
                tradingState.state === "defensive" && "bg-accent-red",
                tradingState.state === "neutral" && "bg-accent-amber"
              )}
              style={{ width: `${exposurePct}%` }}
            />
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] text-text-muted">
            <span>Composite score</span>
            <span className="tabular-nums">{tradingState.score.toFixed(2)}</span>
          </div>
          <div className="relative h-1 rounded-full bg-gradient-to-r from-accent-red via-text-muted to-accent-green">
            <div className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-full bg-white" style={{ left: `${scorePct}%` }} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {tradingState.reason_codes.slice(0, 3).map((code) => (
            <span key={code} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-text-muted">
              {REASON_LABELS[code] ?? code}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

