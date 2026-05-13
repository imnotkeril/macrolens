"use client";

import Link from "next/link";
import { useMemo, type CSSProperties, type ComponentType } from "react";
import type { NextShellThemeContextValue } from "@/components/next-dashboard/nextShellTheme";
import { YieldCurveSnapshotCard } from "@/components/next-dashboard/yield-curve/YieldCurveSnapshotCard";
import type { CategoryScore, YieldCurveSnapshot } from "@/types";

type Palette = {
  borderSoft: string;
  muted: string;
  soft: string;
  text: string;
  green: string;
  yellow: string;
  panelSoft: string;
  border: string;
};

type RecessionModelRow = { name: string; pct: number; dot: string };

type Props = {
  quadPanelStyle: CSSProperties;
  colors: Palette;
  recessionProbPct: number | null;
  recessionRisk: { label: string; color: string };
  recessionModelRows: RecessionModelRow[];
  cycleScore: number | null;
  macroSentimentSeries: number[];
  categories: CategoryScore[];
  fedPolicy: number;
  /** Midpoint minus FOMC longer-run neutral (SEP), percentage points — from `/api/fed/current`. */
  fedRateVsNeutralPp: number | null;
  fedStance: string;
  fedRateSeries: number[];
  rateDirection: string;
  balanceSheetDirection: string;
  curvePatternLabel: string;
  curvePatternTitle: string;
  yieldCurveSnapshot: YieldCurveSnapshot | null | undefined;
  yieldHistory: YieldCurveSnapshot[] | null | undefined;
  spread2y10yText: string;
  realYield10yText: string;
  formatPercent: (value: number | null | undefined, digits?: number) => string;
  formatNumber: (value: number | null | undefined, digits?: number) => string;
  RiskSegmentDonutComponent: ComponentType<{ value: number | null | undefined }>;
  MacroSentimentSparkBlockComponent: ComponentType<{ values: number[] }>;
  MacroCategoryRowComponent: ComponentType<{ row: CategoryScore }>;
  FedPolicyScaleBarComponent: ComponentType<{ value: number }>;
  FedRateHistorySparkComponent: ComponentType<{ values: number[] }>;
  /** Same palette tokens as `/yield-curve` — passed to `YieldCurveSnapshotCard`. */
  yieldPalette: NextShellThemeContextValue["colors"];
};

