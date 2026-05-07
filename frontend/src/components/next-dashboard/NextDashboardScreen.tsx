"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useDataRefresh } from "@/lib/useDataRefresh";
import { NextDashboardShell } from "@/components/next-dashboard/NextDashboardShell";
import { QueryErrorBanner } from "@/components/next-dashboard/QueryErrorBanner";
import { NEXT_DASHBOARD_NAV_ITEMS } from "@/components/next-dashboard/nextDashboardConfig";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";
import { useDashboardData } from "@/features/dashboard/hooks/useDashboardData";
import { DashboardRecommendationsSection } from "@/features/dashboard/components/DashboardRecommendationsSection";
import { DashboardTopRowSection } from "@/features/dashboard/components/DashboardTopRowSection";
import { DashboardMiddleRowSection } from "@/features/dashboard/components/DashboardMiddleRowSection";
import { SnapshotDetailModal, type SnapshotDetailKind } from "@/features/dashboard/components/SnapshotDetailModal";
import { FedPolicySinglePanel } from "@/features/dashboard/components/NextFeaturePanels";
import {
  ConfidenceSegments,
  FedPolicyScaleBar,
  FedRateHistorySpark,
  formatCurvePatternLabel,
  formatRealYield10y,
  formatSpread2y10y,
  fmtNumber,
  fmtPct,
  InflationQuickRow,
  MacroCategoryRow,
  MacroNavigatorSvg,
  MacroSentimentSparkBlock,
  NavigatorYieldCurveMini,
  QuickRow,
  regimeAccent,
  RiskSegmentDonut,
  SectionTitle,
  SignalRow,
} from "@/features/dashboard/components/dashboardVisuals";
import {
  geoTiltColor,
  geoTiltWeight,
  normalizeGeoTilt,
  normalizeTiltLabel,
  tiltColor,
} from "@/features/dashboard/utils/snapshotUtils";
import {
  nextPanelDashboardQuadStyle,
  nextPanelFillBelowChromeStyle,
  nextPanelSurfaceStyle,
} from "@/components/next-dashboard/nextPanelSurface";
import {
  DASHBOARD_FALLBACK_FACTORS,
  DASHBOARD_FALLBACK_SECTORS,
  DASHBOARD_SECTOR_TICKER_MAP,
} from "@/features/dashboard/constants/fallbackDashboard";
import { NEXT_DASHBOARD_QUERY_ROOT } from "@/features/dashboard/queryKeys";

/** Panel layout: viewport-relative grid; parity with Trading Navigator proportions. */

type NextDashboardScreenProps = {
  mode?: "dashboard" | "placeholder" | "fed-policy";
  placeholderTitle?: string;
  /** Shown on placeholder: link to the same content in the classic (TopNav) app */
  placeholderLegacyHref?: string;
};

type SnapshotDetailState = SnapshotDetailKind | null;

function compactRegimeLabel(label: string) {
  const normalized = label.toUpperCase();
  if (normalized.includes("RISK ON") || normalized.includes("Q1_GOLDILOCKS")) return "RISK ON";
  if (normalized.includes("GROWTH") || normalized.includes("Q2_REFLATION")) return "GROWTH";
  if (normalized.includes("VALUE") || normalized.includes("Q3_OVERHEATING")) return "VALUE";
  if (normalized.includes("RISK OFF") || normalized.includes("Q4_STAGFLATION")) return "RISK OFF";
  return label.split("(")[0].trim().toUpperCase();
}

