"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMLDatasetInfo, postMLBuildDataset, API_BASE } from "@/lib/api";
import { cn } from "@/lib/utils";

const isFailedFetch = (e: unknown) =>
  e instanceof Error && (e.message === "Failed to fetch" || e.name === "TypeError");

export default function MLRegimePage() {
  const queryClient = useQueryClient();
  const {
    data: datasetInfo,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["ml-dataset-info"],
    queryFn: getMLDatasetInfo,
  });

  const buildMutation = useMutation({
    mutationFn: (opts: { maxMonths?: number; minimal?: boolean }) =>
      postMLBuildDataset(opts.maxMonths, opts.minimal),
    onSuccess: (data) => {
      queryClient.setQueryData(["ml-dataset-info"], data);
    },
  });

  const building = buildMutation.isPending;
  const buildError = buildMutation.error;
  const buildSuccess = buildMutation.isSuccess && buildMutation.data;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extralight tracking-tight text-text-primary">
          ML Regime
        </h1>
        <p className="mt-1 text-sm font-light text-text-muted">
          Build the ML dataset from the database (monthly growth, Fed, cycle data) and see the result here.
        </p>
        <p className="mt-1 text-xs text-text-muted">
          When running via Docker, build logs are written to <code className="bg-bg-card px-1 rounded">macrolens/backend/debug-*.log</code>. Check that file after running a build (e.g. &quot;1 month (full)&quot;).
        </p>
      </div>

      <div className="card">
        <div className="card-header flex flex-wrap items-center justify-between gap-2">
          <span>Dataset</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={building}
              className={cn(
                "rounded border px-2 py-1 text-xs font-light transition-colors cursor-pointer",
                isFetching || building
                  ? "border-border text-text-muted cursor-wait"
                  : "border-border text-text-muted hover:text-text-secondary hover:border-text-muted"
              )}
            >
              {isFetching && !building ? "Loading…" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={() => buildMutation.mutate({ minimal: true, maxMonths: 6 })}
              disabled={building}
              className={cn(
                "rounded border px-2 py-1 text-xs font-light transition-colors cursor-pointer",
                building
                  ? "border-border text-text-muted cursor-wait"
                  : "border-accent-green/40 text-accent-green hover:bg-accent-green/10"
              )}
            >
              {building ? "Building…" : "1 indicator (6 mo)"}
            </button>
            <button
              type="button"
              onClick={() => buildMutation.mutate({ maxMonths: 1 })}
              disabled={building}
              className={cn(
                "rounded border px-2 py-1 text-xs font-light transition-colors cursor-pointer",
                building
                  ? "border-border text-text-muted cursor-wait"
                  : "border-border text-text-muted hover:text-text-secondary hover:border-text-muted"
              )}
            >
              {building ? "Building…" : "1 month (full)"}
            </button>
            <button
              type="button"
              onClick={() => buildMutation.mutate({})}
              disabled={building}
              className={cn(
                "rounded border px-3 py-1.5 text-xs font-light transition-colors cursor-pointer",
                building
                  ? "border-border text-text-muted cursor-wait"
                  : "border-accent/40 text-accent hover:bg-accent/10"
              )}
            >
              {building ? "Building from DB…" : "Build dataset from DB"}
            </button>
          </div>
        </div>

        {building && (
          <div className="py-4 text-sm text-text-muted">
            {buildMutation.variables?.minimal
              ? "Building 1 indicator (6 months)…"
              : buildMutation.variables?.maxMonths === 1
                ? "Building 1 month (full)…"
                : "Building dataset from database (monthly indicators, Fed, cycle). This can take 5–10 minutes; do not close the page."}
          </div>
        )}

        {buildError && (
          <div className="py-4 text-sm text-accent-red space-y-2">
            <p>Build failed: {buildError instanceof Error ? buildError.message : String(buildError)}</p>
            {isFailedFetch(buildError) && (
              <div className="rounded border border-border bg-bg/80 p-3 text-text-muted space-y-1">
                <p className="font-medium text-text-secondary">&quot;Failed to fetch&quot; means the browser could not reach the backend.</p>
                <p>Backend URL: <code className="text-xs break-all">{API_BASE}</code></p>
                <p>Check: 1) Backend is running (port 8000; with Docker run <code>docker compose ps</code>). 2) If not on localhost, set <code>NEXT_PUBLIC_API_URL</code> and rebuild the frontend.</p>
              </div>
            )}
            {!isFailedFetch(buildError) && (
              <p className="text-text-muted font-light">
                Ensure the backend is running and the DB has data (run Refresh on the main page first).
              </p>
            )}
          </div>
        )}

        {buildSuccess && !building && (
          <p className="text-sm text-accent-green">
            Dataset built: {buildSuccess.rows} rows
            {buildSuccess.date_min && buildSuccess.date_max && (
              <> ({buildSuccess.date_min} – {buildSuccess.date_max})</>
            )}
          </p>
        )}

        {!building && (
          <>
            {isLoading && !datasetInfo && (
              <div className="py-8 text-center text-sm text-text-muted">
                Loading dataset info…
              </div>
            )}

            {isError && (
              <div className="py-4 text-sm text-accent-red space-y-2">
                <p>Failed to load data: {error instanceof Error ? error.message : String(error)}</p>
                {isFailedFetch(error) && (
                  <div className="rounded border border-border bg-bg/80 p-3 text-text-muted space-y-1">
                    <p className="font-medium text-text-secondary">&quot;Failed to fetch&quot; means the browser could not reach the backend.</p>
                    <p>Backend URL: <code className="text-xs break-all">{API_BASE}</code></p>
                    <p>Check: 1) Backend is running (Docker: <code>docker compose ps</code>, port 8000). 2) Open <a href={`${API_BASE}/api/health`} target="_blank" rel="noopener noreferrer" className="text-accent underline">{API_BASE}/api/health</a> in the browser; it should return <code>{`{ "status": "ok" }`}</code>.</p>
                  </div>
                )}
                {!isFailedFetch(error) && (
                  <p className="text-text-muted font-light">
                    Ensure the backend is running and the ML API is available.
                  </p>
                )}
              </div>
            )}

            {datasetInfo && !isError && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-text-muted uppercase tracking-wider">Rows</p>
                    <p className="text-xl font-light tabular-nums text-text-primary">
                      {datasetInfo.rows}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted uppercase tracking-wider">Date range</p>
                    <p className="text-sm font-light text-text-secondary">
                      {datasetInfo.date_min && datasetInfo.date_max
                        ? `${datasetInfo.date_min} – ${datasetInfo.date_max}`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted uppercase tracking-wider">Last built</p>
                    <p className="text-sm font-light text-text-secondary">
                      {datasetInfo.last_built ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted uppercase tracking-wider">Path</p>
                    <p className="text-xs font-mono text-text-muted truncate" title={datasetInfo.path}>
                      {datasetInfo.path}
                    </p>
                  </div>
                </div>

                <details className="text-sm">
                  <summary className="cursor-pointer text-text-muted hover:text-text-secondary">
                    Features ({datasetInfo.features?.length ?? 0})
                  </summary>
                  <pre className="mt-2 text-xs text-text-muted overflow-x-auto p-2 rounded border border-border bg-bg/50">
                    {datasetInfo.features?.join(", ") ?? "—"}
                  </pre>
                </details>

                {datasetInfo.rows === 0 && !buildSuccess && (
                  <div className="space-y-2">
                    <p className="text-sm text-accent-amber">
                      No dataset yet. Click &quot;Build dataset from DB&quot; or &quot;1 month (full)&quot; above.
                    </p>
                    {datasetInfo.build_error && (
                      <p className="text-sm text-accent-red font-mono break-all">
                        Reason: {datasetInfo.build_error}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
