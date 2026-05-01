"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bell,
  CalendarDays,
  CircleDollarSign,
  Compass,
  Gauge,
  Grid2X2,
  Home,
  Info,
  LineChart,
  Package,
  RefreshCw,
  Settings,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  getAlertCount,
  getCategoryScores,
  getCrossAssetRadar,
  getFedStatus,
  getInflationLatest,
  getNavigatorRecommendation,
  getRecessionCheck,
  getRegimeCurrent,
  getCurveDynamics,
  getYieldCurve,
  getYieldCurveHistory,
  getYieldSpreads,
} from "@/lib/api";
import type { CategoryScore, CrossAssetRadarCell, CrossAssetSignal, YieldCurveSnapshot } from "@/types";
import { CATEGORY_LABELS } from "@/lib/utils";

/**
 * Design-width scaling: the dashboard is laid out at this fixed width in CSS px,
 * then uniformly scaled with `transform: scale()` so every element (text,
 * cards, charts, gaps, paddings) zooms together with the viewport. This keeps
 * the layout pixel-identical to the reference at any window size or browser
 * zoom level — no more text overflowing cards or charts drifting sideways.
 */
const DESIGN_W = 1440;
const MIN_SCALE = 0.45;
const MAX_SCALE = 1.6;

const C = {
  bg: "#080c11",
  sidebar: "#090d12",
  panel: "#10151b",
  panelSoft: "#0b1016",
  border: "#303942",
  borderSoft: "#252d34",
  text: "#d7d0c7",
  soft: "#b1ada6",
  muted: "#7e7e78",
  green: "#72ad66",
  red: "#d45d72",
  yellow: "#d4a93b",
  blue: "#5d82be",
  purple: "#8b65aa",
  orange: "#b87856",
};

const NAV_ITEMS = [
  { label: "Trading Navigator", icon: Grid2X2, active: true },
  { label: "Economic Indicators", icon: LineChart },
  { label: "Fed Policy", icon: CircleDollarSign },
  { label: "Yield Curve", icon: TrendingUp },
  { label: "Recession Monitor", icon: Gauge },
  { label: "Inflation", icon: Sparkles },
  { label: "Recommendations", icon: Sparkles },
  { label: "ML Regime (Beta)", icon: Compass },
  { label: "Calendar & Alerts", icon: CalendarDays },
];

const QMAP: Record<string, string> = {
  Q1_GOLDILOCKS: "RISK ON",
  Q2_REFLATION: "GROWTH",
  Q3_OVERHEATING: "VALUE",
  Q4_STAGFLATION: "RISK OFF",
};

const RECESSION_MODEL_DOT_COLORS = [C.green, C.blue, C.purple];

function normalizeProbabilityPercent(x: number | null | undefined): number {
  if (x == null || Number.isNaN(x)) return 18;
  const v = x >= 0 && x <= 1 ? x * 100 : x;
  return clamp(v, 0, 100);
}

function recessionRiskStyle(pct: number): { label: string; color: string } {
  if (pct < 22) return { label: "LOW RISK", color: C.green };
  if (pct < 45) return { label: "MODERATE", color: C.yellow };
  return { label: "ELEVATED", color: C.red };
}

const YIELD_MATURITY_ORDER = ["3M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"] as const;

const YIELD_HISTORY_STYLE = [
  { stroke: "#60a5fa", opacity: 0.38, dash: [5, 5] as [number, number] },
  { stroke: "#a78bfa", opacity: 0.32, dash: [4, 4] as [number, number] },
  { stroke: "#9ca3af", opacity: 0.28, dash: [6, 4] as [number, number] },
];

const CATEGORY_PHASE: Record<string, string> = {
  housing: "Leading",
  orders: "Leading",
  income_sales: "Coincident",
  employment: "Lagging",
  inflation: "Coincident",
};

type CrossAssetDisplaySignal = {
  name: string;
  description: string;
  signal: CrossAssetSignal["signal"];
  value: number | null;
  unit?: string;
};

const FALLBACK_SIGNALS: CrossAssetDisplaySignal[] = [
  { name: "Gold vs Copper", description: "Defensive metal vs growth metal", signal: "bearish", value: -2.4, unit: "%" },
  { name: "Gold vs Oil", description: "Real-rate hedge vs inflation beta", signal: "bullish", value: 1.7, unit: "%" },
  { name: "DXY", description: "Dollar pressure / funding", signal: "bearish", value: -1.8, unit: "%" },
  { name: "VIX", description: "Volatility regime", signal: "bearish", value: 18.7, unit: "" },
  { name: "High Beta vs Low Beta", description: "Risk appetite factor spread", signal: "bullish", value: 3.4, unit: "%" },
  { name: "Cyclicals vs Non-Cyclicals", description: "Cycle exposure spread", signal: "bullish", value: 2.2, unit: "%" },
];

const FALLBACK_CATEGORIES: CategoryScore[] = [
  { category: "housing", score: 0.41, trend: "improving", indicator_count: 4, color: "green" },
  { category: "orders", score: 0.26, trend: "improving", indicator_count: 5, color: "green" },
  { category: "income_sales", score: 0.12, trend: "neutral", indicator_count: 6, color: "yellow" },
  { category: "employment", score: -0.28, trend: "deteriorating", indicator_count: 5, color: "red" },
];

const FALLBACK_FACTORS: Array<[string, string, string]> = [
  ["Growth", "OW", C.green],
  ["Value", "N", C.muted],
  ["Quality", "OW", C.green],
  ["Size", "N", C.muted],
  ["Beta", "UW", C.red],
  ["Cyclicals", "OW", C.green],
  ["Defensives", "UW", C.red],
];

const FALLBACK_SECTORS: Array<[string, string, string]> = [
  ["Technology", "OW", C.green],
  ["Industrials", "OW", C.green],
  ["Financials", "N", C.soft],
  ["Energy", "N", C.soft],
  ["Consumer Discretionary", "OW", C.green],
  ["Consumer Staples", "UW", C.red],
];

const FALLBACK_RECS = [
  { name: "Long XLY / Short XLP", trade_type: "Relative", legs: "LONG XLY   SHORT XLP" },
  { name: "Long IWM / Short SPY", trade_type: "Relative", legs: "LONG IWM   SHORT SPY" },
  { name: "Long EEM / Short EFA", trade_type: "Relative", legs: "LONG EEM   SHORT EFA" },
];

