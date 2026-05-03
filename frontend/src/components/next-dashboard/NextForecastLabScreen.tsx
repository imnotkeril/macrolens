"use client";

/**
 * Forecast Lab — ensemble phase (rule + HMM + GBDT [+ cycle]), stress, macro panel,
 * regime history, diagnostics. Data from `/api/forecast-lab/*` (see backend `forecast_lab` service).
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { CalendarDays, Check, Database, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NextDashboardShell } from "@/components/next-dashboard/NextDashboardShell";
import { NEXT_DASHBOARD_NAV_ITEMS } from "@/components/next-dashboard/nextDashboardConfig";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";
import { nextPanelSurfaceStyle } from "@/components/next-dashboard/nextPanelSurface";
import { useDataRefresh } from "@/lib/useDataRefresh";
import {
  getForecastLabSummary,
  getForecastLabTrainStatus,
  postForecastLabTrain,
  getForecastLabDiagnosticsOos,
  getForecastLabPhaseAlignment,
  postForecastLabLogSnapshot,
  postForecastLabTrainResetProgress,
  getForecastLabRegimeHistory,
  postForecastLabRegimeHistoryMaterialize,
} from "@/lib/forecastLabApi";
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
  Q1_GOLDILOCKS: "#79A87D",
  Q2_REFLATION: "#8FB6FF",
  Q3_OVERHEATING: "#E6C06A",
  Q4_STAGFLATION: "#E67D7D",
};

/** Fixed per-column wash — solid tint (no gradient). */
const EXPERT_REGIME_COLUMN_BG: Record<QuadrantKey, string> = {
  Q1_GOLDILOCKS: "rgba(76, 110, 85, 0.30)",
  Q2_REFLATION: "rgba(62, 95, 118, 0.33)",
  Q3_OVERHEATING: "rgba(135, 108, 58, 0.33)",
  Q4_STAGFLATION: "rgba(125, 72, 72, 0.33)",
};

/** Gutter between heatmap cells — same as panel surface. */
const EXPERT_TABLE_GAP_BG = "var(--nd-panel)";

