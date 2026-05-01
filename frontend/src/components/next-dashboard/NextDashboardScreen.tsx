"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  getCategoryScores,
  getCrossAssetRadar,
  getFedStatus,
  getRateHistory,
  getInflationLatest,
  getInflationSeries,
  getNavigatorRecommendation,
  getRecessionCheck,
  getRegimeHistory,
  getRegimeCurrent,
  getSpreadHistory,
  getCurveDynamics,
  getYieldCurve,
  getYieldCurveHistory,
  getYieldSpreads,
} from "@/lib/api";
import type {
  CategoryScore,
  CrossAssetRadarCell,
  CrossAssetSignal,
  FactorAllocation,
  SectorAllocation,
  TradingRecommendation,
  YieldCurveSnapshot,
} from "@/types";
import { CATEGORY_LABELS } from "@/lib/utils";
import { useDataRefresh } from "@/lib/useDataRefresh";

/**
 * The dashboard fills available viewport width while preserving
 * card structure and spacing from the base design proportions.
 */
const DARK_THEME = {
  bg: "#070b10",
  sidebar: "#090d12",
  panel: "#10151b",
  panelSoft: "#0b1016",
  border: "#2f3842",
  borderSoft: "#232b33",
  text: "#d7d0c7",
  soft: "#b1ada6",
  muted: "#7e7e78",
  green: "#72ad66",
  red: "#d45d72",
  yellow: "#d4a93b",
  blue: "#5d82be",
  purple: "#8b65aa",
  orange: "#b87856",
  activeBg: "#d1ccc1",
  activeBorder: "#ccc7be",
  activeText: "#0b0d0f",
};

const LIGHT_THEME = {
  bg: "#ece8dd",
  sidebar: "#ddd7c9",
  panel: "#f5f2e8",
  panelSoft: "#ebe6d8",
  border: "#7b746b",
  borderSoft: "#9a9388",
  text: "#232019",
  soft: "#3d382f",
  muted: "#666055",
  green: "#2f7c3f",
  red: "#b84952",
  yellow: "#a97c22",
  blue: "#45699f",
  purple: "#705193",
  orange: "#9e623f",
  activeBg: "#f7f4ec",
  activeBorder: "#1e1b14",
  activeText: "#11100b",
};

const C = {
  bg: "var(--nd-bg)",
  sidebar: "var(--nd-sidebar)",
  panel: "var(--nd-panel)",
  panelSoft: "var(--nd-panel-soft)",
  border: "var(--nd-border)",
  borderSoft: "var(--nd-border-soft)",
  text: "var(--nd-text)",
  soft: "var(--nd-soft)",
  muted: "var(--nd-muted)",
  green: "var(--nd-green)",
  red: "var(--nd-red)",
  yellow: "var(--nd-yellow)",
  blue: "var(--nd-blue)",
  purple: "var(--nd-purple)",
  orange: "var(--nd-orange)",
  activeBg: "var(--nd-active-bg)",
  activeBorder: "var(--nd-active-border)",
  activeText: "var(--nd-active-text)",
};

type SidebarNavItem = {
  label: string;
  icon: typeof Grid2X2;
  href: string;
  children?: Array<{ label: string; href: string }>;
};

const NAV_ITEMS: SidebarNavItem[] = [
  { label: "Dashboard", icon: Grid2X2, href: "/next/dashboard" },
  { label: "Recession Monitor", icon: Gauge, href: "/next/recession-monitor" },
  {
    label: "Macro Sentiment",
    icon: LineChart,
    href: "/next/macro-sentiment",
    children: [
      { label: "Housing", href: "/next/macro-sentiment/housing" },
      { label: "Orders & Production", href: "/next/macro-sentiment/orders-production" },
      { label: "Income & Sales", href: "/next/macro-sentiment/income-sales" },
      { label: "Employment", href: "/next/macro-sentiment/employment" },
      { label: "Inflation", href: "/next/macro-sentiment/inflation" },
    ],
  },
  { label: "Fed Policy", icon: CircleDollarSign, href: "/next/fed-policy" },
  { label: "Yield Curve", icon: TrendingUp, href: "/next/yield-curve" },
  {
    label: "Inflation",
    icon: Sparkles,
    href: "/next/inflation",
    children: [
      { label: "CPI", href: "/next/inflation/cpi" },
      { label: "PCE", href: "/next/inflation/pce" },
      { label: "PPI", href: "/next/inflation/ppi" },
    ],
  },
  {
    label: "Analysis",
    icon: Compass,
    href: "/next/analysis",
    children: [
      { label: "Major Indices & Bitcoin", href: "/next/analysis/major-indices-bitcoin" },
      { label: "Sectors & Sentiment", href: "/next/analysis/sectors-sentiment" },
      { label: "Market Breadth", href: "/next/analysis/market-breadth" },
      { label: "Macro Overview", href: "/next/analysis/macro-overview" },
      { label: "Commodities & Global Activity", href: "/next/analysis/commodities-global-activity" },
      { label: "Risk Appetite & Relative Performance", href: "/next/analysis/risk-appetite-relative-performance" },
    ],
  },
  { label: "Forecast Lab", icon: ShoppingCart, href: "/next/forecast-lab" },
  { label: "Calendar & Alerts", icon: CalendarDays, href: "/next/calendar-alerts" },
  { label: "Reports", icon: Package, href: "/next/reports" },
];

type ThemeMode = "dark" | "light";

function buildThemeVars(mode: ThemeMode): CSSProperties {
  const palette = mode === "dark" ? DARK_THEME : LIGHT_THEME;
  return {
    "--nd-bg": palette.bg,
    "--nd-sidebar": palette.sidebar,
    "--nd-panel": palette.panel,
    "--nd-panel-soft": palette.panelSoft,
    "--nd-border": palette.border,
    "--nd-border-soft": palette.borderSoft,
    "--nd-text": palette.text,
    "--nd-soft": palette.soft,
    "--nd-muted": palette.muted,
    "--nd-green": palette.green,
    "--nd-red": palette.red,
    "--nd-yellow": palette.yellow,
    "--nd-blue": palette.blue,
    "--nd-purple": palette.purple,
    "--nd-orange": palette.orange,
    "--nd-active-bg": palette.activeBg,
    "--nd-active-border": palette.activeBorder,
    "--nd-active-text": palette.activeText,
  } as CSSProperties;
}

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

const YIELD_CURVE_SERIES_COLORS = {
  now: "#79ad76", // Asset Allocation green, one step lighter for chart readability
  m3: C.red,
  m6: "#d4b35e", // Asset Allocation yellow, slightly lighter
  y1: "#6a8ec4", // Asset Allocation blue, slightly lighter
} as const;

