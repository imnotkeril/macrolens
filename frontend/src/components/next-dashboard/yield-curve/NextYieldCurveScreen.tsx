"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NextDashboardShell } from "@/components/next-dashboard/NextDashboardShell";
import { NEXT_DASHBOARD_NAV_ITEMS } from "@/components/next-dashboard/nextDashboardConfig";
import { QueryErrorBanner } from "@/components/next-dashboard/QueryErrorBanner";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";
import { nextPanelSurfaceStyle } from "@/components/next-dashboard/nextPanelSurface";
import { useDataRefresh } from "@/lib/useDataRefresh";
import {
  getBreakevenHistory,
  getCurveDynamics,
  getMarketSeries,
  getRatesDashboard,
  getSpreadHistory,
  getYieldCurve,
  getYieldCurveHistory,
  getYieldSpreadPercentiles,
} from "@/lib/api";
import type { RatioPoint } from "@/types";
import { NEXT_YIELD_CURVE_QUERY_ROOT } from "./yieldCurveQueryKeys";
import { CurveDynamicsCard } from "./CurveDynamicsCard";
import { CurveMomentumChart } from "./CurveMomentumChart";
import { YieldCurvePercentileTable } from "./YieldCurvePercentileTable";
import { YieldCurveSnapshotCard } from "./YieldCurveSnapshotCard";
import { YieldCurveSpreadHistoryCard } from "./YieldCurveSpreadHistoryCard";
import { YieldCurveStripLineCard } from "./YieldCurveStripLineCard";
import {
  buildCurveMomentumBpPerMonth,
  estimateRegimePersistenceWeeks,
  marketSeriesToRatioPoints,
} from "./yieldCurveUtils";

const HISTORY_START_UTC = Date.UTC(2020, 0, 1);
const HISTORY_DAYS = Math.max(
  730,
  Math.ceil((Date.now() - HISTORY_START_UTC) / (1000 * 60 * 60 * 24)) + 10,
);
/** Inner chart height — rows 2 & 3 use identical card chrome. */
const ROW_CHART_H = 268;
/** Row 1 cards share one fixed visual height. */
const ROW1_CARD_H = "h-[452px]";

