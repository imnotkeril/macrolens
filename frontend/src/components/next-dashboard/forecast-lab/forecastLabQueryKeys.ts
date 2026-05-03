/** TanStack Query keys for Forecast Lab — keep in sync with invalidations in mutations. */

export const forecastLabQueryKeys = {
  summary: (alignMonthEnd: boolean) => ["forecast-lab-summary", alignMonthEnd] as const,
  trainStatus: ["forecast-lab-train-status"] as const,
  oos: ["forecast-lab-oos"] as const,
  align: ["forecast-lab-align"] as const,
  regimeHistory: ["forecast-lab-regime-history"] as const,
} as const;
