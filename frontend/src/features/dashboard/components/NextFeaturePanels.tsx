"use client";

import type { ComponentType, CSSProperties } from "react";
import type { CategoryScore } from "@/types";

type Palette = {
  borderSoft: string;
  muted: string;
  soft: string;
  text: string;
  green: string;
};

type RecessionModelRow = { name: string; pct: number; dot: string };

type SharedDeps = {
  colors: Palette;
  panelStyle: CSSProperties;
  formatPercent: (value: number, digits?: number) => string;
  formatNumber: (value: number) => string;
  RiskSegmentDonutComponent: ComponentType<{ value: number }>;
  MacroSentimentSparkBlockComponent: ComponentType<{ values: number[] }>;
  MacroCategoryRowComponent: ComponentType<{ row: CategoryScore }>;
  FedPolicyScaleBarComponent: ComponentType<{ value: number }>;
  FedRateHistorySparkComponent: ComponentType<{ values: number[] }>;
};

export function RecessionMonitorSinglePanel({
  colors,
  panelStyle,
  recessionProbPct,
  recessionRisk,
  recessionModelRows,
  formatPercent,
  RiskSegmentDonutComponent,
}: SharedDeps & {
  recessionProbPct: number;
  recessionRisk: { label: string; color: string };
  recessionModelRows: RecessionModelRow[];
}) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" style={panelStyle}>
      <div className="shrink-0">
        <div className="text-[18px] uppercase leading-none tracking-[0.08em]">Recession Probability</div>
      </div>
      <div className="mt-3 grid shrink-0 items-start gap-2 border-b pb-3" style={{ borderColor: colors.borderSoft, gridTemplateColumns: "minmax(0,1fr) auto" }}>
        <div className="min-w-0">
          <div className="text-[24px] leading-none tabular-nums">{formatPercent(recessionProbPct, 0)}</div>
          <div className="mt-2 text-[13px] uppercase tracking-[0.08em]" style={{ color: recessionRisk.color }}>{recessionRisk.label}</div>
        </div>
        <RiskSegmentDonutComponent value={recessionProbPct} />
      </div>
      <div className="mt-3 flex min-h-0 flex-1 flex-col text-[11px]">
        <div className="mb-2 flex shrink-0 items-center justify-between pb-1 text-[10px] uppercase tracking-[0.1em]" style={{ color: colors.muted }}>
          <span>Model</span>
          <span>Probability</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
          {recessionModelRows.map((row) => (
            <div key={row.name} className="flex items-center justify-between gap-2 py-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: row.dot }} />
                <span className="min-w-0 truncate text-[11px]" style={{ color: colors.soft }}>{row.name}</span>
              </div>
              <span className="shrink-0 text-[11px] tabular-nums" style={{ color: colors.text }}>{formatPercent(row.pct, 0)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MacroSentimentSinglePanel({
  colors,
  panelStyle,
  cycleScore,
  macroSentimentSeries,
  categories,
  formatNumber,
  MacroSentimentSparkBlockComponent,
  MacroCategoryRowComponent,
}: SharedDeps & {
  cycleScore: number;
  macroSentimentSeries: number[];
  categories: CategoryScore[];
}) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" style={panelStyle}>
      <div className="mb-1 text-[18px] uppercase leading-none tracking-[0.08em]">Macro Sentiment Score</div>
      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <div className="flex h-[92px] shrink-0 items-start gap-3 overflow-hidden">
          <div className="shrink-0">
            <div className="text-[24px] leading-none tabular-nums">{formatNumber(cycleScore)}</div>
            <div className="mt-2 text-[13px] uppercase tracking-[0.08em]" style={{ color: colors.green }}>Z-score</div>
          </div>
          <div className="min-h-0 min-w-0 flex-1 self-start">
            <MacroSentimentSparkBlockComponent values={macroSentimentSeries} />
          </div>
        </div>
        <div className="mt-3 flex min-h-0 flex-1 flex-col border-t pt-2 text-[11px]" style={{ borderColor: colors.borderSoft }}>
          <div className="min-h-0 flex-1 space-y-0 overflow-y-auto overflow-x-hidden overscroll-contain pr-0.5">
            {categories.map((row) => (
              <MacroCategoryRowComponent key={row.category} row={row} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FedPolicySinglePanel({
  colors,
  panelStyle,
  fedPolicy,
  fedStance,
  fedRateSeries,
  rateDirection,
  balanceSheetDirection,
  formatNumber,
  FedPolicyScaleBarComponent,
  FedRateHistorySparkComponent,
}: SharedDeps & {
  fedPolicy: number;
  fedStance: string;
  fedRateSeries: number[];
  rateDirection: string;
  balanceSheetDirection: string;
}) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" style={panelStyle}>
      <div className="mb-1 text-[18px] uppercase leading-none tracking-[0.08em]">Fed Policy Score</div>
      <div className="mt-2 grid min-w-0 shrink-0 items-start gap-y-0 overflow-hidden" style={{ gridTemplateColumns: "minmax(78px,auto) minmax(0,1fr)" }}>
        <div className="min-w-0">
          <div className="text-[24px] leading-none tabular-nums">{formatNumber(fedPolicy)}</div>
          <div className="mt-2 text-[13px] uppercase tracking-[0.08em]" style={{ color: colors.green }}>{fedStance}</div>
        </div>
        <div className="min-w-0 px-1 py-0.5">
          <FedPolicyScaleBarComponent value={fedPolicy ?? 0} />
        </div>
        <div className="col-span-2 mt-2 border-t pt-3" style={{ borderColor: colors.borderSoft }}>
          <div className="grid min-w-0 items-start" style={{ gridTemplateColumns: "minmax(78px,auto) minmax(0,1fr)" }}>
            <div className="min-w-0">
              <div className="leading-tight text-[10px] uppercase tracking-[0.06em]" style={{ color: colors.soft }}>
                <div>Fed Funds</div>
                <div>Rate</div>
              </div>
            </div>
            <div className="min-w-0 pl-1 pt-0.5">
              <FedRateHistorySparkComponent values={fedRateSeries} />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-auto flex shrink-0 flex-col border-t pt-3 text-[11px] uppercase tracking-[0.06em]" style={{ color: colors.soft, borderColor: colors.borderSoft }}>
        <div className="flex items-center justify-between py-2">
          <span>Rate direction</span>
          <span style={{ color: colors.text }}>{rateDirection}</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span>Balance sheet</span>
          <span style={{ color: colors.text }}>{balanceSheetDirection}</span>
        </div>
      </div>
    </div>
  );
}
