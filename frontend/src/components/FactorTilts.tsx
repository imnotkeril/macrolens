"use client";

import type { FactorAllocation, AssetAllocation, TradingRecommendation } from "@/types";
import { cn, weightBadgeColor } from "@/lib/utils";

interface Props {
  factors: FactorAllocation[];
  allocation: AssetAllocation;
  tradingRecommendations?: TradingRecommendation[];
}

const ALLOC_SEGMENTS = [
  { key: "equities_pct", label: "Equities", color: "bg-accent-blue" },
  { key: "bonds_pct", label: "Bonds", color: "bg-accent-green" },
  { key: "commodities_pct", label: "Commodities", color: "bg-accent-amber" },
  { key: "gold_pct", label: "Gold", color: "bg-yellow-400" },
  { key: "cash_pct", label: "Cash", color: "bg-text-muted" },
] as const;

export function FactorTilts({ factors, allocation, tradingRecommendations }: Props) {
  return (
    <div className="card animate-fade-in">
      <div className="card-header">Recommended Tilts</div>

      <div className="space-y-2 mb-6">
        {factors.map((f) => (
          <div key={f.factor} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-light text-text-primary">{f.factor}</span>
              <span className={cn("badge text-[10px]", weightBadgeColor(f.weight))}>
                {f.weight}
              </span>
            </div>
            {f.tickers && f.tickers.length > 0 && (
              <span className="text-[10px] text-text-muted">
                {f.tickers.join(", ")}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="card-header">Asset Allocation</div>
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        {ALLOC_SEGMENTS.map((seg) => {
          const pct = allocation[seg.key as keyof AssetAllocation];
          if (pct <= 0) return null;
          return (
            <div
              key={seg.key}
              className={cn("rounded-full opacity-60", seg.color)}
              style={{ width: `${pct}%` }}
            />
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {ALLOC_SEGMENTS.map((seg) => {
          const pct = allocation[seg.key as keyof AssetAllocation];
          if (pct <= 0) return null;
          return (
            <div key={seg.key} className="flex items-center gap-1.5 text-[10px] text-text-muted">
              <span className={cn("h-1.5 w-1.5 rounded-full opacity-60", seg.color)} />
              {seg.label} {pct}%
            </div>
          );
        })}
      </div>

      {tradingRecommendations && tradingRecommendations.length > 0 && (
        <>
          <div className="card-header mt-6">Trading ideas</div>
          <ul className="space-y-2 text-sm font-light">
            {tradingRecommendations.map((t) => (
              <li key={t.name} className="flex flex-col gap-0.5">
                <span className="text-text-primary">{t.name}</span>
                <span className="text-[11px] text-accent font-mono">{t.legs}</span>
                <span className="text-[10px] text-text-muted">{t.description}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