/** Hit-rate row: framed cells, no regime tint fills. */
const HITRATE_CELL_BORDER = "1px solid rgba(255,255,255,0.15)";

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
    cellFill: "rgba(68, 95, 128, 0.22)",
    accent: "#8FB6FF",
    bubble: "rgba(140,170,220,0.8)",
    frame: "1px solid rgba(143,182,255,0.42)",
  },
  Q1_GOLDILOCKS: {
    cellFill: "rgba(68, 112, 88, 0.22)",
    accent: "#7FD7A4",
    bubble: "rgba(130,200,160,0.8)",
    frame: "1px solid rgba(127,215,164,0.42)",
  },
  Q4_STAGFLATION: {
    cellFill: "rgba(125, 72, 72, 0.23)",
    accent: "#E78D8D",
    bubble: "rgba(220,130,130,0.85)",
    frame: "1px solid rgba(231,141,141,0.45)",
  },
  Q3_OVERHEATING: {
    cellFill: "rgba(148, 122, 72, 0.23)",
    accent: "#E6C06A",
    bubble: "rgba(230,195,120,0.9)",
    frame: "1px solid rgba(230,192,106,0.45)",
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
      return `rgba(114, 173, 102, ${a})`;
    case "Q2_REFLATION":
      return `rgba(93, 130, 190, ${a})`;
    case "Q3_OVERHEATING":
      return `rgba(212, 169, 59, ${a})`;
    case "Q4_STAGFLATION":
      return `rgba(212, 93, 114, ${a})`;
    default:
      return `rgba(255,255,255,${a * 0.3})`;
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

/** Visible grid for regime history (monthly) — matches expert breakdown cell framing. */
const REGIME_HISTORY_TABLE_BORDER = "1px solid rgba(255,255,255,0.16)";

/** Macro panel scroll cap (regime history height matches macro card via layout sync on xl). */
const MACRO_REGIME_HISTORY_MAX_H = "min(396px, 54vh)";

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
  const barFill = "rgba(255,255,255,0.22)";

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
            <span className="text-[10px] font-semibold uppercase tracking-[0.11em]" style={{ color: palette.muted }}>
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
            <span className="font-mono text-[10px] font-normal tabular-nums" style={{ color: palette.soft }}>
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
  const phaseHeadline = (QUADRANT_LABELS[summary.phase_class] ?? summary.phase_class).toUpperCase();
  let datePretty = String(summary.as_of_date);
  try {
    datePretty = format(parseISO(String(summary.as_of_date)), "MMM d, yyyy");
  } catch {
    /* keep raw */
  }
  const confPct = (summary.confidence * 100).toFixed(0);
  const match = summary.dashboard_context?.matches_navigator_quadrant;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div
            className="text-[26px] font-semibold uppercase leading-[1.05] tracking-[0.08em] sm:text-[28px]"
            style={{ color: palette.yellow }}
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
          <NavigatorMatchBadge match={match} palette={palette} />
        </div>
      </div>

      <RegimeMapChart probabilities={summary.phase_probabilities} />
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
  "Limited history: fewer than 8 aligned monthly return rows across the ETF basket. Backend uses fallback score 0.25 (low band).";

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
          {(stress.stress_score * 100).toFixed(0)}
        </span>
        <span className="pb-1 text-[12px] font-medium tabular-nums" style={{ color: palette.muted }}>
          / 100
        </span>
        <span
          className="mb-0.5 inline-flex rounded-[2px] border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ borderColor: bandColor, color: bandColor }}
        >
          {stress.stress_band}
        </span>
      </div>

      <p className="mt-2 text-[10px] leading-snug" style={{ color: palette.muted }}>
        <span className="font-semibold uppercase tracking-[0.06em]" style={{ color: palette.soft }}>
          ETF basket (monthly returns)
        </span>
        <span className="mx-1 opacity-50" aria-hidden>
          ·
        </span>
        <span className="font-mono">{universe}</span>
      </p>

      {contributors.length > 0 ? (
        <div className="text-[10px] leading-snug" style={{ color: palette.muted }}>
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
        <p className="text-[10px] leading-snug" style={{ color: palette.muted }}>
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
          <p className="mt-1 text-[10px] uppercase tracking-[0.06em]" style={{ color: palette.muted }}>
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

  const rowBorder = "1px solid rgba(255,255,255,0.06)";
  const headMuted = { color: palette.muted, fontSize: 10, letterSpacing: "0.1em", fontWeight: 600 as const };

  if (!macroRows.length) {
    return <p style={{ color: palette.muted }}>No macro forecasts.</p>;
  }

  const cellAt = (sid: string, h: number) => pivot.get(sid)?.[h]?.value ?? null;

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
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.14)" }}>
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
              <div style={{ borderTop: "1px dashed rgba(255,255,255,0.14)" }} />
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
  const axisDash = "1px dashed rgba(255,255,255,0.38)";

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
            const rawD = 40 + p * 120;
            const d = Math.min(152, Math.max(28, rawD));
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
                    marginTop: -d / 2,
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
                background: "#d6d6d6",
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
        <p className="mt-2 text-[10px] leading-relaxed" style={{ color: palette.muted }}>
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
    color: "rgba(255,255,255,0.82)",
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
                color: "rgba(255,255,255,0.45)",
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
                      borderTop: "1px dashed rgba(255,255,255,0.15)",
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
                      const fg = diag ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.86)";
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
  const W = 480;
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
  const axisStroke = "rgba(255,255,255,0.14)";
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
              fontSize={12}
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
              fontSize={12}
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
              stroke="rgba(255,255,255,0.42)"
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
              <span className="inline-block h-0 w-6 border-t-2 border-dashed" style={{ borderColor: "rgba(255,255,255,0.42)" }} />{" "}
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

const FI_BAR_COLORS = ["#79A87D", "#E6C06A", "#8FB6FF", "#E67D7D", "#B794F6"];

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
                  className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.11em]"
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
                <span className="font-mono text-[10px] font-normal tabular-nums" style={{ color: palette.soft }}>
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
  const W = 480;
  const H = 198;
  const padL = 72;
  const padR = 10;
  const padT = 10;
  const padB = 48;
  const plotW = W - padL - padR;
  const plotBottom = H - padB;
  const plotTop = padT;
  const plotH = plotBottom - plotTop;
  const axisStroke = "rgba(255,255,255,0.14)";
  const gridStroke = "rgba(255,255,255,0.06)";
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
  const xTickIdx = n >= 2 ? weightHistoryXTickIndices(n, 6) : [];
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
              fontSize={12}
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
              fontSize={12}
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

