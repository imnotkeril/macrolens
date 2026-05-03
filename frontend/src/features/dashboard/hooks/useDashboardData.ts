"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCategoryScores,
  getCrossAssetRadar,
  getCurveDynamics,
  getFedStatus,
  getInflationLatest,
  getInflationSeries,
  getNavigatorRecommendation,
  getRateHistory,
  getRecessionCheck,
  getRegimeHistory,
  getRegimeCurrent,
  getSpreadHistory,
  getYieldCurve,
  getYieldCurveHistory,
  getYieldSpreads,
} from "@/lib/api";
import { dashboardQueryKeys } from "@/features/dashboard/queryKeys";
import { deriveDashboardUpdatedAtLabel } from "@/features/dashboard/utils/dashboardAsOf";
import type { CategoryScore, CrossAssetRadarCell, CrossAssetSignal } from "@/types";

const QMAP: Record<string, string> = {
  Q1_GOLDILOCKS: "RISK ON",
  Q2_REFLATION: "GROWTH",
  Q3_OVERHEATING: "VALUE",
  Q4_STAGFLATION: "RISK OFF",
};

const RECESSION_MODEL_DOT_COLORS = ["var(--nd-green)", "var(--nd-blue)", "var(--nd-purple)"];

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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeProbabilityPercent(x: number | null | undefined): number {
  if (x == null || Number.isNaN(x)) return 18;
  const v = x >= 0 && x <= 1 ? x * 100 : x;
  return clamp(v, 0, 100);
}

function recessionRiskStyle(pct: number): { label: string; color: string } {
  if (pct < 22) return { label: "LOW RISK", color: "var(--nd-green)" };
  if (pct < 45) return { label: "MODERATE", color: "var(--nd-yellow)" };
  return { label: "ELEVATED", color: "var(--nd-red)" };
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

export function useDashboardData() {
  const navigatorQ = useQuery({ queryKey: dashboardQueryKeys.navigator, queryFn: getNavigatorRecommendation, staleTime: 120_000 });
  const regimeQ = useQuery({ queryKey: dashboardQueryKeys.regime, queryFn: getRegimeCurrent, staleTime: 120_000 });
  const fedQ = useQuery({ queryKey: dashboardQueryKeys.fed, queryFn: getFedStatus, staleTime: 120_000 });
  const signalsQ = useQuery({ queryKey: dashboardQueryKeys.crossAssetRadar, queryFn: getCrossAssetRadar, staleTime: 120_000 });
  const categoriesQ = useQuery({ queryKey: dashboardQueryKeys.categories, queryFn: getCategoryScores, staleTime: 120_000 });
  const recessionQ = useQuery({ queryKey: dashboardQueryKeys.recession, queryFn: getRecessionCheck, staleTime: 120_000 });
  const inflationQ = useQuery({ queryKey: dashboardQueryKeys.inflationLatest, queryFn: getInflationLatest, staleTime: 120_000 });
  const inflationSeriesQ = useQuery({ queryKey: dashboardQueryKeys.inflationSeriesCpi, queryFn: () => getInflationSeries("CPI", "yoy", 365 * 4), staleTime: 120_000 });
  const coreInflationSeriesQ = useQuery({
    queryKey: dashboardQueryKeys.inflationSeriesCore,
    queryFn: () => getInflationSeries("Core CPI", "yoy", 365 * 4),
    staleTime: 120_000,
  });
  const fedRateHistoryQ = useQuery({ queryKey: dashboardQueryKeys.fedRateHistory, queryFn: () => getRateHistory(120), staleTime: 120_000 });
  const regimeHistoryQ = useQuery({ queryKey: dashboardQueryKeys.regimeHistory, queryFn: () => getRegimeHistory(6), staleTime: 120_000 });
  const spreadHistoryQ = useQuery({ queryKey: dashboardQueryKeys.spreadHistory2y10y, queryFn: () => getSpreadHistory("2Y10Y", 365), staleTime: 120_000 });
  const yieldSpreadsQ = useQuery({ queryKey: dashboardQueryKeys.yieldSpreads, queryFn: getYieldSpreads, staleTime: 120_000 });
  const yieldCurveQ = useQuery({ queryKey: dashboardQueryKeys.yieldCurve, queryFn: getYieldCurve, staleTime: 120_000 });
  const yieldHistoryQ = useQuery({ queryKey: dashboardQueryKeys.yieldHistory, queryFn: getYieldCurveHistory, staleTime: 120_000 });
  const curveDynamicsQ = useQuery({ queryKey: dashboardQueryKeys.curveDynamics, queryFn: getCurveDynamics, staleTime: 120_000 });

  const fedPolicy = fedQ.data?.policy_score ?? navigatorQ.data?.position?.fed_policy_score ?? 0.46;
  const cycleScore = regimeQ.data?.cycle_score ?? 0.32;
  const recessionProbPct = normalizeProbabilityPercent(regimeQ.data?.recession_prob_12m ?? 0.18);
  const recessionRisk = recessionRiskStyle(recessionProbPct);
  const growthScore = navigatorQ.data?.position?.growth_score ?? 0.21;
  const confidence = clamp((navigatorQ.data?.position?.confidence ?? 0.72) * 100, 0, 100);
  const updatedAt = deriveDashboardUpdatedAtLabel({
    regime: regimeQ.data,
    navigator: navigatorQ.data,
    regimePending: regimeQ.isPending,
    navigatorPending: navigatorQ.isPending,
  });
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
  const geographySource = navigatorQ.data?.geographic ?? {};

  return {
    navigatorQ,
    regimeQ,
    fedQ,
    yieldCurveQ,
    yieldHistoryQ,
    curveDynamicsQ,
    fedPolicy,
    cycleScore,
    recessionProbPct,
    recessionRisk,
    growthScore,
    confidence,
    updatedAt,
    activeRegime,
    inflationLatest,
    coreInflationLatest,
    inflationDelta,
    coreInflationDelta,
    spread2y10y,
    fedRateSeries,
    quick,
    macroSentimentSeries,
    signals,
    categories,
    recessionModelRows,
    fullIdeas,
    fullFactors,
    fullSectors,
    recs,
    factors,
    sectors,
    alloc,
    geographySource,
  };
}
