"use client";

/**
 * Forecast Lab shell — data hooks, layout sync, toolbar; panels live in `forecast-lab/forecastLabPanelBundle`.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NextDashboardShell } from "@/components/next-dashboard/NextDashboardShell";
import { NEXT_DASHBOARD_NAV_ITEMS } from "@/components/next-dashboard/nextDashboardConfig";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";
import { nextPanelSurfaceStyle } from "@/components/next-dashboard/nextPanelSurface";
import { useDataRefresh } from "@/lib/useDataRefresh";
import {
  getForecastLabSummary,
  getForecastLabTrainStatus,
  postForecastLabTrain,
  getForecastLabDiagnosticsOos,
  getForecastLabPhaseAlignment,
  postForecastLabLogSnapshot,
  postForecastLabTrainResetProgress,
  getForecastLabRegimeHistory,
  postForecastLabRegimeHistoryMaterialize,
} from "@/lib/forecastLabApi";
import {
  CardHelpHint,
  EnsembleModelWeightsRows,
  ExpertBreakdownHitRate,
  ExpertProbabilityTable,
  FlCalibrationCard,
  FlConfusionMatrixCard,
  FlFeatureImportanceCard,
  FlWeightHistoryCard,
  ForecastLabMacroPanelTable,
  ForecastLabStressCard,
  MACRO_REGIME_HISTORY_MAX_H,
  PhaseEnsembleCard,
  RegimeHistoryQuadrantBadge,
  XL_MEDIA,
  extractFlTrainMetrics,
  formatRegimeHistoryObsDate,
  regimeHistoryAssetImplTooltip,
  regimeHistoryFwdOkTooltip,
  regimeHistoryHorizonMonths,
  type ForecastLabOosApiRow,
} from "@/components/next-dashboard/forecast-lab/forecastLabPanelBundle";
import { forecastLabQueryKeys } from "@/components/next-dashboard/forecast-lab/forecastLabQueryKeys";
import { REGIME_HISTORY_TABLE_BORDER } from "@/components/next-dashboard/nextDashboardTableTokens";
import type { RegimeHistoryRow } from "@/types/forecastLab";
import { Check, Database, X } from "lucide-react";

export function NextForecastLabScreen() {
  const { shellThemeVars, toggleTheme, colors: C } = useNextShellTheme();
  const denseSurface = useMemo(
    () => ({ ...nextPanelSurfaceStyle(C), padding: "10px 14px" }) as CSSProperties,
    [C],
  );
  const diagnosticsSurface = useMemo(
    () => ({ ...nextPanelSurfaceStyle(C), padding: "7px 10px" }) as CSSProperties,
    [C],
  );
  const qc = useQueryClient();
  const { refreshing, refreshResult, progress, handleRefresh } = useDataRefresh();
  const [alignMonthEnd, setAlignMonthEnd] = useState(true);

  const summaryQ = useQuery({
    queryKey: forecastLabQueryKeys.summary(alignMonthEnd),
    queryFn: () => getForecastLabSummary({ alignMonthEnd }),
    staleTime: 60_000,
  });
  const trainStatusQ = useQuery({
    queryKey: forecastLabQueryKeys.trainStatus,
    queryFn: getForecastLabTrainStatus,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => (q.state.data?.done === false ? 2000 : false),
  });
  const oosQ = useQuery({
    queryKey: forecastLabQueryKeys.oos,
    queryFn: getForecastLabDiagnosticsOos,
    staleTime: 60_000,
  });
  const trainMetrics = useMemo(
    () => extractFlTrainMetrics(oosQ.data as ForecastLabOosApiRow | undefined),
    [oosQ.data],
  );
  const alignQ = useQuery({
    queryKey: forecastLabQueryKeys.align,
    queryFn: () => getForecastLabPhaseAlignment(),
    staleTime: 60_000,
  });
  const regimeHistQ = useQuery({
    queryKey: forecastLabQueryKeys.regimeHistory,
    queryFn: () => getForecastLabRegimeHistory(),
    staleTime: 30_000,
  });

  const materializeMut = useMutation({
    mutationFn: () => postForecastLabRegimeHistoryMaterialize(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [...forecastLabQueryKeys.regimeHistory] });
    },
  });

  const trainMut = useMutation({
    mutationFn: postForecastLabTrain,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [...forecastLabQueryKeys.trainStatus] });
    },
  });

  const trainResetMut = useMutation({
    mutationFn: postForecastLabTrainResetProgress,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [...forecastLabQueryKeys.trainStatus] });
    },
  });

  const logMut = useMutation({
    mutationFn: () => postForecastLabLogSnapshot({ alignMonthEnd }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["forecast-lab-summary"] });
      void qc.invalidateQueries({ queryKey: [...forecastLabQueryKeys.regimeHistory] });
    },
  });

  const summary = summaryQ.data;

  const macroPanelCardRef = useRef<HTMLDivElement>(null);
  const regimeHistoryCardRef = useRef<HTMLDivElement>(null);
  const flRow1MiddleRef = useRef<HTMLDivElement>(null);
  const flRow1LeftRef = useRef<HTMLDivElement>(null);
  const flRow1RightRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const macroEl = macroPanelCardRef.current;
    const regimeEl = regimeHistoryCardRef.current;
    if (typeof window === "undefined" || !macroEl || !regimeEl) return;

    const xlMq = window.matchMedia(XL_MEDIA);

    const sync = () => {
      if (!xlMq.matches) {
        regimeEl.style.height = "";
        regimeEl.style.minHeight = "";
        return;
      }
      const h = macroEl.getBoundingClientRect().height;
      if (h > 0) {
        regimeEl.style.height = `${Math.round(h)}px`;
        regimeEl.style.minHeight = `${Math.round(h)}px`;
      }
    };

    sync();
    const ro = new ResizeObserver(() => sync());
    ro.observe(macroEl);
    xlMq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    const t = window.setTimeout(sync, 0);

    return () => {
      window.clearTimeout(t);
      ro.disconnect();
      xlMq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, [
    summary?.macro_forecasts,
    summary?.as_of_date,
    regimeHistQ.data?.items,
    regimeHistQ.dataUpdatedAt,
    materializeMut.isSuccess,
    materializeMut.data,
    denseSurface,
  ]);

  const stressSparkValues = useMemo(() => {
    const items = regimeHistQ.data?.items ?? [];
    if (items.length < 2) return [];
    const slice = items
      .slice()
      .sort((a, b) => a.obs_date.localeCompare(b.obs_date))
      .slice(-36);
    return slice.map((r) => r.navigator_growth_score).filter(Number.isFinite);
  }, [regimeHistQ.data?.items]);

  useLayoutEffect(() => {
    const mid = flRow1MiddleRef.current;
    const left = flRow1LeftRef.current;
    const right = flRow1RightRef.current;
    if (typeof window === "undefined" || !mid || !left || !right) return;

    const xlMq = window.matchMedia(XL_MEDIA);

    const sync = () => {
      if (!xlMq.matches) {
        left.style.height = "";
        left.style.minHeight = "";
        right.style.height = "";
        right.style.minHeight = "";
        return;
      }
      const h = mid.getBoundingClientRect().height;
      if (h > 0) {
        const px = `${Math.round(h)}px`;
        left.style.height = px;
        left.style.minHeight = px;
        right.style.height = px;
        right.style.minHeight = px;
      }
    };

    sync();
    const ro = new ResizeObserver(() => sync());
    ro.observe(mid);
    xlMq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    const t = window.setTimeout(sync, 0);

    return () => {
      window.clearTimeout(t);
      ro.disconnect();
      xlMq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, [summary, stressSparkValues, denseSurface]);

  const trainStatus = trainStatusQ.data;

  const prevTrainDoneRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const done = trainStatus?.done;
    if (prevTrainDoneRef.current === false && done === true && trainStatus?.message !== "error") {
      void qc.invalidateQueries({ queryKey: [...forecastLabQueryKeys.oos] });
      void qc.invalidateQueries({ queryKey: ["forecast-lab-summary"] });
      void qc.invalidateQueries({ queryKey: [...forecastLabQueryKeys.regimeHistory] });
    }
    prevTrainDoneRef.current = done;
  }, [trainStatus, qc]);

  return (
    <>
      <NextDashboardShell
        navItems={NEXT_DASHBOARD_NAV_ITEMS}
        colors={C}
        shellThemeVars={shellThemeVars}
        updatedAt={summaryQ.data?.as_of_date ? `FL ${summaryQ.data.as_of_date}` : "—"}
        refreshing={refreshing}
        refreshResult={refreshResult}
        progress={progress}
        onRefresh={handleRefresh}
        onThemeToggle={toggleTheme}
      >
        <section className="flex min-h-0 flex-col gap-3">
          <div
            className="flex flex-wrap items-center gap-2 border-b pb-3"
            style={{ borderColor: "var(--nd-border-soft)" }}
          >
            <button
              type="button"
              onClick={() => summaryQ.refetch()}
              disabled={summaryQ.isFetching}
              className="rounded-[2px] border px-3 py-1.5 text-[11px] font-medium transition-opacity disabled:opacity-50"
              style={{ borderColor: C.border, color: C.soft }}
            >
              {summaryQ.isFetching ? "Refreshing…" : "Refresh summary"}
            </button>
            <button
              type="button"
              onClick={() => trainMut.mutate()}
              disabled={trainMut.isPending || trainStatus?.done === false}
              className="rounded-[2px] border px-3 py-1.5 text-[11px] font-medium transition-opacity disabled:opacity-50"
              style={{ borderColor: C.blue, color: C.blue }}
            >
              {trainMut.isPending ? "Starting…" : "Run training"}
            </button>
            <button
              type="button"
              onClick={() => trainResetMut.mutate()}
              disabled={trainResetMut.isPending}
              className="rounded-[2px] border px-3 py-1.5 text-[11px] font-medium transition-opacity disabled:opacity-50"
              style={{ borderColor: C.border, color: C.muted }}
              title="If training appears stuck, reset server-side progress."
            >
              Reset train status
            </button>
            <button
              type="button"
              onClick={() => logMut.mutate()}
              disabled={logMut.isPending}
              className="rounded-[2px] border px-3 py-1.5 text-[11px] font-medium transition-opacity disabled:opacity-50"
              style={{ borderColor: C.border, color: C.soft }}
            >
              {logMut.isPending ? "Logging…" : "Log snapshot"}
            </button>
            <label className="flex cursor-pointer select-none items-center gap-2 text-[11px]" style={{ color: C.muted }}>
              <input
                type="checkbox"
                checked={alignMonthEnd}
                onChange={(e) => setAlignMonthEnd(e.target.checked)}
                className="rounded border"
                style={{ borderColor: C.border }}
              />
              Align month-end (PIT)
            </label>
          </div>

          {trainStatus && !trainStatus.done && (
            <div className="rounded-[2px] border px-3 py-2 text-[11px]" style={{ borderColor: C.borderSoft, background: C.panelSoft }}>
              Training: {trainStatus.percent.toFixed(0)}% — {trainStatus.message}
              {trainStatus.log_line ? (
                <span className="mt-1 block font-mono text-[10px]" style={{ color: C.muted }}>
                  {trainStatus.log_line}
                </span>
              ) : null}
            </div>
          )}
          {trainStatus?.done === true && trainStatus.message === "error" && (
            <div className="rounded-[2px] border px-3 py-2 text-[11px]" style={{ borderColor: C.red, color: C.red }}>
              Last training failed — check backend logs.
              {trainStatus.log_line ? <span className="mt-1 block font-mono opacity-90">{trainStatus.log_line}</span> : null}
            </div>
          )}
          {summaryQ.isError && (
            <div className="rounded-[2px] border px-3 py-2 text-[11px]" style={{ borderColor: C.red, color: C.soft }}>
              Summary failed: {summaryQ.error instanceof Error ? summaryQ.error.message : String(summaryQ.error)}
            </div>
          )}
          {logMut.isError && (
            <p className="text-[11px]" style={{ color: C.red }}>
              Log snapshot failed (DB table missing?)
            </p>
          )}

          {summaryQ.isLoading && <p style={{ color: C.muted }}>Loading…</p>}

          {summary && (
            <div className="grid min-h-0 items-start gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.9fr)_minmax(0,1.15fr)]">
              <div ref={flRow1LeftRef} className="flex min-h-0 min-w-0 flex-col">
                <div
                  className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden"
                  style={denseSurface}
                >
                  <PhaseEnsembleCard summary={summary} palette={C} />
                </div>
              </div>

              <div ref={flRow1MiddleRef} className="flex min-h-0 min-w-0 flex-col gap-3">
                <div className="flex min-h-0 flex-col gap-2" style={denseSurface}>
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-muted)" }}>
                    Model weights
                  </h2>
                  <EnsembleModelWeightsRows weights={summary.ensemble_weights} palette={C} />
                </div>

                <div className="flex min-h-0 flex-col gap-2" style={denseSurface}>
                  <ForecastLabStressCard
                    stress={summary.stress}
                    navigatorGrowthSparklineValues={stressSparkValues}
                    palette={C}
                  />
                </div>
              </div>

              <div ref={flRow1RightRef} className="flex min-h-0 min-w-0 flex-col">
                <div
                  className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden"
                  style={denseSurface}
                >
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-muted)" }}>
                    Expert breakdown
                  </h2>
                  {summary.experts ? (
                    <ExpertProbabilityTable experts={summary.experts} ensemblePhase={summary.phase_probabilities} />
                  ) : (
                    <p style={{ color: C.muted }}>No expert breakdown.</p>
                  )}
                  <ExpertBreakdownHitRate data={alignQ.data} palette={C} />
                </div>
              </div>
            </div>
          )}

          {summary && (
            <div className="grid min-h-0 items-start gap-3 xl:grid-cols-[minmax(260px,0.4fr)_minmax(0,1fr)]">
              <div
                ref={macroPanelCardRef}
                className="flex w-full min-w-0 flex-col self-start overflow-hidden"
                style={denseSurface}
              >
                <div className="w-full overflow-auto" style={{ maxHeight: MACRO_REGIME_HISTORY_MAX_H }}>
                  <ForecastLabMacroPanelTable macroRows={summary.macro_forecasts} regimeItems={regimeHistQ.data?.items ?? []} palette={C} />
                </div>
              </div>

              <div
                ref={regimeHistoryCardRef}
                className="flex min-h-0 min-w-0 flex-col gap-2 self-start overflow-hidden"
                style={denseSurface}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-muted)" }}>
                    Regime history (monthly)
                  </h2>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => regimeHistQ.refetch()}
                      disabled={regimeHistQ.isFetching}
                      className="rounded-[2px] border px-2 py-1 text-[10px] font-medium disabled:opacity-50"
                      style={{ borderColor: C.border, color: C.soft }}
                    >
                      {regimeHistQ.isFetching ? "…" : "Refresh table"}
                    </button>
                    <button
                      type="button"
                      onClick={() => materializeMut.mutate()}
                      disabled={materializeMut.isPending}
                      className="inline-flex items-center gap-1 rounded-[2px] border px-2 py-1 text-[10px] font-medium disabled:opacity-50"
                      style={{ borderColor: C.blue, color: C.blue }}
                    >
                      <Database className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
                      {materializeMut.isPending ? "…" : "Materialize from DB"}
                    </button>
                  </div>
                </div>
                <div className="min-h-0 w-full min-w-0 flex-1 overflow-auto">
                  <table
                    className="w-full min-w-[560px] table-fixed border-separate border-spacing-0 font-mono text-[13px]"
                    style={{ border: REGIME_HISTORY_TABLE_BORDER }}
                  >
                    <colgroup>
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "18%" }} />
                      <col style={{ width: "9%" }} />
                      <col style={{ width: "33%" }} />
                    </colgroup>
                    <thead className="sticky top-0 z-[1]" style={{ background: C.panel }}>
                      <tr style={{ color: C.muted }}>
                        <th
                          className="px-2 py-2 text-center font-semibold uppercase tracking-[0.08em]"
                          style={{ border: REGIME_HISTORY_TABLE_BORDER, fontSize: 12 }}
                        >
                          OBS_DATE
                        </th>
                        <th
                          className="px-2 py-2 text-center font-semibold uppercase tracking-[0.08em]"
                          style={{ border: REGIME_HISTORY_TABLE_BORDER, fontSize: 12 }}
                          title="Navigator / Forecast Lab rule plane (growth × Fed) — single PIT label per row"
                        >
                          RULE PLANE
                        </th>
                        <th
                          className="px-2 py-2 text-center font-semibold uppercase tracking-[0.08em]"
                          style={{ border: REGIME_HISTORY_TABLE_BORDER, fontSize: 12 }}
                          title="Forecast Lab ensemble headline (phase_class) from the newest /log-snapshot row for this month-end, if you logged one."
                        >
                          ENS (FL)
                        </th>
                        <th
                          className="px-2 py-2 text-center font-semibold uppercase tracking-[0.08em]"
                          style={{ border: REGIME_HISTORY_TABLE_BORDER, fontSize: 12 }}
                          title={regimeHistoryAssetImplTooltip(regimeHistoryHorizonMonths(materializeMut))}
                        >
                          ASSET IMPL.
                        </th>
                        <th
                          className="px-2 py-2 text-center font-semibold uppercase tracking-[0.08em]"
                          style={{ border: REGIME_HISTORY_TABLE_BORDER, fontSize: 12 }}
                          title={regimeHistoryFwdOkTooltip(regimeHistoryHorizonMonths(materializeMut))}
                        >
                          FWD OK
                        </th>
                        <th
                          className="px-2 py-2 text-center font-semibold uppercase tracking-[0.08em]"
                          style={{ border: REGIME_HISTORY_TABLE_BORDER, fontSize: 12 }}
                        >
                          CURVE
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(regimeHistQ.data?.items ?? [])
                        .slice()
                        .reverse()
                        .map((row: RegimeHistoryRow) => (
                          <tr key={row.obs_date}>
                            <td
                              className="px-2 py-2 text-center tabular-nums"
                              style={{ border: REGIME_HISTORY_TABLE_BORDER, color: C.soft }}
                            >
                              {formatRegimeHistoryObsDate(row.obs_date)}
                            </td>
                            <td className="px-2 py-2 align-middle" style={{ border: REGIME_HISTORY_TABLE_BORDER }}>
                              <div className="flex justify-center">
                                <RegimeHistoryQuadrantBadge quadrantKey={row.fl_rule_quadrant} palette={C} />
                              </div>
                            </td>
                            <td className="px-2 py-2 align-middle" style={{ border: REGIME_HISTORY_TABLE_BORDER }}>
                              {row.fl_ensemble_quadrant ? (
                                <div className="flex justify-center">
                                  <RegimeHistoryQuadrantBadge quadrantKey={row.fl_ensemble_quadrant} palette={C} />
                                </div>
                              ) : (
                                <div
                                  className="text-center font-sans text-[12px]"
                                  style={{ color: C.muted }}
                                  title="No prediction log for this date — use Log snapshot or backfill logs."
                                >
                                  —
                                </div>
                              )}
                            </td>
                            <td className="px-2 py-2 align-middle" style={{ border: REGIME_HISTORY_TABLE_BORDER }}>
                              <div className="flex justify-center">
                                <RegimeHistoryQuadrantBadge quadrantKey={row.asset_implied_quadrant} palette={C} />
                              </div>
                            </td>
                            <td className="px-2 py-2 text-center align-middle" style={{ border: REGIME_HISTORY_TABLE_BORDER }}>
                              {row.forward_regime_confirmed ? (
                                <span
                                  className="inline-flex items-center justify-center"
                                  style={{ color: C.green }}
                                  title="Forward window: rule label matched expected pair outcomes"
                                >
                                  <Check className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden />
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center justify-center"
                                  style={{ color: C.red }}
                                  title="Below threshold, not evaluable yet, or horizon not reached"
                                >
                                  <X className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden />
                                </span>
                              )}
                            </td>
                            <td
                              className="max-w-[min(160px,28vw)] px-2 py-2 text-center font-sans text-[13px] leading-snug"
                              style={{ border: REGIME_HISTORY_TABLE_BORDER, color: C.soft }}
                              title={row.yield_curve_pattern ?? ""}
                            >
                              {row.yield_curve_pattern?.replace(/_/g, " ") ?? "—"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {regimeHistQ.isError && (
                  <p className="text-[10px]" style={{ color: C.red }}>
                    {regimeHistQ.error instanceof Error ? regimeHistQ.error.message : String(regimeHistQ.error)}
                  </p>
                )}
              </div>
            </div>
          )}

          {summary && (
            <div className="grid min-h-0 gap-1.5 lg:grid-cols-2 xl:grid-cols-4">
              <div className="relative flex min-h-0 min-w-0 flex-col gap-1 overflow-hidden pt-0.5" style={diagnosticsSurface}>
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-muted)" }}>
                  Confusion matrix
                </h2>
                <FlConfusionMatrixCard trainMetrics={trainMetrics} palette={C} />
                <CardHelpHint text="Predicted vs actual (ensemble · monthly test split)" palette={C} />
              </div>
              <div className="relative flex min-h-0 min-w-0 flex-col gap-1 overflow-hidden pt-0.5" style={diagnosticsSurface}>
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-muted)" }}>
                  Calibration
                </h2>
                <FlCalibrationCard trainMetrics={trainMetrics} palette={C} />
                <CardHelpHint text="Reliability diagram (max predicted probability vs. empirical accuracy)" palette={C} />
              </div>
              <div className="relative flex min-h-0 min-w-0 flex-col gap-1 overflow-hidden pt-0.5" style={diagnosticsSurface}>
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-muted)" }}>
                  Feature importance (top 5)
                </h2>
                <FlFeatureImportanceCard trainMetrics={trainMetrics} palette={C} />
                <CardHelpHint text="GBDT gain-based importance (aggregate)" palette={C} />
              </div>
              <div className="relative flex min-h-0 min-w-0 flex-col gap-1 overflow-hidden pt-0.5" style={diagnosticsSurface}>
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-muted)" }}>
                  Ensemble weight history
                </h2>
                <FlWeightHistoryCard trainMetrics={trainMetrics} palette={C} />
                <CardHelpHint text="Inverse log-loss weights over expanding validation windows" palette={C} />
              </div>
            </div>
          )}
        </section>
      </NextDashboardShell>
    </>
  );
}
