"use client";

import { cn } from "@/lib/utils";

interface Props {
  narrative: string;
  completeness: number;
}

export function NarrativeSummary({ narrative, completeness }: Props) {
  return (
    <div className={cn(
      "card border-l-2",
      completeness >= 0.5 ? "border-l-accent-blue" : "border-l-accent-amber",
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="card-header">Macro Narrative</div>
        {completeness < 1 && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-accent-amber/10 text-accent-amber border border-accent-amber/20">
            {(completeness * 100).toFixed(0)}% data coverage
          </span>
        )}
      </div>
      <p className="text-sm font-light text-text-secondary leading-relaxed">
        {narrative}
      </p>
    </div>
  );
}
