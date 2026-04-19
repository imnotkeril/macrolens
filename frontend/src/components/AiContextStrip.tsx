"use client";

import { useQuery } from "@tanstack/react-query";
import { getContextPack } from "@/lib/api";
import type { AgentContextPack } from "@/types";

type Props = {
  tabId: string;
};

export function AiContextStrip({ tabId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["agent-context-pack"],
    queryFn: () => getContextPack(),
    staleTime: 60_000,
  });
  const pack = data as AgentContextPack | undefined;
  const llm = pack?.macro?.payload?.llm as Record<string, unknown> | undefined;
  const tabs = llm?.tab_summaries as Record<string, string> | undefined;
  const text = tabs?.[tabId];

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border/60 bg-bg-card/40 px-3 py-2 text-xs text-text-muted animate-pulse">
        Loading AI tab summary…
      </div>
    );
  }
  if (!text) {
    return (
      <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-text-muted">
        No AI summary for this tab yet. Run agents (Dashboard or Predictive) with Claude + macro pipeline to fill tab summaries.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-accent/15 bg-accent/5 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">AI · this tab</div>
      <p className="text-sm text-text-secondary leading-relaxed">{text}</p>
    </div>
  );
}
