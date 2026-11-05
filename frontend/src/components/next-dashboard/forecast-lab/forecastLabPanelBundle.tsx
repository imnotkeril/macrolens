"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, Check, Database, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ExpertPhaseBreakdown,
  ForecastLabSummary,
  MacroForecastRow,
  PhaseAssetAlignment,
  PhaseProbabilities,
  RegimeHistoryRow,
  StressBlock,
} from "@/types/forecastLab";
import type { NextShellThemeContextValue } from "@/components/next-dashboard/nextShellTheme";
import { REGIME_HISTORY_TABLE_BORDER } from "@/components/next-dashboard/nextDashboardTableTokens";
import { NextNoData, NO_DATA_TITLE } from "@/components/next-dashboard/NextNoData";
const QUADRANT_ORDER = ["Q1_GOLDILOCKS", "Q2_REFLATION", "Q3_OVERHEATING", "Q4_STAGFLATION"] as const;

const QUADRANT_LABELS: Record<string, string> = {
  Q1_GOLDILOCKS: "Risk ON",
  Q2_REFLATION: "Growth",
  Q3_OVERHEATING: "Value",
  Q4_STAGFLATION: "Risk OFF",
};

type QuadrantKey = (typeof QUADRANT_ORDER)[number];

/** Expert breakdown heatmap — column tints; cell gutters like confusion matrix (borderSpacing, no solid grid). */
const EXPERT_REGIME_HEADER_COLOR: Record<QuadrantKey, string> = {
  Q1_GOLDILOCKS: "var(--nd-green)",
  Q2_REFLATION: "var(--nd-blue)",
  Q3_OVERHEATING: "var(--nd-yellow)",
  Q4_STAGFLATION: "var(--nd-red)",
};

/** Fixed per-column wash — solid tint (no gradient). */
const EXPERT_REGIME_COLUMN_BG: Record<QuadrantKey, string> = {
  Q1_GOLDILOCKS: "color-mix(in srgb, var(--nd-green) 24%, transparent)",
  Q2_REFLATION: "color-mix(in srgb, var(--nd-blue) 24%, transparent)",
  Q3_OVERHEATING: "color-mix(in srgb, var(--nd-yellow) 24%, transparent)",
  Q4_STAGFLATION: "color-mix(in srgb, var(--nd-red) 24%, transparent)",
};

/** Gutter between heatmap cells — same as panel surface. */
const EXPERT_TABLE_GAP_BG = "var(--nd-panel)";

/** Hit-rate row: framed cells, no regime tint fills. */
const HITRATE_CELL_BORDER = "1px solid color-mix(in srgb, var(--nd-text) 15%, transparent)";

const REGIME_MAP_GRID_ORDER: { key: QuadrantKey; corner: "tl" | "tr" | "bl" | "br" }[] = [
  { key: "Q2_REFLATION", corner: "tl" },
  { key: "Q1_GOLDILOCKS", corner: "tr" },
  { key: "Q4_STAGFLATION", corner: "bl" },
  { key: "Q3_OVERHEATING", corner: "br" },
];

const REGIME_MAP_QUADRANT_VISUAL: Record<
  QuadrantKey,
  { cellFill: string; accent: string; bubble: string; frame: string }
> = {
  Q2_REFLATION: {
    cellFill: "color-mix(in srgb, var(--nd-blue) 18%, transparent)",
    accent: "var(--nd-blue)",
    bubble: "color-mix(in srgb, var(--nd-blue) 80%, transparent)",
    frame: "1px solid color-mix(in srgb, var(--nd-blue) 45%, transparent)",
  },
  Q1_GOLDILOCKS: {
    cellFill: "color-mix(in srgb, var(--nd-green) 18%, transparent)",
    accent: "var(--nd-green)",
    bubble: "color-mix(in srgb, var(--nd-green) 80%, transparent)",
    frame: "1px solid color-mix(in srgb, var(--nd-green) 45%, transparent)",
  },
  Q4_STAGFLATION: {
    cellFill: "color-mix(in srgb, var(--nd-red) 18%, transparent)",
    accent: "var(--nd-red)",
    bubble: "color-mix(in srgb, var(--nd-red) 80%, transparent)",
    frame: "1px solid color-mix(in srgb, var(--nd-red) 45%, transparent)",
  },
  Q3_OVERHEATING: {
    cellFill: "color-mix(in srgb, var(--nd-yellow) 18%, transparent)",
    accent: "var(--nd-yellow)",
    bubble: "color-mix(in srgb, var(--nd-yellow) 80%, transparent)",
    frame: "1px solid color-mix(in srgb, var(--nd-yellow) 45%, transparent)",
  },
};

/** Crosshair gutter — axes sit here, not on quadrant edges (reference). */
const REGIME_MAP_CROSS_GUTTER_PX = 12;

const REGIME_MAP_GRID_PLACE: Record<QuadrantKey, { gridColumn: number; gridRow: number }> = {
  Q2_REFLATION: { gridColumn: 1, gridRow: 1 },
  Q1_GOLDILOCKS: { gridColumn: 3, gridRow: 1 },
  Q4_STAGFLATION: { gridColumn: 1, gridRow: 3 },
  Q3_OVERHEATING: { gridColumn: 3, gridRow: 3 },
};

function regimeMapCornerLabelStyle(corner: "tl" | "tr" | "bl" | "br"): CSSProperties {
  const pad = 12;
  const base: CSSProperties = { position: "absolute", zIndex: 1 };
  switch (corner) {
    case "tl":
      return { ...base, top: pad, left: pad, textAlign: "left" };
    case "tr":
      return { ...base, top: pad, right: pad, textAlign: "right" };
    case "bl":
      return { ...base, bottom: pad, left: pad, textAlign: "left" };
    case "br":
      return { ...base, bottom: pad, right: pad, textAlign: "right" };
    default:
      return base;
  }
}

function quadrantAccentClass(key: QuadrantKey): string {
  switch (key) {
    case "Q1_GOLDILOCKS":
      return "text-[var(--nd-green)]";
    case "Q2_REFLATION":
      return "text-[var(--nd-blue)]";
    case "Q3_OVERHEATING":
      return "text-[var(--nd-yellow)]";
    case "Q4_STAGFLATION":
      return "text-[var(--nd-red)]";
    default:
      return "text-[var(--nd-text)]";
  }
}

function quadrantBgTint(key: QuadrantKey, intensity: number): string {
  const a = Math.min(0.35, 0.06 + intensity * 0.28);
  switch (key) {
    case "Q1_GOLDILOCKS":
      return `color-mix(in srgb, var(--nd-green) ${Math.round(a * 100)}%, transparent)`;
    case "Q2_REFLATION":
      return `color-mix(in srgb, var(--nd-blue) ${Math.round(a * 100)}%, transparent)`;
    case "Q3_OVERHEATING":
      return `color-mix(in srgb, var(--nd-yellow) ${Math.round(a * 100)}%, transparent)`;
    case "Q4_STAGFLATION":
      return `color-mix(in srgb, var(--nd-red) ${Math.round(a * 100)}%, transparent)`;
    default:
      return `color-mix(in srgb, var(--nd-text) ${Math.round(a * 30)}%, transparent)`;
  }
}

function extractScores(summary: ForecastLabSummary | undefined): { growth: number | null; fed: number | null } {
  if (!summary?.macro_forecasts?.length) return { growth: null, fed: null };
  const g = summary.macro_forecasts.find((r) => r.series_id === "growth_score_nowcast");
  const f = summary.macro_forecasts.find((r) => r.series_id === "fed_policy_score_nowcast");
  return {
    growth: g?.value ?? null,
    fed: f?.value ?? null,
  };
}

