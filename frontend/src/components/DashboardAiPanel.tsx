"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getContextPack, postRunAgents } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AgentContextPack, MasterRecommendation } from "@/types";

export function pickMasterAiComment(master: MasterRecommendation | null | undefined): string | null {
  if (!master?.payload) return null;
  const llm = master.payload.llm as Record<string, unknown> | undefined;
  if (!llm || typeof llm !== "object") return null;
  const notes = llm.factor_tilt_notes;
  if (Array.isArray(notes) && notes.length > 0) {
    return notes.filter((x) => typeof x === "string").join(" ");
  }
  const rc = llm.regime_comment;
  if (typeof rc === "string" && rc.trim()) return rc.trim();
  return null;
}

type Props = {
  variant: "navigator" | "radar";
};

export function DashboardAiPanel({ variant }: Props) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["agent-context-pack"],
    queryFn: () => getContextPack(),
    staleTime: 60_000,
  });
  const runMutation = useMutation({
    mutationFn: postRunAgents,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["agent-context-pack"] });
      void qc.invalidateQueries({ queryKey: ["fed-rhetoric-history"] });
      void qc.invalidateQueries({ queryKey: ["master-recommendation"] });
      void qc.invalidateQueries({ queryKey: ["agent-signals"] });
    },
  });

  const pack = data as AgentContextPack | undefined;
  const master = pack?.master ?? null;
  const comment = pickMasterAiComment(master);

  return (
    <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted">
            AI overlay · {variant === "navigator" ? "Navigator" : "Radar"}
          </div>
          <p className="text-xs text-text-muted font-light mt-0.5">
            Master synthesis + specialist signals (run from Predictive or here).
          </p>
        </div>
        <button
          type="button"
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
          className="shrink-0 rounded-md border border-accent/30 px-3 py-1 text-[11px] font-light text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          {runMutation.isPending ? "Running…" : "Run AI agents"}
        </button>
      </div>
      {isLoading && <p className="text-xs text-text-muted">Loading AI context…</p>}
      {!isLoading && !master && (
        <p className="text-xs text-text-muted">No Master recommendation yet. Run agents once data and keys are configured.</p>
      )}
      {master && (
        <div className="space-y-2">
          <p className="text-sm text-text-secondary leading-snug line-clamp-4">{master.macro_thesis}</p>
          <div className="flex flex-wrap gap-2 text-[11px] text-text-muted">
            <span className="rounded border border-border px-2 py-0.5">Conf {(master.risk.confidence * 100).toFixed(0)}%</span>
            <span className={cn("rounded border px-2 py-0.5", master.risk.no_trade ? "border-accent-red/40 text-accent-red" : "border-border")}>
              {master.risk.no_trade ? "NO TRADE" : "Trade allowed"}
            </span>
            <span className="rounded border border-border px-2 py-0.5">{master.regime}</span>
          </div>
        </div>
      )}
      {comment && (
        <div className="rounded-lg border border-border/60 bg-bg-card/60 p-2.5">
          <div className="text-[10px] uppercase text-text-muted mb-1">AI on tilts & regime</div>
          <p className="text-xs text-text-secondary leading-relaxed">{comment}</p>
        </div>
      )}
      {pack?.news?.summary && (
        <p className="text-[11px] text-text-muted">
          <span className="text-text-secondary font-medium">News: </span>
          {pack.news.summary}
        </p>
      )}
    </div>
  );
}

/** One line under FactorTilts / trading ideas — uses same context-pack query cache. */
export function MasterAiTiltsNote() {
  const { data } = useQuery({
    queryKey: ["agent-context-pack"],
    queryFn: () => getContextPack(),
    staleTime: 60_000,
  });
  const pack = data as AgentContextPack | undefined;
  const c = pickMasterAiComment(pack?.master ?? null);
  if (!c) return null;
  return (
    <div className="mt-3 rounded-lg border border-border/70 bg-bg-card/50 p-3">
      <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">AI comment · tilts & ideas</div>
      <p className="text-xs text-text-secondary leading-relaxed">{c}</p>
    </div>
  );
}
