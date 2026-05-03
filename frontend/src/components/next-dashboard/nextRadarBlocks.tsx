"use client";

import type { CSSProperties } from "react";
import {
  NextRadarCycleGauge,
  NextRadarExpectedReturnsTable,
  NextRadarRecession12m,
  NextRadarSectionTitle,
  NextRadarTacticalTable,
} from "@/components/next-dashboard/nextRadarPanels";
import type { NextShellThemeContextValue } from "@/components/next-dashboard/nextShellTheme";
import { RadarCycleScoreChart, RadarRecessionProbChart } from "@/components/next-dashboard/RadarTimelineCharts";
import { Check, Info, X } from "lucide-react";
import type { RecessionBand, RecessionCheck, RegimeSnapshot } from "@/types";

export type NextShellColors = NextShellThemeContextValue["colors"];

export const RADAR_CHART_H = 260;

type PanelStyle = CSSProperties;

export function RadarCycleScorePanel({
  colors: C,
  surface,
  placement,
  regime,
}: {
  colors: NextShellColors;
  surface: PanelStyle;
  placement?: CSSProperties;
  regime: RegimeSnapshot;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col" style={{ ...surface, ...placement, minHeight: 0 }}>
      <div className="mb-1 flex shrink-0 items-start justify-between gap-2">
        <NextRadarSectionTitle className="mb-0">Cycle Score</NextRadarSectionTitle>
        <button
          type="button"
          className="mt-0.5 rounded-full p-1 opacity-70 transition-opacity hover:opacity-100"
          style={{ color: C.muted }}
          aria-label="Cycle score aggregates macro indicators into a −100…+100 score; z-score shown is scaled for display."
          title="Aggregate macro score (−100…+100); z-axis matches timeline charts."
        >
          <Info className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        <NextRadarCycleGauge
          palette={C}
          score={regime.cycle_score}
          phase={regime.phase}
          phaseLabel={regime.phase_label}
        />
      </div>
    </div>
  );
}

export function RadarRecessionProbPanel({
  colors: C,
  surface,
  placement,
  regime,
}: {
  colors: NextShellColors;
  surface: PanelStyle;
  placement?: CSSProperties;
  regime: RegimeSnapshot;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col" style={{ ...surface, ...placement, minHeight: 0 }}>
      <NextRadarSectionTitle className="mb-0">Recession Probability 12M</NextRadarSectionTitle>
      <div className="flex min-h-0 flex-1 flex-col pt-2">
        <NextRadarRecession12m
          palette={C}
          probability={regime.recession_prob_12m}
          models={regime.recession_models}
          drivers={regime.top_drivers}
        />
      </div>
    </div>
  );
}

function checklistConfidenceStyle(
  C: NextShellColors,
  confidence: string,
): CSSProperties {
  if (confidence === "high") return { borderColor: C.red, color: C.red };
  if (confidence === "moderate") return { borderColor: C.yellow, color: C.yellow };
  return { borderColor: C.green, color: C.green };
}