export function NextForecastLabScreen() {
  const { shellThemeVars, toggleTheme, colors: C } = useNextShellTheme();
  const denseSurface = useMemo(
    () => ({ ...nextPanelSurfaceStyle(C), padding: "10px 14px" }) as CSSProperties,
    [C],
  );
  const diagnosticsSurface = useMemo(
    () => ({ ...nextPanelSurfaceStyle(C), padding: "7px 10px" }) as CSSProperties,
    [C],
  );
  const qc = useQueryClient();
  const { refreshing, refreshResult, progress, handleRefresh } = useDataRefresh();
  const [alignMonthEnd, setAlignMonthEnd] = useState(true);

  const summaryQ = useQuery({
    queryKey: ["forecast-lab-summary", alignMonthEnd],
    queryFn: () => getForecastLabSummary({ alignMonthEnd }),
    staleTime: 60_000,
  });
  const trainStatusQ = useQuery({
    queryKey: ["forecast-lab-train-status"],
    queryFn: getForecastLabTrainStatus,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => (q.state.data?.done === false ? 2000 : false),
  });
  const oosQ = useQuery({
    queryKey: ["forecast-lab-oos"],
    queryFn: getForecastLabDiagnosticsOos,
    staleTime: 60_000,
  });
  const trainMetrics = useMemo(
    () => extractFlTrainMetrics(oosQ.data as ForecastLabOosApiRow | undefined),
    [oosQ.data],
  );
  const alignQ = useQuery({
    queryKey: ["forecast-lab-align"],
    queryFn: () => getForecastLabPhaseAlignment(),
    staleTime: 60_000,
  });
  const regimeHistQ = useQuery({
    queryKey: ["forecast-lab-regime-history"],
    queryFn: () => getForecastLabRegimeHistory(),
    staleTime: 30_000,
  });

  const materializeMut = useMutation({
    mutationFn: () => postForecastLabRegimeHistoryMaterialize(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["forecast-lab-regime-history"] });
    },
  });

  const trainMut = useMutation({
    mutationFn: postForecastLabTrain,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["forecast-lab-train-status"] });
    },
  });

  const trainResetMut = useMutation({
    mutationFn: postForecastLabTrainResetProgress,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["forecast-lab-train-status"] });
    },
  });

  const logMut = useMutation({
    mutationFn: () => postForecastLabLogSnapshot({ alignMonthEnd }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["forecast-lab-summary"] });
      void qc.invalidateQueries({ queryKey: ["forecast-lab-regime-history"] });
    },
  });

  const summary = summaryQ.data;

  const macroPanelCardRef = useRef<HTMLDivElement>(null);
  const regimeHistoryCardRef = useRef<HTMLDivElement>(null);
  const flRow1MiddleRef = useRef<HTMLDivElement>(null);
  const flRow1LeftRef = useRef<HTMLDivElement>(null);
  const flRow1RightRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const macroEl = macroPanelCardRef.current;
    const regimeEl = regimeHistoryCardRef.current;
    if (typeof window === "undefined" || !macroEl || !regimeEl) return;

    const xlMq = window.matchMedia(XL_MEDIA);

    const sync = () => {
      if (!xlMq.matches) {
        regimeEl.style.height = "";
        regimeEl.style.minHeight = "";
        return;
      }
      const h = macroEl.getBoundingClientRect().height;
      if (h > 0) {
        regimeEl.style.height = `${Math.round(h)}px`;
        regimeEl.style.minHeight = `${Math.round(h)}px`;
      }
    };

    sync();
    const ro = new ResizeObserver(() => sync());
    ro.observe(macroEl);
    xlMq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    const t = window.setTimeout(sync, 0);

    return () => {
      window.clearTimeout(t);
      ro.disconnect();
      xlMq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, [
    summary?.macro_forecasts,
    summary?.as_of_date,
    regimeHistQ.data?.items,
    regimeHistQ.dataUpdatedAt,
    materializeMut.isSuccess,
    materializeMut.data,
    denseSurface,
  ]);

  const scores = useMemo(() => extractScores(summary), [summary]);
  const stressSparkValues = useMemo(() => {
    const items = regimeHistQ.data?.items ?? [];
    if (items.length < 2) return [];
    const slice = items
      .slice()
      .sort((a, b) => a.obs_date.localeCompare(b.obs_date))
      .slice(-36);
    return slice.map((r) => r.navigator_growth_score).filter(Number.isFinite);
  }, [regimeHistQ.data?.items]);

  /** xl: left (phase) + right (experts) max-height = middle stack (weights + anomaly) so bottoms align. */
  useLayoutEffect(() => {
    const mid = flRow1MiddleRef.current;
    const left = flRow1LeftRef.current;
    const right = flRow1RightRef.current;
    if (typeof window === "undefined" || !mid || !left || !right) return;

    const xlMq = window.matchMedia(XL_MEDIA);

    const sync = () => {
      if (!xlMq.matches) {
        left.style.height = "";
        left.style.minHeight = "";
        right.style.height = "";
        right.style.minHeight = "";
        return;
      }
      const h = mid.getBoundingClientRect().height;
      if (h > 0) {
        const px = `${Math.round(h)}px`;
        left.style.height = px;
        left.style.minHeight = px;
        right.style.height = px;
        right.style.minHeight = px;
      }
    };

    sync();
    const ro = new ResizeObserver(() => sync());
    ro.observe(mid);
    xlMq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    const t = window.setTimeout(sync, 0);

    return () => {
      window.clearTimeout(t);
      ro.disconnect();
      xlMq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, [summary, stressSparkValues, denseSurface]);

  const trainStatus = trainStatusQ.data;

  const prevTrainDoneRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const done = trainStatus?.done;
    if (prevTrainDoneRef.current === false && done === true && trainStatus?.message !== "error") {
      void qc.invalidateQueries({ queryKey: ["forecast-lab-oos"] });
      void qc.invalidateQueries({ queryKey: ["forecast-lab-summary"] });
      void qc.invalidateQueries({ queryKey: ["forecast-lab-regime-history"] });
    }
    prevTrainDoneRef.current = done;
  }, [trainStatus, qc]);

  return (
    <>
      <NextDashboardShell
        navItems={NEXT_DASHBOARD_NAV_ITEMS}
        colors={C}
        shellThemeVars={shellThemeVars}
        updatedAt={summaryQ.data?.as_of_date ? `FL ${summaryQ.data.as_of_date}` : "—"}
        refreshing={refreshing}
        refreshResult={refreshResult}
        progress={progress}
        onRefresh={handleRefresh}
        onThemeToggle={toggleTheme}
      >
        <section className="flex min-h-0 flex-col gap-3">
          {/* Toolbar — same actions as legacy /forecast-lab */}
          <div
            className="flex flex-wrap items-center gap-2 border-b pb-3"
            style={{ borderColor: "var(--nd-border-soft)" }}
          >
            <button
              type="button"
              onClick={() => summaryQ.refetch()}
              disabled={summaryQ.isFetching}
              className="rounded-[2px] border px-3 py-1.5 text-[11px] font-medium transition-opacity disabled:opacity-50"
              style={{ borderColor: C.border, color: C.soft }}
            >
              {summaryQ.isFetching ? "Refreshing…" : "Refresh summary"}
            </button>
            <button
              type="button"
              onClick={() => trainMut.mutate()}
              disabled={trainMut.isPending || trainStatus?.done === false}
              className="rounded-[2px] border px-3 py-1.5 text-[11px] font-medium transition-opacity disabled:opacity-50"
              style={{ borderColor: C.blue, color: C.blue }}
            >
              {trainMut.isPending ? "Starting…" : "Run training"}
            </button>
            <button
              type="button"
              onClick={() => trainResetMut.mutate()}
              disabled={trainResetMut.isPending}
              className="rounded-[2px] border px-3 py-1.5 text-[11px] font-medium transition-opacity disabled:opacity-50"
              style={{ borderColor: C.border, color: C.muted }}
              title="If training appears stuck, reset server-side progress."
            >
              Reset train status
            </button>
            <button
              type="button"
              onClick={() => logMut.mutate()}
              disabled={logMut.isPending}
              className="rounded-[2px] border px-3 py-1.5 text-[11px] font-medium transition-opacity disabled:opacity-50"
              style={{ borderColor: C.border, color: C.soft }}
            >
              {logMut.isPending ? "Logging…" : "Log snapshot"}
            </button>
            <label className="flex cursor-pointer select-none items-center gap-2 text-[11px]" style={{ color: C.muted }}>
              <input
                type="checkbox"
                checked={alignMonthEnd}
                onChange={(e) => setAlignMonthEnd(e.target.checked)}
                className="rounded border"
                style={{ borderColor: C.border }}
              />
              Align month-end (PIT)
            </label>
          </div>

          {trainStatus && !trainStatus.done && (
            <div className="rounded-[2px] border px-3 py-2 text-[11px]" style={{ borderColor: C.borderSoft, background: C.panelSoft }}>
              Training: {trainStatus.percent.toFixed(0)}% — {trainStatus.message}
              {trainStatus.log_line ? (
                <span className="mt-1 block font-mono text-[10px]" style={{ color: C.muted }}>
                  {trainStatus.log_line}
                </span>
              ) : null}
            </div>
          )}
          {trainStatus?.done === true && trainStatus.message === "error" && (
            <div className="rounded-[2px] border px-3 py-2 text-[11px]" style={{ borderColor: C.red, color: C.red }}>
              Last training failed — check backend logs.
              {trainStatus.log_line ? <span className="mt-1 block font-mono opacity-90">{trainStatus.log_line}</span> : null}
            </div>
          )}
          {summaryQ.isError && (
            <div className="rounded-[2px] border px-3 py-2 text-[11px]" style={{ borderColor: C.red, color: C.soft }}>
              Summary failed: {summaryQ.error instanceof Error ? summaryQ.error.message : String(summaryQ.error)}
            </div>
          )}
          {logMut.isError && (
            <p className="text-[11px]" style={{ color: C.red }}>
              Log snapshot failed (DB table missing?)
            </p>
          )}

          {summaryQ.isLoading && <p style={{ color: C.muted }}>Loading…</p>}

          {/* Row 1: Phase + regime map | Model weights + Anomaly | Expert breakdown */}
          {summary && (
            <div className="grid min-h-0 items-start gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.9fr)_minmax(0,1.15fr)]">
              <div ref={flRow1LeftRef} className="flex min-h-0 min-w-0 flex-col">
                <div
                  className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden"
                  style={denseSurface}
                >
                  <PhaseEnsembleCard summary={summary} palette={C} />
                </div>
              </div>

              <div ref={flRow1MiddleRef} className="flex min-h-0 min-w-0 flex-col gap-3">
                <div className="flex min-h-0 flex-col gap-2" style={denseSurface}>
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-muted)" }}>
                    Model weights
                  </h2>
                  <EnsembleModelWeightsRows weights={summary.ensemble_weights} palette={C} />
                </div>

                <div className="flex min-h-0 flex-col gap-2" style={denseSurface}>
                  <ForecastLabStressCard
                    stress={summary.stress}
                    navigatorGrowthSparklineValues={stressSparkValues}
                    palette={C}
                  />
                </div>
              </div>

              <div ref={flRow1RightRef} className="flex min-h-0 min-w-0 flex-col">
                <div
                  className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden"
                  style={denseSurface}
                >
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-muted)" }}>
                    Expert breakdown
                  </h2>
                  {summary.experts ? (
                    <ExpertProbabilityTable experts={summary.experts} ensemblePhase={summary.phase_probabilities} />
                  ) : (
                    <p style={{ color: C.muted }}>No expert breakdown.</p>
                  )}
                  <ExpertBreakdownHitRate data={alignQ.data} palette={C} />
                </div>
              </div>
            </div>
          )}

          {/* Row 2: Macro | Regime history (wide) */}
          {summary && (
            <div className="grid min-h-0 items-start gap-3 xl:grid-cols-[minmax(260px,0.4fr)_minmax(0,1fr)]">
              <div
                ref={macroPanelCardRef}
                className="flex w-full min-w-0 flex-col self-start overflow-hidden"
                style={denseSurface}
              >
                <div className="w-full overflow-auto" style={{ maxHeight: MACRO_REGIME_HISTORY_MAX_H }}>
                  <ForecastLabMacroPanelTable macroRows={summary.macro_forecasts} regimeItems={regimeHistQ.data?.items ?? []} palette={C} />
                </div>
              </div>

              <div
                ref={regimeHistoryCardRef}
                className="flex min-h-0 min-w-0 flex-col gap-2 self-start overflow-hidden"
                style={denseSurface}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-muted)" }}>
                    Regime history (monthly)
                  </h2>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => regimeHistQ.refetch()}
                      disabled={regimeHistQ.isFetching}
                      className="rounded-[2px] border px-2 py-1 text-[10px] font-medium disabled:opacity-50"
                      style={{ borderColor: C.border, color: C.soft }}
                    >
                      {regimeHistQ.isFetching ? "…" : "Refresh table"}
                    </button>
                    <button
                      type="button"
                      onClick={() => materializeMut.mutate()}
                      disabled={materializeMut.isPending}
                      className="inline-flex items-center gap-1 rounded-[2px] border px-2 py-1 text-[10px] font-medium disabled:opacity-50"
                      style={{ borderColor: C.blue, color: C.blue }}
                    >
                      <Database className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
                      {materializeMut.isPending ? "…" : "Materialize from DB"}
                    </button>
                  </div>
                </div>
                <div className="min-h-0 w-full min-w-0 flex-1 overflow-auto">
                  <table
                    className="w-full min-w-[560px] table-fixed border-separate border-spacing-0 font-mono text-[13px]"
                    style={{ border: REGIME_HISTORY_TABLE_BORDER }}
                  >
                    <colgroup>
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "18%" }} />
                      <col style={{ width: "9%" }} />
                      <col style={{ width: "33%" }} />
                    </colgroup>
                    <thead className="sticky top-0 z-[1]" style={{ background: C.panel }}>
                      <tr style={{ color: C.muted }}>
                        <th
                          className="px-2 py-2 text-center font-semibold uppercase tracking-[0.08em]"
                          style={{ border: REGIME_HISTORY_TABLE_BORDER, fontSize: 12 }}
                        >
                          OBS_DATE
                        </th>
                        <th
                          className="px-2 py-2 text-center font-semibold uppercase tracking-[0.08em]"
                          style={{ border: REGIME_HISTORY_TABLE_BORDER, fontSize: 12 }}
                          title="Navigator / Forecast Lab rule plane (growth × Fed) — single PIT label per row"
                        >
                          RULE PLANE
                        </th>
                        <th
                          className="px-2 py-2 text-center font-semibold uppercase tracking-[0.08em]"
                          style={{ border: REGIME_HISTORY_TABLE_BORDER, fontSize: 12 }}
                          title="Forecast Lab ensemble headline (phase_class) from the newest /log-snapshot row for this month-end, if you logged one."
                        >
                          ENS (FL)
                        </th>
                        <th
                          className="px-2 py-2 text-center font-semibold uppercase tracking-[0.08em]"
                          style={{ border: REGIME_HISTORY_TABLE_BORDER, fontSize: 12 }}
                          title={regimeHistoryAssetImplTooltip(regimeHistoryHorizonMonths(materializeMut))}
                        >
                          ASSET IMPL.
                        </th>
                        <th
                          className="px-2 py-2 text-center font-semibold uppercase tracking-[0.08em]"
                          style={{ border: REGIME_HISTORY_TABLE_BORDER, fontSize: 12 }}
                          title={regimeHistoryFwdOkTooltip(regimeHistoryHorizonMonths(materializeMut))}
                        >
                          FWD OK
                        </th>
                        <th
                          className="px-2 py-2 text-center font-semibold uppercase tracking-[0.08em]"
                          style={{ border: REGIME_HISTORY_TABLE_BORDER, fontSize: 12 }}
                        >
                          CURVE
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(regimeHistQ.data?.items ?? [])
                        .slice()
                        .reverse()
                        .map((row: RegimeHistoryRow) => (
                          <tr key={row.obs_date}>
                            <td
                              className="px-2 py-2 text-center tabular-nums"
                              style={{ border: REGIME_HISTORY_TABLE_BORDER, color: C.soft }}
                            >
                              {formatRegimeHistoryObsDate(row.obs_date)}
                            </td>
                            <td className="px-2 py-2 align-middle" style={{ border: REGIME_HISTORY_TABLE_BORDER }}>
                              <div className="flex justify-center">
                                <RegimeHistoryQuadrantBadge quadrantKey={row.fl_rule_quadrant} palette={C} />
                              </div>
                            </td>
                            <td className="px-2 py-2 align-middle" style={{ border: REGIME_HISTORY_TABLE_BORDER }}>
                              {row.fl_ensemble_quadrant ? (
                                <div className="flex justify-center">
                                  <RegimeHistoryQuadrantBadge quadrantKey={row.fl_ensemble_quadrant} palette={C} />
                                </div>
                              ) : (
                                <div
                                  className="text-center font-sans text-[12px]"
                                  style={{ color: C.muted }}
                                  title="No prediction log for this date — use Log snapshot or backfill logs."
                                >
                                  —
                                </div>
                              )}
                            </td>
                            <td className="px-2 py-2 align-middle" style={{ border: REGIME_HISTORY_TABLE_BORDER }}>
                              <div className="flex justify-center">
                                <RegimeHistoryQuadrantBadge quadrantKey={row.asset_implied_quadrant} palette={C} />
                              </div>
                            </td>
                            <td className="px-2 py-2 text-center align-middle" style={{ border: REGIME_HISTORY_TABLE_BORDER }}>
                              {row.forward_regime_confirmed ? (
                                <span
                                  className="inline-flex items-center justify-center"
                                  style={{ color: C.green }}
                                  title="Forward window: rule label matched expected pair outcomes"
                                >
                                  <Check className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden />
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center justify-center"
                                  style={{ color: C.red }}
                                  title="Below threshold, not evaluable yet, or horizon not reached"
                                >
                                  <X className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden />
                                </span>
                              )}
                            </td>
                            <td
                              className="max-w-[min(160px,28vw)] px-2 py-2 text-center font-sans text-[13px] leading-snug"
                              style={{ border: REGIME_HISTORY_TABLE_BORDER, color: C.soft }}
                              title={row.yield_curve_pattern ?? ""}
                            >
                              {row.yield_curve_pattern?.replace(/_/g, " ") ?? "—"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {regimeHistQ.isError && (
                  <p className="text-[10px]" style={{ color: C.red }}>
                    {regimeHistQ.error instanceof Error ? regimeHistQ.error.message : String(regimeHistQ.error)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Row 3: Bundle diagnostics — confusion matrix, calibration, feature importance, weight history */}
          {summary && (
            <div className="grid min-h-0 gap-1.5 lg:grid-cols-2 xl:grid-cols-4">
              <div className="relative flex min-h-0 min-w-0 flex-col gap-1 overflow-hidden pt-0.5" style={diagnosticsSurface}>
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-muted)" }}>
                  Confusion matrix
                </h2>
                <FlConfusionMatrixCard trainMetrics={trainMetrics} palette={C} />
                <CardHelpHint text="Predicted vs actual (ensemble · monthly test split)" palette={C} />
              </div>
              <div className="relative flex min-h-0 min-w-0 flex-col gap-1 overflow-hidden pt-0.5" style={diagnosticsSurface}>
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-muted)" }}>
                  Calibration
                </h2>
                <FlCalibrationCard trainMetrics={trainMetrics} palette={C} />
                <CardHelpHint text="Reliability diagram (max predicted probability vs. empirical accuracy)" palette={C} />
              </div>
              <div className="relative flex min-h-0 min-w-0 flex-col gap-1 overflow-hidden pt-0.5" style={diagnosticsSurface}>
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-muted)" }}>
                  Feature importance (top 5)
                </h2>
                <FlFeatureImportanceCard trainMetrics={trainMetrics} palette={C} />
                <CardHelpHint text="GBDT gain-based importance (aggregate)" palette={C} />
              </div>
              <div className="relative flex min-h-0 min-w-0 flex-col gap-1 overflow-hidden pt-0.5" style={diagnosticsSurface}>
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-muted)" }}>
                  Ensemble weight history
                </h2>
                <FlWeightHistoryCard trainMetrics={trainMetrics} palette={C} />
                <CardHelpHint text="Inverse log-loss weights over expanding validation windows" palette={C} />
              </div>
            </div>
          )}
        </section>
      </NextDashboardShell>
    </>
  );
}
