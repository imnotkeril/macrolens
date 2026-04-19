import type {
  IndicatorWithLatest,
  IndicatorValue,
  CategoryScore,
  FedPolicyStatus,
  FedRate,
  BalanceSheet,
  FomcDashboard,
  YieldCurveSnapshot,
  YieldSpread,
  CurveDynamics,
  NavigatorPosition,
  NavigatorRecommendation,
  CrossAssetSignal,
  RecessionCheck,
  CalendarSummary,
  EventImpact,
  Alert,
  AlertCount,
  IndicatorCategory,
  TimeSeriesPoint,
  NetLiquidityPoint,
  RatioPoint,
  RecessionBand,
  SectorPerf,
  SectorGroupPerf,
  FactorRatio,
  IndexStatus,
  FxStrength,
  InflationPoint,
  InflationLatest,
  BreadthDashboardData,
  MacroOverviewData,
  InflationDashboardData,
  IndicesDashboardData,
  RatesDashboardData,
  SectorsDashboardData,
  CurrencyDashboardData,
  SentimentDashboardData,
  CrossAssetRadarCell,
  MLRegimePredict,
  MLRegimeBacktest,
  MLRegimeMetrics,
  MLDatasetInfo,
  MLTrainResponse,
  TaskProgress,
  ML2Predict,
  ML2Metrics,
  MasterRecommendation,
  AgentSignalItem,
  MemoryContextResponse,
  AgentContextPack,
  FedRhetoricPoint,
} from "@/types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

// Indicators
export const getIndicators = (category?: IndicatorCategory) =>
  fetchJSON<IndicatorWithLatest[]>(
    `/api/indicators/${category ? `?category=${category}` : ""}`
  );

export const getCategoryScores = () =>
  fetchJSON<CategoryScore[]>("/api/indicators/categories");

export const getIndicatorHistory = (id: number, limit = 120) =>
  fetchJSON<IndicatorValue[]>(`/api/indicators/${id}/history?limit=${limit}`);

// Fed Policy
export const getFedStatus = () =>
  fetchJSON<FedPolicyStatus>("/api/fed/current");

export const getRateHistory = (limit = 120) =>
  fetchJSON<FedRate[]>(`/api/fed/rate-history?limit=${limit}`);

export const getBalanceSheetHistory = (limit = 120) =>
  fetchJSON<BalanceSheet[]>(`/api/fed/balance-sheet?limit=${limit}`);

export const getFomcDashboard = () =>
  fetchJSON<FomcDashboard>("/api/fed/fomc-dashboard");

// Yield Curve
export const getYieldCurve = () =>
  fetchJSON<YieldCurveSnapshot>("/api/yield-curve/current");

export const getYieldCurveHistory = () =>
  fetchJSON<YieldCurveSnapshot[]>("/api/yield-curve/history");

export const getYieldSpreads = () =>
  fetchJSON<YieldSpread[]>("/api/yield-curve/spreads");

export const getCurveDynamics = () =>
  fetchJSON<CurveDynamics>("/api/yield-curve/dynamics");

export const getCurveDynamicsAt = (asOf: string) =>
  fetchJSON<CurveDynamics>(`/api/yield-curve/dynamics-at?as_of=${asOf}`);

// Navigator
export const getNavigatorRecommendation = () =>
  fetchJSON<NavigatorRecommendation>("/api/navigator/current");

export const getNavigatorHistory = () =>
  fetchJSON<NavigatorPosition[]>("/api/navigator/history");

export const getNavigatorForward = () =>
  fetchJSON<NavigatorPosition[]>("/api/navigator/forward");

export const getCrossAssetSignals = () =>
  fetchJSON<CrossAssetSignal[]>("/api/navigator/signals");

export const getRecessionCheck = () =>
  fetchJSON<RecessionCheck>("/api/navigator/recession-check");

// Calendar
export const getCalendar = () =>
  fetchJSON<CalendarSummary>("/api/calendar/");

export const getEventImpact = (indicatorId: number, limit = 12) =>
  fetchJSON<EventImpact>(`/api/calendar/impact/${indicatorId}?limit=${limit}`);

// Market
export const getMarketSeries = (symbol: string, days = 365) =>
  fetchJSON<TimeSeriesPoint[]>(`/api/market/series/${symbol}?days=${days}`);

export const getMarketRatios = (a: string, b: string, days = 365) =>
  fetchJSON<RatioPoint[]>(`/api/market/ratios?a=${a}&b=${b}&days=${days}`);

export const getNetLiquidity = (days = 730) =>
  fetchJSON<NetLiquidityPoint[]>(`/api/market/net-liquidity?days=${days}`);

export const getRecessionBands = () =>
  fetchJSON<RecessionBand[]>("/api/market/recession-bands");

export const getSectors = (days = 180) =>
  fetchJSON<SectorPerf[]>(`/api/market/sectors?days=${days}`);

