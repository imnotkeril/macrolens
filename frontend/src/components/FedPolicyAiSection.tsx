"use client";

import { useQuery } from "@tanstack/react-query";
import { getContextPack, getFedRhetoricHistory } from "@/lib/api";
import type { AgentContextPack, FedRhetoricPoint } from "@/types";
import LWChart from "@/components/LWChart";

export function FedPolicyAiSection() {
  const { data: pack, isLoading: packLoading } = useQuery({
    queryKey: ["agent-context-pack"],
    queryFn: () => getContextPack(),
    staleTime: 60_000,
  });
  const { data: hist, isLoading: histLoading } = useQuery({
    queryKey: ["fed-rhetoric-history"],
    queryFn: () => getFedRhetoricHistory(),
    staleTime: 120_000,
  });

  const p = pack as AgentContextPack | undefined;
  const fed = p?.fed_cb;
  const llm = (fed?.payload?.llm as Record<string, unknown> | undefined) ?? undefined;
  const stance = typeof llm?.stance === "string" ? llm.stance : null;
  const score = fed?.score ?? null;
  const hawkIdx = score == null ? null : Math.round((Number(score) + 1) * 50);

  const chartData = (hist as FedRhetoricPoint[] | undefined)?.length
    ? (hist as FedRhetoricPoint[]).map((h) => ({
        date: h.signal_date,
        hawk_index: h.hawk_dovish_index ?? (h.score == null ? null : Math.round((Number(h.score) + 1) * 50)),
      }))
    : [];

  const chartReady = chartData.some((d) => d.hawk_index != null);

  return (
    <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-4">
      <div className="text-[10px] uppercase tracking-wider text-text-muted">Fed / CB · AI agent (communications + rates)</div>
      {packLoading && <p className="text-xs text-text-muted">Loading…</p>}
      {!packLoading && !fed && (
        <p className="text-xs text-text-muted">No Fed CB agent signal for today. Run AI agents from the Dashboard.</p>
      )}
      {fed && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <p className="text-sm text-text-secondary leading-relaxed">{fed.summary}</p>
            <div className="flex flex-wrap gap-2 text-[11px] text-text-muted">
              {stance && <span className="rounded border border-border px-2 py-0.5 capitalize">{stance}</span>}
              {score != null && (
                <span className="rounded border border-border px-2 py-0.5 tabular-nums">Rhetoric score {Number(score).toFixed(2)} (−1 dovish … +1 hawkish)</span>
              )}
            </div>
            {hawkIdx != null && (
              <div>
                <div className="flex justify-between text-[9px] text-text-muted mb-1">
                  <span>Dovish 0</span>
                  <span>Neutral 50</span>
                  <span>Hawkish 100</span>
                </div>
                <div className="relative h-1.5 rounded-full bg-gradient-to-r from-accent-green via-[#404060] to-accent-red">
                  <div
                    className="absolute top-1/2 w-2.5 h-2.5 rounded-full bg-[#9b7fff] shadow-[0_0_8px_#9b7fff] -translate-y-1/2"
                    style={{ left: `calc(${Math.min(100, Math.max(0, hawkIdx))}% - 5px)` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="card bg-bg-card/60">
            <div className="text-[9px] uppercase tracking-wider text-text-muted mb-2">Rhetoric index history (daily)</div>
            {histLoading && <div className="h-40 flex items-center justify-center text-xs text-text-muted">Loading history…</div>}
            {!histLoading && chartReady && (
              <LWChart
                data={chartData.filter((d) => d.hawk_index != null) as { date: string; hawk_index: number }[]}
                series={[{ key: "hawk_index", label: "Hawk–dovish (0–100)", color: "#a78bfa", type: "line" }]}
                height={220}
                periodSelector
                fixedPriceRange={{ min: 0, max: 100 }}
                formatValue={(v) => `${v.toFixed(0)}`}
              />
            )}
            {!histLoading && !chartReady && (
              <div className="h-40 flex items-center justify-center text-xs text-text-muted">
                No history yet. Run agents on days with Fed CB signals to build a series.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
