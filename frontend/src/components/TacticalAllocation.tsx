"use client";

import { cn } from "@/lib/utils";
import type { TacticalAllocationRow, ExpectedReturn } from "@/types";

interface Props {
  allocation: TacticalAllocationRow[];
  expectedReturns: ExpectedReturn[];
  currentPhase: string;
}

const WEIGHT_STYLE: Record<string, string> = {
  overweight: "bg-accent-green/15 text-accent-green",
  neutral: "bg-surface-lighter text-text-muted",
  underweight: "bg-accent-red/15 text-accent-red",
};

const PHASE_HIGHLIGHT: Record<string, string> = {
  recovery: "Recovery",
  expansion: "Expansion",
  slowdown: "Slowdown",
  contraction: "Contraction",
};

function WeightCell({ weight, highlight }: { weight: string; highlight?: boolean }) {
  return (
    <td className={cn(
      "py-2 px-2 text-center text-xs font-medium capitalize",
      WEIGHT_STYLE[weight],
      highlight && "ring-1 ring-accent-blue/50 rounded",
    )}>
      {weight === "overweight" ? "OW" : weight === "underweight" ? "UW" : "N"}
    </td>
  );
}

export function TacticalAllocation({ allocation, expectedReturns, currentPhase }: Props) {
  return (
    <div className="card">
      <div className="card-header">Tactical Asset Allocation by Cycle Phase</div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-muted text-xs uppercase tracking-wider border-b border-border">
              <th className="pb-2 text-left font-medium">Asset Class</th>
              {["recovery", "expansion", "slowdown", "contraction"].map((p) => (
                <th
                  key={p}
                  className={cn(
                    "pb-2 text-center font-medium",
                    currentPhase === p && "text-accent-blue",
                  )}
                >
                  {PHASE_HIGHLIGHT[p]}
                </th>
              ))}
              <th className="pb-2 text-center font-medium text-accent-blue">Current</th>
            </tr>
          </thead>
          <tbody>
            {allocation.map((row) => (
              <tr key={row.asset_class} className="border-b border-border/30">
                <td className="py-2 pr-3 text-text-primary font-light whitespace-nowrap">
                  {row.asset_class}
                </td>
                <WeightCell weight={row.recovery} highlight={currentPhase === "recovery"} />
                <WeightCell weight={row.expansion} highlight={currentPhase === "expansion"} />
                <WeightCell weight={row.slowdown} highlight={currentPhase === "slowdown"} />
                <WeightCell weight={row.contraction} highlight={currentPhase === "contraction"} />
                <td className="py-2 px-2 text-center">
                  <span className={cn(
                    "inline-block px-2 py-0.5 rounded text-xs font-medium capitalize border",
                    row.current_signal === "overweight"
                      ? "bg-accent-green/10 text-accent-green border-accent-green/20"
                      : row.current_signal === "underweight"
                      ? "bg-accent-red/10 text-accent-red border-accent-red/20"
                      : "bg-surface-lighter text-text-muted border-border",
                  )}>
                    {row.current_signal === "overweight" ? "OW" :
                     row.current_signal === "underweight" ? "UW" : "N"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expected Returns */}
      {expectedReturns.length > 0 && (
        <div className="mt-5 border-t border-border pt-3">
          <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
            Expected Returns (Current Phase)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-xs uppercase tracking-wider border-b border-border">
                  <th className="pb-2 text-left font-medium">Asset</th>
                  <th className="pb-2 text-right font-medium">Avg Return</th>
                  <th className="pb-2 text-right font-medium">Sharpe</th>
                  <th className="pb-2 text-right font-medium">Beta to Cycle</th>
                </tr>
              </thead>
              <tbody>
                {expectedReturns.map((r) => (
                  <tr key={r.asset_class} className="border-b border-border/30">
                    <td className="py-1.5 text-text-primary font-light">{r.asset_class}</td>
                    <td className={cn(
                      "py-1.5 text-right tabular-nums font-medium",
                      r.avg_return >= 0 ? "text-accent-green" : "text-accent-red",
                    )}>
                      {r.avg_return >= 0 ? "+" : ""}{r.avg_return.toFixed(1)}%
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-text-secondary">
                      {r.sharpe.toFixed(2)}
                    </td>
                    <td className={cn(
                      "py-1.5 text-right tabular-nums",
                      r.beta_to_cycle >= 0 ? "text-accent-green" : "text-accent-amber",
                    )}>
                      {r.beta_to_cycle >= 0 ? "+" : ""}{r.beta_to_cycle.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-3 text-[10px] text-text-muted italic">
        Historical patterns, not investment advice. Past cycle returns do not guarantee future results.
      </div>
    </div>
  );
}