export function DashboardMiddleRowSection({
  quadPanelStyle,
  colors,
  recessionProbPct,
  recessionRisk,
  recessionModelRows,
  cycleScore,
  macroSentimentSeries,
  categories,
  fedPolicy,
  fedRateVsNeutralPp,
  fedStance,
  fedRateSeries,
  rateDirection,
  balanceSheetDirection,
  curvePatternLabel,
  curvePatternTitle,
  yieldCurveSnapshot,
  yieldHistory,
  spread2y10yText,
  realYield10yText,
  formatPercent,
  formatNumber,
  RiskSegmentDonutComponent,
  MacroSentimentSparkBlockComponent,
  MacroCategoryRowComponent,
  FedPolicyScaleBarComponent,
  FedRateHistorySparkComponent,
  yieldPalette,
}: Props) {
  const quadChrome = useMemo(() => {
    const s = { ...quadPanelStyle } as CSSProperties & { height?: number | string };
    delete s.height;
    return s;
  }, [quadPanelStyle]);

  return (
    <div className="nd-dashboard-middle-grid grid items-stretch gap-[14px] [grid-template-columns:minmax(0,1fr)] xl:[grid-template-columns:252fr_410fr_438fr_458fr]">
      <div
        className="nd-dashboard-panel flex h-[360px] max-xl:h-auto max-xl:min-h-[280px] min-h-0 min-w-0 flex-col overflow-hidden print:break-inside-avoid"
        style={quadChrome}
      >
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
          <Link
            href="/radar"
            className="mt-1.5 shrink-0 pt-1 text-[11px] tracking-[0.03em] transition-opacity hover:opacity-90"
            style={{ color: colors.soft }}
          >
            View Cycle Radar {"->"}
          </Link>
        </div>
      </div>

      <div
        className="nd-dashboard-panel flex h-[360px] max-xl:h-auto max-xl:min-h-[280px] min-h-0 min-w-0 flex-col overflow-hidden print:break-inside-avoid"
        style={quadChrome}
      >
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
            <Link
              href="/macro-sentiment"
              className="mt-2 shrink-0 pt-0.5 text-[11px] tracking-[0.03em] transition-opacity hover:opacity-90"
              style={{ color: colors.soft }}
            >
              All indicators {"->"}
            </Link>
          </div>
        </div>
      </div>

      <Link
        href="/fed-policy"
        className="contents no-underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--nd-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--nd-panel)]"
        aria-label="Open full Fed Policy page"
      >
        <div
          className="nd-dashboard-panel flex h-[360px] max-xl:h-auto max-xl:min-h-[280px] min-h-0 min-w-0 flex-col overflow-hidden print:break-inside-avoid"
          style={quadChrome}
        >
          <div className="mb-1 text-[18px] uppercase leading-none tracking-[0.08em]">Fed Policy Score</div>
          <div
            className="mt-2 grid min-w-0 shrink-0 items-start gap-y-0 overflow-hidden"
            style={{ gridTemplateColumns: "minmax(78px,auto) minmax(0,1fr)" }}
          >
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
          <div className="flex items-center justify-between py-2">
            <span>Vs neutral (SEP)</span>
            <span style={{ color: colors.text }} className="tabular-nums">
              {fedRateVsNeutralPp == null || Number.isNaN(fedRateVsNeutralPp)
                ? "—"
                : `${fedRateVsNeutralPp >= 0 ? "+" : ""}${fedRateVsNeutralPp.toFixed(2)}pp`}
            </span>
          </div>
            <span className="mt-auto shrink-0 pt-2 text-[11px] normal-case tracking-[0.03em]" style={{ color: colors.soft }}>
              Open Fed Policy {"->"}
            </span>
          </div>
        </div>
      </Link>

      <div
        className="nd-dashboard-panel relative flex h-[360px] max-xl:h-auto max-xl:min-h-[280px] min-h-0 min-w-0 flex-col overflow-hidden print:break-inside-avoid"
        style={quadChrome}
      >
        <div className="mb-2 flex shrink-0 items-start justify-between gap-2">
          <div className="text-[18px] uppercase leading-none tracking-[0.08em]">Yield Curve</div>
          <div
            className="max-w-[min(200px,52%)] shrink-0 rounded-[2px] border px-2.5 py-1.5 text-right"
            style={{ borderColor: colors.border, background: colors.panelSoft }}
            title={curvePatternTitle}
          >
            <div className="text-[11px] font-medium uppercase leading-snug tracking-[0.04em]" style={{ color: colors.text }}>
              {curvePatternLabel}
            </div>
          </div>
        </div>
        <div className="flex min-h-[168px] w-full min-w-0 flex-1 basis-0 flex-col self-stretch overflow-hidden print:min-h-[260px] print:overflow-visible">
          <YieldCurveSnapshotCard
            palette={yieldPalette}
            snapshot={yieldCurveSnapshot ?? undefined}
            history={yieldHistory ?? undefined}
            fillHeight
            hideTitle
            hideMetrics
          />
        </div>
        <div className="mt-auto shrink-0 border-t px-1 pt-2 pb-0.5" style={{ borderColor: colors.borderSoft }}>
          <div className="grid grid-cols-2 gap-0">
            <div
              className="flex items-center justify-center gap-1.5 border-r py-0.5 pr-1.5 text-center"
              style={{ borderColor: colors.borderSoft }}
            >
              <span className="text-[11px] uppercase tracking-[0.08em]" style={{ color: colors.soft }}>2Y-10Y:</span>
              <span className="text-[13px] font-medium tabular-nums" style={{ color: colors.yellow }}>
                {spread2y10yText}
              </span>
            </div>
            <div className="flex items-center justify-center gap-1.5 py-0.5 pl-1.5 text-center">
              <span className="text-[11px] uppercase tracking-[0.08em]" style={{ color: colors.soft }}>Real Yield 10Y:</span>
              <span className="text-[13px] font-medium tabular-nums" style={{ color: colors.text }}>
                {realYield10yText}
              </span>
            </div>
          </div>
          <Link
            href="/yield-curve"
            className="mt-1 block pt-1 text-[11px] tracking-[0.03em] transition-opacity hover:opacity-90"
            style={{ color: colors.soft }}
          >
            View Yield Curve {"->"}
          </Link>
        </div>
      </div>
    </div>
  );
}
