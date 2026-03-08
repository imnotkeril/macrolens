"use client";

import { cn } from "@/lib/utils";
import type { PhaseTransitionSignal } from "@/types";

interface Props {
  signals: PhaseTransitionSignal[];
}

const STATUS_ICON: Record<string, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
};

const STATUS_BADGE: Record<string, string> = {
  green: "bg-accent-green/10 text-accent-green border-accent-green/20",
  yellow: "bg-accent-amber/10 text-accent-amber border-accent-amber/20",
  red: "bg-accent-red/10 text-accent-red border-accent-red/20",
};

export function PhaseSignals({ signals }: Props) {
  const redCount = signals.filter((s) => s.status === "red").length;
  const yellowCount = signals.filter((s) => s.status === "yellow").length;

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="card-header">Phase Transition Signals</div>
        <div className="flex gap-2 text-xs">
          {redCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-accent-red/10 text-accent-red border border-accent-red/20">
              {redCount} alert{redCount > 1 ? "s" : ""}
            </span>
          )}
          {yellowCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-accent-amber/10 text-accent-amber border border-accent-amber/20">
              {yellowCount} caution
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-muted text-xs uppercase tracking-wider border-b border-border">
              <th className="pb-2 text-left font-medium">Signal</th>
              <th className="pb-2 text-right font-medium">Current</th>
              <th className="pb-2 text-right font-medium">Threshold</th>
              <th className="pb-2 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s, i) => (
              <tr
                key={s.name}
                className={cn(
                  "border-b border-border/50 hover:bg-surface-lighter/50 transition-colors",
                  s.status === "red" && "bg-accent-red/5",
                )}
              >
                <td className="py-2.5 pr-4">
                  <div className="text-text-primary font-light">{s.name}</div>
                  <div className="text-[11px] text-text-muted mt-0.5 max-w-[250px] truncate">
                    {s.description}
                  </div>
                </td>
                <td className="py-2.5 text-right tabular-nums font-medium text-text-primary whitespace-nowrap">
                  {s.current_value}
                </td>
                <td className="py-2.5 text-right text-text-muted text-xs whitespace-nowrap">
                  {s.threshold}
                </td>
                <td className="py-2.5 text-center">
                  <span className={cn(
                    "inline-flex items-center justify-center px-2 py-0.5 rounded text-xs border",
                    STATUS_BADGE[s.status],
                  )}>
                    {s.status === "green" ? "OK" : s.status === "yellow" ? "Watch" : "Alert"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
