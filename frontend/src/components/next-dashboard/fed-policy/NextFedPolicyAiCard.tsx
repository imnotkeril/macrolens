"use client";

import { useQuery } from "@tanstack/react-query";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";
import { FedRhetoricIndexRecharts } from "@/components/next-dashboard/fed-policy/FedPolicyRecharts";
import { getContextPack, getFedRhetoricHistory } from "@/lib/api";
import type { AgentContextPack, FedRhetoricPoint } from "@/types";
import { NEXT_FED_POLICY_QUERY_ROOT } from "@/components/next-dashboard/fed-policy/fedPolicyQueryKeys";

export function NextFedPolicyAiCard() {
  const { colors: C } = useNextShellTheme();
  const { data: pack, isLoading: packLoading } = useQuery({
    queryKey: [NEXT_FED_POLICY_QUERY_ROOT, "agent-pack"],
    queryFn: () => getContextPack(),
    staleTime: 60_000,
  });
  const { data: hist, isLoading: histLoading } = useQuery({
    queryKey: [NEXT_FED_POLICY_QUERY_ROOT, "fed-rhetoric"],
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
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-2 overflow-hidden">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
        Fed / CB · AI agent
      </div>
      {packLoading && <p className="text-[12px]" style={{ color: "var(--nd-muted)" }}>Loading…</p>}
      {!packLoading && !fed && (
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--nd-soft)" }}>
          No Fed CB agent signal for today. Run AI agents from the Dashboard.
        </p>
      )}
      {fed && (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto">
          <p className="text-[12px] leading-relaxed" style={{ color: "var(--nd-text)" }}>
            {fed.summary}
          </p>
          <div className="flex flex-wrap gap-1.5 text-[11px]" style={{ color: "var(--nd-muted)" }}>
            {stance ? (
              <span
                className="rounded-[2px] border px-2 py-0.5 capitalize"
                style={{ borderColor: "var(--nd-border-soft)" }}
              >
                {stance}
              </span>
            ) : null}
            {score != null ? (
              <span className="rounded-[2px] border px-2 py-0.5 tabular-nums" style={{ borderColor: "var(--nd-border-soft)" }}>
                Rhetoric {Number(score).toFixed(2)} (−1 dovish … +1 hawkish)
              </span>
            ) : null}
          </div>
          {hawkIdx != null ? (
            <div>
              <div className="mb-0.5 flex justify-between text-[9px] uppercase tracking-[0.06em]" style={{ color: "var(--nd-muted)" }}>
                <span>Dovish 0</span>
                <span>Neutral 50</span>
                <span>Hawkish 100</span>
              </div>
              <div
                className="relative h-1 rounded-full"
                style={{
                  background: "linear-gradient(90deg, var(--nd-green) 0%, var(--nd-border) 50%, var(--nd-red) 100%)",
                }}
              >
                <div
                  className="absolute top-1/2 h-2 w-2 rounded-full border-2 shadow"
                  style={{
                    left: `${Math.min(100, Math.max(0, hawkIdx))}%`,
                    transform: "translate(-50%, -50%)",
                    background: "var(--nd-purple)",
                    borderColor: "var(--nd-panel)",
                  }}
                />
              </div>
            </div>
          ) : null}
          <div className="min-h-0 min-w-0 flex-1">
            <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
              Rhetoric index (daily)
            </div>
            {histLoading ? (
              <div className="flex h-28 items-center justify-center text-[12px]" style={{ color: "var(--nd-muted)" }}>
                Loading history…
              </div>
            ) : null}
            {!histLoading && chartReady ? (
              <FedRhetoricIndexRecharts
                palette={C}
                rows={chartData.filter((d): d is { date: string; hawk_index: number } => d.hawk_index != null)}
                height={118}
              />
            ) : null}
            {!histLoading && !chartReady ? (
              <div className="flex h-28 items-center justify-center text-center text-[12px]" style={{ color: "var(--nd-muted)" }}>
                No rhetoric history yet.
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