export function NextYieldCurveScreen({ omitShell = false }: { omitShell?: boolean }) {
  const { shellThemeVars, toggleTheme, colors: C } = useNextShellTheme();
  const queryClient = useQueryClient();
  const { refreshing, refreshResult, progress, handleRefresh } = useDataRefresh();

  const surface = useMemo(() => nextPanelSurfaceStyle(C), [C]);
  const panel = useMemo(() => ({ ...surface, padding: "12px 22px" } as const), [surface]);

  const curveQ = useQuery({
    queryKey: [NEXT_YIELD_CURVE_QUERY_ROOT, "curve"],
    queryFn: getYieldCurve,
    staleTime: 120_000,
  });
  const curveHistQ = useQuery({
    queryKey: [NEXT_YIELD_CURVE_QUERY_ROOT, "curve-history"],
    queryFn: getYieldCurveHistory,
    staleTime: 120_000,
  });
  const pctQ = useQuery({
    queryKey: [NEXT_YIELD_CURVE_QUERY_ROOT, "spread-percentiles"],
    queryFn: getYieldSpreadPercentiles,
    staleTime: 120_000,
  });
  const dynQ = useQuery({
    queryKey: [NEXT_YIELD_CURVE_QUERY_ROOT, "dynamics"],
    queryFn: getCurveDynamics,
    staleTime: 120_000,
  });
  const spread2y10yQ = useQuery({
    queryKey: [NEXT_YIELD_CURVE_QUERY_ROOT, "spread-2y10y", HISTORY_DAYS],
    queryFn: () => getSpreadHistory("2Y10Y", HISTORY_DAYS),
    staleTime: 120_000,
  });
  const spread3m10yQ = useQuery({
    queryKey: [NEXT_YIELD_CURVE_QUERY_ROOT, "spread-3m10y", HISTORY_DAYS],
    queryFn: () => getSpreadHistory("3M10Y", HISTORY_DAYS),
    staleTime: 120_000,
  });
  const ratesDashQ = useQuery({
    queryKey: [NEXT_YIELD_CURVE_QUERY_ROOT, "rates-dash", HISTORY_DAYS],
    queryFn: () => getRatesDashboard(HISTORY_DAYS),
    staleTime: 120_000,
  });
  const be10Q = useQuery({
    queryKey: [NEXT_YIELD_CURVE_QUERY_ROOT, "be-10y", HISTORY_DAYS],
    queryFn: () => getBreakevenHistory("10Y", HISTORY_DAYS),
    staleTime: 120_000,
  });

  const termPremiumQ = useQuery({
    queryKey: [NEXT_YIELD_CURVE_QUERY_ROOT, "market-term-premium", HISTORY_DAYS],
    queryFn: () => getMarketSeries("TERM_PREMIUM_10Y", HISTORY_DAYS),
    staleTime: 120_000,
  });
  const moveQ = useQuery({
    queryKey: [NEXT_YIELD_CURVE_QUERY_ROOT, "market-move", HISTORY_DAYS],
    queryFn: () => getMarketSeries("MOVE", HISTORY_DAYS),
    staleTime: 120_000,
  });
  const sofrQ = useQuery({
    queryKey: [NEXT_YIELD_CURVE_QUERY_ROOT, "market-sofr", HISTORY_DAYS],
    queryFn: () => getMarketSeries("SOFR", HISTORY_DAYS),
    staleTime: 120_000,
  });
  const effrQ = useQuery({
    queryKey: [NEXT_YIELD_CURVE_QUERY_ROOT, "market-effr-daily", HISTORY_DAYS],
    queryFn: () => getMarketSeries("EFFR_DAILY", HISTORY_DAYS),
    staleTime: 120_000,
  });

  const termPremiumRows = useMemo(() => marketSeriesToRatioPoints(termPremiumQ.data), [termPremiumQ.data]);
  const moveRows = useMemo(() => marketSeriesToRatioPoints(moveQ.data), [moveQ.data]);
  const sofrEffrRows = useMemo(() => {
    const sofr = new Map((sofrQ.data ?? []).map((d) => [d.date, d.value]));
    const effr = new Map((effrQ.data ?? []).map((d) => [d.date, d.value]));
    const dates = Array.from(new Set([...Array.from(sofr.keys()), ...Array.from(effr.keys())])).sort((a, b) =>
      a.localeCompare(b),
    );
    const rows: RatioPoint[] = [];
    let lastSofr: number | null = null;
    let lastEffr: number | null = null;
    for (const d of dates) {
      if (sofr.has(d)) lastSofr = sofr.get(d) ?? null;
      if (effr.has(d)) lastEffr = effr.get(d) ?? null;
      if (lastSofr == null || lastEffr == null) continue;
      rows.push({ date: d, value: Math.round((lastSofr - lastEffr) * 10000) / 10000 });
    }
    return rows;
  }, [sofrQ.data, effrQ.data]);
  const curveMomentumRows = useMemo(
    () => buildCurveMomentumBpPerMonth(spread2y10yQ.data ?? []),
    [spread2y10yQ.data],
  );
  const regimePersistenceWeeks = useMemo(
    () => estimateRegimePersistenceWeeks(curveMomentumRows),
    [curveMomentumRows],
  );

  const updatedAt = useMemo(() => {
    const d = curveQ.data?.date;
    if (d) return `${d}T16:00:00.000Z`;
    return "—";
  }, [curveQ.data?.date]);

  const queryErrors = useMemo(() => {
    const errs: Array<{ label: string; message: string }> = [];
    if (curveQ.isError) errs.push({ label: "Yield curve", message: String(curveQ.error) });
    if (curveHistQ.isError) errs.push({ label: "Curve history", message: String(curveHistQ.error) });
    if (pctQ.isError) errs.push({ label: "Spread percentiles", message: String(pctQ.error) });
    if (dynQ.isError) errs.push({ label: "Curve dynamics", message: String(dynQ.error) });
    if (spread2y10yQ.isError) errs.push({ label: "2Y-10Y history", message: String(spread2y10yQ.error) });
    if (spread3m10yQ.isError) errs.push({ label: "3M-10Y history", message: String(spread3m10yQ.error) });
    if (ratesDashQ.isError) errs.push({ label: "Rates dashboard", message: String(ratesDashQ.error) });
    if (be10Q.isError) errs.push({ label: "Breakeven history", message: String(be10Q.error) });
    if (termPremiumQ.isError) errs.push({ label: "Term premium", message: String(termPremiumQ.error) });
    if (moveQ.isError) errs.push({ label: "MOVE index", message: String(moveQ.error) });
    if (sofrQ.isError) errs.push({ label: "SOFR", message: String(sofrQ.error) });
    if (effrQ.isError) errs.push({ label: "EFFR daily", message: String(effrQ.error) });
    return errs;
  }, [
    curveQ.isError,
    curveQ.error,
    curveHistQ.isError,
    curveHistQ.error,
    pctQ.isError,
    pctQ.error,
    dynQ.isError,
    dynQ.error,
    spread2y10yQ.isError,
    spread2y10yQ.error,
    spread3m10yQ.isError,
    spread3m10yQ.error,
    ratesDashQ.isError,
    ratesDashQ.error,
    be10Q.isError,
    be10Q.error,
    termPremiumQ.isError,
    termPremiumQ.error,
    moveQ.isError,
    moveQ.error,
    sofrQ.isError,
    sofrQ.error,
    effrQ.isError,
    effrQ.error,
  ]);

  const onRetry = () => void queryClient.invalidateQueries({ queryKey: [NEXT_YIELD_CURVE_QUERY_ROOT] });

  /** Uniform tile size for chart rows (header + chart). */
  const rowCardShell = "flex min-h-[360px] flex-col";

  const mainColumn = (
        <section className="flex flex-col gap-2">
          <QueryErrorBanner colors={C} errors={queryErrors} onRetry={onRetry} />

          <div className="grid grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1.35fr)_336px_minmax(0,0.94fr)] xl:items-stretch print:grid-cols-[minmax(0,1.35fr)_336px_minmax(0,0.94fr)] print:items-stretch">
            <div className={`min-h-0 min-w-0 overflow-hidden ${ROW1_CARD_H}`} style={panel}>
              <YieldCurveSnapshotCard palette={C} snapshot={curveQ.data} history={curveHistQ.data} height={314} />
            </div>
            <div className={`min-h-0 min-w-0 overflow-hidden ${ROW1_CARD_H}`} style={panel}>
              <CurveDynamicsCard
                palette={C}
                dynamics={dynQ.data}
                pending={dynQ.isPending}
                momentumRows={curveMomentumRows}
                persistenceWeeks={regimePersistenceWeeks}
              />
            </div>
            <div className={`flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden ${ROW1_CARD_H}`} style={panel}>
              <YieldCurvePercentileTable rows={pctQ.data} pending={pctQ.isPending} />
              <div className="flex min-h-0 flex-1 border-t border-[var(--nd-border-soft)] pt-2">
                <CurveMomentumChart
                  rows={curveMomentumRows}
                  lineColor={String(C.green)}
                  pending={spread2y10yQ.isPending}
                  fillHeight
                  initialPeriod="ALL"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4 xl:items-stretch print:grid-cols-4">
            <div className={rowCardShell} style={panel}>
              <YieldCurveStripLineCard
                title="5Y real yield"
                subtitle="US05Y – T5YIE"
                rows={ratesDashQ.data?.real_yield_5y}
                lineColor={String(C.purple)}
                height={ROW_CHART_H}
                pending={ratesDashQ.isPending}
                yTickFormat={(v) => `${v.toFixed(1)}%`}
                tooltipFormat={(v) => `${v.toFixed(2)}%`}
                referenceLines={[{ y: 0, label: "0%" }]}
                initialPeriod="ALL"
              />
            </div>
            <div className={rowCardShell} style={panel}>
              <YieldCurveStripLineCard
                title="10Y real yield"
                subtitle="US10Y – T10YIE"
                rows={ratesDashQ.data?.real_yield_10y}
                lineColor={String(C.orange)}
                height={ROW_CHART_H}
                pending={ratesDashQ.isPending}
                yTickFormat={(v) => `${v.toFixed(1)}%`}
                tooltipFormat={(v) => `${v.toFixed(2)}%`}
                referenceLines={[{ y: 0, label: "0%" }]}
                initialPeriod="ALL"
              />
            </div>
            <div className={rowCardShell} style={panel}>
              <YieldCurveSpreadHistoryCard
                palette={C}
                cardTitle="3M-10Y spread"
                fullSeries={spread3m10yQ.data}
                height={ROW_CHART_H}
                pending={spread3m10yQ.isPending}
                initialPeriod="ALL"
              />
            </div>
            <div className={rowCardShell} style={panel}>
              <YieldCurveSpreadHistoryCard
                palette={C}
                cardTitle="2Y-10Y spread"
                fullSeries={spread2y10yQ.data}
                height={ROW_CHART_H}
                pending={spread2y10yQ.isPending}
                initialPeriod="ALL"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4 xl:items-stretch print:grid-cols-4">
            <div className={rowCardShell} style={panel}>
              <YieldCurveStripLineCard
                title="10Y breakeven"
                subtitle="TIPS-implied"
                rows={be10Q.data as RatioPoint[] | undefined}
                lineColor={String(C.green)}
                height={ROW_CHART_H}
                pending={be10Q.isPending}
                yTickFormat={(v) => `${v.toFixed(1)}%`}
                tooltipFormat={(v) => `${v.toFixed(2)}%`}
                referenceLines={[{ y: 2.0, label: "Fed target" }]}
                initialPeriod="ALL"
              />
            </div>
            <div className={rowCardShell} style={panel}>
              <YieldCurveStripLineCard
                title="Term premium (10Y)"
                subtitle="THREEFYTP10"
                rows={termPremiumRows}
                lineColor={String(C.yellow)}
                height={ROW_CHART_H}
                pending={termPremiumQ.isPending}
                yTickFormat={(v) => `${v.toFixed(2)}%`}
                tooltipFormat={(v) => `${v.toFixed(3)}%`}
                initialPeriod="ALL"
              />
            </div>
            <div className={rowCardShell} style={panel}>
              <YieldCurveStripLineCard
                title="SOFR - EFFR spread"
                rows={sofrEffrRows}
                lineColor={String(C.blue)}
                height={ROW_CHART_H}
                pending={sofrQ.isPending || effrQ.isPending}
                yTickFormat={(v) => `${v.toFixed(3)}%`}
                tooltipFormat={(v) => `${v.toFixed(4)}%`}
                initialPeriod="ALL"
              />
            </div>
            <div className={rowCardShell} style={panel}>
              <YieldCurveStripLineCard
                title="MOVE index"
                rows={moveRows}
                lineColor={String(C.red)}
                height={ROW_CHART_H}
                pending={moveQ.isPending}
                yTickFormat={(v) => `${v.toFixed(1)}`}
                tooltipFormat={(v) => v.toFixed(2)}
                initialPeriod="ALL"
              />
            </div>
          </div>
        </section>
  );

  return (
    <>
      {omitShell ? (
        mainColumn
      ) : (
        <NextDashboardShell
          navItems={NEXT_DASHBOARD_NAV_ITEMS}
          colors={C}
          shellThemeVars={shellThemeVars}
          updatedAt={updatedAt}
          refreshing={refreshing}
          refreshResult={refreshResult}
          progress={progress}
          onRefresh={handleRefresh}
          onThemeToggle={toggleTheme}
        >
          {mainColumn}
        </NextDashboardShell>
      )}
    </>
  );
}
