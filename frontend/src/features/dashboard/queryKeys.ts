/** React Query keys for `/next/dashboard` — single source for invalidation prefixes. */

export const NEXT_DASHBOARD_QUERY_ROOT = "next-dashboard" as const;

const PREFIX = NEXT_DASHBOARD_QUERY_ROOT;

export const dashboardQueryKeys = {
  navigator: [PREFIX, "navigator"] as const,
  regime: [PREFIX, "regime"] as const,
  fed: [PREFIX, "fed"] as const,
  crossAssetRadar: [PREFIX, "cross-asset-radar"] as const,
  categories: [PREFIX, "categories"] as const,
  recession: [PREFIX, "recession"] as const,
  inflationLatest: [PREFIX, "inflation-latest"] as const,
  inflationSeriesCpi: [PREFIX, "inflation-series-cpi"] as const,
  inflationSeriesCore: [PREFIX, "inflation-series-core"] as const,
  fedRateHistory: [PREFIX, "fed-rate-history"] as const,
  regimeHistory: [PREFIX, "regime-history"] as const,
  spreadHistory2y10y: [PREFIX, "spread-history-2y10y"] as const,
  yieldSpreads: [PREFIX, "yield-spreads"] as const,
  yieldCurve: [PREFIX, "yield-curve"] as const,
  yieldHistory: [PREFIX, "yield-history"] as const,
  curveDynamics: [PREFIX, "curve-dynamics"] as const,
  indicatorsAll: [PREFIX, "indicators", "all"] as const,
  indicatorsByCategory: (category: string) => [PREFIX, "indicators", category] as const,
  indicatorHistory: (id: number, limit: number) => [PREFIX, "indicator-history", id, limit] as const,
} as const;

