"use client";

import { cn } from "@/lib/utils";
import type { CrossAssetSignal } from "@/types";

interface RiskOnOffPanelProps {
  /** Composite score -2 (Risk Off) to +2 (Risk On), 0 = neutral */
  compositeScore: number;
  label: string;
  /** Four component rows: name, direction text, arrow, color */
  components: { name: string; direction: string; arrow: "up" | "down" | "flat"; signal: "risk_on" | "risk_off" | "neutral" }[];
}

export function RiskOnOffPanel({ compositeScore, label, components }: RiskOnOffPanelProps) {
  // Map composite -2..+2 to 0..100% for needle
  const pct = Math.min(100, Math.max(0, ((compositeScore + 2) / 4) * 100));

  return (
    <div className="card h-full flex flex-col">
      <div className="card-header">Risk On / Risk Off Composite</div>
      <div className="flex-1 flex flex-col gap-4">
        <div className="text-sm font-light text-text-primary">{label}</div>
        <div className="relative h-2 rounded-full overflow-hidden bg-gradient-to-r from-red-600 via-gray-500 to-emerald-600">
          <div
            className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-white shadow-lg transition-all duration-300 z-10"
            style={{ left: `${pct}%`, transform: `translate(-50%, -50%)` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-text-muted">
          <span>Risk Off</span>
          <span>Risk On</span>
        </div>
        <div className="space-y-2 mt-2">
          {components.map((c, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-text-secondary font-light">{c.name}</span>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "font-light",
                    c.signal === "risk_on" && "text-accent-green",
                    c.signal === "risk_off" && "text-accent-red",
                    c.signal === "neutral" && "text-accent-amber"
                  )}
                >
                  {c.direction}
                </span>
                <span className="text-text-muted">
                  {c.arrow === "up" && "↑"}
                  {c.arrow === "down" && "↓"}
                  {c.arrow === "flat" && "→"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
