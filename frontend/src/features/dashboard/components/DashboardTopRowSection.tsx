"use client";

import type { CSSProperties, ComponentType } from "react";
import type { CrossAssetSignal } from "@/types";

type Palette = {
  borderSoft: string;
  text: string;
  border: string;
};

type CrossAssetDisplaySignal = {
  name: string;
  description: string;
  signal: CrossAssetSignal["signal"];
  value: number | null;
  unit?: string;
};

type QuickRowData = {
  label: string;
  value: number | null;
  secondaryValue?: number | null;
  delta?: number | null;
  min: number;
  mid: number;
  max: number;
  format: "number" | "percent" | "basis_points";
  sub?: string;
  higherIsWorse?: boolean;
  gradient?: string;
  palette?: readonly [string, string, string];
  compact?: boolean;
};

type Props = {
  basePanelStyle: CSSProperties;
  colors: Palette;
  growthScore: number;
  fedPolicy: number;
  ensembleGrowth: number | null;
  ensembleFed: number | null;
  confidence: number;
  confidenceText: string;
  signals: CrossAssetDisplaySignal[];
  activeRegimeLabel: string;
  activeRegimeColor: string;
  inflationLatest: number | null;
  coreInflationLatest: number | null;
  inflationDelta: number | null;
  coreInflationDelta: number | null;
  quickRows: QuickRowData[];
  SectionTitleComponent: ComponentType<{ label: string; sub?: string; centered?: boolean }>;
  MacroNavigatorSvgComponent: ComponentType<{
    growthScore: number;
    fedPolicy: number;
    ensembleGrowth: number | null;
    ensembleFed: number | null;
  }>;
  ConfidenceSegmentsComponent: ComponentType<{ value: number }>;
  SignalRowComponent: ComponentType<{ signal: CrossAssetDisplaySignal }>;
  InflationQuickRowComponent: ComponentType<{
    cpiValue: number | null;
    coreValue: number | null;
    cpiDelta: number | null;
    coreDelta: number | null;
  }>;
  QuickRowComponent: ComponentType<QuickRowData>;
};

export function DashboardTopRowSection({
  basePanelStyle,
  colors,
  growthScore,
  fedPolicy,
  ensembleGrowth,
  ensembleFed,
  confidence,
  confidenceText,
  signals,
  activeRegimeLabel,
  activeRegimeColor,
  inflationLatest,
  coreInflationLatest,
  inflationDelta,
  coreInflationDelta,
  quickRows,
  SectionTitleComponent,
  MacroNavigatorSvgComponent,
  ConfidenceSegmentsComponent,
  SignalRowComponent,
  InflationQuickRowComponent,
  QuickRowComponent,
}: Props) {
  return (
    <div
      className="nd-dashboard-top-grid grid gap-[14px] [grid-template-columns:minmax(0,1fr)] xl:[grid-template-columns:600fr_472fr_488fr]"
    >
      <div
        className="nd-dashboard-panel flex h-[460px] max-xl:h-auto max-xl:min-h-[260px] min-h-0 w-full flex-col print:break-inside-avoid"
        style={basePanelStyle}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden print:overflow-visible">
          <div className="shrink-0">
            <SectionTitleComponent label="Macro Navigator" />
          </div>
          {/* flex-1 + min-h-0 alone can collapse this slot to 0 height (SVG max-h-full → invisible). */}
          <div className="mt-0.5 flex min-h-[220px] flex-1 flex-col overflow-hidden pb-2 print:min-h-[280px] print:overflow-visible">
            <MacroNavigatorSvgComponent
              growthScore={growthScore}
              fedPolicy={fedPolicy}
              ensembleGrowth={ensembleGrowth}
              ensembleFed={ensembleFed}
            />
          </div>
        </div>
        <div className="mt-auto shrink-0 border-t pt-[10px]" style={{ borderColor: colors.borderSoft }}>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em]" style={{ color: colors.text }}>
            <span>Confidence</span>
            <span
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px]"
              style={{ borderColor: colors.border }}
            >
              ?
            </span>
            <ConfidenceSegmentsComponent value={confidence} />
            <span className="text-[18px]">{confidenceText}</span>
          </div>
        </div>
      </div>

      <div
        className="nd-dashboard-panel flex h-[460px] max-xl:h-auto max-xl:min-h-[260px] min-h-0 w-full flex-col print:break-inside-avoid"
        style={basePanelStyle}
      >
        <SectionTitleComponent label="Cross-Asset Signals" />
        <div
          className="mt-2 grid min-h-0 flex-1"
          style={{ gridTemplateRows: `repeat(${Math.max(1, signals.length)}, minmax(0, 1fr))` }}
        >
          {signals.map((s) => <SignalRowComponent key={s.name} signal={s} />)}
        </div>
      </div>

      <div
        className="nd-dashboard-panel h-[460px] max-xl:h-auto max-xl:min-h-[260px] w-full print:break-inside-avoid"
        style={basePanelStyle}
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <div className="text-[18px] uppercase leading-none tracking-[0.08em]">Active Regime</div>
          </div>
          <span
            className="max-w-[220px] truncate rounded-[2px] border px-3 py-2 text-[11px] uppercase tracking-[0.08em]"
            style={{ borderColor: activeRegimeColor, color: activeRegimeColor }}
          >
            {activeRegimeLabel}
          </span>
        </div>
        <div className="mt-4 w-full min-w-0 space-y-4">
          <InflationQuickRowComponent
            cpiValue={inflationLatest}
            coreValue={coreInflationLatest}
            cpiDelta={inflationDelta}
            coreDelta={coreInflationDelta}
          />
          {quickRows.map((row) => <QuickRowComponent key={row.label} {...row} compact />)}
        </div>
      </div>
    </div>
  );
}