const YIELD_HISTORY_STYLE = [
  { key: "m3" as const, opacity: 0.78, dash: [5, 5] as [number, number] },
  { key: "m6" as const, opacity: 0.76, dash: [4, 4] as [number, number] },
  { key: "y1" as const, opacity: 0.74, dash: [6, 4] as [number, number] },
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

const SECTOR_TICKER_MAP: Record<string, string> = {
  Technology: "XLK, VGT",
  Financials: "XLF, VFH",
  Energy: "XLE, VDE",
  Industrials: "XLI, VIS",
  Materials: "XLB, VAW",
  Healthcare: "XLV, VHT",
  Utilities: "XLU, VPU",
  "Consumer Discretionary": "XLY, VCR",
  "Consumer Staples": "XLP, VDC",
};

type NextDashboardScreenProps = {
  mode?: "dashboard" | "placeholder";
  placeholderTitle?: string;
};

type SnapshotDetailKind = "factors" | "sectors" | "ideas" | null;

export function NextDashboardScreen({ mode = "dashboard", placeholderTitle = "Coming soon" }: NextDashboardScreenProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedNav, setExpandedNav] = useState<string | null>(null);
  const [snapshotDetail, setSnapshotDetail] = useState<SnapshotDetailKind>(null);
  const { refreshing, refreshResult, handleRefresh } = useDataRefresh();
  const navigatorQ = useQuery({ queryKey: ["next-dashboard", "navigator"], queryFn: getNavigatorRecommendation, staleTime: 120_000 });
  const regimeQ = useQuery({ queryKey: ["next-dashboard", "regime"], queryFn: getRegimeCurrent, staleTime: 120_000 });
  const fedQ = useQuery({ queryKey: ["next-dashboard", "fed"], queryFn: getFedStatus, staleTime: 120_000 });
  const signalsQ = useQuery({ queryKey: ["next-dashboard", "cross-asset-radar"], queryFn: getCrossAssetRadar, staleTime: 120_000 });
  const categoriesQ = useQuery({ queryKey: ["next-dashboard", "categories"], queryFn: getCategoryScores, staleTime: 120_000 });
  const recessionQ = useQuery({ queryKey: ["next-dashboard", "recession"], queryFn: getRecessionCheck, staleTime: 120_000 });
  const inflationQ = useQuery({ queryKey: ["next-dashboard", "inflation-latest"], queryFn: getInflationLatest, staleTime: 120_000 });
  const inflationSeriesQ = useQuery({ queryKey: ["next-dashboard", "inflation-series-cpi"], queryFn: () => getInflationSeries("CPI", "yoy", 365 * 4), staleTime: 120_000 });
  const coreInflationSeriesQ = useQuery({ queryKey: ["next-dashboard", "inflation-series-core"], queryFn: () => getInflationSeries("Core CPI", "yoy", 365 * 4), staleTime: 120_000 });
  const fedRateHistoryQ = useQuery({ queryKey: ["next-dashboard", "fed-rate-history"], queryFn: () => getRateHistory(120), staleTime: 120_000 });
  const regimeHistoryQ = useQuery({ queryKey: ["next-dashboard", "regime-history"], queryFn: () => getRegimeHistory(6), staleTime: 120_000 });
  const spreadHistoryQ = useQuery({ queryKey: ["next-dashboard", "spread-history-2y10y"], queryFn: () => getSpreadHistory("2Y10Y", 365), staleTime: 120_000 });
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
  const inflationDelta = useMemo(() => {
    const points = inflationSeriesQ.data;
    if (!points || points.length < 2) return null;
    return points[points.length - 1].value - points[points.length - 2].value;
  }, [inflationSeriesQ.data]);
  const coreInflationDelta = useMemo(() => {
    const points = coreInflationSeriesQ.data;
    if (!points || points.length < 2) return null;
    return points[points.length - 1].value - points[points.length - 2].value;
  }, [coreInflationSeriesQ.data]);
  const fedPolicyDelta = useMemo(() => {
    const rates = fedRateHistoryQ.data;
    if (!rates || rates.length < 2) return null;
    const sorted = [...rates].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    const midpointLatest = (latest.target_upper + latest.target_lower) / 2;
    const midpointPrev = (prev.target_upper + prev.target_lower) / 2;
    const rateComponentLatest = (midpointLatest - 2.5) / 2.5;
    const rateComponentPrev = (midpointPrev - 2.5) / 2.5;
    return rateComponentLatest - rateComponentPrev;
  }, [fedRateHistoryQ.data]);
  const macroSentimentDelta = useMemo(() => {
    const points = regimeHistoryQ.data;
    if (!points || points.length < 2) return null;
    const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
    return sorted[sorted.length - 1].cycle_score - sorted[sorted.length - 2].cycle_score;
  }, [regimeHistoryQ.data]);
  const spreadDelta = useMemo(() => {
    const points = spreadHistoryQ.data;
    if (!points || points.length < 2) return null;
    const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
    return sorted[sorted.length - 1].value - sorted[sorted.length - 2].value;
  }, [spreadHistoryQ.data]);
  const macroSentimentSeries = useMemo(() => {
    const points = regimeHistoryQ.data;
    if (!points?.length) return [cycleScore];
    return [...points]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((p) => p.cycle_score)
      .filter((v) => Number.isFinite(v))
      .slice(-36);
  }, [regimeHistoryQ.data, cycleScore]);
  const fedRateSeries = useMemo(() => {
    const rates = fedRateHistoryQ.data;
    if (!rates?.length) return [fedQ.data?.current_rate_upper ?? 0];
    const sorted = [...rates]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => (r.effr ?? (r.target_upper + r.target_lower) / 2))
      .filter((v) => Number.isFinite(v));
    const compressed = sorted.filter((v, i) => i === 0 || Math.abs(v - sorted[i - 1]) >= 0.01);
    if (compressed.length >= 3) return compressed.slice(-72);
    return sorted.slice(-72);
  }, [fedRateHistoryQ.data, fedQ.data?.current_rate_upper]);
  const quick = useMemo(
    () => [
      {
        label: "Fed Policy Score",
        value: fedPolicy,
        delta: fedPolicyDelta,
        min: -2,
        mid: 0,
        max: 2,
        format: "number" as const,
        sub: "z-score",
        higherIsWorse: true,
        gradient: "linear-gradient(90deg, rgba(96,186,125,0.9) 0%, rgba(184,199,112,0.86) 50%, rgba(201,97,109,0.9) 100%)",
        palette: ["#6db77a", "#c9b55d", "#c66b74"] as const,
      },
      {
        label: "Macro Sentiment",
        value: cycleScore,
        delta: macroSentimentDelta,
        min: -20,
        mid: 0,
        max: 20,
        format: "number" as const,
        sub: "cycle score",
        higherIsWorse: false,
        gradient: "linear-gradient(90deg, rgba(193,97,109,0.9) 0%, rgba(191,182,111,0.86) 50%, rgba(96,186,125,0.9) 100%)",
        palette: ["#c66b74", "#c9b55d", "#6db77a"] as const,
      },
      {
        label: "Yield Curve (2Y-10Y)",
        value: spread2y10y,
        delta: spreadDelta,
        min: -200,
        mid: 0,
        max: 200,
        format: "basis_points" as const,
        sub: "spread",
        higherIsWorse: false,
        gradient: "linear-gradient(90deg, rgba(196,96,108,0.9) 0%, rgba(182,168,110,0.84) 50%, rgba(95,183,123,0.9) 100%)",
        palette: ["#c66b74", "#c9b55d", "#6db77a"] as const,
      },
    ],
    [fedPolicy, fedPolicyDelta, cycleScore, macroSentimentDelta, spread2y10y, spreadDelta],
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
  const fullIdeas = navigatorQ.data?.trading_recommendations ?? [];
  const fullFactors = navigatorQ.data?.factor_tilts ?? [];
  const fullSectors = navigatorQ.data?.sector_allocations ?? [];
  const recs = fullIdeas.slice(0, 4);
  const factors = fullFactors.slice(0, 7);
  const sectors = fullSectors.slice(0, 6);
  const aa = navigatorQ.data?.asset_allocation;
  const alloc = [
    { label: "Equities", value: aa?.equities_pct ?? 55, color: "#679963" },
    { label: "Bonds", value: aa?.bonds_pct ?? 25, color: "#587eb2" },
    { label: "Commodities", value: aa?.commodities_pct ?? 10, color: "#c9a349" },
    { label: "Cash", value: aa?.cash_pct ?? 5, color: "#8b8b85" },
    { label: "Gold", value: aa?.gold_pct ?? 5, color: "#7a5a9b" },
  ];
  const geographyRows = useMemo(() => {
    const source = navigatorQ.data?.geographic;
    const base = Object.entries(source ?? {}).slice(0, 5);
    return base.map(([label, raw]) => {
      const normalized = normalizeGeoTilt(String(raw));
      return {
        label,
        raw: normalized,
        color: geoTiltColor(normalized),
        weight: geoTiltWeight(normalized),
      };
    });
  }, [navigatorQ.data?.geographic]);
  const dmGeo = geographyRows.find((row) => row.label.toUpperCase() === "DM") ?? geographyRows[0] ?? null;
  const emGeo = geographyRows.find((row) => row.label.toUpperCase() === "EM") ?? geographyRows[1] ?? null;

  const shellThemeVars = useMemo(() => buildThemeVars(theme), [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("next-dashboard-theme");
    if (saved === "dark" || saved === "light") {
      setTheme(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("next-dashboard-theme", theme);
  }, [theme]);

  useEffect(() => {
    const current = NAV_ITEMS.find(
      (item) =>
        pathname === item.href ||
        pathname.startsWith(`${item.href}/`) ||
        item.children?.some((child) => pathname === child.href),
    );
    if (current?.children?.length) {
      setExpandedNav(current.label);
      return;
    }
    if (expandedNav && !NAV_ITEMS.some((item) => item.label === expandedNav && item.children?.length)) {
      setExpandedNav(null);
    }
  }, [pathname, expandedNav]);

  useEffect(() => {
    if (!frameRef.current) return;
    frameRef.current.scrollTo({ left: 0, top: 0 });
  }, []);

  useEffect(() => {
    if (!snapshotDetail) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSnapshotDetail(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [snapshotDetail]);

  return (
    <div
      ref={frameRef}
      className="fixed inset-0 z-[60] overflow-auto"
      style={{ ...shellThemeVars, background: C.bg, color: C.text, fontFamily: "var(--font-plex-mono), ui-monospace, monospace" }}
    >
      <div
        className="grid min-h-screen"
        style={{
          width: "100%",
          gridTemplateColumns: `${sidebarCollapsed ? 110 : 320}px minmax(0, 1fr)`,
        }}
      >
        <aside className="flex min-h-screen flex-col border-r px-[24px] py-[34px]" style={{ borderColor: C.borderSoft, background: C.sidebar }}>
          <div className={sidebarCollapsed ? "text-center" : undefined}>
            <div
              className="text-[34px] leading-none"
              style={{ letterSpacing: sidebarCollapsed ? "0.02em" : "0.23em" }}
            >
              {sidebarCollapsed ? "M" : "MACROLENS"}
            </div>
            {!sidebarCollapsed && (
            <div className="mt-[28px] flex gap-3">
              <span className="mt-1 h-3 w-3 rounded-full" style={{ background: C.green }} />
              <div className="text-[13px] uppercase leading-[1.35] tracking-[0.08em]" style={{ color: C.soft }}>
                <div>Macro perspective.</div>
                <div>Better decisions.</div>
              </div>
            </div>
            )}
          </div>

          <div className="mt-[30px] space-y-[10px]">
            {NAV_ITEMS.map((item, index) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`) ||
                item.children?.some((child) => pathname === child.href);
              const isExpanded = expandedNav === item.label;
              return (
                <div key={item.label}>
                  <Link
                    href={item.href}
                    title={sidebarCollapsed ? item.label : undefined}
                    className="flex h-[44px] w-full items-center gap-4 rounded-[2px] border px-3 text-left text-[13px] uppercase tracking-[0.06em]"
                    onClick={() => {
                      if (!item.children?.length) {
                        setExpandedNav(null);
                        return;
                      }
                      setExpandedNav((prev) => (prev === item.label ? null : item.label));
                    }}
                    style={{
                      marginTop: index === 7 ? 18 : undefined,
                      borderColor: isActive ? C.activeBorder : "transparent",
                      background: isActive ? C.activeBg : "transparent",
                      color: isActive ? C.activeText : C.soft,
                      justifyContent: sidebarCollapsed ? "center" : "flex-start",
                    }}
                  >
                    <Icon size={19} strokeWidth={isActive ? 2.8 : 2} />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </Link>
                  {!sidebarCollapsed && item.children?.length && isExpanded ? (
                    <div className="ml-9 mt-1.5 space-y-1 border-l pl-3 text-[10px] uppercase tracking-[0.09em]" style={{ borderColor: C.borderSoft, color: C.muted }}>
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="block transition-opacity hover:opacity-90"
                          style={{ color: pathname === child.href ? C.text : C.muted }}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-auto">
            <div className="border-t pt-[22px]" style={{ borderColor: C.borderSoft }}>
              <div className={sidebarCollapsed ? "flex items-center justify-center" : "grid grid-cols-[1fr_auto] items-center"}>
                <div>
                  {!sidebarCollapsed && <div className="text-[12px] uppercase tracking-[0.08em]" style={{ color: C.muted }}>Data as of</div>}
                  {!sidebarCollapsed && <div className="mt-2 text-[12px] leading-[1.45]">{updatedAt}</div>}
                </div>
                <button type="button" onClick={handleRefresh} title="Refresh data" className="inline-flex h-8 w-8 items-center justify-center transition-opacity hover:opacity-80">
                  <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} style={{ color: refreshResult === "error" ? C.red : refreshResult === "ok" ? C.green : C.soft }} />
                </button>
              </div>
            </div>
            <div className="mt-[28px] border-y py-[24px]" style={{ borderColor: C.borderSoft }}>
              <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"}`}>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[22px]" style={{ background: C.text, color: C.bg }}>U</span>
                {!sidebarCollapsed && <div>
                  <div className="text-[13px] uppercase">User</div>
                  <div className="text-[12px]" style={{ color: C.soft }}>Portfolio Manager</div>
                </div>}
              </div>
            </div>
            <div className={`mt-[24px] flex items-center ${sidebarCollapsed ? "justify-center" : "justify-between"}`} style={{ color: C.soft }}>
              {!sidebarCollapsed && (
                <>
                  <button type="button" title="Toggle theme" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
                    <Sparkles size={20} />
                  </button>
                  <button type="button" title="Settings">
                    <Settings size={20} />
                  </button>
                  <button type="button" title="Notifications">
                    <Bell size={20} />
                  </button>
                </>
              )}
              <button type="button" title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setSidebarCollapsed((v) => !v)}>
                <Grid2X2 size={20} />
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0" style={{ padding: "14px 18px 20px" }}>
          {mode === "dashboard" ? (
          <section style={{ display: "grid", gap: 12 }}>
            <div className="grid" style={{ gap: 14, gridTemplateColumns: "680fr 532fr 360fr" }}>
            <div className="flex h-full min-h-0 flex-col" style={{ ...panelStyle(), height: 460 }}>
              <div className="min-h-0 flex-1">
                <SectionTitle label="Macro Navigator" />
                <div className="mt-0.5 h-full pb-2">
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
              </div>
              <div className="mt-auto border-t pt-[10px]" style={{ borderColor: C.borderSoft }}>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em]" style={{ color: C.text }}>
                  <span>Confidence</span>
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px]" style={{ borderColor: C.border }}>?</span>
                  <ConfidenceSegments value={confidence} />
                  <span className="text-[18px]">{fmtPct(confidence, 0)}</span>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-col" style={{ ...panelStyle(), height: 460 }}>
              <SectionTitle label="Cross-Asset Signals" />
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
                </div>
                <span
                  className="max-w-[220px] truncate rounded-[2px] border px-3 py-2 text-[11px] uppercase tracking-[0.08em]"
                  style={{ borderColor: regimeAccent(activeRegimeLabel), color: regimeAccent(activeRegimeLabel) }}
                >
                  {activeRegimeLabel}
                </span>
              </div>
              <div className="mt-4 space-y-4">
                <InflationQuickRow
                  cpiValue={inflationLatest}
                  coreValue={coreInflationLatest}
                  cpiDelta={inflationDelta}
                  coreDelta={coreInflationDelta}
                />
                {quick.map((row) => <QuickRow key={row.label} {...row} compact />)}
              </div>
            </div>

            </div>

            <div className="grid items-stretch" style={{ gap: 14, gridTemplateColumns: "252fr 410fr 438fr 458fr" }}>
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" style={dashboardQuadPanelStyle()}>
              <div className="shrink-0">
                <div className="text-[18px] uppercase leading-none tracking-[0.08em]">Recession Probability</div>
              </div>
              <div className="mt-3 grid shrink-0 items-start gap-2 border-b pb-3" style={{ borderColor: C.borderSoft, gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <div className="min-w-0">
                  <div className="text-[24px] leading-none tabular-nums">{fmtPct(recessionProbPct, 0)}</div>
                  <div className="mt-2 text-[13px] uppercase tracking-[0.08em]" style={{ color: recessionRisk.color }}>{recessionRisk.label}</div>
                </div>
                <RiskSegmentDonut value={recessionProbPct} />
              </div>
              <div className="mt-3 flex min-h-0 flex-1 flex-col text-[11px]">
                <div className="mb-2 flex shrink-0 items-center justify-between pb-1 text-[10px] uppercase tracking-[0.1em]" style={{ color: C.muted }}>
                  <span>Model</span>
                  <span>Probability</span>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
                  {recessionModelRows.map((row) => (
                    <div key={row.name} className="flex items-center justify-between gap-2 py-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: row.dot }} />
                        <span className="min-w-0 truncate text-[11px]" style={{ color: C.soft }}>{row.name}</span>
                      </div>
                      <span className="shrink-0 text-[11px] tabular-nums" style={{ color: C.text }}>{fmtPct(row.pct, 0)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 shrink-0 pt-1 text-[11px] tracking-[0.03em]" style={{ color: C.soft }}>View Recession Monitor {"->"}</div>
              </div>
            </div>

            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" style={dashboardQuadPanelStyle()}>
              <div className="mb-1 text-[18px] uppercase leading-none tracking-[0.08em]">Macro Sentiment Score</div>
              <div className="mt-3 flex min-h-0 flex-1 flex-col">
                <div className="flex h-[92px] shrink-0 items-start gap-3 overflow-hidden">
                  <div className="shrink-0">
                    <div className="text-[24px] leading-none tabular-nums">{fmtNumber(cycleScore)}</div>
                    <div className="mt-2 text-[13px] uppercase tracking-[0.08em]" style={{ color: C.green }}>Z-score</div>
                  </div>
                  <div className="min-h-0 min-w-0 flex-1 self-start">
                    <MacroSentimentSparkBlock values={macroSentimentSeries} />
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
              <div className="mb-1 text-[18px] uppercase leading-none tracking-[0.08em]">Fed Policy Score</div>
              <div
                className="mt-2 grid min-w-0 shrink-0 items-start gap-y-0 overflow-hidden"
                style={{ gridTemplateColumns: "minmax(78px,auto) minmax(0,1fr)" }}
              >
                <div className="min-w-0">
                  <div className="text-[24px] leading-none tabular-nums">{fmtNumber(fedPolicy)}</div>
                  <div className="mt-2 text-[13px] uppercase tracking-[0.08em]" style={{ color: C.green }}>{fedQ.data?.stance ?? "Moderately Easy"}</div>
                </div>
                <div className="min-w-0 px-1 py-0.5">
                  <FedPolicyScaleBar value={fedPolicy ?? 0} />
                </div>
                <div className="col-span-2 mt-2 border-t pt-3" style={{ borderColor: C.borderSoft }}>
                  <div
                    className="grid min-w-0 items-start"
                    style={{ gridTemplateColumns: "minmax(78px,auto) minmax(0,1fr)" }}
                  >
                    <div className="min-w-0">
                      <div className="leading-tight text-[10px] uppercase tracking-[0.06em]" style={{ color: C.soft }}>
                        <div>Fed Funds</div>
                        <div>Rate</div>
                      </div>
                    </div>
                    <div className="min-w-0 pl-1 pt-0.5">
                      <FedRateHistorySpark values={fedRateSeries} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-auto flex shrink-0 flex-col border-t pt-3 text-[11px] uppercase tracking-[0.06em]" style={{ color: C.soft, borderColor: C.borderSoft }}>
                <div className="flex items-center justify-between py-2">
                  <span>Rate direction</span>
                  <span style={{ color: C.text }}>{fedQ.data?.rate_direction ?? "Paused"}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span>Balance sheet</span>
                  <span style={{ color: C.text }}>{fedQ.data?.balance_sheet_direction ?? "QT"}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span>Vs neutral (r*)</span>
                  <span style={{ color: C.text }}>+0.42%</span>
                </div>
                <div className="mt-auto shrink-0 pt-2 text-[11px] normal-case tracking-[0.03em]" style={{ color: C.soft }}>View Fed Policy {"->"}</div>
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
              <div className="mt-auto shrink-0 border-t px-1 pt-2 pb-0.5" style={{ borderColor: C.borderSoft }}>
                <div className="grid grid-cols-2 gap-0">
                  <div
                    className="flex items-center justify-center gap-1.5 border-r py-0.5 pr-1.5 text-center"
                    style={{ borderColor: C.borderSoft }}
                  >
                    <span className="text-[11px] uppercase tracking-[0.08em]" style={{ color: C.soft }}>2Y-10Y:</span>
                    <span className="text-[13px] font-medium tabular-nums" style={{ color: C.yellow }}>
                      {formatSpread2y10y(yieldCurveQ.data)}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 py-0.5 pl-1.5 text-center">
                    <span className="text-[11px] uppercase tracking-[0.08em]" style={{ color: C.soft }}>Real Yield 10Y:</span>
                    <span className="text-[13px] font-medium tabular-nums" style={{ color: C.text }}>
                      {formatRealYield10y(yieldCurveQ.data)}
                    </span>
                  </div>
                </div>
                <div className="mt-1 pt-1 text-[11px] tracking-[0.03em]" style={{ color: C.soft }}>
                  View Yield Curve {"->"}
                </div>
              </div>
            </div>

            </div>

            <div style={{ ...panelStyle(), height: 280 }}>
              <SectionTitle label="Recommendations Snapshot" />
              <div
                className="mt-3 grid grid-cols-[0.82fr_0.95fr_1.24fr_2.84fr] gap-0 text-[12px]"
                style={{ color: C.soft }}
              >
                <div className="flex h-full flex-col pr-3">
                  <SnapshotTiltTable
                    title="Factor Tilts"
                    rows={
                      factors.length
                        ? factors.map((f) => ({ name: f.factor, tilt: normalizeTiltLabel(f.weight), color: tiltColor(f.weight) }))
                        : FALLBACK_FACTORS.map(([name, tilt, color]) => ({ name, tilt, color }))
                    }
                    showSignals
                  />
                  <button
                    type="button"
                    className="mt-auto pt-3 text-[11px] uppercase tracking-[0.05em] transition-opacity hover:opacity-85"
                    style={{ color: C.text }}
                    onClick={() => setSnapshotDetail("factors")}
                  >
                    View Full Factor Tilts {"->"}
                  </button>
                </div>
                <div className="flex h-full flex-col border-l pl-3 pr-3" style={{ borderColor: C.borderSoft }}>
                  <SnapshotTiltTable
                    title="Sector Allocation"
                    rows={
                      sectors.length
                        ? sectors.map((s) => ({ name: s.sector, tilt: normalizeTiltLabel(s.weight), color: tiltColor(s.weight) }))
                        : FALLBACK_SECTORS.map(([name, tilt, color]) => ({ name, tilt, color }))
                    }
                  />
                  <button
                    type="button"
                    className="mt-auto pt-3 text-[11px] uppercase tracking-[0.05em] transition-opacity hover:opacity-85"
                    style={{ color: C.text }}
                    onClick={() => setSnapshotDetail("sectors")}
                  >
                    View Full Allocation {"->"}
                  </button>
                </div>
                <div className="border-l pl-4 pr-3" style={{ borderColor: C.borderSoft }}>
                  <div className="mb-2 text-center uppercase tracking-[0.08em]">Asset Allocation</div>
                  <div className="flex items-start gap-1.5">
                    <AssetDonut items={alloc} />
                    <div className="w-[126px] space-y-0.5">
                      {alloc.map((d) => (
                        <div key={d.label} className="grid grid-cols-[1fr_auto] items-center gap-0.5 py-[1px]">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: d.color }} />
                            {d.label}
                          </div>
                          <span className="tabular-nums text-right" style={{ color: C.text }}>{Math.round(d.value)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {geographyRows.length ? (
                    <div className="mt-3 border-t pt-2" style={{ borderColor: C.borderSoft }}>
                      <GeographySplitBar rows={geographyRows} />
                      <div className="mt-1 grid grid-cols-2 text-[11px]">
                        <div className="flex items-center justify-center gap-1.5 py-1">
                          <span className="uppercase">{dmGeo?.label ?? "DM"}</span>
                          <span className="tabular-nums uppercase" style={{ color: dmGeo?.color ?? C.soft }}>{dmGeo?.raw ?? "neutral"}</span>
                        </div>
                        <div className="flex items-center justify-center gap-1.5 border-l py-1" style={{ borderColor: C.borderSoft }}>
                          <span className="uppercase">{emGeo?.label ?? "EM"}</span>
                          <span className="tabular-nums uppercase" style={{ color: emGeo?.color ?? C.soft }}>{emGeo?.raw ?? "neutral"}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="flex h-full flex-col border-l pl-4 pr-1" style={{ borderColor: C.borderSoft }}>
                  <div className="mb-2 text-center uppercase tracking-[0.08em]">Trading Ideas (Examples)</div>
                  {recs.length ? (
                    <SnapshotTradingIdeas rows={recs} />
                  ) : (
                    <div className="py-2 text-[11px] uppercase tracking-[0.06em]" style={{ color: C.muted }}>
                      No trading ideas
                    </div>
                  )}
                  <button
                    type="button"
                    className="mt-auto pt-3 text-[11px] uppercase tracking-[0.05em] transition-opacity hover:opacity-85"
                    style={{ color: C.text }}
                    onClick={() => setSnapshotDetail("ideas")}
                  >
                    View All Ideas {"->"}
                  </button>
                </div>
              </div>
            </div>
          </section>
          ) : (
            <section
              className="flex min-h-[calc(100vh-80px)] items-center justify-center rounded-[2px] border"
              style={{ borderColor: C.borderSoft, background: C.panel }}
            >
              <div className="text-center">
                <div className="text-[34px] uppercase tracking-[0.11em]">{placeholderTitle}</div>
                <div className="mt-4 text-[14px] uppercase tracking-[0.08em]" style={{ color: C.soft }}>
                  This section is coming soon.
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
      {snapshotDetail ? (
        <SnapshotDetailModal
          kind={snapshotDetail}
          onClose={() => setSnapshotDetail(null)}
          factors={fullFactors}
          sectors={fullSectors}
          ideas={fullIdeas}
        />
      ) : null}
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

function SectionTitle({ label, sub, centered = false }: { label: string; sub?: string; centered?: boolean }) {
  return (
    <div className={`mb-1 ${centered ? "text-center" : ""}`}>
      <div className="text-[18px] uppercase leading-none tracking-[0.08em]">{label}</div>
      {sub ? <div className="mt-3 text-[13px] tracking-[0.02em]" style={{ color: C.text }}>{sub}</div> : null}
    </div>
  );
}

function ConfidenceSegments({ value }: { value: number }) {
  const safeValue = clamp(value, 0, 100);

  return (
    <div className="flex flex-1 gap-0.5">
      {Array.from({ length: 10 }).map((_, i) => {
        const fill = clamp(safeValue - i * 10, 0, 10) * 10;

        return (
          <span key={i} className="relative h-[6px] flex-1 overflow-hidden rounded-[2px]" style={{ background: C.border }}>
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
      <text x="310" y="365" fill={C.soft} fontSize="11" textAnchor="middle">FED POLICY (TIGHT)</text>
      <text x="24" y="199" fill={C.soft} fontSize="11">MACRO</text>
      <text x="24" y="214" fill={C.soft} fontSize="11">SENTIMENT</text>
      <text x="554" y="199" fill={C.soft} fontSize="11">MACRO</text>
      <text x="554" y="214" fill={C.soft} fontSize="11">SENTIMENT</text>

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
    { ...relative("Gold vs Copper", get("Gold"), get("Copper")), description: "Risk appetite factor" },
    { ...relative("Gold vs Oil", get("Gold"), get("Oil")), description: "Risk appetite factor" },
    single("DXY", "DXY", "Dollar pressure"),
    single("VIX", "VIX", "Vol"),
    single("High Beta vs Low Beta", "High Beta vs Low Beta", "Risk appetite factor"),
    single("Cyclicals vs Non-Cyclicals", "Cyclicals vs Defensives", "Cycle exposure"),
  ];
}

function SignalRow({ signal }: { signal: CrossAssetDisplaySignal }) {
  const value = signal.value == null ? "N/A" : `${signal.value > 0 ? "+" : ""}${signal.value.toFixed(1)}${signal.unit ?? "%"}`;
  return (
    <div
      className="grid items-center border-b"
      style={{
        borderColor: C.border,
        gridTemplateColumns: "minmax(0, 1.04fr) minmax(0, 1.56fr) 162px",
        columnGap: 8,
        padding: "4px 0",
      }}
    >
      <div className="min-w-0">
        <div className="truncate text-[12px] uppercase tracking-[0.03em]">{signal.name}</div>
        <div className="mt-0.5 truncate text-[10px]" style={{ color: C.soft }}>{signal.description}</div>
      </div>
      <div className="min-w-0 pr-0.5">
        <Sparkline points={series(signal.name, signal.signal, 22)} color={signalColor(signal.signal)} width={280} height={22} responsive responsiveMode="fixed-height" />
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <span className="min-w-[88px] whitespace-nowrap rounded-[2px] px-2 py-1 text-center text-[9px] uppercase tracking-[0.06em]" style={{ background: badgeColor(signal.signal), color: badgeTextColor(signal.signal) }}>{badgeText(signal.signal)}</span>
        <div className="min-w-[56px] whitespace-nowrap text-right text-[12px] tabular-nums">{value}</div>
      </div>
    </div>
  );
}

function QuickRow({
  label,
  value,
  secondaryValue,
  delta,
  min,
  mid,
  max,
  format,
  sub,
  higherIsWorse = false,
  gradient,
  palette,
  compact = false,
}: {
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
}) {
  const safe = value == null ? mid : clamp(value, min, max);
  const secondarySafe = secondaryValue == null ? null : clamp(secondaryValue, min, max);
  const ratio = clamp((safe - min) / (max - min), 0, 1);
  const secondaryRatio = secondarySafe == null ? null : clamp((secondarySafe - min) / (max - min), 0, 1);
  const display = value == null ? "N/A" : format === "percent" ? fmtPct(value, 1) : format === "basis_points" ? `${value.toFixed(0)}bp` : value.toFixed(2);
  const deltaDisplay = formatDeltaByFormat(delta ?? null, format);
  const deltaArrow = delta == null ? "→" : delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  const deltaColor = delta == null ? C.soft : higherIsWorse ? (delta > 0 ? C.red : delta < 0 ? C.green : C.soft) : (delta > 0 ? C.green : delta < 0 ? C.red : C.soft);
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
          <div className={`mt-1 ${subSize} uppercase`} style={{ color: C.soft }}>{sub ?? (format === "percent" ? "composite" : "z-score")}</div>
        </div>
        <div className={`${valueSize} leading-none tabular-nums whitespace-nowrap`}>{deltaDisplay} <span style={{ color: deltaColor }}>{deltaArrow}</span></div>
      </div>
      <div className="relative h-[6px] rounded" style={{ background: C.border }}>
        <div className="h-[6px] rounded" style={{ width: `${ratio * 100}%`, background: gradient ?? C.green }} />
        {secondaryRatio != null ? (
          <div
            className="absolute inset-y-0 left-0 rounded"
            style={{ width: `${secondaryRatio * 100}%`, background: "#88f3cb", opacity: 0.45, boxShadow: "0 0 6px rgba(136,243,203,0.25)" }}
          />
        ) : null}
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-shadow hover:shadow-[0_0_0_2px_rgba(215,208,199,0.35)]"
          style={{ left: `${ratio * 100}%`, background: pointColorFromPalette(ratio, palette, higherIsWorse), borderColor: C.panel }}
          title={`${label}: ${display}`}
        />
        <span className="absolute top-[-5px] h-4 w-px" style={{ left: `${midRatio * 100}%`, background: "#777" }} />
      </div>
      <div className={`${scaleGap} flex justify-between text-[12px]`} style={{ color: C.soft }}>
        <span>{formatTick(min, format)}</span><span>{formatTick(mid, format)}</span><span>{formatTick(max, format)}</span>
      </div>
    </div>
  );
}

function InflationQuickRow({
  cpiValue,
  coreValue,
  cpiDelta,
  coreDelta,
}: {
  cpiValue: number | null;
  coreValue: number | null;
  cpiDelta: number | null;
  coreDelta: number | null;
}) {
  const min = 0;
  const target = 2;
  const mid = 3;
  const max = 6;
  const cpi = cpiValue == null ? mid : clamp(cpiValue, min, max);
  const core = coreValue == null ? null : clamp(coreValue, min, max);
  const ratio = clamp((cpi - min) / (max - min), 0, 1);
  const coreRatio = core == null ? null : clamp((core - min) / (max - min), 0, 1);
  const targetRatio = (target - min) / (max - min);
  const midRatio = (mid - min) / (max - min);
  const displayDelta = formatDelta(cpiDelta, "%");
  const coreDeltaDisplay = formatDelta(coreDelta, "%");
  const deltaArrow = cpiDelta == null ? "→" : cpiDelta > 0 ? "↑" : cpiDelta < 0 ? "↓" : "→";
  const cpiDisplay = cpiValue == null ? "N/A" : `${cpiValue.toFixed(1)}%`;
  const coreDisplay = coreValue == null ? "N/A" : `${coreValue.toFixed(1)}%`;
  const pointColor = pointColorFromPalette(ratio, ["#6db77a", "#c9b55d", "#c66b74"], true);

  return (
    <div>
      <div className="mb-2 flex items-end justify-between">
        <div>
          <div className="text-[12px] uppercase tracking-[0.06em]" style={{ color: C.text }}>Inflation</div>
          <div className="mt-1 text-[10px] uppercase" style={{ color: C.soft }}>CPI YoY</div>
        </div>
        <div className="text-right text-[18px] leading-none tabular-nums">
          {displayDelta.value} <span style={{ color: displayDelta.color }}>{deltaArrow}</span>
        </div>
      </div>
      <div className="relative h-[6px] rounded" style={{ background: C.border }}>
        <div
          className="h-[6px] rounded"
          style={{
            width: `${ratio * 100}%`,
            background: "linear-gradient(90deg, rgba(80,168,106,0.9) 0%, rgba(130,186,86,0.86) 52%, rgba(211,171,73,0.9) 78%, rgba(194,84,97,0.92) 100%)",
          }}
        />
        {coreRatio != null ? (
          <span
            className="absolute inset-y-0 left-0 rounded"
            style={{
              width: `${coreRatio * 100}%`,
              background: "linear-gradient(90deg, rgba(121,248,214,0.56) 0%, rgba(121,248,214,0.24) 100%)",
              boxShadow: "0 0 8px rgba(121,248,214,0.32)",
            }}
          />
        ) : null}
        <span className="absolute top-[-6px] h-[22px] w-px" style={{ left: `${targetRatio * 100}%`, background: "#9f88df" }} />
        <span className="absolute top-[-6px] h-[22px] w-px" style={{ left: `${midRatio * 100}%`, background: "rgba(220,214,205,0.6)" }} />
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-shadow hover:shadow-[0_0_0_2px_rgba(215,208,199,0.35)]"
          style={{
            left: `${ratio * 100}%`,
            background: pointColor,
            borderColor: C.panel,
          }}
          title={`Current CPI: ${cpiDisplay} (${displayDelta.value})\nCore CPI: ${coreDisplay} (${coreDeltaDisplay.value})`}
        />
      </div>
      <div className="relative mt-2 h-4 text-[11px]" style={{ color: C.soft }}>
        <span className="absolute left-0 -translate-x-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${targetRatio * 100}%`, color: "#9f88df" }}>2</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${midRatio * 100}%` }}>3</span>
        <span className="absolute right-0 translate-x-0">6</span>
      </div>
    </div>
  );
}

function FedPolicyScaleBar({ value }: { value: number }) {
  const safe = clamp(value, -2, 2);
  const ratio = clamp((safe + 2) / 4, 0, 1);
  const pointerColor = pointColorFromPalette(ratio, ["#6db77a", "#c9b55d", "#c66b74"], true);
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between px-0.5 text-[12px] tabular-nums" style={{ color: C.soft }}>
        <span>-2</span>
        <span>0</span>
        <span>+2</span>
      </div>
      <div className="relative h-[6px] rounded" style={{ background: C.border }}>
        <div
          className="h-[6px] rounded"
          style={{
            background:
              "linear-gradient(90deg, rgba(96,186,125,0.9) 0%, rgba(184,199,112,0.86) 50%, rgba(201,97,109,0.9) 100%)",
          }}
        />
        <span className="absolute top-[-5px] h-4 w-px" style={{ left: "50%", background: "rgba(220,214,205,0.6)" }} />
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-shadow hover:shadow-[0_0_0_2px_rgba(215,208,199,0.35)]"
          style={{
            left: `${ratio * 100}%`,
            background: pointerColor,
            borderColor: C.panel,
          }}
          title={`Fed policy score: ${fmtNumber(safe)}`}
        />
      </div>
    </div>
  );
}

function FedRateHistorySpark({ values }: { values: number[] }) {
  const rawPts = useMemo(() => {
    const clean = values.filter((v) => Number.isFinite(v));
    return clean.length ? clean : [0];
  }, [values]);
  const pts = rawPts.length >= 2 ? rawPts : [rawPts[0], rawPts[0]];
  const minRaw = useMemo(() => Math.min(...rawPts), [rawPts]);
  const maxRaw = useMemo(() => Math.max(...rawPts), [rawPts]);
  const range = useMemo(() => Math.max(0.25, maxRaw - minRaw), [minRaw, maxRaw]);
  const pad = Math.max(range * 0.12, 0.05);
  const yMin = minRaw - pad;
  const yMax = maxRaw + pad;
  const yMid = (yMin + yMax) / 2;
  const svgW = 300;
  const svgH = 74;
  const plotLeft = 0;
  const plotRight = 258;
  const plotTop = 4;
  const plotBottom = 70;
  const plotW = plotRight - plotLeft;
  const pointsCount = Math.max(1, pts.length - 1);
  const yAt = (v: number) => {
    const ratio = clamp((v - yMin) / (yMax - yMin), 0, 1);
    return plotBottom - ratio * (plotBottom - plotTop);
  };
  const stepPath = (() => {
    let d = "";
    for (let i = 0; i < pts.length; i += 1) {
      const x = plotLeft + (i / pointsCount) * plotW;
      const y = yAt(pts[i]);
      if (i === 0) {
        d = `M${x.toFixed(2)} ${y.toFixed(2)}`;
      } else {
        const prevY = yAt(pts[i - 1]);
        d += ` L${x.toFixed(2)} ${prevY.toFixed(2)} L${x.toFixed(2)} ${y.toFixed(2)}`;
      }
    }
    return d;
  })();
  const areaPath = `${stepPath} L${plotRight.toFixed(2)} ${plotBottom.toFixed(2)} L${plotLeft.toFixed(2)} ${plotBottom.toFixed(2)} Z`;
  const changeMarkers = pts
    .map((value, index) => ({ value, index }))
    .filter((point) => point.index > 0 && Math.abs(point.value - pts[point.index - 1]) >= 0.01);
  const formatRateAxisLabel = (num: number) =>
    `${num.toFixed(range < 0.6 ? 2 : 1).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1")}%`;

  return (
    <div className="relative h-[74px] min-h-[74px] w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 right-7 top-0 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="absolute left-0 right-7 top-1/2 h-px -translate-y-1/2" style={{ background: "rgba(255,255,255,0.07)" }} />
        <div className="absolute bottom-0 left-0 right-7 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
      </div>
      <div className="h-full w-full pr-7">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none" className="block h-full w-full min-w-0">
          <path d={areaPath} fill={C.green} opacity={0.1} />
          <path d={stepPath} fill="none" stroke={C.green} strokeWidth={1.4} strokeLinecap="butt" strokeLinejoin="miter" />
          {changeMarkers.map((marker) => {
            const x = plotLeft + (marker.index / pointsCount) * plotW;
            const y = yAt(marker.value);
            return <circle key={`fed-step-${marker.index}`} cx={x} cy={y} r={1.7} fill={C.green} />;
          })}
        </svg>
      </div>
      <span className="pointer-events-none absolute right-0 top-0 text-[10px] tabular-nums leading-none" style={{ color: C.muted }}>
        {formatRateAxisLabel(yMax)}
      </span>
      <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[10px] tabular-nums leading-none" style={{ color: C.muted }}>
        {formatRateAxisLabel(yMid)}
      </span>
      <span className="pointer-events-none absolute bottom-0 right-0 text-[10px] tabular-nums leading-none" style={{ color: C.muted }}>
        {formatRateAxisLabel(yMin)}
      </span>
    </div>
  );
}

function Sparkline({
  points,
  color,
  width = 70,
  height = 18,
  fill,
  fillOpacity = 0.16,
  responsive = false,
  responsiveMode = "stretch",
  strokeWidth = 1.9,
}: {
  points: number[];
  color: string;
  width?: number;
  height?: number;
  fill?: boolean;
  fillOpacity?: number;
  responsive?: boolean;
  responsiveMode?: "stretch" | "fit" | "fixed-height";
  strokeWidth?: number;
}) {
  if (!points.length) return null;
  const padY = fill ? 3 : 0;
  const innerH = height - padY * 2;
  const step = width / Math.max(1, points.length - 1);
  const yAt = (p: number) => padY + innerH - (p / 100) * innerH;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)} ${yAt(p).toFixed(2)}`).join(" ");
  const area = `${d} L${width} ${height} L0 ${height} Z`;
  const svgHeight = responsive ? (responsiveMode === "fixed-height" ? height : "100%") : height;
  const svgClass = responsive
    ? (responsiveMode === "fixed-height" ? "block w-full min-w-0" : "block h-full w-full min-w-0")
    : undefined;
  const preserveAspectRatio = responsive
    ? (responsiveMode === "fit" ? "xMidYMid meet" : "none")
    : "xMidYMid meet";
  return (
    <svg
      width={responsive ? "100%" : width}
      height={svgHeight}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={preserveAspectRatio}
      className={svgClass}
      style={{ overflow: "visible" }}
    >
      {fill ? <path d={area} fill={color} opacity={fillOpacity} /> : null}
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

function RiskSegmentDonut({ value }: { value: number }) {
  const safe = clamp(value, 0, 100);
  const litSegments = Math.floor(safe / 10);
  const segmentPalette = [
    "#6fb97b",
    "#72bd7f",
    "#79c286",
    "#b8b25c",
    "#c3b75f",
    "#d0be64",
    "#be6f7c",
    "#c36777",
    "#cb5f71",
    "#bc4856",
  ];
  const inactive = "rgba(54,66,79,0.66)";
  const gap = 3.4;
  const slice = 360 / 10;
  const ringBg = "#0d141d";
  const gradient = Array.from({ length: 10 }).flatMap((_, i) => {
      const segStart = i * slice;
      const segEnd = (i + 1) * slice;
      const start = segStart + gap * 0.5;
      const end = segEnd - gap * 0.5;
      const fill = clamp((safe - i * 10) / 10, 0, 1);
      const activeColor = segmentPalette[i];
      const chunks = [
        `${ringBg} ${segStart}deg ${start}deg`,
      ];
      if (fill <= 0) {
        chunks.push(`${inactive} ${start}deg ${end}deg`);
      } else if (fill >= 1) {
        chunks.push(`${activeColor} ${start}deg ${end}deg`);
      } else {
        const split = start + (end - start) * fill;
        chunks.push(`${activeColor} ${start}deg ${split}deg`);
        chunks.push(`${inactive} ${split}deg ${end}deg`);
      }
      chunks.push(`${ringBg} ${end}deg ${segEnd}deg`);
      return chunks;
    })
    .join(", ");
  const showExclamation = litSegments >= 10;
  return (
    <div
      className="shrink-0 rounded-full border"
      style={{
        width: "clamp(64px, 10vw, 98px)",
        height: "clamp(64px, 10vw, 98px)",
        borderColor: C.border,
        background: `conic-gradient(from -90deg, ${gradient})`,
        padding: "clamp(10px, 1.9vw, 17px)",
        position: "relative",
      }}
    >
      <div className="flex h-full w-full items-center justify-center rounded-full" style={{ background: C.panelSoft }}>
        {showExclamation ? <span className="text-[28px] leading-none" style={{ color: "#cb5161" }}>!</span> : null}
      </div>
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
  return (
    <div
      className="h-[112px] w-[112px] min-w-[112px] shrink-0 rounded-full"
      style={{ background: `conic-gradient(${slices})`, padding: 24, aspectRatio: "1 / 1" }}
    >
      <div className="h-full w-full rounded-full" style={{ background: C.panel }} />
    </div>
  );
}

function SnapshotTiltTable({
  title,
  rows,
  showSignals = false,
}: {
  title: string;
  rows: Array<{ name: string; tilt: string; color: string }>;
  showSignals?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 text-center uppercase tracking-[0.08em]">{title}</div>
      {rows.map((row) => (
        <div key={`${row.name}-${row.tilt}`} className="grid grid-cols-[1fr_auto] items-center gap-2 py-[2px]">
          <span className="truncate">{row.name}</span>
          <span className="inline-flex min-w-[34px] items-center justify-end gap-1 tabular-nums" style={{ color: row.color }}>
            {showSignals ? <span>{tiltArrow(row.tilt)}</span> : null}
            <span>{row.tilt}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function GeographySplitBar({ rows }: { rows: Array<{ label: string; raw: string; color: string; weight: number }> }) {
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  const fallbackDenominator = Math.max(1, rows.length);
  return (
    <div className="mb-3 flex h-5 overflow-hidden rounded-[2px] border" style={{ borderColor: C.border, background: C.panelSoft }}>
      {rows.map((row, index) => {
        const ratio = total > 0 ? row.weight / total : 1 / fallbackDenominator;
        return (
          <div
            key={`geo-segment-${row.label}`}
            className="relative h-full"
            style={{
              width: `${ratio * 100}%`,
              background: row.color,
              opacity: index % 2 === 0 ? 0.8 : 0.76,
            }}
          />
        );
      })}
    </div>
  );
}

function SnapshotTradingIdeas({ rows }: { rows: Array<{ name: string; trade_type: string; legs: string; description?: string; rationale?: string }> }) {
  return (
    <div>
      <div
        className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.05fr)_minmax(0,1.2fr)] gap-2 border-b pb-1 text-[10px] uppercase tracking-[0.08em]"
        style={{ borderColor: C.border, color: C.muted }}
      >
        <span>Category</span>
        <span>Thesis</span>
        <span className="text-right">Legs</span>
      </div>
      {rows.map((row) => {
        const longLeg = extractLeg(row.legs, "long");
        const shortLeg = extractLeg(row.legs, "short");
        return (
          <div
            key={`${row.name}-${row.trade_type}`}
            className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.05fr)_minmax(0,1.2fr)] items-center gap-2 border-b py-1.5"
            style={{ borderColor: C.border }}
          >
            <span className="truncate" style={{ color: C.text }}>{row.name}</span>
            <span className="truncate text-[11px]" title={row.description ?? row.rationale ?? ""}>{compactIdeaThesis(row.description ?? row.rationale ?? "")}</span>
            <div className="flex items-center justify-end gap-1.5">
              {longLeg ? <LegTag label={`LONG ${longLeg}`} tone="long" /> : <LegTag label={summarizeLegs(row.legs)} tone="neutral" />}
              {shortLeg ? <LegTag label={`SHORT ${shortLeg}`} tone="short" /> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SnapshotDetailModal({
  kind,
  onClose,
  factors,
  sectors,
  ideas,
}: {
  kind: Exclude<SnapshotDetailKind, null>;
  onClose: () => void;
  factors: FactorAllocation[];
  sectors: SectorAllocation[];
  ideas: TradingRecommendation[];
}) {
  const titleByKind: Record<Exclude<SnapshotDetailKind, null>, string> = {
    factors: "Full Factor Tilts",
    sectors: "Full Sector Allocation",
    ideas: "Trading Ideas Details",
  };
  const subtitleByKind: Record<Exclude<SnapshotDetailKind, null>, string> = {
    factors: "Factor tilt summary with tickers and rationale.",
    sectors: "Sector weights with rationale for the current macro phase.",
    ideas: "Trading ideas with thesis and executable legs.",
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-5">
      <button
        type="button"
        aria-label="Close details"
        className="absolute inset-0"
        style={{ background: "rgba(4,8,12,0.76)" }}
        onClick={onClose}
      />
      <div
        className="relative w-[min(1180px,92vw)] max-h-[84vh] overflow-auto rounded-[4px] border p-5"
        style={{ borderColor: C.border, background: C.panel, boxShadow: "0 0 0 1px rgba(255,255,255,0.03), 0 28px 60px rgba(0,0,0,0.42)" }}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[16px] uppercase tracking-[0.09em]">{titleByKind[kind]}</div>
            <div className="mt-1 text-[12px] uppercase tracking-[0.05em]" style={{ color: C.soft }}>{subtitleByKind[kind]}</div>
          </div>
          <button
            type="button"
            className="rounded-[2px] border px-2 py-1 text-[11px] uppercase tracking-[0.08em] transition-opacity hover:opacity-85"
            style={{ borderColor: C.borderSoft, color: C.text, background: C.panelSoft }}
            onClick={onClose}
          >
            Close (Esc)
          </button>
        </div>

        {kind === "factors" ? (
          <div className="grid gap-1">
            <div
              className="grid grid-cols-[220px_110px_330px_minmax(0,1fr)] gap-4 border-b pb-2 text-[11px] uppercase tracking-[0.06em]"
              style={{ borderColor: C.border, color: C.muted }}
            >
              <span>Factor</span>
              <span>Tilt</span>
              <span>Tickers</span>
              <span>Rationale</span>
            </div>
            {(factors.length ? factors : FALLBACK_FACTORS.map(([factor, weight]) => ({
              factor,
              weight: expandTilt(weight) as "overweight" | "neutral" | "underweight",
              description: "Methodology fallback row",
              tickers: [],
            }))).map((row) => (
              <div key={`factor-modal-${row.factor}`} className="grid grid-cols-[220px_110px_330px_minmax(0,1fr)] gap-4 border-b py-3" style={{ borderColor: C.border }}>
                <span className="text-[15px]" style={{ color: C.text }}>{row.factor}</span>
                <span className="text-[13px] uppercase" style={{ color: tiltColor(row.weight) }}>{normalizeTiltLabel(row.weight)}</span>
                <span className="text-[13px] uppercase tracking-[0.03em]" style={{ color: C.soft }}>{(row.tickers?.length ? row.tickers.join(", ") : "No ticker basket")}</span>
                <span className="text-[13px]" style={{ color: C.soft }}>{row.description}</span>
              </div>
            ))}
          </div>
        ) : null}

        {kind === "sectors" ? (
          <div className="grid gap-1">
            <div
              className="grid grid-cols-[220px_110px_250px_minmax(0,1fr)] gap-4 border-b pb-2 text-[11px] uppercase tracking-[0.06em]"
              style={{ borderColor: C.border, color: C.muted }}
            >
              <span>Sector</span>
              <span>Tilt</span>
              <span>Tickers</span>
              <span>Rationale</span>
            </div>
            {sectors.map((row) => (
              <div key={`sector-modal-${row.sector}`} className="grid grid-cols-[220px_110px_250px_minmax(0,1fr)] gap-4 border-b py-3" style={{ borderColor: C.border }}>
                <span className="text-[15px]" style={{ color: C.text }}>{row.sector}</span>
                <span className="text-[13px] uppercase" style={{ color: tiltColor(row.weight) }}>{normalizeTiltLabel(row.weight)}</span>
                <span className="text-[13px] uppercase tracking-[0.03em]" style={{ color: C.soft }}>{SECTOR_TICKER_MAP[row.sector] ?? "ETF basket N/A"}</span>
                <span className="text-[13px]" style={{ color: C.soft }}>{row.rationale}</span>
              </div>
            ))}
          </div>
        ) : null}

        {kind === "ideas" ? (
          <div className="grid gap-1">
            <div
              className="grid grid-cols-[320px_minmax(0,1fr)_350px] gap-4 border-b pb-2 text-[11px] uppercase tracking-[0.06em]"
              style={{ borderColor: C.border, color: C.muted }}
            >
              <span>Category</span>
              <span>Thesis</span>
              <span>Legs</span>
            </div>
            {(ideas.length ? ideas : []).map((row) => (
              <div key={`idea-modal-${row.name}`} className="grid grid-cols-[320px_minmax(0,1fr)_350px] gap-4 border-b py-3" style={{ borderColor: C.border }}>
                <span className="text-[15px]" style={{ color: C.text }}>{row.name}</span>
                <span className="text-[13px]" style={{ color: C.soft }}>{compactIdeaThesis(row.description || row.rationale || "")}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {extractLeg(row.legs, "long") ? <LegTag label={`LONG ${extractLeg(row.legs, "long")}`} tone="long" /> : null}
                  {extractLeg(row.legs, "short") ? <LegTag label={`SHORT ${extractLeg(row.legs, "short")}`} tone="short" /> : null}
                  {!extractLeg(row.legs, "long") && !extractLeg(row.legs, "short") ? <LegTag label={summarizeLegs(row.legs)} tone="neutral" /> : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LegTag({ label, tone }: { label: string; tone: "long" | "short" | "neutral" }) {
  const color =
    tone === "long"
      ? "#c2f2c9"
      : tone === "short"
        ? "#ffd4dc"
        : "#d8d2c7";
  const background =
    tone === "long"
      ? "rgba(114,173,102,0.2)"
      : tone === "short"
        ? "rgba(212,93,114,0.2)"
        : "rgba(126,126,120,0.22)";
  const borderColor =
    tone === "long"
      ? "rgba(114,173,102,0.35)"
      : tone === "short"
        ? "rgba(212,93,114,0.35)"
        : "rgba(148,148,140,0.34)";
  return (
    <span
      className="inline-flex h-5 items-center rounded-[2px] px-1.5 text-[10px] uppercase tracking-[0.03em]"
      style={{
        color,
        background,
        border: `1px solid ${borderColor}`,
      }}
    >
      {label}
    </span>
  );
}

function MacroSentimentSparkBlock({ values }: { values: number[] }) {
  const rawPts = useMemo(() => {
    const clean = values.filter((v) => Number.isFinite(v));
    return clean.length ? clean : [0];
  }, [values]);
  const minValue = useMemo(() => Math.min(...rawPts), [rawPts]);
  const maxValue = useMemo(() => Math.max(...rawPts), [rawPts]);
  const safeRange = useMemo(() => Math.max(0.4, maxValue - minValue), [maxValue, minValue]);
  const padding = safeRange * 0.1;
  const yMin = minValue - padding;
  const yMax = maxValue + padding;
  const yMid = (yMin + yMax) / 2;
  const plotPts = rawPts;

  const svgW = 300;
  const svgH = 64;
  const plotLeft = 0;
  const plotRight = 258;
  const plotTop = 8;
  const plotBottom = 56;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;
  const pointsCount = Math.max(1, plotPts.length - 1);
  const yAt = (v: number) => plotBottom - ((v - yMin) / (yMax - yMin)) * plotH;

  const linePath = plotPts
    .map((v, i) => {
      const x = plotLeft + (i / pointsCount) * plotW;
      const y = yAt(v);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const areaPath = `${linePath} L${plotRight} ${plotBottom} L${plotLeft} ${plotBottom} Z`;
  const midY = clamp(yAt(yMid), plotTop, plotBottom);
  const topLabelPct = (plotTop / svgH) * 100;
  const midLabelPct = (midY / svgH) * 100;
  const bottomLabelPct = (plotBottom / svgH) * 100;

  return (
    <div className="relative h-[72px] min-h-[72px] min-w-0 w-full overflow-hidden">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none" className="block h-full w-full min-w-0">
        <line x1={plotLeft} x2={plotRight} y1={plotTop} y2={plotTop} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line x1={plotLeft} x2={plotRight} y1={midY} y2={midY} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line
          x1={plotLeft}
          x2={plotRight}
          y1={plotBottom}
          y2={plotBottom}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
        <path d={areaPath} fill={C.green} opacity={0.1} />
        <path d={linePath} fill="none" stroke={C.green} strokeWidth="1.35" strokeLinecap="butt" strokeLinejoin="miter" />
      </svg>
      <span
        className="pointer-events-none absolute right-0 text-[10px] tabular-nums leading-none"
        style={{ top: `${topLabelPct}%`, transform: "translateY(-40%)", color: C.muted }}
      >
        {formatAxisValue(yMax)}
      </span>
      <span
        className="pointer-events-none absolute right-0 text-[10px] tabular-nums leading-none"
        style={{ top: `${midLabelPct}%`, transform: "translateY(-50%)", color: C.muted }}
      >
        {formatAxisValue(yMid)}
      </span>
      <span
        className="pointer-events-none absolute right-0 text-[10px] tabular-nums leading-none"
        style={{ top: `${bottomLabelPct}%`, transform: "translateY(-60%)", color: C.muted }}
      >
        {formatAxisValue(yMin)}
      </span>
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
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const css = window.getComputedStyle(canvas);
      const themeText = css.getPropertyValue("--nd-text").trim() || "#d7d0c7";
      const themeSoft = css.getPropertyValue("--nd-soft").trim() || "#b1ada6";
      const themeBorder = css.getPropertyValue("--nd-border").trim() || "#2f3842";
      const themeBorderSoft = css.getPropertyValue("--nd-border-soft").trim() || "#232b33";
      const themeRed = css.getPropertyValue("--nd-red").trim() || "#d45d72";

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
      const padL = 42;
      const padR = 18;
      const padT = 10;
      const padB = 30;
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
      const yPad = (yMax - yMin) * 0.14 || 0.35;
      yMin -= yPad;
      yMax += yPad;

      const xOf = (i: number) => padL + (i / Math.max(1, chartData.length - 1)) * plotW;
      const yOf = (v: number) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

      ctx.clearRect(0, 0, w, h);

      const yTickCount = 5;
      const yTicks = Array.from({ length: yTickCount }, (_, idx) => {
        const ratio = idx / Math.max(1, yTickCount - 1);
        const value = yMax - (yMax - yMin) * ratio;
        return { value, y: padT + plotH * ratio };
      });

      ctx.strokeStyle = themeBorderSoft;
      ctx.globalAlpha = 0.62;
      ctx.lineWidth = 1;
      for (const tick of yTicks) {
        ctx.beginPath();
        ctx.moveTo(padL, tick.y);
        ctx.lineTo(w - padR, tick.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = themeBorder;
      ctx.globalAlpha = 0.82;
      ctx.beginPath();
      ctx.moveTo(padL, padT);
      ctx.lineTo(padL, h - padB);
      ctx.lineTo(w - padR, h - padB);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = themeText;
      ctx.font = "10px ui-monospace, monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (const tick of yTicks) {
        ctx.fillText(`${tick.value.toFixed(1)}%`, padL - 6, tick.y);
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.font = "10px ui-monospace, monospace";
      ctx.fillStyle = themeText;
      for (let i = 0; i < chartData.length; i += 1) {
        const x = Math.min(w - padR - 2, Math.max(padL + 2, xOf(i)));
        ctx.beginPath();
        ctx.strokeStyle = themeBorder;
        ctx.globalAlpha = 0.82;
        ctx.moveTo(x, h - padB);
        ctx.lineTo(x, h - padB + 4);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillText(chartData[i].maturity, x, h - padB + 6);
      }

      const drawCurve = (
        values: (number | null)[],
        color: string,
        lineW: number,
        opacity: number,
        dash: number[],
        withDots = false,
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

        if (withDots) {
          ctx.fillStyle = color;
          for (let i = 0; i < values.length; i += 1) {
            const v = values[i];
            if (v == null) continue;
            const x = Math.round(xOf(i) * 10) / 10;
            const y = Math.round(yOf(v) * 10) / 10;
            ctx.beginPath();
            ctx.arc(x, y, 2.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.globalAlpha = 1;
      };

      const histLen = history?.length ?? 0;
      for (let hi = histLen - 1; hi >= 0; hi -= 1) {
        const vals = chartData.map((d) => d.hist[hi] ?? null);
        const style = YIELD_HISTORY_STYLE[hi];
        if (!style) continue;
        const stroke = style.key === "m3"
          ? themeRed
          : style.key === "m6"
            ? YIELD_CURVE_SERIES_COLORS.m6
            : YIELD_CURVE_SERIES_COLORS.y1;
        drawCurve(vals, stroke, 1.45, style.opacity, [...style.dash]);
      }

      const currentVals = chartData.map((d) => d.current);
      drawCurve(currentVals, YIELD_CURVE_SERIES_COLORS.now, 2.35, 1, [], true);
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
        className="mt-1 flex shrink-0 flex-wrap justify-center gap-x-4 gap-y-0.5 text-[10px] uppercase tracking-[0.06em]"
        style={{ color: C.soft }}
      >
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: YIELD_CURVE_SERIES_COLORS.now }} />
          Now
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: C.red }} />
          3m
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: YIELD_CURVE_SERIES_COLORS.m6 }} />
          6m
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: YIELD_CURVE_SERIES_COLORS.y1 }} />
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
  let v = s?.value ?? null;
  if (v == null && snapshot?.points?.length) {
    const y2 = snapshot.points.find((p) => p.maturity === "2Y")?.nominal_yield ?? null;
    const y10 = snapshot.points.find((p) => p.maturity === "10Y")?.nominal_yield ?? null;
    if (y2 != null && y10 != null) v = (y10 - y2) * 100;
  }
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(0)}bp`;
}

function formatRealYield10y(snapshot: YieldCurveSnapshot | null | undefined) {
  const s = snapshot?.spreads?.find((x) => x.name === "10Y_REAL_YIELD");
  if (s != null) return `${s.value.toFixed(2)}%`;
  const tips = snapshot?.points?.find((p) => p.maturity === "10Y")?.tips_yield ?? null;
  if (tips == null) return "—";
  return `${tips.toFixed(2)}%`;
}

function fmtNumber(value: number | null | undefined, digits = 2) {
  if (value == null || Number.isNaN(value)) return "N/A";
  return value.toFixed(digits);
}

function fmtPct(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return "N/A";
  return `${value.toFixed(digits)}%`;
}

function formatAxisValue(value: number) {
  const normalized = Math.abs(value) < 0.05 ? 0 : value;
  const rounded = Math.abs(normalized) >= 10 ? normalized.toFixed(0) : normalized.toFixed(1);
  return rounded.replace(/\.0$/, "");
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
  if (signal === "bullish") return "rgba(50, 103, 61, 0.68)";
  if (signal === "bearish") return "rgba(104, 46, 58, 0.68)";
  return "rgba(49, 67, 105, 0.72)";
}

function badgeTextColor(signal: CrossAssetSignal["signal"]) {
  if (signal === "bullish") return "#d4f0d2";
  if (signal === "bearish") return "#ffc5cb";
  return "#d5e3ff";
}

function normalizeTiltLabel(weight: string) {
  const w = weight.trim().toLowerCase();
  if (w === "ow" || w.includes("over")) return "OW";
  if (w === "uw" || w.includes("under")) return "UW";
  return "N";
}

function tiltArrow(tilt: string) {
  if (tilt === "OW") return "↑";
  if (tilt === "UW") return "↓";
  return "→";
}

function extractLeg(legs: string, side: "long" | "short") {
  const pattern = side === "long" ? /LONG\s+([A-Z0-9._-]+)/i : /SHORT\s+([A-Z0-9._-]+)/i;
  const match = legs.match(pattern);
  return match?.[1]?.toUpperCase() ?? null;
}

function summarizeLegs(legs: string) {
  const compact = legs.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
  if (!compact) return "DIRECTIONAL";
  return compact.length > 16 ? `${compact.slice(0, 16).trim()}…` : compact.toUpperCase();
}

function compactIdeaThesis(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return "No thesis";
  return compact.length > 58 ? `${compact.slice(0, 58).trim()}…` : compact;
}

function expandTilt(weight: string) {
  const w = weight.trim().toLowerCase();
  if (w === "ow" || w.includes("over")) return "overweight";
  if (w === "uw" || w.includes("under")) return "underweight";
  return "neutral";
}

function normalizeGeoTilt(raw: string) {
  const value = raw.trim().toLowerCase();
  if (value.includes("over")) return "overweight";
  if (value.includes("under")) return "underweight";
  return "neutral";
}

function geoTiltColor(tilt: string) {
  if (tilt === "overweight") return "rgba(112,171,104,0.82)";
  if (tilt === "underweight") return "rgba(212,93,114,0.78)";
  return "rgba(121,96,163,0.76)";
}

function geoTiltWeight(tilt: string) {
  if (tilt === "overweight") return 0.6;
  if (tilt === "underweight") return 0.4;
  return 0.5;
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

function formatDelta(value: number | null, suffix = "") {
  if (value == null || Number.isNaN(value)) return { value: "N/A", color: C.soft };
  const sign = value > 0 ? "+" : "";
  const color = value > 0 ? C.red : value < 0 ? C.green : C.soft;
  return { value: `${sign}${value.toFixed(1)}${suffix}`, color };
}

function formatDeltaByFormat(value: number | null, format: "number" | "percent" | "basis_points") {
  if (value == null || Number.isNaN(value)) return "N/A";
  const sign = value > 0 ? "+" : "";
  if (format === "basis_points") return `${sign}${value.toFixed(0)}bp`;
  if (format === "percent") return `${sign}${value.toFixed(1)}%`;
  return `${sign}${value.toFixed(2)}`;
}

function pointColorFromPalette(
  ratio: number,
  palette?: readonly [string, string, string],
  higherIsWorse = false,
) {
  const safe = clamp(ratio, 0, 1);
  const defaultPalette = higherIsWorse
    ? (["#6db77a", "#c9b55d", "#c66b74"] as const)
    : (["#c66b74", "#c9b55d", "#6db77a"] as const);
  const [c1, c2, c3] = palette ?? defaultPalette;
  if (safe <= 0.5) return lerpHex(c1, c2, safe / 0.5);
  return lerpHex(c2, c3, (safe - 0.5) / 0.5);
}

function lerpHex(from: string, to: string, t: number) {
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    const value = h.length === 3
      ? h.split("").map((ch) => ch + ch).join("")
      : h;
    return {
      r: Number.parseInt(value.slice(0, 2), 16),
      g: Number.parseInt(value.slice(2, 4), 16),
      b: Number.parseInt(value.slice(4, 6), 16),
    };
  };
  const a = parse(from);
  const b = parse(to);
  const safeT = clamp(t, 0, 1);
  const r = Math.round(a.r + (b.r - a.r) * safeT);
  const g = Math.round(a.g + (b.g - a.g) * safeT);
  const bl = Math.round(a.b + (b.b - a.b) * safeT);
  return `rgb(${r}, ${g}, ${bl})`;
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