type ShellPalette = NextShellThemeContextValue["colors"];

function regimeHistoryQuadrantColor(key: string, palette: ShellPalette): string {
  switch (key) {
    case "Q1_GOLDILOCKS":
      return palette.green;
    case "Q2_REFLATION":
      return palette.blue;
    case "Q3_OVERHEATING":
      return palette.yellow;
    case "Q4_STAGFLATION":
      return palette.red;
    default:
      return palette.soft;
  }
}

function RegimeHistoryQuadrantBadge({ quadrantKey, palette }: { quadrantKey: string; palette: ShellPalette }) {
  const label = (QUADRANT_LABELS[quadrantKey] ?? quadrantKey).toUpperCase();
  const color = regimeHistoryQuadrantColor(quadrantKey, palette);
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold leading-none" style={{ color, fontSize: 12 }}>
      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {label}
    </span>
  );
}

function formatRegimeHistoryObsDate(iso: string): string {
  if (!iso) return "—";
  const s = String(iso);
  return s.length >= 7 ? s.slice(0, 7) : s;
}

/** Macro panel scroll cap (regime history height matches macro card via layout sync on xl). */
const MACRO_REGIME_HISTORY_MAX_H = "min(396px, 54vh)";
/** Same cap as a class applied from xl only: below xl the asset table sizes to its content (200% zoom, D-27). */
const MACRO_REGIME_HISTORY_MAX_H_CLASS = "xl:max-h-[min(396px,54vh)]";

const XL_MEDIA = "(min-width: 1280px)";

function regimeHistoryHorizonMonths(
  materialize: { isSuccess: boolean; data?: { horizon_months?: number } | null },
): number {
  const h = materialize.isSuccess ? materialize.data?.horizon_months : undefined;
  return typeof h === "number" && Number.isFinite(h) && h >= 1 ? h : 1;
}

function regimeHistoryAssetImplTooltip(h: number): string {
  return `Implied quadrant from realized YAML asset-pair returns over the ${h}-month lookback ending at obs_date (month-end window). H = evaluation_horizon_months in backend/config/forecast_lab/asset_phase_expectations.yaml; value shown uses last Materialize when available, else 1.`;
}

function regimeHistoryFwdOkTooltip(h: number): string {
  return `Checks the rule-plane label at obs_date against realized pair returns from obs_date through obs_date + ${h} month(s) (same H and YAML as phase–asset alignment). Not a comparison to the Asset impl. column. May be “no” if the forward window is not over yet or score is below threshold.`;
}

/** Shared bar row geometry for model weights + feature importance (label | bar | value). */
/** Slightly wider label column so long feature names get more room; same bar + value widths as model weights. */
const FL_HBAR_ROW_GRID =
  "grid grid-cols-[minmax(72px,0.42fr)_minmax(0,1fr)_52px] items-center gap-2 sm:grid-cols-[minmax(88px,0.42fr)_minmax(0,1fr)_52px]";
const FL_HBAR_HEIGHT = "h-5";

