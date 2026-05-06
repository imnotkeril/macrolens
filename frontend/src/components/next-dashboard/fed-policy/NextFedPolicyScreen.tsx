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
  getBalanceSheetHistory,
  getFedStatus,
  getFomcDashboard,
  getNetLiquidity,
  getRateHistory,
  getRatesDashboard,
} from "@/lib/api";
import { balanceStackFromRows, buildRateChangeRows, computeBsMetrics } from "@/components/next-dashboard/fed-policy/fedPolicyUtils";
import { NEXT_FED_POLICY_QUERY_ROOT } from "@/components/next-dashboard/fed-policy/fedPolicyQueryKeys";
import { FedRatePathDotPlot } from "@/components/next-dashboard/fed-policy/FedRatePathDotPlot";
import { NextFedPolicyAiCard } from "@/components/next-dashboard/fed-policy/NextFedPolicyAiCard";
import { FedPolicyPolicyScoreColumn } from "@/components/next-dashboard/fed-policy/FedPolicyPolicyScoreColumn";
import { FedPolicyFomcColumn } from "@/components/next-dashboard/fed-policy/FedPolicyFomcColumn";
import { FedPolicyBalanceMetricsColumn } from "@/components/next-dashboard/fed-policy/FedPolicyBalanceMetricsColumn";
import { FedPolicyRateDecisionHistoryTable } from "@/components/next-dashboard/fed-policy/FedPolicyRateDecisionHistoryTable";
import { FedPolicyLowerChartsSection } from "@/components/next-dashboard/fed-policy/FedPolicyLowerChartsSection";

