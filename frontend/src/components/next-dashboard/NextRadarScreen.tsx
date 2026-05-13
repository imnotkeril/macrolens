"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getRegimeCurrent,
  getRegimeHistory,
  getRecessionBands,
  getRecessionCheck,
} from "@/lib/api";
import { dashboardQueryKeys } from "@/features/dashboard/queryKeys";
import { deriveDashboardUpdatedAtLabel } from "@/features/dashboard/utils/dashboardAsOf";
import { useDataRefresh } from "@/lib/useDataRefresh";
import { NextDashboardShell } from "@/components/next-dashboard/NextDashboardShell";
import { QueryErrorBanner } from "@/components/next-dashboard/QueryErrorBanner";
import { NEXT_DASHBOARD_NAV_ITEMS } from "@/components/next-dashboard/nextDashboardConfig";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";
import { nextPanelSurfaceStyle } from "@/components/next-dashboard/nextPanelSurface";
import {
  RadarCycleScorePanel,
  RadarCycleTimelinePanel,
  RadarRecessionChecklistPanel,
  RadarRecessionProbPanel,
  RadarRecProbHistoryPanel,
  RadarTablesSection,
} from "@/components/next-dashboard/nextRadarBlocks";
import type { RegimeHistoryPoint } from "@/types";
import { NEXT_DASHBOARD_QUERY_ROOT } from "@/features/dashboard/queryKeys";

export function NextRadarScreen({ omitShell = false }: { omitShell?: boolean }) {
  const queryClient = useQueryClient();
  const { shellThemeVars, toggleTheme, colors: C } = useNextShellTheme();
  const { refreshing, refreshResult, progress, handleRefresh } = useDataRefresh();
  const surface = useMemo(() => nextPanelSurfaceStyle(C), [C]);
  /** Tighter chrome for the top KPI row + checklist so cells don't balloon vs timeline charts below. */
  const surfaceTopRow = useMemo(
    () => ({ ...surface, padding: "13px 16px" }),
    [surface],
  );

  const regimeQ = useQuery({
    queryKey: dashboardQueryKeys.regime,
    queryFn: getRegimeCurrent,
    staleTime: 120_000,
  });
  const regime = regimeQ.data;

  const historyQ = useQuery({
    queryKey: [...dashboardQueryKeys.regimeHistory, "radar-60m"],
    queryFn: () => getRegimeHistory(60),
    staleTime: 120_000,
  });

  const recessionBandsQ = useQuery({
    queryKey: ["recession-bands"],
    queryFn: getRecessionBands,
    staleTime: 300_000,
  });

  const recessionQ = useQuery({
    queryKey: dashboardQueryKeys.recession,
    queryFn: getRecessionCheck,
    staleTime: 120_000,
  });

  const updatedAt = deriveDashboardUpdatedAtLabel({
    regime,
    navigator: undefined,
    regimePending: regimeQ.isPending,
    navigatorPending: false,
  });

  const timelineData = useMemo(() => {
    if (!historyQ.data?.length) return [];
    return historyQ.data.map((p: RegimeHistoryPoint) => ({ date: p.date, cycle_score: p.cycle_score }));
  }, [historyQ.data]);

  const recProbData = useMemo(() => {
    if (!historyQ.data?.length) return [];
    return historyQ.data.map((p: RegimeHistoryPoint) => ({ date: p.date, recession_prob: p.recession_prob }));
  }, [historyQ.data]);

  const loadingShell = regimeQ.isPending && !regime;

  const secondaryErrors = useMemo(() => {
    const rows: { label: string; message: string }[] = [];
    const add = (label: string, q: { isError: boolean; error: unknown }) => {
      if (!q.isError || q.error == null) return;
      rows.push({
        label,
        message: q.error instanceof Error ? q.error.message : String(q.error),
      });
    };
    add("Regime history", historyQ);
    add("Recession bands", recessionBandsQ);
    add("Recession checklist", recessionQ);
    return rows;
  }, [
    historyQ.isError,
    historyQ.error,
    recessionBandsQ.isError,
    recessionBandsQ.error,
    recessionQ.isError,
    recessionQ.error,
  ]);

  const mainColumn = loadingShell ? (
          <div
            className="flex min-h-[40vh] items-center justify-center text-[13px]"
            style={{ color: C.muted }}
          >
            Loading cycle radar…
          </div>
        ) : regime ? (
          <section className="nd-report-print-flow flex flex-col gap-3">
            <QueryErrorBanner
              title="Secondary radar data failed to load"
              colors={C}
              errors={secondaryErrors}
              onRetry={() => void queryClient.invalidateQueries({ queryKey: [NEXT_DASHBOARD_QUERY_ROOT] })}
            />
            <div className="nd-radar-desktop-layout hidden min-h-0 flex-col gap-3 xl:flex">
              <div
                className="nd-radar-main-grid grid min-h-0 gap-3"
                style={{
                  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(270px, 360px)",
                  gridTemplateRows: "auto auto",
                  alignItems: "stretch",
                }}
              >
                <RadarCycleScorePanel
                  colors={C}
                  surface={surfaceTopRow}
                  placement={{ gridColumn: 1, gridRow: 1 }}
                  regime={regime}
                />
                <RadarRecessionProbPanel
                  colors={C}
                  surface={surfaceTopRow}
                  placement={{ gridColumn: 2, gridRow: 1 }}
                  regime={regime}
                />
                <RadarRecessionChecklistPanel
                  colors={C}
                  surface={surfaceTopRow}
                  placement={{ gridColumn: 3, gridRow: "1 / span 2" }}
                  checklistVariant="sidebar"
                  recession={recessionQ.data}
                />
                <RadarCycleTimelinePanel
                  colors={C}
                  surface={surface}
                  placement={{ gridColumn: 1, gridRow: 2 }}
                  timelineData={timelineData}
                  recessionBands={recessionBandsQ.data}
                />
                <RadarRecProbHistoryPanel
                  colors={C}
                  surface={surface}
                  placement={{ gridColumn: 2, gridRow: 2 }}
                  recProbData={recProbData}
                  recessionBands={recessionBandsQ.data}
                />
              </div>

              <RadarTablesSection colors={C} surface={surface} regime={regime} layout="split" />
            </div>

            <div className="nd-radar-mobile-layout flex flex-col gap-3 xl:hidden">
              <RadarCycleScorePanel colors={C} surface={surfaceTopRow} regime={regime} />
              <RadarRecessionProbPanel colors={C} surface={surfaceTopRow} regime={regime} />
              <RadarCycleTimelinePanel
                colors={C}
                surface={surface}
                timelineData={timelineData}
                recessionBands={recessionBandsQ.data}
              />
              <RadarRecProbHistoryPanel
                colors={C}
                surface={surface}
                recProbData={recProbData}
                recessionBands={recessionBandsQ.data}
              />
              <RadarRecessionChecklistPanel
                colors={C}
                surface={surfaceTopRow}
                checklistVariant="stacked"
                recession={recessionQ.data}
              />
              <RadarTablesSection colors={C} surface={surface} regime={regime} layout="stack" />
            </div>
          </section>
        ) : (
          <div
            className="flex min-h-[40vh] items-center justify-center text-[13px]"
            style={{ color: C.muted }}
          >
            Cycle radar data unavailable.
          </div>
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