/** Gray horizontal rows — ensemble_weights; same bar geometry as feature importance. */
function EnsembleModelWeightsRows({
  weights,
  palette,
}: {
  weights: Record<string, number> | null | undefined;
  palette: ShellPalette;
}) {
  const rows = [
    { label: "RULE", key: "rule" },
    { label: "GBDT", key: "gbdt" },
    { label: "HMM", key: "hmm" },
    { label: "CYCLE", key: "cycle" },
  ] as const;
  const barFill = "color-mix(in srgb, var(--nd-text) 22%, transparent)";

  return (
    <div className="flex flex-col gap-2">
      {rows.map(({ label, key }) => {
        const raw = weights?.[key];
        const v = raw != null && Number.isFinite(Number(raw)) ? Number(raw) : null;
        const pct = v != null ? v * 100 : 0;
        return (
          <div
            key={key}
            className={cn(FL_HBAR_ROW_GRID, "rounded-[2px] py-1 pl-0.5 pr-1")}
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.11em]" style={{ color: palette.muted }}>
              {label}
            </span>
            <div
              className={cn(FL_HBAR_HEIGHT, "min-w-0 overflow-hidden rounded-none border")}
              style={{
                borderColor: palette.borderSoft,
                background: palette.panelSoft,
              }}
            >
              <div
                className="h-full rounded-none"
                style={{
                  width: v != null ? `${Math.min(100, Math.max(0, pct))}%` : "0%",
                  background: barFill,
                }}
              />
            </div>
            <span className="font-mono text-[11px] font-normal tabular-nums" style={{ color: palette.soft }}>
              {v != null ? v.toFixed(2) : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Phase headline + date + confidence, MATCH top-right, full regime map below (no duplicate quadrant bars). */
function PhaseEnsembleCard({ summary, palette }: { summary: ForecastLabSummary; palette: ShellPalette }) {
  const noData =
    summary.insufficient_data === true || !summary.phase_class || !summary.phase_probabilities || summary.confidence == null;
  const phaseKey = summary.phase_class ?? "";
  const phaseHeadline = (QUADRANT_LABELS[phaseKey] ?? phaseKey).toUpperCase();
  let datePretty = String(summary.as_of_date);
  try {
    datePretty = format(parseISO(String(summary.as_of_date)), "MMM d, yyyy");
  } catch {
    /* keep raw */
  }
  const confPct = summary.confidence != null ? (summary.confidence * 100).toFixed(0) : null;
  const match = summary.dashboard_context?.matches_navigator_quadrant;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {noData ? (
            <NextNoData compact className="!items-start !text-left !py-0" />
          ) : (
            <>
              <div
                className="text-[26px] font-semibold uppercase leading-[1.05] tracking-[0.08em] sm:text-[28px]"
                style={{ color: regimeHistoryQuadrantColor(phaseKey, palette) }}
              >
                {phaseHeadline}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-light">
                <span className="inline-flex items-center gap-1.5" style={{ color: palette.muted }}>
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-85" strokeWidth={2} aria-hidden />
                  {datePretty}
                </span>
                <span style={{ color: palette.borderSoft }} aria-hidden>
                  |
                </span>
                <span style={{ color: palette.muted }}>
                  Confidence{" "}
                  <strong className="font-semibold tabular-nums" style={{ color: palette.text }}>
                    {confPct}%
                  </strong>
                </span>
              </div>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="whitespace-nowrap rounded-[2px] border px-2 py-0.5 font-mono text-[11px] font-normal uppercase tracking-[0.06em]"
            style={{
              borderColor: palette.borderSoft,
              color: palette.muted,
              background: palette.panelSoft,
            }}
          >
            ensemble vs rule
          </span>
          {noData ? (
            <span
              className="shrink-0 whitespace-nowrap rounded-[2px] border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em]"
              style={{ borderColor: palette.borderSoft, color: palette.muted }}
            >
              {NO_DATA_TITLE}
            </span>
          ) : (
            <NavigatorMatchBadge match={match} palette={palette} />
          )}
        </div>
      </div>

      {noData || !summary.phase_probabilities ? (
        <NextNoData hint="Run the first data refresh to compute the regime map." />
      ) : (
        <RegimeMapChart probabilities={summary.phase_probabilities} />
      )}
    </div>
  );
}

const STRESS_ETF_UNIVERSE_FALLBACK = ["SPY", "IWM", "GLD", "TLT", "HYG", "EEM"] as const;

function humanizeStressDriver(key: string): string {
  switch (key) {
    case "isolation_forest":
      return "Isolation Forest";
    case "return_z_spike":
      return "Return z-spike";
    default:
      return key.replace(/_/g, " ");
  }
}

const FL_ANOMALY_HELP =
  "Anomaly score for this month vs the trailing window: Isolation Forest on the return row plus normalized |z| peaks across the ETF basket. Higher = more atypical regime.";

const FL_NAVIGATOR_GROWTH_HELP =
  "Macro context (same 36 month-ends as stress window) — not the anomaly score time series.";

const FL_ANOMALY_INSUFFICIENT_HELP =
  "Limited history: fewer than 8 aligned monthly return rows across the ETF basket. No score is shown until enough history exists.";

function ForecastLabStressCard({
  stress,
  navigatorGrowthSparklineValues,
  palette,
}: {
  stress: StressBlock;
  navigatorGrowthSparklineValues: number[];
  palette: ShellPalette;
}) {
  const band = stress.stress_band?.toLowerCase() ?? "";
  const bandColor =
    band === "high" ? palette.red : band === "medium" ? palette.yellow : palette.green;
  const universe =
    stress.universe_symbols && stress.universe_symbols.length > 0
      ? stress.universe_symbols.join(", ")
      : STRESS_ETF_UNIVERSE_FALLBACK.join(", ");
  const visibleDrivers = stress.drivers.filter((d) => d !== "insufficient_market_history");
  const insufficient =
    stress.insufficient_history === true || stress.drivers.includes("insufficient_market_history");
  // With insufficient history the backend score (0.25) is a fallback, not a measurement: show a dash (D-22).
  const contributors = stress.top_z_contributors ?? [];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative">
        <div className="absolute right-2 top-2 z-[2] flex items-center gap-1">
          {insufficient ? (
            <span
              className="cursor-help select-none text-[13px] font-semibold leading-none"
              style={{ color: palette.red }}
              title={FL_ANOMALY_INSUFFICIENT_HELP}
              aria-label={FL_ANOMALY_INSUFFICIENT_HELP}
            >
              !
            </span>
          ) : null}
          <span
            className="cursor-help select-none text-[13px] font-semibold leading-none"
            style={{ color: palette.muted }}
            title={FL_ANOMALY_HELP}
            aria-label={FL_ANOMALY_HELP}
          >
            ?
          </span>
        </div>
        <h2 className="pr-14 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-muted)" }}>
          Anomaly
        </h2>

      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <span
          className="font-semibold tabular-nums leading-none tracking-tight"
          style={{ color: palette.text, fontSize: "clamp(28px, 5vw, 34px)" }}
        >
          {insufficient ? "—" : (stress.stress_score * 100).toFixed(0)}
        </span>
        {insufficient ? null : (
          <>
            <span className="pb-1 text-[12px] font-medium tabular-nums" style={{ color: palette.muted }}>
              / 100
            </span>
            <span
              className="mb-0.5 inline-flex rounded-[2px] border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{ borderColor: bandColor, color: bandColor }}
            >
              {stress.stress_band}
            </span>
          </>
        )}
      </div>

      <p className="mt-2 text-[11px] leading-snug" style={{ color: palette.muted }}>
        <span className="font-semibold uppercase tracking-[0.06em]" style={{ color: palette.soft }}>
          ETF basket (monthly returns)
        </span>
        <span className="mx-1 opacity-50" aria-hidden>
          ·
        </span>
        <span className="font-mono">{universe}</span>
      </p>

      {contributors.length > 0 ? (
        <div className="text-[11px] leading-snug" style={{ color: palette.muted }}>
          <span className="font-semibold uppercase tracking-[0.06em]" style={{ color: palette.soft }}>
            Largest |z| this month
          </span>
          <ul className="mt-1 list-inside list-disc font-mono">
            {contributors.map((c) => (
              <li key={c.symbol}>
                {c.symbol}{" "}
                <span className="tabular-nums opacity-90">|z| = {Number(c.z_abs).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {visibleDrivers.length > 0 ? (
        <p className="text-[11px] leading-snug" style={{ color: palette.muted }}>
          <span className="font-semibold uppercase tracking-[0.06em]" style={{ color: palette.soft }}>
            Signals
          </span>
          : {visibleDrivers.map(humanizeStressDriver).join(" · ")}
        </p>
      ) : null}
      </div>

      {navigatorGrowthSparklineValues.length >= 2 ? (
        <div className="relative mt-0.5 border-t pt-2.5" style={{ borderColor: palette.borderSoft }}>
          <CardHelpHint text={FL_NAVIGATOR_GROWTH_HELP} palette={palette} />
          <p className="pr-6 text-[11px] font-semibold leading-snug" style={{ color: palette.soft }}>
            Navigator growth score
          </p>
          <div className="mt-2 min-h-[40px] w-full min-w-0">
            <LabSparkline values={navigatorGrowthSparklineValues} stroke={palette.soft} height={40} />
          </div>
          <p className="mt-1 text-[11px] uppercase tracking-[0.06em]" style={{ color: palette.muted }}>
            Monthly points: {navigatorGrowthSparklineValues.length}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Sparkline — same geometry as Macro Sentiment KPI strip (full width). */
function LabSparkline({ values, stroke, height = 36 }: { values: number[]; stroke: string; height?: number }) {
  const pts = values.filter((v) => Number.isFinite(v));
  if (pts.length < 2) {
    return <div className="w-full opacity-30" style={{ height }} />;
  }
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const pad = Math.max(1e-6, (max - min) * 0.08);
  const lo = min - pad;
  const hi = max + pad;
  const w = 1000;
  const h = height - 4;
  const path = pts
    .map((v, i) => {
      const x = (i / Math.max(1, pts.length - 1)) * w;
      const y = h - ((v - lo) / (hi - lo)) * h + 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${w} ${height}`}
      className="block min-h-0 min-w-0 w-full"
      preserveAspectRatio="none"
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Area under sparkline — translucent fill for macro panel horizon column. */
function LabSparklineFilled({
  values,
  stroke,
  fill,
  height = 32,
}: {
  values: number[];
  stroke: string;
  fill: string;
  height?: number;
}) {
  const pts = values.filter((v) => Number.isFinite(v));
  if (pts.length < 2) {
    return <div className="w-full rounded-[2px] opacity-20" style={{ height, background: fill }} />;
  }
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const pad = Math.max(1e-6, (max - min) * 0.08);
  const lo = min - pad;
  const hi = max + pad;
  const w = 1000;
  const h = height - 4;
  const linePath = pts
    .map((v, i) => {
      const x = (i / Math.max(1, pts.length - 1)) * w;
      const y = h - ((v - lo) / (hi - lo)) * h + 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const fillPath = `${linePath} L${w},${height} L0,${height} Z`;
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${w} ${height}`}
      className="block min-h-0 min-w-0 w-full"
      preserveAspectRatio="none"
    >
      <path d={fillPath} fill={fill} stroke="none" opacity={0.32} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const MACRO_PANEL_HORIZONS = [0, 1, 3, 6] as const;
const MACRO_PANEL_ASSETS = ["SPY", "GLD", "TLT", "UNRATE"] as const;

function pivotMacroForecasts(rows: MacroForecastRow[]): Map<string, Partial<Record<number, MacroForecastRow>>> {
  const m = new Map<string, Partial<Record<number, MacroForecastRow>>>();
  for (const r of rows) {
    if (!m.has(r.series_id)) m.set(r.series_id, {});
    m.get(r.series_id)![r.horizon_months] = r;
  }
  return m;
}

function formatMacroPanelValue(seriesId: string, v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (seriesId === "UNRATE") return v.toFixed(1);
  return v.toFixed(2);
}

/**
 * Macro panel — asset / horizon spark / spot (0) vs forward month preds (1, 3, 6). Gaps are backend-driven (different series horizons).
 */
function ForecastLabMacroPanelTable({
  macroRows,
  regimeItems,
  palette,
}: {
  macroRows: MacroForecastRow[];
  regimeItems: RegimeHistoryRow[];
  palette: ShellPalette;
}) {
  const pivot = useMemo(() => pivotMacroForecasts(macroRows), [macroRows]);

  const sortedHistory = useMemo(() => {
    if (regimeItems.length < 2) return [];
    return [...regimeItems].sort((a, b) => a.obs_date.localeCompare(b.obs_date)).slice(-36);
  }, [regimeItems]);

  const growthSpark = useMemo(
    () => sortedHistory.map((r) => r.navigator_growth_score).filter(Number.isFinite),
    [sortedHistory],
  );
  const fedSpark = useMemo(
    () => sortedHistory.map((r) => r.navigator_fed_score).filter(Number.isFinite),
    [sortedHistory],
  );

  const topRows = useMemo(
    () =>
      [
        {
          id: "growth_score_nowcast" as const,
          label: "Macro Sentiment",
          nowTint: "accent" as const,
          spark: growthSpark,
          sparkStroke: palette.green,
          sparkFill: palette.green,
        },
        {
          id: "fed_policy_score_nowcast" as const,
          label: "Fed Policy Score",
          nowTint: "warn" as const,
          spark: fedSpark,
          sparkStroke: palette.blue,
          sparkFill: palette.blue,
        },
      ] as const,
    [growthSpark, fedSpark, palette.green, palette.blue],
  );

  const assetSparkStyle: Record<string, { stroke: string; fill: string }> = useMemo(
    () => ({
      SPY: { stroke: palette.green, fill: palette.green },
      GLD: { stroke: palette.yellow, fill: palette.yellow },
      TLT: { stroke: palette.blue, fill: palette.blue },
      UNRATE: { stroke: palette.red, fill: palette.red },
    }),
    [palette.green, palette.yellow, palette.blue, palette.red],
  );

  const rowBorder = "1px solid color-mix(in srgb, var(--nd-text) 6%, transparent)";
  const headMuted = { color: palette.muted, fontSize: 11, letterSpacing: "0.1em", fontWeight: 600 as const };

  if (!macroRows.length) {
    return <NextNoData compact hint="Forecasts appear after the models are trained." />;
  }

  // Untrained forecasts carry a placeholder value (0.0): show a dash instead (D-22).
  const cellAt = (sid: string, h: number) => {
    const r = pivot.get(sid)?.[h];
    return r && r.trained ? r.value : null;
  };

  const nowTextColor = (tint: "accent" | "warn" | "default") => {
    if (tint === "accent") return palette.green;
    if (tint === "warn") return palette.yellow;
    return palette.soft;
  };

  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full border-collapse" style={{ tableLayout: "fixed", fontSize: 13 }}>
        <colgroup>
          <col style={{ width: "30%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "13.5%" }} />
          <col style={{ width: "13.5%" }} />
          <col style={{ width: "13.5%" }} />
          <col style={{ width: "13.5%" }} />
        </colgroup>
        <thead>
          <tr style={{ borderBottom: "1px solid color-mix(in srgb, var(--nd-text) 14%, transparent)" }}>
            <th className="py-2 pr-2 text-left uppercase" style={headMuted}>
              Asset
            </th>
            <th className="py-2 text-center uppercase" style={headMuted}>
              Chart
            </th>
            <th className="py-2 text-center uppercase" style={headMuted}>
              NOW
            </th>
            <th className="py-2 text-center uppercase" style={headMuted}>
              1
            </th>
            <th className="py-2 text-center uppercase" style={headMuted}>
              3
            </th>
            <th className="py-2 text-center uppercase" style={headMuted}>
              6
            </th>
          </tr>
        </thead>
        <tbody>
          {topRows.map((row) => (
            <tr key={row.id} style={{ borderBottom: rowBorder }}>
              <td className="py-2 pr-2 align-middle">
                <div className="font-semibold leading-tight" style={{ color: palette.text, fontSize: 14 }}>
                  {row.label}
                </div>
              </td>
              <td className="px-1 py-2 align-middle">
                <div className="min-h-[28px] w-full min-w-[72px]">
                  <LabSparklineFilled values={row.spark} stroke={row.sparkStroke} fill={row.sparkFill} height={28} />
                </div>
              </td>
              {MACRO_PANEL_HORIZONS.map((h) => (
                <td
                  key={h}
                  className="px-1 py-2 text-center align-middle tabular-nums"
                  style={{
                    color: h === 0 ? nowTextColor(row.nowTint) : palette.soft,
                    fontWeight: h === 0 ? 600 : 500,
                  }}
                >
                  {formatMacroPanelValue(row.id, cellAt(row.id, h))}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td colSpan={6} style={{ padding: "4px 0", border: "none", background: "transparent" }}>
              <div style={{ borderTop: "1px dashed color-mix(in srgb, var(--nd-text) 14%, transparent)" }} />
            </td>
          </tr>
          {MACRO_PANEL_ASSETS.map((sid) => {
            const colors = assetSparkStyle[sid];
            const display =
              macroRows.find((r) => r.series_id === sid)?.display_name ??
              (sid === "UNRATE" ? "Unemployment rate" : sid);
            const sparkVals: number[] = [];
            return (
              <tr key={sid} style={{ borderBottom: rowBorder }}>
                <td className="py-2 pr-2 align-middle">
                  <div className="font-semibold leading-tight" style={{ color: palette.text, fontSize: 14 }} title={display}>
                    {sid}
                  </div>
                </td>
                <td className="px-1 py-2 align-middle">
                  <div className="min-h-[28px] w-full min-w-[72px]">
                    <LabSparklineFilled values={sparkVals} stroke={colors.stroke} fill={colors.fill} height={28} />
                  </div>
                </td>
                {MACRO_PANEL_HORIZONS.map((h) => (
                  <td
                    key={h}
                    className="px-1 py-2 text-center align-middle tabular-nums"
                    style={{ color: palette.soft, fontWeight: 500 }}
                  >
                    {formatMacroPanelValue(sid, cellAt(sid, h))}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Ensemble vs Navigator quadrant — pill like Radar recession checklist score badge. */
function NavigatorMatchBadge({
  match,
  palette,
}: {
  match: boolean | null | undefined;
  palette: ShellPalette;
}) {
  if (match === null || match === undefined) {
    return (
      <span
        className="shrink-0 whitespace-nowrap rounded-[2px] border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em]"
        style={{ borderColor: palette.borderSoft, color: palette.muted }}
      >
        —
      </span>
    );
  }
  const ok = match === true;
  return (
    <span
      className="shrink-0 whitespace-nowrap rounded-[2px] border px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em]"
      style={{
        borderColor: ok ? palette.green : palette.red,
        color: ok ? palette.green : palette.red,
      }}
    >
      {ok ? "MATCH" : "UNMATCH"}
    </span>
  );
}

/** Regime label + percent fill (matches quadrant accents). */
function quadrantTitleFill(key: QuadrantKey): string {
  switch (key) {
    case "Q1_GOLDILOCKS":
      return "var(--nd-green)";
    case "Q2_REFLATION":
      return "var(--nd-blue)";
    case "Q3_OVERHEATING":
      return "var(--nd-yellow)";
    case "Q4_STAGFLATION":
      return "var(--nd-red)";
    default:
      return "var(--nd-text)";
  }
}

/**
 * Regime map — 3×3 grid: corner tiles + central cross gutter so dashed axes never touch quadrant fills.
 * Bubble diameter ≈ 40 + p×120 px (clamped).
 */
const REGIME_MAP_MAX_W = 600;
const REGIME_MAP_H = 300;

function RegimeMapChart({ probabilities }: { probabilities: PhaseProbabilities }) {
  const g = REGIME_MAP_CROSS_GUTTER_PX;
  const axisDash = "1px dashed color-mix(in srgb, var(--nd-text) 38%, transparent)";

  return (
    <div className="min-w-0 w-full">
      <div
        className="relative mx-auto w-full"
        style={{
          maxWidth: REGIME_MAP_MAX_W,
          height: REGIME_MAP_H,
          overflow: "visible",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `minmax(0, 1fr) ${g}px minmax(0, 1fr)`,
            gridTemplateRows: `minmax(0, 1fr) ${g}px minmax(0, 1fr)`,
            width: "100%",
            height: "100%",
            position: "relative",
            zIndex: 0,
          }}
        >
          {REGIME_MAP_GRID_ORDER.map(({ key, corner }) => {
            const p = Math.max(0, probabilities[key as QuadrantKey]);
            const vis = REGIME_MAP_QUADRANT_VISUAL[key];
            const place = REGIME_MAP_GRID_PLACE[key];
            const title = (QUADRANT_LABELS[key] ?? key).toUpperCase();
            const pctStr = `${(p * 100).toFixed(0)}%`;
            const rawD = 36 + p * 90;
            // Cap below the free area under/above the corner label and shift the bubble away from it (D-27).
            const d = Math.min(92, Math.max(28, rawD));
            const shiftY = corner === "tl" || corner === "tr" ? 24 : -24;
            return (
              <div
                key={key}
                style={{
                  position: "relative",
                  gridColumn: place.gridColumn,
                  gridRow: place.gridRow,
                  border: vis.frame,
                  borderRadius: 0,
                  background: vis.cellFill,
                  minWidth: 0,
                  minHeight: 0,
                  overflow: "hidden",
                  zIndex: 1,
                }}
              >
                <div style={{ ...regimeMapCornerLabelStyle(corner) }}>
                  <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.03em", color: vis.accent }}>{title}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2, color: vis.accent }}>{pctStr}</div>
                </div>
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: d,
                    height: d,
                    marginLeft: -d / 2,
                    marginTop: -d / 2 + shiftY,
                    borderRadius: "50%",
                    background: vis.bubble,
                    boxShadow: "none",
                    zIndex: 1,
                    pointerEvents: "none",
                  }}
                />
              </div>
            );
          })}

          <div
            aria-hidden
            style={{
              gridColumn: 2,
              gridRow: "1 / 4",
              display: "flex",
              justifyContent: "center",
              alignItems: "stretch",
              pointerEvents: "none",
              zIndex: 3,
              background: "transparent",
            }}
          >
            <div style={{ width: 0, height: "100%", borderLeft: axisDash }} />
          </div>
          <div
            aria-hidden
            style={{
              gridColumn: "1 / 4",
              gridRow: 2,
              display: "flex",
              alignItems: "center",
              pointerEvents: "none",
              zIndex: 3,
              background: "transparent",
            }}
          >
            <div style={{ height: 0, width: "100%", borderTop: axisDash }} />
          </div>
          <div
            aria-hidden
            style={{
              gridColumn: 2,
              gridRow: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              zIndex: 4,
              background: "transparent",
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "var(--nd-text)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Phase–asset hit rates — one row aligned with Expert table columns (26% + 18.5%×4). */
function ExpertBreakdownHitRate({
  data,
  palette,
}: {
  data: PhaseAssetAlignment | undefined;
  palette: ShellPalette;
}) {
  if (!data) {
    return (
      <div className="mt-3 w-full min-w-0 border-t pt-3" style={{ borderColor: "var(--nd-border-soft)" }}>
        <p className="text-[11px]" style={{ color: palette.muted }}>
          No phase–asset alignment for this range.
        </p>
      </div>
    );
  }
  const overallStr =
    data.overall_hit_rate != null && Number.isFinite(data.overall_hit_rate)
      ? `${(data.overall_hit_rate * 100).toFixed(1)}%`
      : "—";
  const quadStr = (key: QuadrantKey) => {
    const r = data.by_quadrant?.[key];
    if (r === null || r === undefined || typeof r !== "number" || !Number.isFinite(r)) return "—";
    return `${(r * 100).toFixed(1)}%`;
  };
  const hitCell: CSSProperties = { padding: "8px 10px", minHeight: 52, verticalAlign: "middle" };
  return (
    <div className="mt-3 w-full min-w-0 border-t pt-3" style={{ borderColor: "var(--nd-border-soft)" }}>
      <table
        className="w-full max-w-full"
        style={{
          tableLayout: "fixed",
          borderCollapse: "separate",
          borderSpacing: "4px",
          backgroundColor: EXPERT_TABLE_GAP_BG,
        }}
      >
        <colgroup>
          <col style={{ width: "26%" }} />
          {QUADRANT_ORDER.map((k) => (
            <col key={k} style={{ width: "18.5%" }} />
          ))}
        </colgroup>
        <tbody>
          <tr>
            <td
              style={{
                ...hitCell,
                textAlign: "center",
                background: "transparent",
                border: HITRATE_CELL_BORDER,
              }}
            >
              <div className="flex flex-col items-center justify-center gap-1">
                <div
                  className="text-[12px] font-semibold uppercase leading-tight tracking-[0.07em]"
                  style={{ color: palette.muted }}
                >
                  OVERALL HITRATE
                </div>
                <div className="font-mono text-[11px] tabular-nums font-medium leading-none" style={{ color: palette.soft }}>
                  {overallStr}
                </div>
              </div>
            </td>
            {QUADRANT_ORDER.map((k) => (
              <td
                key={k}
                style={{
                  ...hitCell,
                  textAlign: "center",
                  background: "transparent",
                  border: HITRATE_CELL_BORDER,
                }}
              >
                <div className="flex flex-col items-center justify-center gap-1">
                  <div
                    className="text-[12px] font-semibold uppercase leading-tight tracking-[0.07em]"
                    style={{ color: EXPERT_REGIME_HEADER_COLOR[k] }}
                  >
                    {(QUADRANT_LABELS[k] ?? k).toUpperCase()}
                  </div>
                  <div className="font-mono text-[11px] tabular-nums font-medium leading-none" style={{ color: EXPERT_REGIME_HEADER_COLOR[k] }}>
                    {quadStr(k)}
                  </div>
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      {data.note ? (
        <p className="mt-2 text-[11px] leading-relaxed" style={{ color: palette.muted }}>
          {data.note}
        </p>
      ) : null}
    </div>
  );
}

function ExpertProbabilityTable({
  experts,
  ensemblePhase,
}: {
  experts: ExpertPhaseBreakdown;
  ensemblePhase?: PhaseProbabilities | null;
}) {
  const models: { id: keyof ExpertPhaseBreakdown; label: string }[] = [
    { id: "rule", label: "Rule-Based" },
    { id: "hmm", label: "HMM" },
    { id: "gbdt", label: "GBDT" },
  ];
  if (experts.cycle) {
    models.push({ id: "cycle", label: "Cycle Model" });
  }

  const cellPad: CSSProperties = { padding: "7px 8px", minHeight: 38, verticalAlign: "middle" };
  const modelText: CSSProperties = {
    fontSize: 14,
    fontWeight: 500,
    color: "color-mix(in srgb, var(--nd-text) 82%, transparent)",
    textAlign: "left",
  };
  const valueTextBase: CSSProperties = {
    fontSize: 14,
    fontWeight: 500,
    textAlign: "center",
  };

  const neutralHead: CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: "0.08em",
    background: "transparent",
    border: "none",
  };

  return (
    <div className="min-w-0 w-full">
      <table
        className="w-full max-w-full"
        style={{
          tableLayout: "fixed",
          borderCollapse: "separate",
          borderSpacing: "3px",
          backgroundColor: EXPERT_TABLE_GAP_BG,
          border: "none",
        }}
      >
        <colgroup>
          <col style={{ width: "26%" }} />
          {QUADRANT_ORDER.map((k) => (
            <col key={k} style={{ width: "18.5%" }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th
              style={{
                ...cellPad,
                ...neutralHead,
                color: "color-mix(in srgb, var(--nd-text) 45%, transparent)",
                textAlign: "left",
              }}
            >
              Model
            </th>
            {QUADRANT_ORDER.map((k) => (
              <th
                key={k}
                style={{
                  ...cellPad,
                  ...neutralHead,
                  textAlign: "center",
                  color: EXPERT_REGIME_HEADER_COLOR[k],
                }}
              >
                {(QUADRANT_LABELS[k] ?? k).toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {models.map(({ id, label }) => {
            const row = experts[id] as PhaseProbabilities | null | undefined;
            if (!row) return null;
            return (
              <tr key={id}>
                <td
                  style={{
                    ...cellPad,
                    ...modelText,
                    background: "transparent",
                    border: "none",
                  }}
                >
                  {label}
                </td>
                {QUADRANT_ORDER.map((k) => {
                  const v = row[k as QuadrantKey];
                  return (
                    <td
                      key={k}
                      style={{
                        ...cellPad,
                        ...valueTextBase,
                        color: EXPERT_REGIME_HEADER_COLOR[k],
                        background: EXPERT_REGIME_COLUMN_BG[k],
                        border: "none",
                      }}
                    >
                      {Number(v).toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {ensemblePhase ? (
            <>
              <tr>
                <td colSpan={1 + QUADRANT_ORDER.length} style={{ padding: 0, border: "none", background: "transparent" }}>
                  <div
                    style={{
                      borderTop: "1px dashed color-mix(in srgb, var(--nd-text) 15%, transparent)",
                      margin: "8px 0",
                    }}
                  />
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    ...cellPad,
                    ...modelText,
                    background: "transparent",
                    border: "none",
                  }}
                >
                  Ensemble
                </td>
                {QUADRANT_ORDER.map((k) => {
                  const v = ensemblePhase[k as QuadrantKey];
                  return (
                    <td
                      key={k}
                      style={{
                        ...cellPad,
                        ...valueTextBase,
                        color: EXPERT_REGIME_HEADER_COLOR[k],
                        background: EXPERT_REGIME_COLUMN_BG[k],
                        border: "none",
                      }}
                    >
                      {Number(v).toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            </>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

const CM_AXIS_SHORT = ["RO", "GR", "VA", "RF"] as const;

function CardHelpHint({ text, palette }: { text: string; palette: ShellPalette }) {
  return (
    <span
      className="absolute right-2 top-2 z-[2] cursor-help select-none text-[13px] font-semibold leading-none"
      style={{ color: palette.muted }}
      title={text}
      aria-label={text}
    >
      ?
    </span>
  );
}

type ForecastLabOosApiRow = {
  bundle_id?: string;
  metrics?: Record<string, unknown>;
};

function extractFlTrainMetrics(oos: ForecastLabOosApiRow | undefined): Record<string, unknown> {
  const wrap = oos?.metrics;
  if (!wrap || typeof wrap !== "object") return {};
  const inner = wrap.metrics;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) return inner as Record<string, unknown>;
  // Legacy flat meta or mis-shaped payload: training artifacts at top level of `metrics`
  if ("confusion_matrix_monthly" in wrap || "calibration_bins" in wrap) {
    return wrap as Record<string, unknown>;
  }
  return {};
}

function FlConfusionMatrixCard({ trainMetrics, palette }: { trainMetrics: Record<string, unknown>; palette: ShellPalette }) {
  const raw = trainMetrics.confusion_matrix_monthly;
  const cm = Array.isArray(raw) ? (raw as number[][]) : null;
  const accRaw = trainMetrics.confusion_accuracy;
  const accPct =
    typeof accRaw === "number" && Number.isFinite(accRaw) ? `${(accRaw * 100).toFixed(0)}%` : "—";
  const cell = (predR: number, actualC: number) => {
    if (!cm || !cm[actualC]) return 0;
    const v = cm[actualC][predR];
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      {!cm || cm.length !== 4 ? (
        <p className="text-[11px]" style={{ color: palette.muted }}>
          Run training to populate confusion matrix (new bundles include test-set CM).
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table
              className="w-full max-w-full text-center text-[12px]"
              style={{
                tableLayout: "fixed",
                borderCollapse: "separate",
                borderSpacing: "3px",
                backgroundColor: EXPERT_TABLE_GAP_BG,
                border: "none",
                minWidth: "min(100%, 380px)",
              }}
            >
              <colgroup>
                <col style={{ width: "6%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "20.75%" }} />
                <col style={{ width: "20.75%" }} />
                <col style={{ width: "20.75%" }} />
                <col style={{ width: "20.75%" }} />
              </colgroup>
              <thead>
                <tr style={{ color: palette.muted }}>
                  <th colSpan={2} className="px-1 py-1" style={{ border: "none", background: "transparent" }} />
                    <th
                      className="px-1 py-1 text-[12px] font-semibold uppercase tracking-[0.08em]"
                      colSpan={4}
                      style={{ border: "none", background: "transparent" }}
                    >
                      Actual
                    </th>
                </tr>
                <tr style={{ color: palette.muted }}>
                  <th colSpan={2} className="px-1 py-1" style={{ border: "none", background: "transparent" }} />
                  {CM_AXIS_SHORT.map((a, i) => (
                    <th
                      key={a}
                      className="px-1 py-1 font-mono text-[13px] font-semibold"
                      style={{
                        color: EXPERT_REGIME_HEADER_COLOR[QUADRANT_ORDER[i] as QuadrantKey],
                        border: "none",
                        background: "transparent",
                      }}
                    >
                      {a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CM_AXIS_SHORT.map((pr, r) => (
                  <tr key={pr}>
                    {r === 0 ? (
                      <th
                        rowSpan={4}
                        className="align-middle px-0 py-1 text-[12px] font-semibold uppercase tracking-[0.08em]"
                        style={{
                          border: "none",
                          background: "transparent",
                          color: palette.muted,
                          writingMode: "vertical-rl",
                          transform: "rotate(180deg)",
                          lineHeight: 1.1,
                        }}
                      >
                        Predicted
                      </th>
                    ) : null}
                    <th
                      className="py-1.5 px-1 text-center font-mono text-[13px] font-semibold uppercase tracking-[0.06em]"
                      style={{
                        color: EXPERT_REGIME_HEADER_COLOR[QUADRANT_ORDER[r] as QuadrantKey],
                        border: "none",
                        background: "transparent",
                      }}
                    >
                      {pr}
                    </th>
                    {CM_AXIS_SHORT.map((_, c) => {
                      const v = cell(r, c);
                      const diag = r === c;
                      const qk = QUADRANT_ORDER[c] as QuadrantKey;
                      const maxCell = Math.max(
                        1,
                        ...CM_AXIS_SHORT.flatMap((_, rr) =>
                          CM_AXIS_SHORT.map((__, cc) => {
                            if (!cm || !cm[cc]) return 0;
                            const vv = cm[cc][rr];
                            return typeof vv === "number" && Number.isFinite(vv) ? vv : 0;
                          }),
                        ),
                      );
                      const intensity = Math.min(1, Math.max(0, v / maxCell));
                      const fg = diag ? "color-mix(in srgb, var(--nd-text) 96%, transparent)" : "color-mix(in srgb, var(--nd-text) 86%, transparent)";
                      return (
                        <td
                          key={`${r}-${c}`}
                          className="font-mono tabular-nums text-[13px]"
                          style={{
                            padding: "5px 6px",
                            border: "none",
                            outline: "none",
                            boxShadow: "none",
                            background: diag
                              ? quadrantBgTint(qk, 0.48 + intensity * 0.42)
                              : quadrantBgTint(qk, 0.08 + intensity * 0.18),
                            color: fg,
                          }}
                        >
                          {v}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-auto text-[11px] leading-tight" style={{ color: palette.muted }}>
            Accuracy: <span style={{ color: palette.soft }}>{accPct}</span>
          </p>
        </>
      )}
    </div>
  );
}

function FlCalibrationCard({ trainMetrics, palette }: { trainMetrics: Record<string, unknown>; palette: ShellPalette }) {
  const binsRaw = trainMetrics.calibration_bins;
  const bins = Array.isArray(binsRaw) ? (binsRaw as { p_mid?: number; accuracy?: number | null }[]) : [];
  const pts = bins.filter((b) => typeof b.accuracy === "number" && Number.isFinite(b.accuracy));
  const W = 340; // near the rendered card width so SVG text stays >= 11px (D-29)
  const H = 198;
  const padL = 72;
  const padR = 10;
  const padT = 10;
  const padB = 48;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const plotBottom = H - padB;
  const axisMidY = padT + plotH / 2;
  const yTitleX = 10;
  const mapX = (p: number) => padL + p * plotW;
  const mapY = (a: number) => plotBottom - a * plotH;
  const axisStroke = "color-mix(in srgb, var(--nd-text) 14%, transparent)";
  const axisW = 1.75;
  const tickLen = 6;
  const tickVals = [0, 0.25, 0.5, 0.75, 1];
  const perfect = `M ${mapX(0)},${mapY(0)} L ${mapX(1)},${mapY(1)}`;
  const modelPath =
    pts.length >= 2
      ? pts
          .map((b, i) => {
            const pm = typeof b.p_mid === "number" ? b.p_mid : 0;
            const ac = typeof b.accuracy === "number" ? b.accuracy : 0;
            const cmd = i === 0 ? "M" : "L";
            return `${cmd}${mapX(pm).toFixed(1)},${mapY(ac).toFixed(1)}`;
          })
          .join(" ")
      : "";

  const xTickNumberY = plotBottom + tickLen + 16;
  const xAxisTitleY = H - 6;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      {pts.length === 0 ? (
        <p className="text-[11px]" style={{ color: palette.muted }}>
          No calibration bins (retrain bundle for reliability curve).
        </p>
      ) : (
        <>
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} className="block min-h-0 w-full shrink-0" preserveAspectRatio="xMidYMid meet">
            <line x1={padL} y1={plotBottom} x2={W - padR} y2={plotBottom} stroke={axisStroke} strokeWidth={axisW} strokeLinecap="square" />
            <line x1={padL} y1={padT} x2={padL} y2={plotBottom} stroke={axisStroke} strokeWidth={axisW} strokeLinecap="square" />
            {tickVals.map((t) => (
              <g key={`x-${t}`}>
                <line
                  x1={mapX(t)}
                  y1={plotBottom}
                  x2={mapX(t)}
                  y2={plotBottom + tickLen}
                  stroke={axisStroke}
                  strokeWidth={1.25}
                />
                <text
                  x={mapX(t)}
                  y={xTickNumberY}
                  textAnchor="middle"
                  fill={palette.muted}
                  fontSize={13}
                  fontFamily="ui-monospace, monospace"
                >
                  {t.toFixed(2)}
                </text>
              </g>
            ))}
            {tickVals.map((t) => (
              <g key={`y-${t}`}>
                <line
                  x1={padL - tickLen}
                  y1={mapY(t)}
                  x2={padL}
                  y2={mapY(t)}
                  stroke={axisStroke}
                  strokeWidth={1.25}
                />
                <text
                  x={padL - 22}
                  y={mapY(t) + 5}
                  textAnchor="end"
                  fill={palette.muted}
                  fontSize={13}
                  fontFamily="ui-monospace, monospace"
                >
                  {t.toFixed(2)}
                </text>
              </g>
            ))}
            <text
              x={padL + plotW / 2}
              y={xAxisTitleY}
              textAnchor="middle"
              fill={palette.soft}
              fontSize={13}
              fontWeight={600}
              letterSpacing="0.06em"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              PREDICTED PROBABILITY
            </text>
            <text
              x={yTitleX}
              y={axisMidY}
              textAnchor="middle"
              fill={palette.soft}
              fontSize={13}
              fontWeight={600}
              letterSpacing="0.06em"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              transform={`rotate(-90, ${yTitleX}, ${axisMidY})`}
            >
              ACTUAL FREQUENCY
            </text>
            <path
              d={perfect}
              fill="none"
              stroke="color-mix(in srgb, var(--nd-text) 42%, transparent)"
              strokeWidth={2}
              strokeDasharray="7 5"
              strokeLinecap="round"
            />
            {modelPath ? (
              <path
                d={modelPath}
                fill="none"
                stroke={palette.yellow}
                strokeWidth={2.35}
                strokeLinecap="butt"
                strokeLinejoin="miter"
              />
            ) : null}
            {pts.map((b, i) => {
              const pm = typeof b.p_mid === "number" ? b.p_mid : 0;
              const ac = typeof b.accuracy === "number" ? b.accuracy : 0;
              return <circle key={i} cx={mapX(pm)} cy={mapY(ac)} r={4.25} fill={palette.yellow} opacity={0.98} />;
            })}
          </svg>
          <div
            className="flex flex-wrap justify-center gap-x-4 gap-y-0.5 text-[11px]"
            style={{ color: palette.muted }}
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0 w-6 border-t-2 border-dashed" style={{ borderColor: "color-mix(in srgb, var(--nd-text) 42%, transparent)" }} />{" "}
              Perfect
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-6 rounded-full" style={{ background: palette.yellow }} /> Model
            </span>
          </div>
        </>
      )}
    </div>
  );
}

const FI_BAR_COLORS = ["var(--nd-green)", "var(--nd-yellow)", "var(--nd-blue)", "var(--nd-red)", "var(--nd-purple)"];

function FlFeatureImportanceCard({ trainMetrics, palette }: { trainMetrics: Record<string, unknown>; palette: ShellPalette }) {
  const raw = trainMetrics.feature_importance_top;
  const rows = Array.isArray(raw) ? (raw as { name?: string; importance?: number }[]) : [];
  const sorted = [...rows]
    .filter((r) => typeof r.importance === "number" && Number.isFinite(r.importance))
    .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
    .slice(0, 5);
  const maxI = Math.max(0.08, ...sorted.map((r) => r.importance ?? 0));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {sorted.length === 0 ? (
        <p className="text-[11px]" style={{ color: palette.muted }}>
          No feature importance (retrain with XGBoost artifact).
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((r, i) => {
            const imp = typeof r.importance === "number" ? r.importance : 0;
            const wPct = Math.min(100, (imp / maxI) * 100);
            const name = typeof r.name === "string" ? r.name : "—";
            const col = FI_BAR_COLORS[i % FI_BAR_COLORS.length];
            return (
              <div key={`${name}-${i}`} className={cn(FL_HBAR_ROW_GRID, "min-w-0 rounded-[2px] py-1 pl-0.5 pr-1")}>
                <span
                  className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.11em]"
                  style={{ color: palette.muted }}
                  title={name}
                >
                  {name}
                </span>
                <div
                  className={cn(FL_HBAR_HEIGHT, "min-w-0 overflow-hidden rounded-none border")}
                  style={{
                    borderColor: palette.borderSoft,
                    background: palette.panelSoft,
                  }}
                >
                  <div className="h-full rounded-none" style={{ width: `${wPct}%`, background: col }} />
                </div>
                <span className="font-mono text-[11px] font-normal tabular-nums" style={{ color: palette.soft }}>
                  {imp.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function weightHistoryXTickIndices(n: number, maxTicks: number): number[] {
  if (n <= 0) return [];
  if (n <= maxTicks) return Array.from({ length: n }, (_, i) => i);
  const step = (n - 1) / Math.max(1, maxTicks - 1);
  const idx: number[] = [];
  for (let k = 0; k < maxTicks; k++) idx.push(Math.min(n - 1, Math.round(k * step)));
  idx.push(0, n - 1);
  return Array.from(new Set(idx)).sort((a, b) => a - b);
}

function formatWeightHistoryDateLabel(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "MMM ''yy");
  } catch {
    return iso;
  }
}

function FlWeightHistoryCard({ trainMetrics, palette }: { trainMetrics: Record<string, unknown>; palette: ShellPalette }) {
  const raw = trainMetrics.ensemble_weight_history;
  const hist = Array.isArray(raw)
    ? (raw as { as_of?: string; rule?: number; hmm?: number; gbdt?: number; cycle?: number }[])
    : [];
  const W = 340; // near the rendered card width so SVG text stays >= 11px (D-29)
  const H = 198;
  const padL = 72;
  const padR = 10;
  const padT = 10;
  const padB = 48;
  const plotW = W - padL - padR;
  const plotBottom = H - padB;
  const plotTop = padT;
  const plotH = plotBottom - plotTop;
  const axisStroke = "color-mix(in srgb, var(--nd-text) 14%, transparent)";
  const gridStroke = "color-mix(in srgb, var(--nd-text) 6%, transparent)";
  const tickLen = 6;
  const yTicks = [0, 0.25, 0.5, 0.75, 1] as const;
  const series: { key: "rule" | "hmm" | "gbdt" | "cycle"; label: string; stroke: string }[] = [
    { key: "rule", label: "w_rule", stroke: palette.yellow },
    { key: "hmm", label: "w_hmm", stroke: palette.blue },
    { key: "gbdt", label: "w_gbdt", stroke: palette.green },
    { key: "cycle", label: "w_cycle", stroke: palette.red },
  ];

  const n = hist.length;
  const mapX = (i: number) =>
    n <= 1 ? padL + plotW / 2 : padL + (i / Math.max(1, n - 1)) * plotW;
  const mapY = (v: number) => plotBottom - Math.min(1, Math.max(0, v)) * plotH;
  const axisMidY = plotTop + plotH / 2;
  const yTitleX = 10;
  const xTickIdx = n >= 2 ? weightHistoryXTickIndices(n, 4) : [];
  const xTickNumberY = plotBottom + tickLen + 16;
  const xAxisTitleY = H - 6;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      {hist.length < 2 ? (
        <p className="text-[11px]" style={{ color: palette.muted }}>
          Weight history builds from validation snapshots after retrain.
        </p>
      ) : (
        <>
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} className="block min-h-0 w-full shrink-0" preserveAspectRatio="xMidYMid meet">
            {yTicks.map((t) => (
              <line key={`grid-${t}`} x1={padL} y1={mapY(t)} x2={W - padR} y2={mapY(t)} stroke={gridStroke} strokeWidth={1} />
            ))}
            <line x1={padL} y1={plotBottom} x2={W - padR} y2={plotBottom} stroke={axisStroke} strokeWidth={1.75} strokeLinecap="square" />
            <line x1={padL} y1={plotTop} x2={padL} y2={plotBottom} stroke={axisStroke} strokeWidth={1.75} strokeLinecap="square" />

            {yTicks.map((t) => (
              <g key={`yt-${t}`}>
                <line x1={padL - tickLen} y1={mapY(t)} x2={padL} y2={mapY(t)} stroke={axisStroke} strokeWidth={1.25} />
                <text
                  x={padL - 22}
                  y={mapY(t) + 5}
                  textAnchor="end"
                  fill={palette.muted}
                  fontSize={13}
                  fontFamily="ui-monospace, monospace"
                >
                  {t.toFixed(2)}
                </text>
              </g>
            ))}

            {xTickIdx.map((i) => (
              <g key={`xt-${i}`}>
                <line x1={mapX(i)} y1={plotBottom} x2={mapX(i)} y2={plotBottom + tickLen} stroke={axisStroke} strokeWidth={1.25} />
                <text
                  x={mapX(i)}
                  y={xTickNumberY}
                  textAnchor="middle"
                  fill={palette.muted}
                  fontSize={13}
                  fontFamily="ui-monospace, monospace"
                >
                  {formatWeightHistoryDateLabel(hist[i]?.as_of)}
                </text>
              </g>
            ))}

            <text
              x={yTitleX}
              y={axisMidY}
              textAnchor="middle"
              fill={palette.soft}
              fontSize={13}
              fontWeight={600}
              letterSpacing="0.06em"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              transform={`rotate(-90, ${yTitleX}, ${axisMidY})`}
            >
              WEIGHT
            </text>
            <text
              x={padL + plotW / 2}
              y={xAxisTitleY}
              textAnchor="middle"
              fill={palette.soft}
              fontSize={13}
              fontWeight={600}
              letterSpacing="0.06em"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              AS OF (VALIDATION)
            </text>

            {series.map(({ key, stroke }) => {
              const d = hist
                .map((h, i) => {
                  const v = typeof h[key] === "number" ? h[key] : 0;
                  const cmd = i === 0 ? "M" : "L";
                  return `${cmd}${mapX(i).toFixed(1)},${mapY(v as number).toFixed(1)}`;
                })
                .join("");
              return (
                <path
                  key={key}
                  d={d}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={1.65}
                  strokeLinecap="butt"
                  strokeLinejoin="miter"
                  opacity={0.96}
                />
              );
            })}
            {series.flatMap(({ key, stroke }) =>
              hist.map((h, i) => {
                const v = typeof h[key] === "number" ? h[key] : 0;
                return (
                  <circle
                    key={`${key}-${i}`}
                    cx={mapX(i)}
                    cy={mapY(v as number)}
                    r={3.25}
                    fill={stroke}
                    stroke="rgba(0,0,0,0.35)"
                    strokeWidth={1}
                  />
                );
              }),
            )}
          </svg>
          <div
            className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[11px]"
            style={{ color: palette.muted }}
          >
            {series.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-5 shrink-0" style={{ background: s.stroke }} />
                <span className="font-mono">{s.label}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export type { ShellPalette, ForecastLabOosApiRow };
export {
  XL_MEDIA,
  MACRO_REGIME_HISTORY_MAX_H,
  MACRO_REGIME_HISTORY_MAX_H_CLASS,
  REGIME_HISTORY_TABLE_BORDER,
  extractScores,
  extractFlTrainMetrics,
  regimeHistoryHorizonMonths,
  regimeHistoryAssetImplTooltip,
  regimeHistoryFwdOkTooltip,
  formatRegimeHistoryObsDate,
  RegimeHistoryQuadrantBadge,
  EnsembleModelWeightsRows,
  PhaseEnsembleCard,
  ForecastLabStressCard,
  ForecastLabMacroPanelTable,
  ExpertProbabilityTable,
  ExpertBreakdownHitRate,
  FlConfusionMatrixCard,
  FlCalibrationCard,
  FlFeatureImportanceCard,
  FlWeightHistoryCard,
  CardHelpHint,
};