export const getSectorGroups = (days = 180) =>
  fetchJSON<SectorGroupPerf[]>(`/api/market/sector-groups?days=${days}`);

export const getFactorRatios = (days = 365) =>
  fetchJSON<FactorRatio[]>(`/api/market/factors?days=${days}`);

export const getIndices = () =>
  fetchJSON<IndexStatus[]>("/api/market/indices");

export const getCurrencies = (days = 365) =>
  fetchJSON<FxStrength[]>(`/api/market/currencies?days=${days}`);

// Yield Curve History
export const getSpreadHistory = (name: string, days = 730) =>
  fetchJSON<TimeSeriesPoint[]>(`/api/yield-curve/spread-history/${name}?days=${days}`);

export const getRealYieldHistory = (maturity: string, days = 730) =>
  fetchJSON<TimeSeriesPoint[]>(`/api/yield-curve/real-yield-history/${maturity}?days=${days}`);

export const getBreakevenHistory = (maturity: string, days = 730) =>
  fetchJSON<TimeSeriesPoint[]>(`/api/yield-curve/breakeven-history/${maturity}?days=${days}`);

// Inflation
export const getInflationSeries = (name: string, transform = "yoy", days = 365 * 5) =>
  fetchJSON<InflationPoint[]>(`/api/indicators/inflation-series/${name}?transform=${transform}&days=${days}`);

export const getInflationLatest = () =>
  fetchJSON<InflationLatest[]>("/api/indicators/inflation-latest");

// Regime / Cycle Radar
export const getRegimeCurrent = () =>
  fetchJSON<import("@/types").RegimeSnapshot>("/api/regime/current");

export const getRegimeHistory = (months = 60) =>
  fetchJSON<import("@/types").RegimeHistoryPoint[]>(`/api/regime/history?months=${months}`);

// Alerts
export const getAlerts = (unreadOnly = false) =>
  fetchJSON<Alert[]>(`/api/alerts/?unread_only=${unreadOnly}`);

export const getAlertCount = () =>
  fetchJSON<AlertCount>("/api/alerts/count");

export const markAlertRead = (id: number) =>
  fetch(`${API_BASE}/api/alerts/${id}/read`, { method: "POST" });

export const markAllAlertsRead = () =>
  fetch(`${API_BASE}/api/alerts/read-all`, { method: "POST" });

// S&P 500 Sectors Dashboard
export const getSectorsDashboard = (days = 365) =>
  fetchJSON<SectorsDashboardData>(`/api/market/sectors-dashboard?days=${days}`);

// Currency Dashboard
export const getCurrencyDashboard = (days = 365 * 5) =>
  fetchJSON<CurrencyDashboardData>(`/api/market/currency-dashboard?days=${days}`);

// Sentiment Dashboard
export const getSentimentDashboard = (days = 365) =>
  fetchJSON<SentimentDashboardData>(`/api/market/sentiment-dashboard?days=${days}`);

// Rates & Yield Curve Dashboard
export const getRatesDashboard = (days = 365 * 5) =>
  fetchJSON<RatesDashboardData>(`/api/market/rates-dashboard?days=${days}`);

// Indices & Bitcoin Dashboard
export const getIndicesDashboard = (days = 365 * 5) =>
  fetchJSON<IndicesDashboardData>(`/api/market/indices-dashboard?days=${days}`);

// Breadth Dashboard
export const getBreadthDashboard = (days = 365 * 5) =>
  fetchJSON<BreadthDashboardData>(`/api/market/breadth?days=${days}`);

// Macro Overview
export const getMacroOverview = (days = 365 * 5) =>
  fetchJSON<MacroOverviewData>(`/api/market/macro-overview?days=${days}`);

// Cross-Asset Radar (all 20 cells, same sources as macro overview)
export const getCrossAssetRadar = () =>
  fetchJSON<CrossAssetRadarCell[]>("/api/market/cross-asset-radar");

// Inflation Dashboard
export const getInflationDashboard = (days = 365 * 5) =>
  fetchJSON<InflationDashboardData>(`/api/indicators/inflation-dashboard?days=${days}`);

// ML Regime Prediction
export const getMLRegimePredict = () =>
  fetchJSON<MLRegimePredict>("/api/ml/regime-predict");

export const getMLRegimeBacktest = () =>
  fetchJSON<MLRegimeBacktest>("/api/ml/regime-backtest");

export const getMLRegimeMetrics = () =>
  fetchJSON<MLRegimeMetrics>("/api/ml/regime-metrics");

export const getMLDatasetInfo = () =>
  fetchJSON<MLDatasetInfo>("/api/ml/dataset-info");

// Build dataset: 2 min for 1 month (backend times out at 90s), 12 min for full
const BUILD_DATASET_TIMEOUT_MS = 12 * 60 * 1000;
const BUILD_DATASET_TIMEOUT_1MONTH_MS = 2 * 60 * 1000;

