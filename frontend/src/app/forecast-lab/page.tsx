"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getForecastLabSummary,
  getForecastLabBundle,
  getForecastLabTrainStatus,
  postForecastLabTrain,
  getForecastLabDiagnosticsOos,
  getForecastLabPhaseAlignment,
  postForecastLabLogSnapshot,
  postForecastLabTrainResetProgress,
  getForecastLabRegimeHistory,
  postForecastLabRegimeHistoryMaterialize,
} from "@/lib/forecastLabApi";
import { cn } from "@/lib/utils";

const QUADRANT_LABELS: Record<string, string> = {
  Q1_GOLDILOCKS: "Risk ON",
  Q2_REFLATION: "GROWTH",
  Q3_OVERHEATING: "VALUE",
  Q4_STAGFLATION: "Risk OFF",
};

export default function ForecastLabPage() {
  const qc = useQueryClient();
  const [alignMonthEnd, setAlignMonthEnd] = useState(true);
  const {
    data: summary,
    isLoading,
    refetch,
    isFetching,
    isError: summaryIsError,
    error: summaryError,
  } = useQuery({
    queryKey: ["forecast-lab-summary", alignMonthEnd],
    queryFn: () => getForecastLabSummary({ alignMonthEnd }),
    staleTime: 60_000,
  });
  const { data: bundle } = useQuery({
    queryKey: ["forecast-lab-bundle"],
    queryFn: getForecastLabBundle,
    staleTime: 120_000,
  });
  const { data: trainStatus } = useQuery({
    queryKey: ["forecast-lab-train-status"],
    queryFn: getForecastLabTrainStatus,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => (q.state.data?.done === false ? 2000 : false),
  });
  const { data: oos } = useQuery({
    queryKey: ["forecast-lab-oos"],
    queryFn: getForecastLabDiagnosticsOos,
    staleTime: 60_000,
  });
  const { data: align } = useQuery({
    queryKey: ["forecast-lab-align"],
    queryFn: () => getForecastLabPhaseAlignment(),
    staleTime: 60_000,
  });
  const {
    data: regimeHist,
    refetch: refetchRegimeHist,
    isFetching: regimeHistLoading,
    isError: regimeHistIsError,
    error: regimeHistError,
  } = useQuery({
    queryKey: ["forecast-lab-regime-history"],
    queryFn: () => getForecastLabRegimeHistory(),
    staleTime: 30_000,
  });

  const materializeMut = useMutation({
    mutationFn: () => postForecastLabRegimeHistoryMaterialize(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["forecast-lab-regime-history"] });
      await refetchRegimeHist();
    },
  });

  const trainMut = useMutation({
    mutationFn: postForecastLabTrain,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["forecast-lab-train-status"] });
      await qc.fetchQuery({ queryKey: ["forecast-lab-train-status"], queryFn: getForecastLabTrainStatus });
    },
  });

  const trainResetMut = useMutation({
    mutationFn: postForecastLabTrainResetProgress,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["forecast-lab-train-status"] });
    },
  });

  const logMut = useMutation({
    mutationFn: () => postForecastLabLogSnapshot({ alignMonthEnd }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["forecast-lab-summary"] });
    },
  });

  const p = summary?.phase_probabilities;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto px-4 py-6">
      <div>
        <h1 className="text-2xl font-extralight tracking-tight text-text-primary">Forecast Lab</h1>
        <p className="mt-1 text-sm font-light text-text-muted">
          Isolated prediction pipeline (rule + HMM + GBDT ensemble). Does not use the Predictive page or legacy{" "}
          <code className="text-xs bg-bg-card px-1 rounded">/api/ml</code> routes.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-light hover:bg-bg-hover disabled:opacity-50"
        >
          {isFetching ? "Refreshing…" : "Refresh summary"}
        </button>
        <button
          type="button"
          onClick={() => trainMut.mutate()}
          disabled={trainMut.isPending || trainStatus?.done === false}
          className="rounded-lg border border-accent/30 px-3 py-1.5 text-xs font-light text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          {trainMut.isPending ? "Starting…" : "Run training"}
        </button>
        <button
          type="button"
          onClick={() => trainResetMut.mutate()}
          disabled={trainResetMut.isPending}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-light text-text-muted hover:bg-bg-hover disabled:opacity-50"
          title="If the button stays disabled, the server thinks training is still running — reset progress."
        >
          Reset train status
        </button>
        <button
          type="button"
          onClick={() => logMut.mutate()}
          disabled={logMut.isPending}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-light hover:bg-bg-hover disabled:opacity-50"
        >
          {logMut.isPending ? "Logging…" : "Log snapshot"}
        </button>
        <label className="flex items-center gap-2 text-xs font-light text-text-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={alignMonthEnd}
            onChange={(e) => setAlignMonthEnd(e.target.checked)}
            className="rounded border-border"
          />
          Align to month-end (PIT bar)
        </label>
      </div>

      {trainStatus && !trainStatus.done && (
        <div className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-xs text-text-secondary">
          Training: {trainStatus.percent.toFixed(0)}% — {trainStatus.message}
          {trainStatus.log_line && <span className="block text-text-muted mt-1 font-mono">{trainStatus.log_line}</span>}
        </div>
      )}
      {trainStatus?.done === true && trainStatus.message === "error" && (
        <div className="rounded-lg border border-accent-red/30 bg-accent-red/5 px-3 py-2 text-xs text-accent-red">
          Last training run failed. Check backend logs (Docker: <code className="font-mono">backend</code> service).
          {trainStatus.log_line && (
            <span className="block text-text-muted mt-1 font-mono">{trainStatus.log_line}</span>
          )}
        </div>
      )}
      {trainStatus?.done === true &&
        trainStatus.message &&
        trainStatus.message !== "idle" &&
        trainStatus.message !== "error" &&
        !trainStatus.message.includes("stale") && (
          <p className="text-[10px] text-text-muted">
            Train status: {trainStatus.message}
            {trainStatus.percent >= 100 ? "" : ` (${trainStatus.percent.toFixed(0)}%)`}
          </p>
        )}
      {trainMut.isError && (
        <p className="text-xs text-accent-red">
          Train request failed: {trainMut.error instanceof Error ? trainMut.error.message : String(trainMut.error)} — is{" "}
          backend reachable (see <code className="font-mono">docker compose</code> / Next <code className="font-mono">/api</code> proxy)?
        </p>
      )}
      {logMut.isError && (
        <p className="text-xs text-accent-red">Log snapshot failed (DB table forecast_lab_prediction_log missing?).</p>
      )}
      {logMut.isSuccess && logMut.data?.id != null && (
        <p className="text-[10px] text-text-muted">Logged prediction id #{logMut.data.id}</p>
      )}

      {isLoading && <p className="text-sm text-text-muted">Loading…</p>}

      {summaryIsError && (
        <div className="rounded-lg border border-accent-red/30 bg-accent-red/5 px-3 py-2 text-xs text-accent-red space-y-1">
          <p className="font-medium">Summary API failed — Phase / Stress / Macro blocks are hidden.</p>
          <p className="text-text-muted font-mono break-all">
            {summaryError instanceof Error ? summaryError.message : String(summaryError)}
          </p>
          <p className="text-[10px] text-text-muted">
            Requests use same-origin <code className="font-mono">/api</code> (proxied to the backend). Restart the Next dev server
            after config changes; ensure backend is up (e.g. <code className="font-mono">docker compose ps</code>).
          </p>
        </div>
      )}

      {summary && (
        <>
          <div className="card space-y-3">
            <div className="card-header">Phase (QuadrantPhase ensemble)</div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-light text-text-primary">
                {QUADRANT_LABELS[summary.phase_class] ?? summary.phase_class}
              </span>
              <span className="text-sm text-text-muted">
                as of {summary.as_of_date} · confidence {(summary.confidence * 100).toFixed(1)}%
              </span>
            </div>
            {p && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {(["Q1_GOLDILOCKS", "Q2_REFLATION", "Q3_OVERHEATING", "Q4_STAGFLATION"] as const).map((k) => (
                  <div key={k} className="rounded border border-border/60 p-2">
                    <div className="text-text-muted mb-0.5">{QUADRANT_LABELS[k]}</div>
                    <div className="tabular-nums text-text-primary">{(p[k] * 100).toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            )}
            <div className="text-[10px] text-text-muted">
              Bundle: {summary.bundle_id} · trained: {summary.trained ? "yes" : "no (rule-only ensemble weights)"}
              {summary.training_label_mode && (
                <span className="ml-2">train labels: {summary.training_label_mode}</span>
              )}
              {summary.ensemble_weights && (
                <span className="ml-2">
                  w_rule={summary.ensemble_weights.rule?.toFixed(2)} w_hmm={summary.ensemble_weights.hmm?.toFixed(2)}{" "}
                  w_gbdt={summary.ensemble_weights.gbdt?.toFixed(2)}
                  {summary.ensemble_weights.cycle != null && (
                    <> w_cycle={Number(summary.ensemble_weights.cycle).toFixed(2)}</>
                  )}
                </span>
              )}
            </div>
          </div>

          {summary.dashboard_context && (
            <div className="card space-y-2">
              <div className="card-header">Dashboard cross-check (Navigator + Cycle)</div>
              <p className="text-[10px] text-text-muted">
                Same <code className="font-mono">as_of_date</code> PIT read — Forecast Lab phase vs Navigator quadrant and
                Radar cycle bucket.
              </p>
              <div className="text-xs text-text-secondary space-y-1">
                {summary.dashboard_context.navigator_quadrant != null && (
                  <p>
                    Navigator quadrant:{" "}
                    <span className="text-text-primary">
                      {QUADRANT_LABELS[summary.dashboard_context.navigator_quadrant] ??
                        summary.dashboard_context.navigator_quadrant}
                    </span>
                    {summary.dashboard_context.matches_navigator_quadrant != null && (
                      <span className="text-text-muted">
                        {" "}
                        ({summary.dashboard_context.matches_navigator_quadrant ? "matches ensemble" : "differs from ensemble"})
                      </span>
                    )}
                  </p>
                )}
                {summary.dashboard_context.cycle_phase_bucket != null && (
                  <p>
                    Cycle (Radar):{" "}
                    <span className="text-text-primary">{summary.dashboard_context.cycle_phase_bucket}</span>
                    {summary.dashboard_context.cycle_phase_detail != null && (
                      <span className="text-text-muted"> · {summary.dashboard_context.cycle_phase_detail}</span>
                    )}
                    {summary.dashboard_context.cycle_score != null && (
                      <span className="tabular-nums text-text-muted"> (score {summary.dashboard_context.cycle_score})</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="card space-y-2">
            <div className="card-header">Stress</div>
            <div className="text-sm text-text-secondary">
              Score {(summary.stress.stress_score * 100).toFixed(0)} / 100 · band{" "}
              <span className={cn(summary.stress.stress_band === "high" && "text-accent-red")}>
                {summary.stress.stress_band}
              </span>
            </div>
            {summary.recession_reason && (
              <p className="text-[10px] text-text-muted">
                Recession signal:{" "}
                {summary.recession_prob_12m != null
                  ? `${(summary.recession_prob_12m * 100).toFixed(0)}% · `
                  : ""}
                {summary.recession_reason}
              </p>
            )}
            {summary.stress.drivers.length > 0 && (
              <p className="text-xs text-text-muted">{summary.stress.drivers.join(", ")}</p>
            )}
          </div>

          <div className="card space-y-2">
            <div className="card-header">Macro panel</div>
            <p className="text-[10px] text-text-muted">Nowcasts plus trained horizon forecasts when bundle macro models exist.</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-text-muted border-b border-border/40">
                  <th className="py-1 font-normal">Series</th>
                  <th className="py-1 font-normal">Horizon (mo)</th>
                  <th className="py-1 font-normal text-right">Value</th>
                  <th className="py-1 font-normal text-right">Source</th>
                </tr>
              </thead>
              <tbody>
                {summary.macro_forecasts.map((r) => (
                  <tr
                    key={`${r.series_id}-${r.horizon_months}`}
                    className="border-b border-border/40"
                  >
                    <td className="py-1 text-text-primary">
                      <span className="block">{r.display_name || r.series_id}</span>
                      {r.display_name && (
                        <span className="block text-[10px] text-text-muted font-mono">{r.series_id}</span>
                      )}
                    </td>
                    <td className="py-1 text-text-secondary tabular-nums">{r.horizon_months}</td>
                    <td className="py-1 text-right tabular-nums text-text-secondary">
                      {r.value != null ? r.value.toFixed(3) : "—"}
                    </td>
                    <td className="py-1 text-right text-text-muted">{r.trained ? "model" : "raw"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {summary.experts && (
            <div className="card space-y-2">
              <div className="card-header">Expert breakdown</div>
              <p className="text-[10px] text-text-muted">Rule vs HMM vs GBDT probabilities</p>
              <pre className="text-[10px] overflow-x-auto bg-bg-card p-2 rounded border border-border/50 text-text-muted">
                {JSON.stringify(summary.experts, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}

      <div className="card space-y-2">
        <div className="card-header">Model bundle</div>
        {bundle && (
          <>
            {(bundle.label_mode != null || bundle.label_stats != null) && (
              <div className="text-[10px] text-text-muted space-y-1">
                {bundle.label_mode != null && (
                  <p>
                    Training label mode: <span className="text-text-secondary">{bundle.label_mode}</span>
                  </p>
                )}
                {bundle.label_stats != null && Object.keys(bundle.label_stats).length > 0 && (
                  <p className="font-mono text-text-secondary break-all">
                    {JSON.stringify(bundle.label_stats)}
                  </p>
                )}
              </div>
            )}
            <pre className="text-[10px] overflow-x-auto bg-bg-card p-2 rounded border border-border/50 text-text-muted">
              {JSON.stringify(bundle, null, 2)}
            </pre>
          </>
        )}
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="card-header mb-0">Regime history (monthly)</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => refetchRegimeHist()}
              disabled={regimeHistLoading}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-light hover:bg-bg-hover disabled:opacity-50"
            >
              {regimeHistLoading ? "Loading…" : "Refresh table"}
            </button>
            <button
              type="button"
              onClick={() => materializeMut.mutate()}
              disabled={materializeMut.isPending}
              className="rounded-lg border border-accent/30 px-3 py-1.5 text-xs font-light text-accent hover:bg-accent/10 disabled:opacity-50"
              title="Rebuild regime_history_monthly from DB (Navigator vs FL rule vs asset-implied)"
            >
              {materializeMut.isPending ? "Materializing…" : "Materialize from DB"}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-text-muted">
          Persists to <code className="font-mono">regime_history_monthly</code>. Empty until you materialize once. Columns: Navigator vs
          Forecast Lab PIT rule vs asset-implied phase.
        </p>
        {materializeMut.isSuccess && (
          <div className="text-[10px] space-y-0.5">
            <p className="text-text-muted">
              Last run: {materializeMut.data.rows} rows, batch {materializeMut.data.batch_id}
              {materializeMut.data.errors != null && materializeMut.data.errors > 0
                ? ` · skipped months: ${materializeMut.data.errors}`
                : ""}
            </p>
            {materializeMut.data.message ? (
              <p className="text-amber-200/90">{materializeMut.data.message}</p>
            ) : null}
          </div>
        )}
        {materializeMut.isError && (
          <p className="text-[10px] text-accent-red">
            {materializeMut.error instanceof Error ? materializeMut.error.message : String(materializeMut.error)}
          </p>
        )}
        <div className="overflow-x-auto max-h-[min(480px,70vh)] overflow-y-auto rounded border border-border/40">
          <table className="w-full text-[10px] sm:text-xs border-collapse">
            <thead className="sticky top-0 bg-bg-card z-10">
              <tr className="text-left text-text-muted border-b border-border/40">
                <th className="py-1.5 pr-2 font-normal whitespace-nowrap">obs_date</th>
                <th className="py-1.5 pr-2 font-normal whitespace-nowrap">Nav Q</th>
                <th className="py-1.5 pr-2 font-normal whitespace-nowrap">FL rule Q</th>
                <th className="py-1.5 pr-2 font-normal whitespace-nowrap">Asset impl.</th>
                <th className="py-1.5 pr-2 font-normal whitespace-nowrap">Fwd OK</th>
                <th className="py-1.5 pr-2 font-normal whitespace-nowrap">Curve</th>
              </tr>
            </thead>
            <tbody>
              {(regimeHist?.items ?? [])
                .slice()
                .reverse()
                .map((row) => (
                  <tr key={row.obs_date} className="border-b border-border/30 hover:bg-bg-hover/50">
                    <td className="py-1 pr-2 font-mono text-text-secondary whitespace-nowrap">{row.obs_date}</td>
                    <td className="py-1 pr-2 text-text-primary whitespace-nowrap">
                      {QUADRANT_LABELS[row.navigator_quadrant] ?? row.navigator_quadrant}
                    </td>
                    <td className="py-1 pr-2 text-text-primary whitespace-nowrap">
                      {QUADRANT_LABELS[row.fl_rule_quadrant] ?? row.fl_rule_quadrant}
                    </td>
                    <td className="py-1 pr-2 text-text-secondary whitespace-nowrap">
                      {QUADRANT_LABELS[row.asset_implied_quadrant] ?? row.asset_implied_quadrant}
                      <span className="text-text-muted ml-1">
                        ({row.asset_confirmation_score >= 0 ? (row.asset_confirmation_score * 100).toFixed(0) : "—"}%)
                      </span>
                    </td>
                    <td className="py-1 pr-2 whitespace-nowrap">
                      {row.forward_regime_confirmed ? (
                        <span className="text-emerald-400/90">yes</span>
                      ) : (
                        <span className="text-text-muted">no</span>
                      )}
                    </td>
                    <td className="py-1 pr-2 text-text-muted whitespace-nowrap max-w-[120px] truncate" title={row.yield_curve_pattern ?? ""}>
                      {row.yield_curve_pattern ?? "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {regimeHistIsError && (
          <p className="text-[10px] text-accent-red font-mono break-all">
            Regime history fetch failed:{" "}
            {regimeHistError instanceof Error ? regimeHistError.message : String(regimeHistError)}
          </p>
        )}
        {regimeHist && regimeHist.count === 0 && !regimeHistIsError && (
          <p className="text-[10px] text-text-muted">
            No rows yet — click &quot;Materialize from DB&quot; (after training we try to fill automatically). If rows stay 0, read
            the warning line above or backend logs.
          </p>
        )}
      </div>

      <div className="card space-y-2">
        <div className="card-header">Diagnostics</div>
        {align && (
          <div className="text-xs space-y-1 text-text-secondary">
            <p>
              Phase–asset alignment (h={align.horizon_months}m, n={align.sample_size ?? "—"}):{" "}
              <span className="tabular-nums text-text-primary">
                {align.overall_hit_rate != null
                  ? `${(align.overall_hit_rate * 100).toFixed(1)}% hit rate`
                  : "no data"}
              </span>
            </p>
            {align.by_quadrant && Object.keys(align.by_quadrant).length > 0 && (
              <ul className="text-[10px] text-text-muted list-disc list-inside">
                {Object.entries(align.by_quadrant).map(([q, v]) => (
                  <li key={q}>
                    {QUADRANT_LABELS[q] ?? q}: {(v * 100).toFixed(1)}%
                  </li>
                ))}
              </ul>
            )}
            {align.note && <p className="text-[10px] text-text-muted">{align.note}</p>}
          </div>
        )}
        <p className="text-[10px] text-text-muted">Raw OOS + alignment JSON</p>
        <pre className="text-[10px] overflow-x-auto bg-bg-card p-2 rounded border border-border/50 text-text-muted">
          {JSON.stringify({ oos, align }, null, 2)}
        </pre>
      </div>
    </div>
  );
}
