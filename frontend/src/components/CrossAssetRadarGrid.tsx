"use client";

import { cn } from "@/lib/utils";
import type { CrossAssetSignal, CrossAssetRadarCell } from "@/types";

/** 5 columns × 4 rows in spec order. Names match API cell names. */
const GRID_ORDER = [
  ["Yield Curve 2s10s", "Real Yields 10Y TIPS", "Nominal 10Y Yield", "Credit Spreads HY OAS", "Financial Conditions Index"],
  ["VIX", "DXY", "Fed Balance Sheet Trend", "Junk vs IG", "Equity Put/Call Ratio"],
  ["Gold", "Oil", "Copper", "Broad Commodities Index", "EM vs DM"],
  ["Small Cap vs Large Cap", "Growth vs Value", "High Beta vs Low Beta", "Cyclicals vs Defensives", "EPS Revisions Breadth"],
];

/** Map API signal names to grid labels (fallback when cells not used). */
const NAME_ALIAS: Record<string, string> = {
  "Yield Curve (2Y10Y)": "Yield Curve 2s10s",
  "10Y Real Yield": "Real Yields 10Y TIPS",
  "Gold": "Gold",
  "Dollar (DXY)": "DXY",
  "Copper": "Copper",
  "VIX": "VIX",
};

interface Props {
  /** Preferred: all 20 cells from /api/market/cross-asset-radar (same data as macro overview). */
  cells?: CrossAssetRadarCell[] | null;
  /** Fallback: navigator cross-asset signals (only 6 filled). */
  signals?: CrossAssetSignal[];
}

const CELL_BG: Record<string, string> = {
  bullish: "bg-accent-green/15 border-accent-green/30",
  bearish: "bg-accent-red/15 border-accent-red/30",
  neutral: "bg-accent-amber/10 border-accent-amber/20",
};

function findCell(cells: CrossAssetRadarCell[], gridLabel: string): CrossAssetRadarCell | null {
  return cells.find((c) => c.name === gridLabel) ?? null;
}

function findSignal(signals: CrossAssetSignal[], gridLabel: string): CrossAssetSignal | null {
  const byAlias = signals.find((s) => NAME_ALIAS[s.name] === gridLabel);
  if (byAlias) return byAlias;
  return signals.find((s) => s.name === gridLabel) || null;
}

export function CrossAssetRadarGrid({ cells, signals = [] }: Props) {
  const labels = GRID_ORDER.flat();
  return (
    <div className="card">
      <div className="card-header">Cross-Asset Radar</div>
      <div className="grid grid-cols-5 gap-px">
        {labels.map((label, idx) => {
          const cell = cells?.length ? findCell(cells, label) : null;
          const sig = !cell ? findSignal(signals, label) : null;
          const signalType = cell?.signal ?? sig?.signal ?? "neutral";
          const bg = (cell ?? sig) ? CELL_BG[signalType] : "bg-bg-card border-border";
          let value: string;
          let unit: string;
          if (cell) {
            value = cell.value != null ? (cell.value >= 0 ? "+" : "") + cell.value : "—";
            unit = cell.unit ?? "";
          } else {
            value = sig?.value != null ? (sig.value >= 0 ? "+" : "") + sig.value : "—";
            unit = label.includes("Yield") || label.includes("10Y") ? "%" : label.includes("Spread") ? "bp" : "";
          }
          return (
            <div
              key={idx}
              className={cn(
                "rounded-sm border p-3 min-h-[72px] flex flex-col justify-between",
                bg
              )}
            >
              <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted leading-tight">
                {label}
              </div>
              <div className="text-sm font-light tabular-nums text-text-primary mt-1">
                {value}
                {unit}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