export async function postMLBuildDataset(
  maxMonths?: number,
  minimal?: boolean
): Promise<MLDatasetInfo> {
  const timeoutMs = minimal
    ? 90 * 1000
    : maxMonths != null && maxMonths <= 3
      ? BUILD_DATASET_TIMEOUT_1MONTH_MS
      : BUILD_DATASET_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const params = new URLSearchParams();
  if (maxMonths != null) params.set("max_months", String(maxMonths));
  if (minimal) params.set("minimal", "1");
  const url =
    `${API_BASE}/api/ml/build-dataset` +
    (params.toString() ? `?${params.toString()}` : "");
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body as { detail?: string }).detail || res.statusText;
      throw new Error(msg);
    }
    return res.json();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(
        "Build dataset timed out (client). Check backend logs and DB data (indicators, Fed history)."
      );
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Only wait for backend to accept and return "started"; training runs in background
const TRAIN_START_TIMEOUT_MS = 30 * 1000; // 30 seconds

export async function postMLRegimeTrain(): Promise<MLTrainResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TRAIN_START_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/ml/regime-train`, {
      method: "POST",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
    return res.json();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(
        "Request to start training timed out. Check server logs and try again."
      );
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Data refresh (FRED + Yahoo: many series, can take 5–15 min)
const REFRESH_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

export function getRefreshProgress(): Promise<TaskProgress> {
  return fetchJSON<TaskProgress>(`/api/data/refresh-progress`);
}

export function getMLTrainProgress(): Promise<TaskProgress> {
  return fetchJSON<TaskProgress>(`/api/ml/train-progress`);
}

// ML2
export const postML2Train = async () => {
  const res = await fetch(`${API_BASE}/api/ml2/train`, { method: "POST" });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<ML2Metrics>;
};

export const getML2Predict = () =>
  fetchJSON<ML2Predict>("/api/ml2/predict");

export const getML2Metrics = () =>
  fetchJSON<ML2Metrics>("/api/ml2/metrics");

export const getML2LatestStored = () =>
  fetchJSON<ML2Predict>("/api/ml2/latest-stored");

// Agents / Master
export const postRunAgents = async () => {
  const res = await fetch(`${API_BASE}/api/agents/run`, { method: "POST" });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<{ status: string; runs: Record<string, string> }>;
};

export const getAgentSignals = () =>
  fetchJSON<AgentSignalItem[]>("/api/agents/signals");

export const getMasterRecommendation = () =>
  fetchJSON<MasterRecommendation>("/api/agents/recommendation");

export const getContextPack = (asOf?: string) =>
  fetchJSON<AgentContextPack>(`/api/agents/context-pack${asOf ? `?as_of=${encodeURIComponent(asOf)}` : ""}`);

export const getFedRhetoricHistory = (dateFrom?: string, dateTo?: string) => {
  const p = new URLSearchParams();
  if (dateFrom) p.set("date_from", dateFrom);
  if (dateTo) p.set("date_to", dateTo);
  const q = p.toString();
  return fetchJSON<FedRhetoricPoint[]>(`/api/agents/fed-rhetoric/history${q ? `?${q}` : ""}`);
};

export const getMacroTabSummary = (tab: string, asOf?: string) =>
  fetchJSON<{ tab: string; summary: string | null; available: boolean; as_of_date?: string; hint?: string; error?: string }>(
    `/api/agents/macro/tab-summary?tab=${encodeURIComponent(tab)}${asOf ? `&as_of=${encodeURIComponent(asOf)}` : ""}`
  );

export const getMemoryContext = (query: string, domain?: string, topK = 5) =>
  fetchJSON<MemoryContextResponse>(
    `/api/memory/context?query=${encodeURIComponent(query)}&top_k=${topK}${domain ? `&domain=${encodeURIComponent(domain)}` : ""}`
  );

export const getMemoryProvenance = (query: string, domain?: string, topK = 5) =>
  fetchJSON<{ query: string; domain: string | null; top_k: number; trace: Array<Record<string, unknown>> }>(
    `/api/memory/provenance?query=${encodeURIComponent(query)}&top_k=${topK}${domain ? `&domain=${encodeURIComponent(domain)}` : ""}`
  );

export const postSnapshotDashboardRadar = async () => {
  const res = await fetch(`${API_BASE}/api/memory/snapshot/dashboard-radar`, { method: "POST" });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
};

export const postSnapshotAnalysisIndicators = async () => {
  const res = await fetch(`${API_BASE}/api/memory/snapshot/analysis-indicators`, { method: "POST" });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
};

export async function refreshAllData(): Promise<{ status: string; errors: string[] }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/data/refresh`, {
      method: "POST",
      signal: controller.signal,
    });
    if (res.status === 409) throw new Error("Refresh already in progress");
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
    return res.json();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(
        "Refresh timed out (20 min). Backend may still be running — check server logs. Try again later."
      );
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}