export function NextDashboardScreen({
  mode = "dashboard",
  placeholderTitle = "Coming soon",
  placeholderLegacyHref,
}: NextDashboardScreenProps) {
  const { shellThemeVars, toggleTheme, colors: C } = useNextShellTheme();
  const [snapshotDetail, setSnapshotDetail] = useState<SnapshotDetailState>(null);
  const { refreshing, refreshResult, progress, handleRefresh } = useDataRefresh();
  const queryClient = useQueryClient();
  const {
    queryErrors,
    navigatorQ,
    regimeQ,
    fedQ,
    yieldCurveQ,
    yieldHistoryQ,
    curveDynamicsQ,
    fedPolicy,
    fedRateVsNeutralPp,
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
  } = useDashboardData();
  const activeRegimeLabel = compactRegimeLabel(activeRegime);

  const geographyRows = useMemo(() => {
    const base = Object.entries(geographySource).slice(0, 5);
    return base.map(([label, raw]) => {
      const normalized = normalizeGeoTilt(String(raw));
      return {
        label,
        raw: normalized,
        color: geoTiltColor(normalized),
        weight: geoTiltWeight(normalized),
      };
    });
  }, [geographySource]);
  const dmGeo = geographyRows.find((row) => row.label.toUpperCase() === "DM") ?? geographyRows[0] ?? null;
  const emGeo = geographyRows.find((row) => row.label.toUpperCase() === "EM") ?? geographyRows[1] ?? null;

  useEffect(() => {
    if (!snapshotDetail) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSnapshotDetail(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [snapshotDetail]);

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
        {mode === "dashboard" ? (
          <section style={{ display: "grid", gap: 12 }}>
            <QueryErrorBanner
              colors={C}
              errors={queryErrors}
              onRetry={() => void queryClient.invalidateQueries({ queryKey: [NEXT_DASHBOARD_QUERY_ROOT] })}
            />
            <DashboardTopRowSection
              basePanelStyle={nextPanelSurfaceStyle(C)}
              colors={C}
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
              confidence={confidence}
              confidenceText={fmtPct(confidence, 0)}
              signals={signals}
              activeRegimeLabel={activeRegimeLabel}
              activeRegimeColor={regimeAccent(activeRegimeLabel)}
              inflationLatest={inflationLatest}
              coreInflationLatest={coreInflationLatest}
              inflationDelta={inflationDelta}
              coreInflationDelta={coreInflationDelta}
              quickRows={quick}
              SectionTitleComponent={SectionTitle}
              MacroNavigatorSvgComponent={MacroNavigatorSvg}
              ConfidenceSegmentsComponent={ConfidenceSegments}
              SignalRowComponent={SignalRow}
              InflationQuickRowComponent={InflationQuickRow}
              QuickRowComponent={QuickRow}
            />

            <DashboardMiddleRowSection
              quadPanelStyle={nextPanelDashboardQuadStyle(C)}
              colors={C}
              recessionProbPct={recessionProbPct}
              recessionRisk={recessionRisk}
              recessionModelRows={recessionModelRows}
              cycleScore={cycleScore}
              macroSentimentSeries={macroSentimentSeries}
              categories={categories}
              fedPolicy={fedPolicy}
              fedRateVsNeutralPp={fedRateVsNeutralPp}
              fedStance={fedQ.data?.stance ?? "Moderately Easy"}
              fedRateSeries={fedRateSeries}
              rateDirection={fedQ.data?.rate_direction ?? "Paused"}
              balanceSheetDirection={fedQ.data?.balance_sheet_direction ?? "QT"}
              curvePatternLabel={formatCurvePatternLabel(curveDynamicsQ.data?.pattern)}
              curvePatternTitle={curveDynamicsQ.data?.description ?? ""}
              yieldCurveSnapshot={yieldCurveQ.data}
              yieldHistory={yieldHistoryQ.data}
              spread2y10yText={formatSpread2y10y(yieldCurveQ.data)}
              realYield10yText={formatRealYield10y(yieldCurveQ.data)}
              formatPercent={fmtPct}
              formatNumber={fmtNumber}
              RiskSegmentDonutComponent={RiskSegmentDonut}
              MacroSentimentSparkBlockComponent={MacroSentimentSparkBlock}
              MacroCategoryRowComponent={MacroCategoryRow}
              FedPolicyScaleBarComponent={FedPolicyScaleBar}
              FedRateHistorySparkComponent={FedRateHistorySpark}
              NavigatorYieldCurveMiniComponent={NavigatorYieldCurveMini}
            />

            <DashboardRecommendationsSection
              colors={C}
              factors={
                factors.length
                  ? factors.map((f) => ({ name: f.factor, tilt: normalizeTiltLabel(f.weight), color: tiltColor(f.weight) }))
                  : DASHBOARD_FALLBACK_FACTORS.map(([name, tilt, color]) => ({ name, tilt, color }))
              }
              sectors={
                sectors.length
                  ? sectors.map((s) => ({ name: s.sector, tilt: normalizeTiltLabel(s.weight), color: tiltColor(s.weight) }))
                  : DASHBOARD_FALLBACK_SECTORS.map(([name, tilt, color]) => ({ name, tilt, color }))
              }
              alloc={alloc}
              geographyRows={geographyRows}
              dmGeo={dmGeo}
              emGeo={emGeo}
              recs={recs}
              onOpenFactors={() => setSnapshotDetail("factors")}
              onOpenSectors={() => setSnapshotDetail("sectors")}
              onOpenIdeas={() => setSnapshotDetail("ideas")}
            />
          </section>
          ) : mode === "fed-policy" ? (
            <section style={{ display: "grid", gap: 12 }}>
              <FedPolicySinglePanel
                panelStyle={nextPanelFillBelowChromeStyle(C)}
                colors={C}
                fedPolicy={fedPolicy}
                fedStance={fedQ.data?.stance ?? "Moderately Easy"}
                fedRateSeries={fedRateSeries}
                rateDirection={fedQ.data?.rate_direction ?? "Paused"}
                balanceSheetDirection={fedQ.data?.balance_sheet_direction ?? "QT"}
                formatNumber={fmtNumber}
                formatPercent={fmtPct}
                RiskSegmentDonutComponent={RiskSegmentDonut}
                MacroSentimentSparkBlockComponent={MacroSentimentSparkBlock}
                MacroCategoryRowComponent={MacroCategoryRow}
                FedPolicyScaleBarComponent={FedPolicyScaleBar}
                FedRateHistorySparkComponent={FedRateHistorySpark}
              />
            </section>
          ) : (
            <section
              className="flex min-h-[calc(100vh-80px)] items-center justify-center rounded-[2px] border"
              style={{ borderColor: C.borderSoft, background: C.panel }}
            >
              <div className="text-center">
                <div className="text-[34px] uppercase tracking-[0.11em]">{placeholderTitle}</div>
                <div className="mt-4 text-[14px] uppercase tracking-[0.08em]" style={{ color: C.soft }}>
                  This section is coming soon in the new shell.
                </div>
                {placeholderLegacyHref ? (
                  <Link
                    href={placeholderLegacyHref}
                    className="mt-8 inline-block text-[11px] uppercase tracking-[0.12em] underline underline-offset-4 transition-opacity hover:opacity-80"
                    style={{ color: C.green }}
                  >
                    Open classic view →
                  </Link>
                ) : null}
              </div>
            </section>
        )}
      </NextDashboardShell>
      {snapshotDetail ? (
        <SnapshotDetailModal
          kind={snapshotDetail}
          onClose={() => setSnapshotDetail(null)}
          factors={fullFactors}
          sectors={fullSectors}
          ideas={fullIdeas}
          fallbackFactors={DASHBOARD_FALLBACK_FACTORS}
          sectorTickerMap={DASHBOARD_SECTOR_TICKER_MAP}
          colors={C}
        />
      ) : null}
    </>
  );
}