export function NextFedPolicyScreen() {
  const { shellThemeVars, toggleTheme, colors: C, theme } = useNextShellTheme();
  const queryClient = useQueryClient();
  const { refreshing, refreshResult, progress, handleRefresh } = useDataRefresh();

  const surface = useMemo(() => nextPanelSurfaceStyle(C), [C]);
  const panel = useMemo(() => ({ ...surface, padding: "12px 22px" } as const), [surface]);

  const balanceHex = useMemo(
    () =>
      theme === "dark"
        ? {
            treasuries: "#5d82be",
            mbs: "#b87856",
            reserves: "#72ad66",
            other: "#4a5568",
            totalAssets: "#e8eaef",
          }
        : {
            treasuries: "#45699f",
            mbs: "#9e623f",
            reserves: "#2f7c3f",
            other: "#666055",
            totalAssets: "#111827",
          },
    [theme],
  );

  const statusQ = useQuery({
    queryKey: [NEXT_FED_POLICY_QUERY_ROOT, "status"],
    queryFn: getFedStatus,
    staleTime: 60_000,
  });
  const rateHistQ = useQuery({
    queryKey: [NEXT_FED_POLICY_QUERY_ROOT, "rate-history"],
    queryFn: () => getRateHistory(3000),
    staleTime: 120_000,
  });
  const bsQ = useQuery({
    queryKey: [NEXT_FED_POLICY_QUERY_ROOT, "balance-sheet"],
    queryFn: () => getBalanceSheetHistory(3000),
    staleTime: 120_000,
  });
  const ratesDashQ = useQuery({
    queryKey: [NEXT_FED_POLICY_QUERY_ROOT, "rates-dash"],
    queryFn: () => getRatesDashboard(1825),
    staleTime: 120_000,
  });
  const netLiqQ = useQuery({
    queryKey: [NEXT_FED_POLICY_QUERY_ROOT, "net-liq"],
    queryFn: () => getNetLiquidity(1825),
    staleTime: 120_000,
  });
  const fomcQ = useQuery({
    queryKey: [NEXT_FED_POLICY_QUERY_ROOT, "fomc"],
    queryFn: getFomcDashboard,
    staleTime: 120_000,
  });

  const status = statusQ.data;

  const rateData = useMemo(() => {
    if (!rateHistQ.data?.length) return [];
    return [...rateHistQ.data].reverse().map((r) => ({
      date: r.date,
      target_upper: r.target_upper,
      target_lower: r.target_lower,
      effr: r.effr,
    }));
  }, [rateHistQ.data]);

  const bsMetrics = useMemo(() => computeBsMetrics(bsQ.data), [bsQ.data]);
  const stackRows = useMemo(() => (bsQ.data?.length ? balanceStackFromRows(bsQ.data) : []), [bsQ.data]);
  const decisionRows = useMemo(() => buildRateChangeRows(rateHistQ.data ?? [], 18), [rateHistQ.data]);

  const sentiment = useMemo(() => {
    if (!status) return null;
    const rs = status.rhetoric_score;
    if (rs != null && Number.isFinite(rs)) {
      const score = rs;
      const pct = ((score + 1) / 2) * 100;
      const label =
        score <= -0.6
          ? "Very Dovish"
          : score <= -0.25
            ? "Dovish"
            : score >= 0.6
              ? "Very Hawkish"
              : score >= 0.25
                ? "Hawkish"
                : "Neutral";
      return { score, pct, label, fromRhetoric: true as const };
    }
    const score = status.policy_score;
    const pct = ((score + 2) / 4) * 100;
    const label =
      score <= -1
        ? "Very Dovish"
        : score <= -0.3
          ? "Dovish"
          : score >= 1
            ? "Very Hawkish"
            : score >= 0.3
              ? "Hawkish"
              : "Neutral";
    return { score, pct, label, fromRhetoric: false as const };
  }, [status]);

  const hawkColor = useMemo(() => {
    if (!sentiment) return C.muted;
    if (sentiment.fromRhetoric) {
      return sentiment.score <= -0.25 ? C.green : sentiment.score >= 0.25 ? C.red : C.yellow;
    }
    return sentiment.score <= -0.3 ? C.green : sentiment.score >= 0.3 ? C.red : C.yellow;
  }, [sentiment, C]);

  const updatedAt = useMemo(() => {
    if (status?.last_change_date) return `${status.last_change_date}T12:00:00.000Z`;
    const d = rateHistQ.data?.[0]?.date;
    if (d) return `${d}T12:00:00.000Z`;
    return "—";
  }, [status?.last_change_date, rateHistQ.data]);

  const queryErrors = useMemo(() => {
    const errs: Array<{ label: string; message: string }> = [];
    if (statusQ.isError) errs.push({ label: "Fed status", message: String(statusQ.error) });
    if (rateHistQ.isError) errs.push({ label: "Rate history", message: String(rateHistQ.error) });
    if (bsQ.isError) errs.push({ label: "Balance sheet", message: String(bsQ.error) });
    if (ratesDashQ.isError) errs.push({ label: "Rates dashboard", message: String(ratesDashQ.error) });
    if (netLiqQ.isError) errs.push({ label: "Net liquidity", message: String(netLiqQ.error) });
    if (fomcQ.isError) errs.push({ label: "FOMC dashboard", message: String(fomcQ.error) });
    return errs;
  }, [
    statusQ.isError,
    statusQ.error,
    rateHistQ.isError,
    rateHistQ.error,
    bsQ.isError,
    bsQ.error,
    ratesDashQ.isError,
    ratesDashQ.error,
    netLiqQ.isError,
    netLiqQ.error,
    fomcQ.isError,
    fomcQ.error,
  ]);

  const onRetry = () => void queryClient.invalidateQueries({ queryKey: [NEXT_FED_POLICY_QUERY_ROOT] });

  return (
    <>
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
        <section className="flex flex-col gap-2">
          <QueryErrorBanner colors={C} errors={queryErrors} onRetry={onRetry} />

          <div className="grid grid-cols-1 gap-2 xl:grid-cols-12">
            <FedPolicyPolicyScoreColumn
              panelStyle={panel}
              status={status}
              statusPending={statusQ.isPending}
              colors={C}
              sentiment={sentiment}
              hawkColor={hawkColor}
            />
            <FedPolicyFomcColumn
              panelStyle={panel}
              meetings={fomcQ.data?.meetings}
              isPending={fomcQ.isPending}
              meetingsSource={fomcQ.data?.meetings_source}
            />
            <FedPolicyBalanceMetricsColumn panelStyle={panel} bsMetrics={bsMetrics} bsPending={bsQ.isPending} />
          </div>

          <div className="grid grid-cols-1 gap-2 xl:grid-cols-12 xl:items-stretch xl:min-h-0 xl:h-[340px]">
            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden xl:col-span-4" style={panel}>
              {fomcQ.data ? (
                <FedRatePathDotPlot fomc={fomcQ.data} palette={C} />
              ) : (
                <div className="flex flex-1 items-center justify-center py-6 text-center text-[12px]" style={{ color: "var(--nd-muted)" }}>
                  {fomcQ.isPending ? "Loading…" : "—"}
                </div>
              )}
            </div>
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden xl:col-span-4" style={panel}>
              <div className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-muted)" }}>
                Rate decision history
              </div>
              <div className="mt-2 min-h-0 w-full min-w-0 flex-1 overflow-auto">
                <FedPolicyRateDecisionHistoryTable
                  palette={C}
                  decisionRows={decisionRows}
                  rateHistPending={rateHistQ.isPending}
                />
              </div>
            </div>
            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden xl:col-span-4" style={panel}>
              <NextFedPolicyAiCard />
            </div>
          </div>

          <FedPolicyLowerChartsSection
            panelStyle={panel}
            palette={C}
            rateRows={rateData}
            rateHistPending={rateHistQ.isPending}
            forwardRows={ratesDashQ.data?.forward_fed_rate}
            ratesDashPending={ratesDashQ.isPending}
            netLiqRows={netLiqQ.data}
            netLiqPending={netLiqQ.isPending}
            stackRows={stackRows}
            bsPending={bsQ.isPending}
            balancePalette={balanceHex}
          />
        </section>
      </NextDashboardShell>
    </>
  );
}