export function RadarRecessionChecklistPanel({
  colors: C,
  surface,
  placement,
  checklistVariant,
  recession,
}: {
  colors: NextShellColors;
  surface: PanelStyle;
  placement?: CSSProperties;
  checklistVariant: "sidebar" | "stacked";
  recession: RecessionCheck | undefined;
}) {
  const listGrid =
    checklistVariant === "sidebar"
      ? "grid min-h-0 grid-cols-1 gap-1.5"
      : "grid grid-cols-1 gap-1.5 sm:grid-cols-2";

  const cardPad = "min-h-[40px] px-2.5 py-2";
  const titleSize = "text-[12px]";
  const threshSize = "text-[10px]";
  const valSize = "text-[12px] tabular-nums leading-snug";
  const iconClass = "h-3.5 w-3.5 shrink-0";

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col"
      style={{
        ...surface,
        ...placement,
        minHeight: 0,
      }}
    >
      <div className="mb-1.5 flex w-full shrink-0 flex-nowrap items-center justify-between gap-3">
        <NextRadarSectionTitle className="mb-0 min-w-0 flex-1 leading-tight">
          Recession Checklist
        </NextRadarSectionTitle>
        {recession ? (
          <span
            className="shrink-0 whitespace-nowrap rounded-[2px] border px-2 py-0.5 font-mono text-[11px] tabular-nums uppercase tracking-[0.06em]"
            style={checklistConfidenceStyle(C, recession.confidence)}
          >
            {recession.score}/{recession.total}
          </span>
        ) : null}
      </div>
      {recession ? (
        <div className={`${listGrid} min-h-0 flex-1 overflow-y-auto max-w-full`}>
          {recession.items.map((item, idx) => (
            <div
              key={item.name}
              className={`grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-start gap-x-2.5 rounded-[2px] border ${cardPad}`}
              style={
                item.triggered
                  ? {
                      borderColor: C.red,
                      borderWidth: 1,
                      borderStyle: "solid",
                      background: "var(--nd-panel-soft)",
                    }
                  : { borderColor: C.borderSoft, background: "var(--nd-panel-soft)" }
              }
            >
              <span className="pt-0.5 font-mono text-[11px] tabular-nums leading-none" style={{ color: C.muted }}>
                {idx + 1}.
              </span>
              <div className="min-w-0">
                <div className={`font-light leading-snug ${titleSize}`} style={{ color: C.text }}>
                  {item.name}
                </div>
                <div className={`mt-0.5 leading-snug ${threshSize}`} style={{ color: C.muted }}>
                  {item.threshold}
                </div>
              </div>
              <span className={`max-w-[10rem] pt-0.5 text-right font-mono font-light break-words ${valSize}`} style={{ color: C.soft }}>
                {item.current_value}
              </span>
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center justify-self-end rounded-full border"
                style={{
                  borderColor: item.triggered ? C.red : C.green,
                  color: item.triggered ? C.red : C.green,
                  background: "var(--nd-bg)",
                }}
              >
                {item.triggered ? (
                  <X className={iconClass} strokeWidth={2.5} aria-label="Triggered" />
                ) : (
                  <Check className={iconClass} strokeWidth={2.5} aria-label="Not triggered" />
                )}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[13px] font-light" style={{ color: C.muted }}>
          Recession checklist unavailable.
        </div>
      )}
    </div>
  );
}

export function RadarCycleTimelinePanel({
  colors: C,
  surface,
  placement,
  timelineData,
  recessionBands,
}: {
  colors: NextShellColors;
  surface: PanelStyle;
  placement?: CSSProperties;
  timelineData: Array<{ date: string; cycle_score: number }>;
  recessionBands: RecessionBand[] | undefined;
}) {
  return (
    <div style={{ ...surface, ...placement, minHeight: 0 }}>
      <NextRadarSectionTitle>Cycle Score Timeline</NextRadarSectionTitle>
      {timelineData.length > 0 ? (
        <div className="flex min-h-0 gap-1 sm:gap-2">
          <div
            className="hidden shrink-0 self-center text-[9px] font-medium uppercase tracking-[0.12em] sm:block"
            style={{
              color: C.muted,
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
            }}
            aria-hidden
          >
            Cycle score (z)
          </div>
          <div className="min-w-0 flex-1">
            <RadarCycleScoreChart
              palette={C}
              data={timelineData}
              height={RADAR_CHART_H}
              recessionBands={recessionBands}
            />
          </div>
        </div>
      ) : (
        <div className="text-[13px]" style={{ color: C.muted }}>
          No history.
        </div>
      )}
    </div>
  );
}

export function RadarRecProbHistoryPanel({
  colors: C,
  surface,
  placement,
  recProbData,
  recessionBands,
}: {
  colors: NextShellColors;
  surface: PanelStyle;
  placement?: CSSProperties;
  recProbData: Array<{ date: string; recession_prob: number }>;
  recessionBands: RecessionBand[] | undefined;
}) {
  return (
    <div style={{ ...surface, ...placement, minHeight: 0 }}>
      <NextRadarSectionTitle>Recession Probability History</NextRadarSectionTitle>
      {recProbData.length > 0 ? (
        <div className="flex min-h-0 gap-1 sm:gap-2">
          <div
            className="hidden shrink-0 self-center text-[9px] font-medium uppercase tracking-[0.12em] sm:block"
            style={{
              color: C.muted,
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
            }}
            aria-hidden
          >
            Probability (%)
          </div>
          <div className="min-w-0 flex-1">
            <RadarRecessionProbChart
              palette={C}
              data={recProbData}
              height={RADAR_CHART_H}
              recessionBands={recessionBands}
            />
          </div>
        </div>
      ) : (
        <div className="text-[13px]" style={{ color: C.muted }}>
          No history.
        </div>
      )}
    </div>
  );
}

export function RadarTablesSection({
  colors: C,
  surface,
  regime,
  layout,
}: {
  colors: NextShellColors;
  surface: PanelStyle;
  regime: RegimeSnapshot;
  layout: "split" | "stack";
}) {
  const tactical = (
    <div style={{ ...surface, minHeight: 0 }}>
      <NextRadarSectionTitle>Tactical Asset Allocation by Cycle Phase</NextRadarSectionTitle>
      <NextRadarTacticalTable palette={C} allocation={regime.tactical_allocation} currentPhase={regime.phase} />
    </div>
  );
  const expected = (
    <div style={{ ...surface, minHeight: 0 }}>
      <NextRadarSectionTitle>Expected Returns</NextRadarSectionTitle>
      <NextRadarExpectedReturnsTable
        palette={C}
        rows={regime.expected_returns}
        currentPhase={regime.phase}
      />
    </div>
  );

  if (layout === "stack") {
    return (
      <>
        {tactical}
        {expected}
      </>
    );
  }

  return (
    <div className="grid min-h-0 gap-3" style={{ gridTemplateColumns: "minmax(0, 1.65fr) minmax(0, 1fr)" }}>
      {tactical}
      {expected}
    </div>
  );
}
