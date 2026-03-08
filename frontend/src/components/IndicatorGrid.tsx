"use client";

import type { CategoryScore } from "@/types";
import { cn, trendArrow, CATEGORY_LABELS } from "@/lib/utils";

interface Props {
  scores: CategoryScore[];
}

const COLOR_MAP: Record<string, { bar: string; text: string }> = {
  green: { bar: "bg-accent-green", text: "text-accent-green" },
  yellow: { bar: "bg-accent-amber", text: "text-accent-amber" },
  red: { bar: "bg-accent-red", text: "text-accent-red" },
};

export function IndicatorGrid({ scores }: Props) {
  return (
    <div className="card animate-fade-in">
      <div className="card-header">Economic Indicators</div>
      <div className="space-y-4">
        {scores.map((s, i) => {
          const colors = COLOR_MAP[s.color] || COLOR_MAP.yellow;
          const pct = Math.min(Math.max((s.score + 2) / 4, 0), 1) * 100;
          return (
            <div key={s.category} className={cn("animate-slide-up", `stagger-${i + 1}`)}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-light text-text-primary">
                  {CATEGORY_LABELS[s.category] || s.category}
                </span>
                <div className="flex items-center gap-3">
                  <span className={cn("text-sm font-light tabular-nums", colors.text)}>
                    {s.score >= 0 ? "+" : ""}{s.score.toFixed(1)}
                  </span>
                  <span className={cn("text-sm", colors.text)}>
                    {trendArrow(s.trend)}
                  </span>
                </div>
              </div>
              <div className="h-1 w-full rounded-full bg-bg-elevated overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", colors.bar)}
                  style={{ width: `${pct}%`, opacity: 0.7 }}
                />
              </div>
              <div className="text-[10px] text-text-muted mt-1">
                {s.indicator_count} indicators
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
