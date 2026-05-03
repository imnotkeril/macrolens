"use client";

import { useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import {
  getCategoryScores,
  getIndicatorHistory,
  getIndicators,
  getRegimeCurrent,
  getRegimeHistory,
} from "@/lib/api";
import { dashboardQueryKeys } from "@/features/dashboard/queryKeys";
import { deriveDashboardUpdatedAtLabel } from "@/features/dashboard/utils/dashboardAsOf";
import { cycleScoreToZ } from "@/components/next-dashboard/nextRadarPanels";
import {
  KPI_SCORE_CATEGORIES,
} from "@/components/next-dashboard/macro-sentiment/macroSentimentConstants";
import { firstByCategory } from "@/components/next-dashboard/macro-sentiment/macroSentimentUtils";
import type { IndicatorCategory } from "@/types";

export function useMacroSentimentData(activeCategory: IndicatorCategory) {
  const regimeQ = useQuery({
    queryKey: dashboardQueryKeys.regime,
    queryFn: getRegimeCurrent,
    staleTime: 120_000,
  });
  const categoriesQ = useQuery({
    queryKey: dashboardQueryKeys.categories,
    queryFn: getCategoryScores,
    staleTime: 120_000,
  });
  /**
   * Avoid GET /api/indicators without filter (large payload + slow DB) alongside category fetches —
   * that parallel load was causing intermittent "Failed to fetch" in the browser.
   * KPI strip uses one scoped request per category; keys match `indicatorsByCategory` so navigation
   * shares the same React Query cache as the table.
   */
  const kpiIndicatorsQueries = useQueries({
    queries: KPI_SCORE_CATEGORIES.map((cat) => ({
      queryKey: dashboardQueryKeys.indicatorsByCategory(cat),
      queryFn: () => getIndicators(cat),
      staleTime: 120_000,
      retry: 2,
    })),
  });
  const regimeHistQ = useQuery({
    queryKey: [...dashboardQueryKeys.regimeHistory, "macro-sentiment-composite"],
    queryFn: () => getRegimeHistory(36),
    staleTime: 120_000,
  });
  const indicatorsCategoryQ = useQuery({
    queryKey: dashboardQueryKeys.indicatorsByCategory(activeCategory),
    queryFn: () => getIndicators(activeCategory),
    staleTime: 120_000,
    retry: 2,
  });

  const regime = regimeQ.data;

  const queryErrors = useMemo(() => {
    const rows: { label: string; message: string }[] = [];
    const add = (label: string, q: { isError: boolean; error: unknown }) => {
      if (!q.isError || q.error == null) return;
      rows.push({
        label,
        message: q.error instanceof Error ? q.error.message : String(q.error),
      });
    };
    add("Regime / cycle", regimeQ);
    add("Category scores", categoriesQ);
    add("Regime history", regimeHistQ);
    KPI_SCORE_CATEGORIES.forEach((cat, i) => {
      add(`Indicators (kpi · ${cat})`, kpiIndicatorsQueries[i]!);
    });
    // Same React Query cache as KPI row when category is housing | orders | income_sales | employment
    if (!KPI_SCORE_CATEGORIES.includes(activeCategory)) {
      add(`Indicators (${activeCategory})`, indicatorsCategoryQ);
    }
    return rows;
  }, [
    regimeQ.isError,
    regimeQ.error,
    categoriesQ.isError,
    categoriesQ.error,
    regimeHistQ.isError,
    regimeHistQ.error,
    indicatorsCategoryQ.isError,
    indicatorsCategoryQ.error,
    activeCategory,
    kpiIndicatorsQueries[0]?.isError,
    kpiIndicatorsQueries[0]?.error,
    kpiIndicatorsQueries[1]?.isError,
    kpiIndicatorsQueries[1]?.error,
    kpiIndicatorsQueries[2]?.isError,
    kpiIndicatorsQueries[2]?.error,
    kpiIndicatorsQueries[3]?.isError,
    kpiIndicatorsQueries[3]?.error,
  ]);

  const firstIdPerKpi = useMemo(() => {
    return KPI_SCORE_CATEGORIES.map((cat, idx) => {
      const rowsForCat = kpiIndicatorsQueries[idx]?.data ?? [];
      return firstByCategory(rowsForCat, cat)?.id ?? null;
    });
  }, [
    kpiIndicatorsQueries[0]?.data,
    kpiIndicatorsQueries[1]?.data,
    kpiIndicatorsQueries[2]?.data,
    kpiIndicatorsQueries[3]?.data,
  ]);

  const kpiHistories = useQueries({
    queries: KPI_SCORE_CATEGORIES.map((cat, idx) => {
      const id = firstIdPerKpi[idx];
      return {
        queryKey:
          id != null
            ? dashboardQueryKeys.indicatorHistory(id, 14)
            : (["next-dashboard", "indicator-history-kpi-empty", cat] as const),
        queryFn: () => getIndicatorHistory(id!, 14),
        staleTime: 120_000,
        enabled: id != null,
      };
    }),
  });

  const categoryRows = indicatorsCategoryQ.data ?? [];

  const rowHistories = useQueries({
    queries: categoryRows.map((ind) => ({
      queryKey: dashboardQueryKeys.indicatorHistory(ind.id, 300),
      queryFn: () => getIndicatorHistory(ind.id, 300),
      staleTime: 120_000,
      enabled: categoryRows.length > 0,
    })),
  });

  const compositeZ = regime ? cycleScoreToZ(regime.cycle_score) : 0;
  const compositeSpark = useMemo(() => {
    const pts = regimeHistQ.data?.map((p) => cycleScoreToZ(p.cycle_score)) ?? [];
    return pts.length >= 2 ? pts.slice(-24) : pts;
  }, [regimeHistQ.data]);

  const compositeDelta = useMemo(() => {
    const h = regimeHistQ.data;
    if (!h || h.length < 2) return null;
    const a = cycleScoreToZ(h[h.length - 2].cycle_score);
    const b = cycleScoreToZ(h[h.length - 1].cycle_score);
    return b - a;
  }, [regimeHistQ.data]);

  const updatedAt = deriveDashboardUpdatedAtLabel({
    regime,
    navigator: undefined,
    regimePending: regimeQ.isPending,
    navigatorPending: false,
  });

  const scoreByCat = useMemo(() => {
    const list = categoriesQ.data ?? [];
    const m = new Map<string, (typeof list)[0]>();
    for (const c of list) m.set(c.category, c);
    return m;
  }, [categoriesQ.data]);

  return {
    regimeQ,
    categoriesQ,
    regimeHistQ,
    indicatorsCategoryQ,
    queryErrors,
    regime,
    kpiHistories,
    categoryRows,
    rowHistories,
    compositeZ,
    compositeSpark,
    compositeDelta,
    updatedAt,
    scoreByCat,
  };
}
