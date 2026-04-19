"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  getMLRegimePredict,
  getMLRegimeBacktest,
  getMLRegimeMetrics,
  getMLDatasetInfo,
  postMLRegimeTrain,
  getMLTrainProgress,
  getML2Predict,
  getML2Metrics,
  postML2Train,
  postRunAgents,
  getMasterRecommendation,
  getAgentSignals,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import type { TaskProgress } from "@/types";

const QUADRANT_LABELS: Record<string, string> = {
  Q1_GOLDILOCKS: "Risk ON",
  Q2_REFLATION: "GROWTH",
  Q3_OVERHEATING: "VALUE",
  Q4_STAGFLATION: "Risk OFF",
};

const QUADRANT_COLORS: Record<string, string> = {
  Q1_GOLDILOCKS: "bg-teal-500/80",
  Q2_REFLATION: "bg-blue-500/80",
  Q3_OVERHEATING: "bg-amber-500/80",
  Q4_STAGFLATION: "bg-red-500/80",
};

export default function PredictivePage() {
  const queryClient = useQueryClient();
  const { data: predict, isLoading: predictLoading } = useQuery({
    queryKey: ["ml-regime-predict"],
    queryFn: getMLRegimePredict,
  });
  const { data: backtest } = useQuery({
    queryKey: ["ml-regime-backtest"],
    queryFn: getMLRegimeBacktest,
  });
  const { data: metrics } = useQuery({
    queryKey: ["ml-regime-metrics"],
    queryFn: getMLRegimeMetrics,
  });
  const { data: datasetInfo } = useQuery({
    queryKey: ["ml-dataset-info"],
    queryFn: getMLDatasetInfo,
  });
  const trainMutation = useMutation({
    mutationFn: postMLRegimeTrain,
    onSuccess: (data) => {
      // Backend returns "started" or "already_running"; training continues in background
      if (data.status === "started" || data.status === "already_running") {
        setTrainingInProgress(true);
        setLastTrainError(null);
        setTrainProgress(null);
        return;
      }
      if (data.status === "completed") {
        queryClient.invalidateQueries({ queryKey: ["ml-regime-predict"] });
        queryClient.invalidateQueries({ queryKey: ["ml-regime-backtest"] });
        queryClient.invalidateQueries({ queryKey: ["ml-regime-metrics"] });
        queryClient.invalidateQueries({ queryKey: ["ml-dataset-info"] });
      }
    },
  });
  const ml2TrainMutation = useMutation({ mutationFn: postML2Train, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ml2-predict"] }) });
  const runAgentsMutation = useMutation({
    mutationFn: postRunAgents,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-recommendation"] });
      queryClient.invalidateQueries({ queryKey: ["agent-signals"] });
      queryClient.invalidateQueries({ queryKey: ["agent-context-pack"] });
      queryClient.invalidateQueries({ queryKey: ["fed-rhetoric-history"] });
    },
  });

  const [trainProgress, setTrainProgress] = useState<TaskProgress | null>(null);
  const [trainingInProgress, setTrainingInProgress] = useState(false);
  const [lastTrainError, setLastTrainError] = useState<string | null>(null);
  const trainDoneRef = useRef(false);
  const { data: ml2Predict } = useQuery({ queryKey: ["ml2-predict"], queryFn: getML2Predict });
  const { data: ml2Metrics } = useQuery({ queryKey: ["ml2-metrics"], queryFn: getML2Metrics });
  const { data: masterRec } = useQuery({ queryKey: ["master-recommendation"], queryFn: getMasterRecommendation });
  const { data: agentSignals } = useQuery({ queryKey: ["agent-signals"], queryFn: getAgentSignals });

  // Poll progress while waiting for POST response or while background training is running
  useEffect(() => {
    if (!trainMutation.isPending && !trainingInProgress) return;
    trainDoneRef.current = false;
    const t = setInterval(async () => {
      if (trainDoneRef.current) return;
      try {
        const p = await getMLTrainProgress();
        setTrainProgress(p);
        if (p.done) {
          trainDoneRef.current = true;
          setTrainingInProgress(false);
          if (p.error) setLastTrainError(p.error);
          else {
            setLastTrainError(null);
            queryClient.invalidateQueries({ queryKey: ["ml-regime-predict"] });
            queryClient.invalidateQueries({ queryKey: ["ml-regime-backtest"] });
            queryClient.invalidateQueries({ queryKey: ["ml-regime-metrics"] });
            queryClient.invalidateQueries({ queryKey: ["ml-dataset-info"] });
          }
        }
      } catch {
        /* ignore */
      }
    }, 1000);
    return () => clearInterval(t);
  }, [trainMutation.isPending, trainingInProgress, queryClient]);

  useEffect(() => {
    if (!trainMutation.isPending && !trainingInProgress) {
      setTrainProgress(null);
      trainDoneRef.current = true;
    }
  }, [trainMutation.isPending, trainingInProgress]);

  const probs = predict
    ? [predict.p_q1, predict.p_q2, predict.p_q3, predict.p_q4]
    : [0.25, 0.25, 0.25, 0.25];
  const quadrantOrder = ["Q1_GOLDILOCKS", "Q2_REFLATION", "Q3_OVERHEATING", "Q4_STAGFLATION"];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extralight tracking-tight text-text-primary">
          Regime Forecast (ML)
        </h1>
        <p className="mt-1 text-sm font-light text-text-muted">
          Navigator regime prediction via ensemble (Markov, XGBoost, rule). Current probabilities and backtest on history.
        </p>
      </div>

      {/* Current predict (nowcast) */}
      <div className="card">
        <div className="card-header">Current Predict (Nowcast)</div>
        {predictLoading && !predict && (
          <div className="py-8 text-center text-sm text-text-muted">Loading…</div>
        )}
        {predict && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="text-xs text-text-muted uppercase tracking-wider">Ensemble</span>
                <p className={cn("text-xl font-light", QUADRANT_COLORS[predict.quadrant_ensemble]?.replace("bg-", "text-").replace("/80", "") || "text-text-primary")}>
                  {QUADRANT_LABELS[predict.quadrant_ensemble] ?? predict.quadrant_ensemble}
                </p>
              </div>
              <div>
                <span className="text-xs text-text-muted uppercase tracking-wider">Confidence</span>
                <p className="text-xl font-light tabular-nums text-text-primary">
                  {(predict.confidence * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <span className="text-xs text-text-muted uppercase tracking-wider">Rule (ground truth)</span>
                <p className="text-lg font-light text-text-secondary">
                  {QUADRANT_LABELS[predict.quadrant_rule] ?? predict.quadrant_rule}
                </p>
              </div>
              {predict.quadrant_rule === predict.quadrant_ensemble ? (
                <span className="badge bg-accent-green/10 text-accent-green border-accent-green/20 text-xs">
                  Matches rule
                </span>
              ) : (
                <span className="badge bg-accent-amber/10 text-accent-amber border-accent-amber/20 text-xs">
                  Diverges from rule
                </span>
              )}
            </div>
            {/* Probability bars */}
            <div>
              <p className="text-xs text-text-muted mb-2">P(quadrant)</p>
              <div className="flex gap-1 h-6 rounded overflow-hidden">
                {quadrantOrder.map((q, i) => (
                  <div
                    key={q}
                    title={`${QUADRANT_LABELS[q]}: ${(probs[i] * 100).toFixed(1)}%`}
                    className={cn("min-w-[2rem] transition-all", QUADRANT_COLORS[q] || "bg-border")}
                    style={{ width: `${Math.max(2, probs[i] * 100)}%` }}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-text-muted">
                {quadrantOrder.map((q) => (
                  <span key={q}>{QUADRANT_LABELS[q]}</span>
                ))}
              </div>
            </div>
            {/* Per-model breakdown */}
            <div>
              <p className="text-xs text-text-muted mb-2">By model</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Object.entries(predict.by_model).map(([name, m]) => (
                  <div key={name} className="rounded-lg border border-border bg-bg/50 p-3">
                    <div className="text-xs font-medium text-text-secondary capitalize mb-2">{name}</div>
                    <div className="text-sm font-light text-text-primary">
                      {m.quadrant ? QUADRANT_LABELS[m.quadrant] ?? m.quadrant : "—"}
                    </div>
                    <div className="flex gap-0.5 mt-1.5 h-1.5 rounded overflow-hidden">
                      {[m.p_q1, m.p_q2, m.p_q3, m.p_q4].map((v, i) => (
                        <div
                          key={i}
                          className={cn(QUADRANT_COLORS[quadrantOrder[i]] || "bg-border")}
                          style={{ width: `${(v ?? 0) * 100}%`, minWidth: (v ?? 0) > 0 ? 2 : 0 }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Test metrics */}
      <div className="card">
        <div className="card-header">Metrics (Test Set)</div>
        {metrics && (metrics.train_rows != null || metrics.metrics?.test_accuracy != null) ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-text-muted">Accuracy</p>
                <p className="text-lg font-light tabular-nums text-text-primary">
                  {((metrics.metrics?.test_accuracy ?? 0) * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Balanced accuracy</p>
                <p className="text-lg font-light tabular-nums text-text-primary">
                  {((metrics.metrics?.test_balanced_accuracy ?? 0) * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Log-loss</p>
                <p className="text-lg font-light tabular-nums text-text-primary">
                  {(metrics.metrics?.test_log_loss ?? 0).toFixed(3)}
                </p>
              </div>
            </div>
            <p className="text-xs text-text-muted">
              Trained: {metrics.trained_at ?? "—"} · Test: {metrics.test_start ?? "—"} to {metrics.test_end ?? "—"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-text-muted">No trained model yet. Build dataset and run Train.</p>
        )}
      </div>

      {/* Confusion matrix */}
      {(() => {
        const confusionMatrix = metrics?.confusion_matrix ?? [];
        if (confusionMatrix.length === 0) return null;
        return (
        <div className="card">
          <div className="card-header">Confusion Matrix (Test) — Rows: actual, Cols: predicted</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left text-text-muted font-medium p-1"></th>
                  {quadrantOrder.map((q) => (
                    <th key={q} className="text-center text-text-muted font-medium p-1 text-xs">
                      {QUADRANT_LABELS[q]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quadrantOrder.map((q, i) => (
                  <tr key={q}>
                    <td className="text-text-muted text-xs p-1 pr-2">{QUADRANT_LABELS[q]}</td>
                    {confusionMatrix[i]?.map((cell: number, j: number) => (
                      <td key={j} className="text-center tabular-nums p-1 border border-border rounded">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        );
      })()}

      {/* Backtest history */}
      <div className="card">
        <div className="card-header">Backtest on History</div>
        {backtest?.backtest?.length ? (
          <div className="space-y-2">
            <p className="text-xs text-text-muted">
              {backtest.test_start ?? ""} – {backtest.test_end ?? ""}
            </p>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-bg-card">
                  <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-text-muted">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Actual</th>
                    <th className="pb-2 font-medium">Ensemble</th>
                    <th className="pb-2 font-medium text-center">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {backtest.backtest.slice(-60).reverse().map((row, idx) => (
                    <tr key={`${row.date}-${idx}`} className="border-b border-border/30">
                      <td className="py-1.5 text-text-secondary">{row.date}</td>
                      <td className="py-1.5">{QUADRANT_LABELS[row.quadrant_actual] ?? row.quadrant_actual}</td>
                      <td className="py-1.5">{QUADRANT_LABELS[row.quadrant_ensemble] ?? row.quadrant_ensemble}</td>
                      <td className="py-1.5 text-center">
                        {row.match ? (
                          <span className="text-accent-green">✓</span>
                        ) : (
                          <span className="text-accent-red">✗</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-muted">No backtest data. Train the model first.</p>
        )}
      </div>

      {/* Data & train */}
      <div className="card">
        <div className="card-header">Dataset & Training</div>
        <div className="space-y-3">
          <p className="text-xs text-text-muted">
            The row count below is the <strong>ML dataset</strong> size (file on the backend). It is built only by «Rebuild dataset & train», not by Refresh. Refresh on the main page loads raw data into the DB; to get rows here, run Refresh first, then click «Rebuild dataset & train».
          </p>
          {datasetInfo && (
            <p className="text-sm font-light text-text-secondary">
              Rows: <span className="tabular-nums">{datasetInfo.rows}</span>
              {datasetInfo.date_min && datasetInfo.date_max && (
                <> · Range: {datasetInfo.date_min} – {datasetInfo.date_max}</>
              )}
              {datasetInfo.rows > 0 && datasetInfo.rows < 60 && (
                <span className="ml-2 text-accent-amber">Low data (&lt;5y) — metrics may be unstable</span>
              )}
            </p>
          )}
          <details className="text-sm">
            <summary className="cursor-pointer text-text-muted hover:text-text-secondary">Features</summary>
            <pre className="mt-2 text-xs text-text-muted overflow-x-auto">
              {datasetInfo?.features?.join(", ") ?? "—"}
            </pre>
          </details>
          {datasetInfo?.rows === 0 && (
            <p className="text-sm text-accent-amber">
              Dataset has 0 rows. Steps: 1) On the main page click Refresh and wait for it to finish. 2) Here click «Rebuild dataset & train» — the dataset will be built from the DB by month, then rows will appear. If still 0 rows, the DB has little history (monthly indicators and Fed data for several years are required).
            </p>
          )}
          <button
            type="button"
            onClick={() => trainMutation.mutate()}
            disabled={trainMutation.isPending || trainingInProgress}
            className={cn(
              "rounded-lg border px-4 py-2 text-sm font-light transition-colors",
              trainMutation.isPending || trainingInProgress
                ? "border-border text-text-muted cursor-wait"
                : "border-accent/30 text-accent hover:bg-accent/10"
            )}
          >
            {trainMutation.isPending || trainingInProgress ? "Training…" : "Rebuild dataset & train"}
          </button>
          {(trainMutation.isPending || trainingInProgress) && (
            <div className="space-y-2 rounded-lg border border-border bg-bg-card/50 p-4">
              <p className="text-sm text-text-muted">
                Training runs in the background (5 years of data + models). Progress updates below; no timeout.
              </p>
              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span>{trainProgress?.message ?? "Starting…"}</span>
                <span className="tabular-nums">{trainProgress ? trainProgress.percent.toFixed(0) : "0"}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${Math.min(100, trainProgress?.percent ?? 0)}%` }}
                />
              </div>
              <div className="max-h-32 overflow-y-auto rounded border border-border bg-bg/80 p-2 font-mono text-xs text-text-muted">
                {trainProgress?.logs?.length ? (
                  trainProgress.logs.map((line, i) => (
                    <div key={i} className="whitespace-pre-wrap break-all">{line}</div>
                  ))
                ) : (
                  <div className="text-text-muted">Waiting for progress…</div>
                )}
              </div>
            </div>
          )}
          {lastTrainError && (
            <div className="text-sm text-accent-red space-y-1">
              <p>Error: {lastTrainError}</p>
              {(lastTrainError.includes("Insufficient data") || lastTrainError.includes("24 months")) && (
                <p className="text-text-muted font-light">
                  Not enough monthly history in the DB. Ensure Refresh on the main page completed and loaded indicators and Fed data for several years; then run «Rebuild dataset & train» again.
                </p>
              )}
            </div>
          )}
          {trainMutation.isError && (
            <div className="text-sm text-accent-red space-y-1">
              <p>Error: {String(trainMutation.error)}</p>
              {String(trainMutation.error).includes("404") && (
                <p className="text-text-muted font-light">
                  ML API not loaded on the backend. Rebuild the backend image with dependencies (xgboost etc.):{" "}
                  <code className="text-xs bg-bg-card px-1 rounded">docker compose build backend</code>
                  {" "}and restart the container.
                </p>
              )}
              {(String(trainMutation.error).includes("timed out") || String(trainMutation.error).includes("AbortError")) && (
                <p className="text-text-muted font-light">
                  Failed to start training. Check backend logs and try again.
                </p>
              )}
            </div>
          )}
          {!lastTrainError && !trainingInProgress && trainProgress?.done && !trainProgress?.error && (
            <p className="text-sm text-accent-green">Training completed.</p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">ML2 Factors & Anomaly</div>
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => ml2TrainMutation.mutate()}
              disabled={ml2TrainMutation.isPending}
              className="rounded-lg border px-4 py-2 text-sm font-light border-accent/30 text-accent hover:bg-accent/10 disabled:opacity-60"
            >
              {ml2TrainMutation.isPending ? "Training ML2…" : "Train ML2"}
            </button>
            <button
              type="button"
              onClick={() => runAgentsMutation.mutate()}
              disabled={runAgentsMutation.isPending}
              className="rounded-lg border px-4 py-2 text-sm font-light border-border text-text-secondary hover:bg-bg-hover disabled:opacity-60"
            >
              {runAgentsMutation.isPending ? "Running agents…" : "Run Agents + Master"}
            </button>
          </div>
          <p className="text-xs text-text-muted">
            ML2 as-of: {ml2Predict?.as_of_date ?? "—"} · anomaly: {(ml2Predict?.anomaly_score ?? 0).toFixed(3)}
            {ml2Predict?.is_anomaly ? " (anomaly)" : " (normal)"}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(ml2Predict?.factors ?? []).slice(0, 6).map((f, i) => (
              <div key={`${f.factor}-${f.horizon_months}-${i}`} className="rounded border border-border p-2 text-xs">
                <div className="text-text-primary">{f.factor} · {f.horizon_months}m</div>
                <div className="text-text-muted">score {f.score.toFixed(3)} · conf {(f.confidence ?? 0).toFixed(2)}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-muted">
            ML2 rows: {ml2Metrics?.rows ?? "—"} · IC(1m): {(ml2Metrics?.metrics?.ic_abs_1m ?? 0).toFixed(3)}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Master & specialist agents</div>
        <p className="text-xs text-text-muted -mt-2 mb-4 leading-relaxed">
          Day-to-day AI overlays live on the{" "}
          <Link href="/" className="text-accent underline-offset-2 hover:underline">
            Dashboard
          </Link>
          ,{" "}
          <Link href="/analysis" className="text-accent underline-offset-2 hover:underline">
            Analysis
          </Link>
          , and{" "}
          <Link href="/fed-policy" className="text-accent underline-offset-2 hover:underline">
            Fed Policy
          </Link>
          . Use this card to run the pipeline and inspect raw signals.
        </p>
        <div className="space-y-5">
          <div className="rounded-lg border border-border/80 bg-bg-card/40 p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Master Agent · synthesis</div>
            {masterRec?.regime && (
              <p className="text-xs text-accent/90 font-medium">Regime label: {masterRec.regime}</p>
            )}
            <p className="text-sm text-text-secondary">{masterRec?.macro_thesis ?? "No recommendation yet."}</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              <div className="rounded border border-border p-2">Confidence: {(masterRec?.risk?.confidence ?? 0).toFixed(2)}</div>
              <div className="rounded border border-border p-2">Uncertainty: {(masterRec?.risk?.uncertainty ?? 1).toFixed(2)}</div>
              <div className="rounded border border-border p-2">Stability: {(masterRec?.risk?.regime_stability_score ?? 0).toFixed(2)}</div>
              <div className="rounded border border-border p-2">Data quality: {(masterRec?.risk?.data_quality_score ?? 0).toFixed(2)}</div>
              <div className="rounded border border-border p-2">{masterRec?.risk?.no_trade ? "NO TRADE" : "TRADE OK"}</div>
            </div>
            <div className="text-xs text-text-muted">
              Reason codes: {(masterRec?.risk?.reason_codes ?? []).join(", ") || "—"}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
              Specialist agents · signals today ({(agentSignals ?? []).length})
            </div>
            <p className="text-[11px] text-text-muted font-light mb-2">
              One row per specialist per run; full narrative is on Dashboard / Analysis / Fed Policy via context-pack.
            </p>
            {(agentSignals ?? []).length === 0 ? (
              <p className="text-xs text-text-muted">No signals yet. Use «Run Agents + Master» or wait for the daily job.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-bg-hover/50 text-text-muted">
                    <tr>
                      <th className="p-2 font-normal">Agent</th>
                      <th className="p-2 font-normal">Signal type</th>
                      <th className="p-2 font-normal w-20">Score</th>
                      <th className="p-2 font-normal">Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(agentSignals ?? [])]
                      .sort((a, b) => a.agent_name.localeCompare(b.agent_name))
                      .map((s) => (
                        <tr key={`${s.agent_name}-${s.signal_type}`} className="border-b border-border/60 last:border-0">
                          <td className="p-2 text-text-primary align-top whitespace-nowrap">{s.agent_name}</td>
                          <td className="p-2 text-text-muted align-top font-mono text-[10px]">{s.signal_type}</td>
                          <td className="p-2 text-text-secondary align-top tabular-nums">
                            {s.score === null || s.score === undefined ? "—" : s.score.toFixed(3)}
                          </td>
                          <td className="p-2 text-text-secondary align-top leading-snug">{s.summary}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