export function NextDashboardScreen() {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [stageHeight, setStageHeight] = useState<number | null>(null);
  const navigatorQ = useQuery({ queryKey: ["next-dashboard", "navigator"], queryFn: getNavigatorRecommendation, staleTime: 120_000 });
  const regimeQ = useQuery({ queryKey: ["next-dashboard", "regime"], queryFn: getRegimeCurrent, staleTime: 120_000 });
  const fedQ = useQuery({ queryKey: ["next-dashboard", "fed"], queryFn: getFedStatus, staleTime: 120_000 });
  const signalsQ = useQuery({ queryKey: ["next-dashboard", "cross-asset-radar"], queryFn: getCrossAssetRadar, staleTime: 120_000 });
  const categoriesQ = useQuery({ queryKey: ["next-dashboard", "categories"], queryFn: getCategoryScores, staleTime: 120_000 });
  const recessionQ = useQuery({ queryKey: ["next-dashboard", "recession"], queryFn: getRecessionCheck, staleTime: 120_000 });
  const alertsQ = useQuery({ queryKey: ["next-dashboard", "alerts"], queryFn: getAlertCount, staleTime: 30_000 });
  const inflationQ = useQuery({ queryKey: ["next-dashboard", "inflation-latest"], queryFn: getInflationLatest, staleTime: 120_000 });
  const yieldSpreadsQ = useQuery({ queryKey: ["next-dashboard", "yield-spreads"], queryFn: getYieldSpreads, staleTime: 120_000 });
  const yieldCurveQ = useQuery({ queryKey: ["next-dashboard", "yield-curve"], queryFn: getYieldCurve, staleTime: 120_000 });
  const yieldHistoryQ = useQuery({ queryKey: ["next-dashboard", "yield-history"], queryFn: getYieldCurveHistory, staleTime: 120_000 });
  const curveDynamicsQ = useQuery({ queryKey: ["next-dashboard", "curve-dynamics"], queryFn: getCurveDynamics, staleTime: 120_000 });

  const fedPolicy = fedQ.data?.policy_score ?? navigatorQ.data?.position?.fed_policy_score ?? 0.46;
  const cycleScore = regimeQ.data?.cycle_score ?? 0.32;
  const recessionProbPct = normalizeProbabilityPercent(regimeQ.data?.recession_prob_12m ?? 0.18);
  const recessionRisk = recessionRiskStyle(recessionProbPct);
  const growthScore = navigatorQ.data?.position?.growth_score ?? 0.21;
  const confidence = clamp((navigatorQ.data?.position?.confidence ?? 0.72) * 100, 0, 100);
  const updatedAt = navigatorQ.data?.position?.date ?? regimeQ.data?.timestamp?.slice(0, 10) ?? "May 15, 2024 12:00 ET";
  const activeRegime =
    navigatorQ.data?.position?.quadrant_label ??
    (navigatorQ.data?.position?.quadrant ? QMAP[navigatorQ.data.position.quadrant] ?? navigatorQ.data.position.quadrant : "RISK ON");

  const inflationLatest =
    inflationQ.data?.find((row) => row.name.toUpperCase().includes("CPI"))?.yoy ??
    inflationQ.data?.[0]?.yoy ??
    3.2;
  const coreInflationLatest =
    inflationQ.data?.find((row) => row.name.toUpperCase().includes("CORE"))?.yoy ??
    null;
  const spread2y10y =
    yieldSpreadsQ.data?.find((row) => row.name.toUpperCase().includes("2Y10Y"))?.value ??
    yieldSpreadsQ.data?.find((row) => row.name.toUpperCase().includes("10Y2Y"))?.value ??
    -18;
  const quick = useMemo(
    () => [
      {
        label: "Inflation",
        value: inflationLatest,
        secondaryValue: coreInflationLatest,
        min: 0,
        mid: 2,
        max: 8,
        format: "percent" as const,
        sub: "CPI YoY",
      },
      { label: "Fed Policy Score", value: fedPolicy, min: -2, mid: 0, max: 2, format: "number" as const, sub: "z-score" },
      { label: "Macro Sentiment", value: cycleScore, min: -20, mid: 0, max: 20, format: "number" as const, sub: "cycle score" },
      { label: "Yield Curve (2Y-10Y)", value: spread2y10y, min: -200, mid: 0, max: 200, format: "basis_points" as const, sub: "spread" },
    ],
    [inflationLatest, coreInflationLatest, fedPolicy, cycleScore, spread2y10y],
  );
  const activeRegimeLabel = compactRegimeLabel(activeRegime);


  const signals = buildCrossAssetSignals(signalsQ.data);
  const categories = (categoriesQ.data?.length ? categoriesQ.data : FALLBACK_CATEGORIES).slice(0, 4);
  const recessionModelRows = useMemo(() => {
    const models = regimeQ.data?.recession_models;
    if (models?.length) {
      return models.slice(0, 3).map((m, i) => ({
        name: m.name.replace(/_/g, " "),
        pct: normalizeProbabilityPercent(m.probability),
        dot: RECESSION_MODEL_DOT_COLORS[i % RECESSION_MODEL_DOT_COLORS.length],
      }));
    }
    const cycleBlend = normalizeProbabilityPercent(
      ((recessionQ.data?.score ?? 1) / Math.max(1, recessionQ.data?.total ?? 7)) * 100,
    );
    return [
      { name: "Cycle Score Model", pct: cycleBlend, dot: RECESSION_MODEL_DOT_COLORS[0] },
      { name: "NY Fed 10Y–3M Model", pct: clamp(recessionProbPct * 0.92, 0, 100), dot: RECESSION_MODEL_DOT_COLORS[1] },
      { name: "3-Factor Model", pct: clamp(recessionProbPct * 1.05, 0, 100), dot: RECESSION_MODEL_DOT_COLORS[2] },
    ];
  }, [regimeQ.data?.recession_models, recessionProbPct, recessionQ.data?.score, recessionQ.data?.total]);
  const recs = (navigatorQ.data?.trading_recommendations ?? []).slice(0, 4);
  const factors = (navigatorQ.data?.factor_tilts ?? []).slice(0, 7);
  const sectors = (navigatorQ.data?.sector_allocations ?? []).slice(0, 6);
  const aa = navigatorQ.data?.asset_allocation;
  const alloc = [
    { label: "Equities", value: aa?.equities_pct ?? 55, color: "#679963" },
    { label: "Bonds", value: aa?.bonds_pct ?? 25, color: "#587eb2" },
    { label: "Commodities", value: aa?.commodities_pct ?? 10, color: "#c9a349" },
    { label: "Cash", value: aa?.cash_pct ?? 5, color: "#8b8b85" },
    { label: "Gold", value: aa?.gold_pct ?? 5, color: "#7a5a9b" },
  ];

  useEffect(() => {
    if (!frameRef.current) return;
    frameRef.current.scrollTo({ left: 0, top: 0 });
  }, []);

  // Compute uniform scale: viewport width / design width, clamped.
  // Re-runs on viewport resize and whenever the inner content's natural
  // height changes (e.g. data loads in / async chart renders).
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;

    const update = () => {
      const w = frame.clientWidth;
      if (!w) return;
      const next = clamp(w / DESIGN_W, MIN_SCALE, MAX_SCALE);
      setScale(next);
      const naturalH = content.scrollHeight;
      setStageHeight(naturalH * next);
    };

    update();

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(frame);
    ro?.observe(content);
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      ref={frameRef}
      className="fixed inset-0 z-[60] overflow-auto"
      style={{ background: C.bg, color: C.text, fontFamily: "var(--font-plex-mono), ui-monospace, monospace" }}
    >
      <div
        ref={stageRef}
        style={{
          width: "100%",
          height: stageHeight ?? "100vh",
          minHeight: "100vh",
          position: "relative",
          background: C.bg,
        }}
      >
      <div
        ref={contentRef}
        className="grid"
        style={{
          width: DESIGN_W,
          gridTemplateColumns: "260px minmax(0, 1fr)",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        <aside className="flex flex-col self-stretch border-r px-[18px] py-[32px]" style={{ borderColor: C.borderSoft, background: C.sidebar }}>
          <div>
            <div className="text-[34px] leading-none tracking-[0.23em]">MACROLENS</div>
            <div className="mt-[28px] flex gap-3">
              <span className="mt-1 h-3 w-3 rounded-full" style={{ background: C.green }} />
              <div className="text-[13px] uppercase leading-[1.35] tracking-[0.08em]" style={{ color: C.soft }}>
                <div>Macro perspective.</div>
                <div>Better decisions.</div>
              </div>
            </div>
          </div>

          <div className="mt-[30px] space-y-[14px]">
            {NAV_ITEMS.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  className="flex h-[44px] w-full items-center gap-4 rounded-[2px] border px-3 text-left text-[13px] uppercase tracking-[0.06em]"
                  style={{
                    marginTop: index === 7 ? 34 : undefined,
                    borderColor: item.active ? "#b4b0a8" : "transparent",
                    background: item.active ? "#b9b5ad" : "transparent",
                    color: item.active ? "#0b0d0f" : C.soft,
                  }}
                >
                  <Icon size={20} strokeWidth={item.active ? 3 : 2} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-auto">
            <div className="border-t pt-[22px]" style={{ borderColor: C.borderSoft }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[12px] uppercase tracking-[0.08em]" style={{ color: C.muted }}>Data as of</div>
                  <div className="mt-2 text-[12px] leading-[1.45]">{updatedAt}</div>
                </div>
                <RefreshCw size={15} style={{ color: C.soft }} />
              </div>
            </div>
            <div className="mt-[28px] border-y py-[24px]" style={{ borderColor: C.borderSoft }}>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[22px]" style={{ background: C.text, color: C.bg }}>U</span>
                <div>
                  <div className="text-[13px] uppercase">User</div>
                  <div className="text-[12px]" style={{ color: C.soft }}>Portfolio Manager</div>
                </div>
              </div>
            </div>
            <div className="mt-[24px] flex items-center justify-between" style={{ color: C.soft }}>
              <Sparkles size={22} />
              <Grid2X2 size={21} />
              <Bell size={21} />
              <Settings size={21} />
            </div>
          </div>
        </aside>

        <main className="min-w-0" style={{ padding: "26px 22px" }}>
          <header className="mb-[22px] flex items-start justify-between">
            <div>
              <h1 className="text-[34px] uppercase leading-none tracking-[0.09em]">TRADING NAVIGATOR</h1>
              <p className="mt-[10px] text-[15px]" style={{ color: C.text, fontFamily: "var(--font-plex-sans)" }}>Your macro regime in one view.</p>
            </div>
            <div className="flex items-start gap-7">
              <div className="text-left text-[13px] uppercase tracking-[0.08em]" style={{ color: C.text }}>
                Last Updated
                <div className="mt-2 flex items-center gap-2 text-[15px] normal-case" style={{ color: C.soft }}>
                  2 min ago <span className="h-2.5 w-2.5 rounded-full" style={{ background: C.green }} />
                </div>
              </div>
              <div className="relative mt-1">
                <Bell size={29} />
                <span className="absolute -right-3 -top-3 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]" style={{ background: "#b9b5ad", color: C.bg }}>
                  {alertsQ.data?.unread ?? 3}
                </span>
              </div>
            </div>
          </header>

          <section style={{ display: "grid", gap: 14 }}>
            <div className="grid" style={{ gap: 14, gridTemplateColumns: "680fr 532fr 360fr" }}>
            <div style={{ ...panelStyle(), height: 460 }}>
              <SectionTitle label="Macro Navigator" sub="Click dots for details" />
              <div className="mt-2" style={{ height: "calc(100% - 118px)" }}>
                <MacroNavigatorSvg
                  growthScore={growthScore}
                  fedPolicy={fedPolicy}
                  ensembleGrowth={
                    navigatorQ.data?.position?.ensemble_growth_score ??
                    navigatorQ.data?.ensemble?.growth_score ??
                    null
                  }
                  ensembleFed={
                    navigatorQ.data?.position?.ensemble_fed_policy_score ??
                    navigatorQ.data?.ensemble?.fed_policy_score ??
                    null
                  }
                />
              </div>
              <div className="border-t pt-[22px]" style={{ borderColor: C.borderSoft }}>
                <div className="flex items-center gap-3 text-[12px] uppercase tracking-[0.08em]" style={{ color: C.text }}>
                  <span>Confidence</span>
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px]" style={{ borderColor: C.border }}>?</span>
                  <ConfidenceSegments value={confidence} />
                  <span className="text-[20px]">{fmtPct(confidence, 0)}</span>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-col" style={{ ...panelStyle(), height: 460 }}>
              <SectionTitle label="Cross-Asset Signals" sub="(30D trend)" />
              <div
                className="mt-2 grid min-h-0 flex-1"
                style={{ gridTemplateRows: `repeat(${Math.max(1, signals.length)}, minmax(0, 1fr))` }}
              >
                {signals.map((s) => <SignalRow key={s.name} signal={s} />)}
              </div>
            </div>

            <div style={{ ...panelStyle(), height: 460 }}>
              <div className="mb-1 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[18px] uppercase leading-none tracking-[0.08em]">Active Regime</div>
                  <div className="mt-3 text-[13px] tracking-[0.02em]" style={{ color: C.text }}>State summary</div>
                </div>
                <span
                  className="max-w-[220px] truncate rounded-[2px] border px-3 py-2 text-[11px] uppercase tracking-[0.08em]"
                  style={{ borderColor: regimeAccent(activeRegimeLabel), color: regimeAccent(activeRegimeLabel) }}
                >
                  {activeRegimeLabel}
                </span>
              </div>
              <div className="mt-4 space-y-4">
                {quick.map((row) => <QuickRow key={row.label} {...row} compact />)}
              </div>
            </div>

            </div>

            <div className="grid items-stretch" style={{ gap: 14, gridTemplateColumns: "326fr 390fr 420fr 422fr" }}>
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" style={dashboardQuadPanelStyle()}>
              <div className="shrink-0">
                <div className="text-[18px] uppercase leading-none tracking-[0.08em]">Recession Probability</div>
                <div className="mt-2 text-[12px] tracking-[0.02em]" style={{ color: C.text }}>(12M)</div>
                <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.1em]" style={{ color: C.muted }}>
                  <span>3 model combined</span>
                  <span
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px]"
                    style={{ borderColor: C.border, color: C.soft }}
                    title="Composite recession probability from regime models"
                  >
                    <Info size={10} strokeWidth={2} />
                  </span>
                </div>
              </div>
              <div className="mt-3 flex shrink-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[42px] leading-none tabular-nums">{fmtPct(recessionProbPct, 0)}</div>
                  <div className="mt-2 text-[13px] uppercase tracking-[0.08em]" style={{ color: recessionRisk.color }}>{recessionRisk.label}</div>
                </div>
                <Donut value={recessionProbPct} color={recessionRisk.color} />
              </div>
              <div className="mt-3 flex min-h-0 flex-1 flex-col border-t pt-2 text-[11px]" style={{ borderColor: C.borderSoft }}>
                <div className="mb-1.5 flex shrink-0 items-center justify-between text-[9px] uppercase tracking-[0.1em]" style={{ color: C.muted }}>
                  <span>Model</span>
                  <span>Probability</span>
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden pr-0.5">
                  {recessionModelRows.map((row) => (
                    <div key={row.name} className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: row.dot }} />
                        <span className="min-w-0 truncate" style={{ color: C.soft }}>{row.name}</span>
                      </div>
                      <span className="shrink-0 tabular-nums" style={{ color: C.text }}>{fmtPct(row.pct, 0)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 shrink-0 pb-0.5 text-[11px] tracking-[0.03em]" style={{ color: C.soft }}>View Recession Monitor {"->"}</div>
              </div>
            </div>

            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" style={dashboardQuadPanelStyle()}>
              <div className="mb-1 flex items-start justify-between gap-2">
                <div className="text-[18px] uppercase leading-none tracking-[0.08em]">Macro Sentiment Score</div>
                <span
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]"
                  style={{ borderColor: C.border, color: C.soft }}
                  title="Composite cycle score vs category contributions"
                >
                  <Info size={12} strokeWidth={2} />
                </span>
              </div>
              <div className="mt-3 flex min-h-0 flex-1 flex-col">
                <div className="flex min-h-[88px] flex-[1_1_34%] items-stretch gap-3 overflow-hidden">
                  <div className="shrink-0">
                    <div className="text-[42px] leading-none tabular-nums">{fmtNumber(cycleScore)}</div>
                    <div className="mt-2 text-[13px] uppercase tracking-[0.08em]" style={{ color: C.green }}>Z-score</div>
                  </div>
                  <div className="min-h-0 min-w-0 flex-1">
                    <MacroSentimentSparkBlock cycleScore={cycleScore} />
                  </div>
                </div>
                <div className="mt-3 flex min-h-0 flex-1 flex-col border-t pt-2 text-[11px]" style={{ borderColor: C.borderSoft }}>
                  <div className="min-h-0 flex-1 space-y-0 overflow-y-auto overflow-x-hidden overscroll-contain pr-0.5">
                    {categories.map((row) => (
                      <MacroCategoryRow key={row.category} row={row} />
                    ))}
                  </div>
                  <div className="mt-2 shrink-0 text-[11px] tracking-[0.03em]" style={{ color: C.soft }}>All Indicators {"->"}</div>
                </div>
              </div>
            </div>

            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" style={dashboardQuadPanelStyle()}>
              <div className="mb-1 flex items-start justify-between gap-2">
                <div className="text-[18px] uppercase leading-none tracking-[0.08em]">Fed Policy Score</div>
                <span
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]"
                  style={{ borderColor: C.border, color: C.soft }}
                  title="Policy stance vs neutral (r*)"
                >
                  <Info size={12} strokeWidth={2} />
                </span>
              </div>
              <div className="mt-2 flex shrink-0 items-start justify-between gap-3">
                <div className="shrink-0">
                  <div className="text-[42px] leading-none tabular-nums">{fmtNumber(fedPolicy)}</div>
                  <div className="mt-2 text-[13px] uppercase tracking-[0.08em]" style={{ color: C.green }}>{fedQ.data?.stance ?? "Moderately Easy"}</div>
                </div>
                <div
                  className="min-w-[140px] max-w-[48%] flex-1 rounded-sm px-5"
                  style={{ background: C.panelSoft, height: 96 }}
                >
                  <Scale value={fedPolicy ?? 0} />
                </div>
              </div>
              <div className="mt-4 flex min-h-0 flex-1 flex-col border-t pt-3 text-[11px] uppercase tracking-[0.06em]" style={{ borderColor: C.borderSoft, color: C.soft }}>
                <div className="flex items-center justify-between py-2">
                  <span>Rate direction</span>
                  <span style={{ color: C.text }}>{fedQ.data?.rate_direction ?? "Paused"}</span>
                </div>
                <div className="flex items-center justify-between border-t py-2" style={{ borderColor: C.border }}>
                  <span>Balance sheet</span>
                  <span style={{ color: C.text }}>{fedQ.data?.balance_sheet_direction ?? "QT"}</span>
                </div>
                <div className="flex items-center justify-between border-t py-2" style={{ borderColor: C.border }}>
                  <span>Vs neutral (r*)</span>
                  <span style={{ color: C.text }}>+0.42%</span>
                </div>
                <div className="mt-auto shrink-0 pt-3 text-[11px] normal-case tracking-[0.03em]" style={{ color: C.soft }}>View Fed Policy {"->"}</div>
              </div>
            </div>

            <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden" style={dashboardQuadPanelStyle()}>
              <div className="mb-2 flex shrink-0 items-start justify-between gap-2">
                <div className="text-[18px] uppercase leading-none tracking-[0.08em]">Yield Curve</div>
                <div
                  className="max-w-[min(200px,52%)] shrink-0 rounded-[2px] border px-2.5 py-1.5 text-right"
                  style={{ borderColor: C.border, background: C.panelSoft }}
                  title={curveDynamicsQ.data?.description ?? ""}
                >
                  <div className="text-[11px] font-medium uppercase leading-snug tracking-[0.04em]" style={{ color: C.text }}>
                    {formatCurvePatternLabel(curveDynamicsQ.data?.pattern)}
                  </div>
                </div>
              </div>
              <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
                <NavigatorYieldCurveMini snapshot={yieldCurveQ.data} history={yieldHistoryQ.data} fillContainer />
              </div>
              <div className="mt-auto shrink-0 border-t px-1 pt-6 pb-2" style={{ borderColor: C.borderSoft }}>
                <div className="grid grid-cols-2 gap-0">
                  <div
                    className="flex items-center justify-center gap-1.5 border-r py-1 pr-2 text-center"
                    style={{ borderColor: C.borderSoft }}
                  >
                    <span className="text-[11px] uppercase tracking-[0.08em]" style={{ color: C.soft }}>2Y-10Y:</span>
                    <span className="text-[13px] font-medium tabular-nums" style={{ color: C.yellow }}>
                      {formatSpread2y10y(yieldCurveQ.data)}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 py-1 pl-2 text-center">
                    <span className="text-[11px] uppercase tracking-[0.08em]" style={{ color: C.soft }}>Real Yield 10Y:</span>
                    <span className="text-[13px] font-medium tabular-nums" style={{ color: C.text }}>
                      {formatRealYield10y(yieldCurveQ.data)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            </div>

            <div style={{ ...panelStyle(), height: 280 }}>
              <SectionTitle label="Recommendations Snapshot" />
              <div className="grid grid-cols-[1.1fr_1.25fr_1.25fr_0.9fr_1.8fr] gap-8 text-[12px]" style={{ color: C.soft }}>
                <Table title="Factor Tilts" rows={factors.length ? factors.map((f) => [f.factor, f.weight.toUpperCase(), tiltColor(f.weight)] as [string, string, string]) : FALLBACK_FACTORS} />
                <Table title="Sector Allocation (Top Tilts)" rows={sectors.length ? sectors.map((s) => [s.sector, s.weight.toUpperCase(), tiltColor(s.weight)] as [string, string, string]) : FALLBACK_SECTORS} />
                <div>
                  <div className="mb-2 uppercase tracking-[0.08em]">Asset Allocation</div>
                  <div className="flex items-start gap-4">
                    <AssetDonut items={alloc} />
                    <div className="w-full space-y-1">
                      {alloc.map((d) => (
                        <div key={d.label} className="flex items-center justify-between">
                          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-[2px]" style={{ background: d.color }} />{d.label}</div>
                          <span style={{ color: C.text }}>{Math.round(d.value)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="mb-2 uppercase tracking-[0.08em]">Geography</div>
                  {(Object.entries(navigatorQ.data?.geographic ?? {}).length ? Object.entries(navigatorQ.data?.geographic ?? {}) : [["DM", "70%"], ["EM", "30%"]]).slice(0, 5).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between py-1">
                      <span>{k}</span>
                      <span style={{ color: C.text }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="mb-2 uppercase tracking-[0.08em]">Trading Ideas (Examples)</div>
                  {(recs.length ? recs : FALLBACK_RECS).map((r) => (
                    <div key={r.name} className="grid grid-cols-[1fr_90px_160px] items-center gap-3 border-b py-1" style={{ borderColor: C.border }}>
                      <span style={{ color: C.text }}>{r.name}</span>
                      <span>{r.trade_type}</span>
                      <span className="text-[11px]" style={{ color: C.green }}>{r.legs}</span>
                    </div>
                  ))}
                  <div className="mt-3">View All Ideas {"->"}</div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
      </div>
    </div>
  );
}

/** Stable height for the 4-card dashboard row at the design width. */
function dashboardQuadPanelStyle(): CSSProperties {
  return {
    ...panelStyle(),
    height: 360,
  };
}

function panelStyle() {
  return {
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: "4px",
    padding: "20px 22px",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.012)",
    minHeight: 0,
    overflow: "hidden",
  } as const;
}

function SectionTitle({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="mb-1">
      <div className="text-[18px] uppercase leading-none tracking-[0.08em]">{label}</div>
      {sub ? <div className="mt-3 text-[13px] tracking-[0.02em]" style={{ color: C.text }}>{sub}</div> : null}
    </div>
  );
}

function ConfidenceSegments({ value }: { value: number }) {
  const safeValue = clamp(value, 0, 100);

  return (
    <div className="flex flex-1 gap-1">
      {Array.from({ length: 10 }).map((_, i) => {
        const fill = clamp(safeValue - i * 10, 0, 10) * 10;

        return (
          <span key={i} className="relative h-[8px] flex-1 overflow-hidden rounded-[2px]" style={{ background: C.border }}>
            <span className="absolute inset-y-0 left-0 rounded-[2px]" style={{ width: `${fill}%`, background: C.green }} />
          </span>
        );
      })}
    </div>
  );
}

function MacroNavigatorSvg({
  growthScore,
  fedPolicy,
  ensembleGrowth,
  ensembleFed,
}: {
  growthScore: number;
  fedPolicy: number;
  ensembleGrowth: number | null;
  ensembleFed: number | null;
}) {
  const nowX = 310 + clamp(growthScore, -1, 1) * 78;
  const nowY = 195 - clamp(fedPolicy, -1, 1) * 72;
  const ensembleX = 310 + clamp(ensembleGrowth ?? -0.18, -1, 1) * 78;
  const ensembleY = 195 - clamp(ensembleFed ?? 0.16, -1, 1) * 72;
  const redPast = "#c84f63";
  const redPastSoft = "#c88092";
  const greenAheadSoft = "#93c786";
  const greenAhead = C.green;
  const neutralNow = "#cfc8bd";
  const ensemblePurple = "#b99ad8";

  return (
    <svg className="h-full w-full" viewBox="0 0 620 390" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <line x1="310" y1="42" x2="310" y2="344" stroke={C.border} strokeWidth="1" />
      <line x1="118" y1="195" x2="502" y2="195" stroke={C.border} strokeWidth="1" />
      <line x1="310" y1="42" x2="310" y2="344" stroke={C.muted} strokeWidth="1" strokeDasharray="1 62" opacity="0.5" />
      <line x1="118" y1="195" x2="502" y2="195" stroke={C.muted} strokeWidth="1" strokeDasharray="28 28" opacity="0.35" />

      <text x="170" y="102" fill={C.blue} fontSize="18" letterSpacing="1.3">GROWTH</text>
      <text x="417" y="102" fill={C.green} fontSize="18" letterSpacing="1.3">RISK ON</text>
      <text x="170" y="314" fill={C.red} fontSize="18" letterSpacing="1.3">RISK OFF</text>
      <text x="420" y="314" fill={C.yellow} fontSize="18" letterSpacing="1.3">VALUE</text>

      <text x="310" y="27" fill={C.soft} fontSize="11" textAnchor="middle">FED POLICY (EASY)</text>
      <text x="310" y="371" fill={C.soft} fontSize="11" textAnchor="middle">FED POLICY (TIGHT)</text>
      <text x="24" y="199" fill={C.soft} fontSize="11">MACRO</text>
      <text x="24" y="214" fill={C.soft} fontSize="11">SENTIMENT</text>
      <text x="24" y="229" fill={C.soft} fontSize="11">(-)</text>
      <text x="554" y="199" fill={C.soft} fontSize="11">MACRO</text>
      <text x="554" y="214" fill={C.soft} fontSize="11">SENTIMENT</text>
      <text x="554" y="229" fill={C.soft} fontSize="11">(+)</text>

      <text x="310" y="59" fill={C.text} fontSize="13" textAnchor="middle">+1</text>
      <text x="310" y="214" fill={C.text} fontSize="13" textAnchor="middle">0</text>
      <text x="310" y="334" fill={C.text} fontSize="13" textAnchor="middle">-1</text>
      <text x="104" y="200" fill={C.text} fontSize="13" textAnchor="middle">-1</text>
      <text x="516" y="200" fill={C.text} fontSize="13" textAnchor="middle">+1</text>

      <line x1="176" y1="250" x2="224" y2="164" stroke={redPast} strokeWidth="1.6" strokeDasharray="5 7" />
      <line x1="224" y1="164" x2={nowX} y2={nowY} stroke={redPastSoft} strokeWidth="1.6" strokeDasharray="5 7" />
      <line x1={nowX} y1={nowY} x2="382" y2="102" stroke={greenAheadSoft} strokeWidth="1.6" strokeDasharray="5 7" />
      <line x1="382" y1="102" x2="432" y2="250" stroke={greenAhead} strokeWidth="1.6" strokeDasharray="5 7" />

      <circle cx="176" cy="250" r="8" fill={redPast} />
      <circle cx="224" cy="164" r="8" fill={redPastSoft} />
      <circle cx="382" cy="102" r="8" fill={greenAheadSoft} />
      <circle cx="432" cy="250" r="8" fill={greenAhead} />
      <text x="185" y="267" fill={redPast} fontSize="11">1Y-</text>
      <text x="198" y="154" fill={redPastSoft} fontSize="11">6M-</text>
      <text x="393" y="105" fill={greenAheadSoft} fontSize="11">6M+</text>
      <text x="444" y="254" fill={greenAhead} fontSize="11">1Y+</text>

      <circle cx={ensembleX} cy={ensembleY} r="7" fill={ensemblePurple} opacity="0.9" />
      <text x={ensembleX + 10} y={ensembleY - 9} fill={ensemblePurple} fontSize="10">ENSEMBLE</text>

      <circle cx={nowX} cy={nowY} r="8" fill={neutralNow} stroke={C.border} strokeWidth="2" />
      <rect x={nowX + 16} y={nowY - 13} width="36" height="24" rx="2" fill="#c4beb3" stroke={C.border} />
      <text x={nowX + 34} y={nowY + 3} fill={C.bg} fontSize="12" fontWeight="600" textAnchor="middle">NOW</text>
    </svg>
  );
}

function buildCrossAssetSignals(radar?: CrossAssetRadarCell[] | null): CrossAssetDisplaySignal[] {
  if (!radar?.length) return FALLBACK_SIGNALS;

  const byName = new Map(radar.map((cell) => [cell.name.toLowerCase(), cell]));
  const get = (name: string) => byName.get(name.toLowerCase());
  const relative = (name: string, a?: CrossAssetRadarCell, b?: CrossAssetRadarCell): CrossAssetDisplaySignal => {
    const value = a?.value != null && b?.value != null ? Number((a.value - b.value).toFixed(1)) : null;
    return {
      name,
      description: `${a?.name ?? "First leg"} minus ${b?.name ?? "second leg"} 30D momentum`,
      signal: value == null ? "neutral" : value > 0 ? "bullish" : value < 0 ? "bearish" : "neutral",
      value,
      unit: "%",
    };
  };
  const single = (displayName: string, source: string, description: string): CrossAssetDisplaySignal => {
    const cell = get(source);
    return {
      name: displayName,
      description,
      signal: cell?.signal ?? "neutral",
      value: cell?.value ?? null,
      unit: cell?.unit ?? "%",
    };
  };

  return [
    relative("Gold vs Copper", get("Gold"), get("Copper")),
    relative("Gold vs Oil", get("Gold"), get("Oil")),
    single("DXY", "DXY", "Dollar pressure / funding"),
    single("VIX", "VIX", "Volatility regime"),
    single("High Beta vs Low Beta", "High Beta vs Low Beta", "Risk appetite factor spread"),
    single("Cyclicals vs Non-Cyclicals", "Cyclicals vs Defensives", "Cycle exposure spread"),
  ];
}

function SignalRow({ signal }: { signal: CrossAssetDisplaySignal }) {
  const value = signal.value == null ? "N/A" : `${signal.value > 0 ? "+" : ""}${signal.value.toFixed(1)}${signal.unit ?? "%"}`;
  return (
    <div
      className="grid items-center border-b"
      style={{
        borderColor: C.border,
        gridTemplateColumns: "52px minmax(0, 1.35fr) minmax(90px, 1fr) auto auto",
        columnGap: 10,
        padding: "6px 0",
      }}
    >
      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[18px]" style={{ background: iconBg(signal.name), color: iconColor(signal.name) }}>{signalIcon(signal.name)}</span>
      <div className="min-w-0">
        <div className="truncate text-[13px] uppercase tracking-[0.03em]">{signal.name}</div>
        <div className="mt-1 truncate text-[11px]" style={{ color: C.soft }}>{signal.description}</div>
      </div>
      <div className="min-w-0">
        <Sparkline points={series(signal.name, signal.signal, 22)} color={signalColor(signal.signal)} width={220} height={50} responsive />
      </div>
      <span className="whitespace-nowrap rounded-[2px] px-2.5 py-2 text-center text-[10px] uppercase tracking-[0.06em]" style={{ background: badgeColor(signal.signal), color: badgeTextColor(signal.signal) }}>{badgeText(signal.signal)}</span>
      <div className="min-w-[72px] whitespace-nowrap text-right text-[13px] tabular-nums">{value}</div>
    </div>
  );
}

function QuickRow({
  label,
  value,
  secondaryValue,
  min,
  mid,
  max,
  format,
  sub,
  compact = false,
}: {
  label: string;
  value: number | null;
  secondaryValue?: number | null;
  min: number;
  mid: number;
  max: number;
  format: "number" | "percent" | "basis_points";
  sub?: string;
  compact?: boolean;
}) {
  const safe = value == null ? mid : clamp(value, min, max);
  const secondarySafe = secondaryValue == null ? null : clamp(secondaryValue, min, max);
  const ratio = clamp((safe - min) / (max - min), 0, 1);
  const secondaryRatio = secondarySafe == null ? null : clamp((secondarySafe - min) / (max - min), 0, 1);
  const display = value == null ? "N/A" : format === "percent" ? fmtPct(value, 1) : format === "basis_points" ? `${value.toFixed(0)}bp` : value.toFixed(2);
  const direction = value == null ? "→" : value >= 0 ? "↑" : "↓";
  const midRatio = clamp((mid - min) / (max - min), 0, 1);
  const titleSize = compact ? "text-[12px]" : "text-[14px]";
  const subSize = compact ? "text-[10px]" : "text-[11px]";
  const valueSize = compact ? "text-[18px]" : "text-[20px]";
  const headerGap = compact ? "mb-2" : "mb-4";
  const scaleGap = compact ? "mt-2" : "mt-3";
  return (
    <div>
      <div className={`${headerGap} flex items-end justify-between`}>
        <div>
          <div className={`${titleSize} uppercase tracking-[0.06em]`} style={{ color: C.text }}>{label}</div>
          <div className={`mt-1 ${subSize} uppercase`} style={{ color: C.soft }}>{sub ?? (format === "percent" ? "3 models combined" : "z-score")}</div>
        </div>
        <div className={`${valueSize} leading-none tabular-nums whitespace-nowrap`}>{display} <span style={{ color: C.green }}>{direction}</span></div>
      </div>
      <div className="relative h-[6px] rounded" style={{ background: C.border }}>
        <div className="h-[6px] rounded" style={{ width: `${ratio * 100}%`, background: C.green }} />
        {secondaryRatio != null ? (
          <div
            className="absolute inset-y-0 left-0 rounded"
            style={{ width: `${secondaryRatio * 100}%`, background: "#88f3cb", opacity: 0.45, boxShadow: "0 0 6px rgba(136,243,203,0.25)" }}
          />
        ) : null}
        <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${ratio * 100}%`, background: C.green }} />
        <span className="absolute top-[-5px] h-4 w-px" style={{ left: `${midRatio * 100}%`, background: "#777" }} />
      </div>
      <div className={`${scaleGap} flex justify-between text-[12px]`} style={{ color: C.soft }}>
        <span>{formatTick(min, format)}</span><span>{formatTick(mid, format)}</span><span>{formatTick(max, format)}</span>
      </div>
    </div>
  );
}

function Scale({ value }: { value: number }) {
  const ratio = clamp((value + 2) / 4, 0, 1);
  return (
    <div className="relative h-full">
      <div className="absolute left-0 top-1/2 h-[6px] w-full -translate-y-1/2 rounded" style={{ background: `linear-gradient(90deg, #3a3d3e, #888, #292d31, #777, #32363b)` }} />
      <div className="absolute -top-4 left-0 flex w-full justify-between text-[12px]" style={{ color: C.soft }}><span>-2</span><span>0</span><span>+2</span></div>
      <span className="absolute top-1/2 h-0 w-0 -translate-x-1/2 -translate-y-1/2 border-x-[7px] border-b-[12px] border-x-transparent" style={{ left: `${ratio * 100}%`, borderBottomColor: C.text }} />
    </div>
  );
}

function Sparkline({
  points,
  color,
  width = 70,
  height = 18,
  fill,
  responsive = false,
  strokeWidth = 1.9,
}: {
  points: number[];
  color: string;
  width?: number;
  height?: number;
  fill?: boolean;
  responsive?: boolean;
  strokeWidth?: number;
}) {
  if (!points.length) return null;
  const padY = fill ? 3 : 0;
  const innerH = height - padY * 2;
  const step = width / Math.max(1, points.length - 1);
  const yAt = (p: number) => padY + innerH - (p / 100) * innerH;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)} ${yAt(p).toFixed(2)}`).join(" ");
  const area = `${d} L${width} ${height} L0 ${height} Z`;
  return (
    <svg
      width={responsive ? "100%" : width}
      height={responsive ? "100%" : height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={responsive ? "none" : "xMidYMid meet"}
      className={responsive ? "block h-full w-full min-w-0" : undefined}
      style={{ overflow: "visible" }}
    >
      {fill ? <path d={area} fill={color} opacity="0.16" /> : null}
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="butt" strokeLinejoin="miter" />
    </svg>
  );
}

function Donut({ value, color }: { value: number; color: string }) {
  const angle = clamp(value, 0, 100) * 3.6;
  return (
    <div
      className="shrink-0 rounded-full"
      style={{
        width: 84,
        height: 84,
        background: `conic-gradient(${color} ${angle}deg, ${C.border} ${angle}deg 360deg)`,
        padding: 10,
      }}
    >
      <div className="h-full w-full rounded-full" style={{ background: C.panel }} />
    </div>
  );
}

function AssetDonut({ items }: { items: Array<{ label: string; value: number; color: string }> }) {
  const total = Math.max(1, items.reduce((sum, i) => sum + Math.max(0, i.value), 0));
  let acc = 0;
  const slices = items.map((i) => {
    const start = (acc / total) * 360;
    acc += Math.max(0, i.value);
    return `${i.color} ${start}deg ${(acc / total) * 360}deg`;
  }).join(", ");
  return <div className="h-[92px] w-[92px] rounded-full" style={{ background: `conic-gradient(${slices})`, padding: 22 }}><div className="h-full w-full rounded-full" style={{ background: C.panel }} /></div>;
}

function Table({ title, rows }: { title: string; rows: Array<[string, string, string]> }) {
  return (
    <div>
      <div className="mb-2 uppercase tracking-[0.08em]">{title}</div>
      {rows.map(([left, right, color]) => (
        <div key={`${left}-${right}`} className="flex items-center justify-between py-[2px]">
          <span>{left}</span>
          <span style={{ color }}>{right}</span>
        </div>
      ))}
    </div>
  );
}

function MacroSentimentSparkBlock({ cycleScore }: { cycleScore: number }) {
  const drift: CrossAssetSignal["signal"] =
    cycleScore > 0.5 ? "bullish" : cycleScore < -0.5 ? "bearish" : "neutral";
  const pts = useMemo(() => series("macro-sentiment", drift, 32), [drift]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 items-stretch gap-1.5 overflow-hidden">
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between py-1">
          <div className="h-px w-full" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="h-px w-full" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="h-px w-full" style={{ background: "rgba(255,255,255,0.08)" }} />
        </div>
        <div className="relative h-full w-full min-h-0 min-w-0 px-0.5">
          <Sparkline points={pts} color={C.green} width={200} height={70} fill responsive strokeWidth={1.45} />
        </div>
      </div>
      <div
        className="flex h-full min-h-0 w-7 shrink-0 flex-col justify-between py-2 text-[10px] tabular-nums leading-none"
        style={{ color: C.muted }}
      >
        <span>3</span>
        <span>0</span>
        <span>-3</span>
      </div>
    </div>
  );
}

function MacroCategoryRow({ row }: { row: CategoryScore }) {
  const Icon = categoryIcon(row.category);
  const label = CATEGORY_LABELS[row.category] ?? row.category.replace("_", " ");
  const phase = CATEGORY_PHASE[row.category] ?? "Coincident";
  const TrendIcon = row.trend === "improving" ? ArrowUp : row.trend === "deteriorating" ? ArrowDown : ArrowRight;
  const arrowColor = row.trend === "improving" ? C.green : row.trend === "deteriorating" ? C.red : C.muted;

  return (
    <div
      className="flex items-center gap-2 border-b py-1.5 last:border-b-0"
      style={{ borderColor: C.borderSoft }}
    >
      <Icon size={14} strokeWidth={1.5} className="shrink-0" style={{ color: C.soft }} />
      <span className="min-w-0 flex-1 truncate" style={{ color: C.text }}>
        {label}{" "}
        <span style={{ color: C.muted }}>({phase})</span>
      </span>
      <span className="shrink-0 tabular-nums" style={{ color: C.text }}>
        {fmtNumber(row.score)}
      </span>
      <TrendIcon size={14} strokeWidth={2.5} className="shrink-0" style={{ color: arrowColor }} />
    </div>
  );
}

function categoryIcon(cat: string) {
  switch (cat) {
    case "housing":
      return Home;
    case "orders":
      return Package;
    case "income_sales":
      return ShoppingCart;
    case "employment":
      return Users;
    case "inflation":
      return TrendingUp;
    default:
      return LineChart;
  }
}

function NavigatorYieldCurveMini({
  snapshot,
  history,
  fillContainer = false,
}: {
  snapshot: YieldCurveSnapshot | null | undefined;
  history: YieldCurveSnapshot[] | null | undefined;
  fillContainer?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const chartData = useMemo(() => {
    if (!snapshot?.points?.length) return [];
    return YIELD_MATURITY_ORDER.map((m) => {
      const point = snapshot.points.find((p) => p.maturity === m);
      const row: { maturity: string; current: number | null; hist: (number | null)[] } = {
        maturity: m,
        current: point?.nominal_yield ?? null,
        hist: [],
      };
      history?.forEach((snap) => {
        const hp = snap.points.find((p) => p.maturity === m);
        row.hist.push(hp?.nominal_yield ?? null);
      });
      return row;
    }).filter((d) => d.current !== null);
  }, [snapshot, history]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || chartData.length === 0) return;

    const paint = () => {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const bw = Math.max(1, Math.floor(rect.width * dpr));
    const bh = Math.max(1, Math.floor(rect.height * dpr));
    canvas.width = bw;
    canvas.height = bh;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const w = rect.width;
    const h = rect.height;
    const padL = 34;
    const padR = 20;
    const padT = 6;
    const padB = 24;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    let yMin = Infinity;
    let yMax = -Infinity;
    for (const d of chartData) {
      if (d.current != null) {
        yMin = Math.min(yMin, d.current);
        yMax = Math.max(yMax, d.current);
      }
      for (const v of d.hist) {
        if (v != null) {
          yMin = Math.min(yMin, v);
          yMax = Math.max(yMax, v);
        }
      }
    }
    const yPad = (yMax - yMin) * 0.12 || 0.35;
    yMin -= yPad;
    yMax += yPad;

    const xOf = (i: number) => padL + (i / Math.max(1, chartData.length - 1)) * plotW;
    const yOf = (v: number) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

    ctx.fillStyle = C.panel;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.lineJoin = "miter";
    ctx.lineCap = "square";
    for (let i = 0; i <= 4; i += 1) {
      const y = padT + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
    }

    ctx.fillStyle = C.muted;
    ctx.font = "9px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 2; i += 1) {
      const v = yMax - ((yMax - yMin) / 2) * i;
      const y = padT + (plotH / 2) * i;
      ctx.fillText(`${v.toFixed(1)}`, padL - 4, y);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = "8px ui-monospace, monospace";
    for (let i = 0; i < chartData.length; i += 1) {
      const lx = Math.min(w - padR - 2, Math.max(padL + 2, xOf(i)));
      ctx.fillText(chartData[i].maturity, lx, h - padB + 3);
    }

    const drawCurve = (
      values: (number | null)[],
      color: string,
      lineW: number,
      opacity: number,
      dash: number[],
    ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineW;
      ctx.globalAlpha = opacity;
      ctx.setLineDash(dash);
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < values.length; i += 1) {
        const v = values[i];
        if (v == null) continue;
        const x = Math.round(xOf(i) * 10) / 10;
        const y = Math.round(yOf(v) * 10) / 10;
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    };

    const histLen = history?.length ?? 0;
    for (let hi = histLen - 1; hi >= 0; hi -= 1) {
      const vals = chartData.map((d) => d.hist[hi] ?? null);
      const style = YIELD_HISTORY_STYLE[hi];
      if (!style) continue;
      drawCurve(vals, style.stroke, 1.65, style.opacity, [...style.dash]);
    }

    const currentVals = chartData.map((d) => d.current);
    drawCurve(currentVals, C.green, 2.35, 1, []);
    };

    paint();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => paint()) : null;
    const el = wrapRef.current;
    if (ro && el) ro.observe(el);
    return () => {
      ro?.disconnect();
    };
  }, [chartData, history]);

  if (!snapshot?.points?.length) {
    return (
      <div
        className={`flex items-center justify-center text-[11px] ${fillContainer ? "min-h-[80px] flex-1" : "h-[118px]"}`}
        style={{ color: C.muted }}
      >
        No yield data
      </div>
    );
  }

  const outerCls = fillContainer
    ? "flex h-full min-h-0 w-full max-w-full min-w-0 flex-1 flex-col overflow-hidden"
    : "flex w-full max-w-full min-w-0 shrink-0 flex-col";
  const chartWrapCls = fillContainer
    ? "min-h-[72px] w-full min-w-0 flex-1 overflow-hidden"
    : "h-[118px] w-full min-w-0 shrink-0 overflow-hidden";

  return (
    <div className={outerCls}>
      <div ref={wrapRef} className={chartWrapCls}>
        <canvas ref={canvasRef} className="block h-full w-full max-w-full min-w-0" aria-label="Yield curve comparison" />
      </div>
      <div
        className="mt-1 flex shrink-0 flex-wrap justify-center gap-x-4 gap-y-0.5 text-[8px] uppercase tracking-[0.06em]"
        style={{ color: C.muted }}
      >
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: C.green }} />
          Now
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 rounded-full opacity-40" style={{ background: YIELD_HISTORY_STYLE[0]?.stroke }} />
          3m
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 rounded-full opacity-40" style={{ background: YIELD_HISTORY_STYLE[1]?.stroke }} />
          6m
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 rounded-full opacity-40" style={{ background: YIELD_HISTORY_STYLE[2]?.stroke }} />
          1y
        </span>
      </div>
    </div>
  );
}

function formatCurvePatternLabel(pattern: string | null | undefined) {
  if (!pattern?.trim()) return "—";
  return pattern.replace(/_/g, " ").toUpperCase();
}

function formatSpread2y10y(snapshot: YieldCurveSnapshot | null | undefined) {
  const s = snapshot?.spreads?.find((x) => x.name === "2Y10Y");
  if (s == null) return "—";
  const v = s.value;
  return `${v >= 0 ? "+" : ""}${v.toFixed(0)}bp`;
}

function formatRealYield10y(snapshot: YieldCurveSnapshot | null | undefined) {
  const s = snapshot?.spreads?.find((x) => x.name === "10Y_REAL_YIELD");
  if (s == null) return "—";
  return `${s.value.toFixed(2)}%`;
}

function fmtNumber(value: number | null | undefined, digits = 2) {
  if (value == null || Number.isNaN(value)) return "N/A";
  return value.toFixed(digits);
}

function fmtPct(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return "N/A";
  return `${value.toFixed(digits)}%`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function badgeText(signal: CrossAssetSignal["signal"]) {
  if (signal === "bullish") return "BULLISH";
  if (signal === "bearish") return "BEARISH";
  return "INVERTED";
}

function signalColor(signal: CrossAssetSignal["signal"]) {
  if (signal === "bullish") return C.green;
  if (signal === "bearish") return C.red;
  return C.blue;
}

function badgeColor(signal: CrossAssetSignal["signal"]) {
  if (signal === "bullish") return "rgba(48, 92, 55, 0.66)";
  if (signal === "bearish") return "rgba(96, 42, 52, 0.66)";
  return "rgba(68, 58, 102, 0.72)";
}

function badgeTextColor(signal: CrossAssetSignal["signal"]) {
  if (signal === "bullish") return "#d5f2d1";
  if (signal === "bearish") return "#ffc3c9";
  return "#e2d8ff";
}

function iconBg(name: string) {
  if (name.includes("Gold")) return "rgba(189,143,43,0.25)";
  if (name.includes("DXY")) return "rgba(76,140,84,0.23)";
  if (name.includes("Copper")) return "rgba(176,92,58,0.26)";
  if (name.includes("VIX")) return "rgba(124,78,166,0.28)";
  if (name.includes("High Beta")) return "rgba(93,130,190,0.24)";
  if (name.includes("Cyclicals")) return "rgba(114,173,102,0.22)";
  return "rgba(71,113,159,0.26)";
}

function iconColor(name: string) {
  if (name.includes("Gold")) return C.yellow;
  if (name.includes("DXY")) return C.green;
  if (name.includes("Copper")) return C.orange;
  if (name.includes("VIX")) return C.purple;
  if (name.includes("High Beta")) return C.blue;
  if (name.includes("Cyclicals")) return C.green;
  return C.blue;
}

function signalIcon(name: string) {
  if (name.includes("Gold vs Copper")) return "G/C";
  if (name.includes("Gold vs Oil")) return "G/O";
  if (name.includes("DXY")) return "$";
  if (name.includes("VIX")) return "⌁";
  if (name.includes("High Beta")) return "β/L";
  if (name.includes("Cyclicals")) return "C/N";
  if (name.includes("10Y")) return "%";
  return "╱";
}

function tiltColor(weight: string) {
  const w = weight.toLowerCase();
  if (w.includes("over") || w === "ow") return C.green;
  if (w.includes("under") || w === "uw") return C.red;
  return C.soft;
}

function regimeAccent(label: string) {
  const normalized = label.toUpperCase();
  if (normalized.includes("RISK ON") || normalized.includes("Q1")) return C.green;
  if (normalized.includes("GROWTH") || normalized.includes("Q2")) return C.blue;
  if (normalized.includes("VALUE") || normalized.includes("Q3")) return C.yellow;
  if (normalized.includes("RISK OFF") || normalized.includes("Q4")) return C.red;
  return C.soft;
}

function compactRegimeLabel(label: string) {
  const normalized = label.toUpperCase();
  if (normalized.includes("RISK ON") || normalized.includes("Q1_GOLDILOCKS")) return "RISK ON";
  if (normalized.includes("GROWTH") || normalized.includes("Q2_REFLATION")) return "GROWTH";
  if (normalized.includes("VALUE") || normalized.includes("Q3_OVERHEATING")) return "VALUE";
  if (normalized.includes("RISK OFF") || normalized.includes("Q4_STAGFLATION")) return "RISK OFF";
  return label.split("(")[0].trim().toUpperCase();
}

function formatTick(value: number, format: "number" | "percent" | "basis_points") {
  if (format === "basis_points") return `${Math.round(value)}`;
  if (format === "percent") return `${value.toFixed(0)}`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function series(seedKey: string, signal: CrossAssetSignal["signal"], points: number) {
  let seed = 0;
  for (let i = 0; i < seedKey.length; i += 1) seed = (seed * 31 + seedKey.charCodeAt(i)) % 9973;
  const drift = signal === "bullish" ? 1.45 : signal === "bearish" ? -1.45 : 0;
  const pulse = signal === "bullish" ? 4.8 : signal === "bearish" ? -4.8 : 3.4;
  let y = 50 + ((seed % 11) - 5);
  const out: number[] = [];
  for (let i = 0; i < points; i += 1) {
    const noise = (((seed + i * 13) % 17) - 8) * 0.95;
    const zigzag = i % 2 === 0 ? pulse : -pulse;
    y = clamp(y + drift + noise + zigzag, 10, 90);
    out.push(y);
  }
  return out;
}
