"use client";

import type { CrossAssetSignal } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  signals: CrossAssetSignal[];
}

const SIGNAL_COLORS: Record<string, string> = {
  bullish: "text-accent-green",
  bearish: "text-accent-red",
  neutral: "text-accent-amber",
};

const SIGNAL_DOT: Record<string, string> = {
  bullish: "bg-accent-green",
  bearish: "bg-accent-red",
  neutral: "bg-accent-amber",
};

export function CrossAssetPanel({ signals }: Props) {
  return (
    <div className="card animate-fade-in">
      <div className="card-header">Cross-Asset Signals</div>
      <div className="space-y-2.5">
        {signals.map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between rounded-lg border border-border bg-bg-card px-3 py-2.5"
          >
            <div className="flex items-center gap-2.5">
              <div className={cn("h-1.5 w-1.5 rounded-full", SIGNAL_DOT[s.signal])} />
              <span className="text-sm font-light text-text-primary">{s.name}</span>
            </div>
            <div className="flex items-center gap-3">
              {s.value !== null && (
                <span className="text-xs tabular-nums text-text-muted">
                  {s.value >= 0 ? "+" : ""}{s.value.toFixed(1)}
                </span>
              )}
              <span className={cn("text-[10px] font-medium uppercase tracking-wider", SIGNAL_COLORS[s.signal])}>
                {s.signal}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
