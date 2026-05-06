"use client";

import { useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import {
  getCategoryScores,
  getIndicatorHistory,
  getIndicators,
  getKpiIndicatorsBundle,
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
import type { IndicatorCategory, IndicatorWithLatest, KpiIndicatorsBundle } from "@/types";

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
  /** Single HTTP request for all KPI categories (avoids parallel `/api/indicators?category=` storms). */
  const kpiBundleQ = useQuery({
    queryKey: dashboardQueryKeys.indicatorsKpiBundle,
    queryFn: getKpiIndicatorsBundle,
    staleTime: 120_000,
    retry: 2,
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
    enabled: activeCategory === "inflation",
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
    add("Macro KPI indicators (bundle)", kpiBundleQ);
    if (activeCategory === "inflation") {
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
    kpiBundleQ.isError,
    kpiBundleQ.error,
    indicatorsCategoryQ.isError,
    indicatorsCategoryQ.error,
    activeCategory,
  ]);

  const firstIdPerKpi = useMemo(() => {
    const b = kpiBundleQ.data;
    if (!b) return KPI_SCORE_CATEGORIES.map(() => null);
    return KPI_SCORE_CATEGORIES.map((cat) =>
      firstByCategory(b[cat as keyof KpiIndicatorsBundle], cat)?.id ?? null,
    );
  }, [kpiBundleQ.data]);

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

  const categoryRows = useMemo((): IndicatorWithLatest[] => {
    if (activeCategory === "inflation") {
      return indicatorsCategoryQ.data ?? [];
    }
    const b = kpiBundleQ.data;
    if (!b) return [];
    return b[activeCategory as keyof KpiIndicatorsBundle] ?? [];
  }, [activeCategory, kpiBundleQ.data, indicatorsCategoryQ.data]);

  const indicatorsDetailPending =
    activeCategory === "inflation" ? indicatorsCategoryQ.isPending : kpiBundleQ.isPending;

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
    indicatorsDetailPending,
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
