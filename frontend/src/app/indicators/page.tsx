"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getIndicators, getIndicatorHistory } from "@/lib/api";
import type { IndicatorCategory, IndicatorWithLatest } from "@/types";
import { cn, trendArrow, trendColor, formatNumber, CATEGORY_LABELS } from "@/lib/utils";
import LWChart from "@/components/LWChart";

const CATEGORIES: (IndicatorCategory | "all")[] = [
  "all", "housing", "orders", "income_sales", "employment", "inflation",
];

export default function IndicatorsPage() {
  const [selectedCategory, setSelectedCategory] = useState<IndicatorCategory | "all">("all");
  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorWithLatest | null>(null);

  const { data: indicators } = useQuery({
    queryKey: ["indicators", selectedCategory],
    queryFn: () => selectedCategory === "all" ? getIndicators() : getIndicators(selectedCategory),
  });

  const { data: history } = useQuery({
    queryKey: ["indicator-history", selectedIndicator?.id],
    queryFn: () => (selectedIndicator ? getIndicatorHistory(selectedIndicator.id) : Promise.resolve([])),
    enabled: !!selectedIndicator,
  });

  const historyChartData = useMemo(() => {
    if (!history?.length) return [];
    return [...history].reverse();
  }, [history]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center py-4">
        <h1 className="text-3xl font-extralight tracking-tight text-text-primary mb-1">
          Economic Indicators
        </h1>
        <p className="text-sm font-light text-text-muted">
          Track 30 key macro indicators across five categories
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex justify-center gap-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => { setSelectedCategory(cat); setSelectedIndicator(null); }}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-light transition-all duration-200",
              selectedCategory === cat
                ? "bg-accent/10 text-accent border border-accent/20"
                : "text-text-muted hover:text-text-secondary hover:bg-bg-hover border border-transparent"
            )}
          >
            {cat === "all" ? "All" : CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Indicator list */}
        <div className="lg:col-span-3 card p-0 overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <div className="card-header mb-0">
              {indicators?.length || 0} Indicators
            </div>
          </div>
          <div className="max-h-[650px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#0d0d10]/95 backdrop-blur-sm">
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-text-muted">
                  <th className="pb-2 pl-5 font-medium">Indicator</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium text-right">Value</th>
                  <th className="pb-2 font-medium text-right">Previous</th>
                  <th className="pb-2 font-medium text-right">Z-Score</th>
                  <th className="pb-2 pr-5 font-medium text-center">Trend</th>
                </tr>
              </thead>
              <tbody>
                {indicators?.map((ind) => (
                  <tr
                    key={ind.id}
                    onClick={() => setSelectedIndicator(ind)}
                    className={cn(
                      "cursor-pointer border-b border-border/50 transition-all duration-200",
                      "hover:bg-bg-hover",
                      selectedIndicator?.id === ind.id && "bg-accent/5 border-l-2 border-l-accent"
                    )}
                  >
                    <td className="py-3 pl-5">
                      <div className="font-light text-text-primary">{ind.name}</div>
                      <div className="text-[10px] text-text-muted">{ind.source}</div>
                    </td>
                    <td className="py-3">
                      <span className="text-[10px] uppercase tracking-wider text-text-muted">
                        {ind.indicator_type}
                      </span>
                    </td>
                    <td className="py-3 text-right tabular-nums font-light text-text-secondary">
                      {formatNumber(ind.latest_value)}
                    </td>
                    <td className="py-3 text-right tabular-nums font-light text-text-muted">
                      {ind.previous_value !== null ? formatNumber(ind.previous_value) : "—"}
                    </td>
                    <td className="py-3 text-right tabular-nums font-light">
                      <span className={
                        ind.z_score !== null && ind.z_score > 0 ? "text-accent-green"
                        : ind.z_score !== null && ind.z_score < 0 ? "text-accent-red"
                        : "text-text-muted"
                      }>
                        {ind.z_score !== null ? ind.z_score.toFixed(2) : "—"}
                      </span>
                    </td>
                    <td className={cn("py-3 pr-5 text-center", trendColor(ind.trend))}>
                      {trendArrow(ind.trend)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart panel */}
        <div className="lg:col-span-2 card">
          {selectedIndicator ? (
            <div className="animate-fade-in">
              <div className="card-header">{selectedIndicator.name}</div>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="rounded-lg border border-border bg-bg-card p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Latest</div>
                  <div className="text-lg font-extralight tabular-nums text-text-primary">
                    {formatNumber(selectedIndicator.latest_value)}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-bg-card p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Previous</div>
                  <div className="text-lg font-extralight tabular-nums text-text-secondary">
                    {formatNumber(selectedIndicator.previous_value)}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-bg-card p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Z-Score</div>
                  <div className={cn("text-lg font-extralight tabular-nums",
                    (selectedIndicator.z_score ?? 0) > 0 ? "text-accent-green" : "text-accent-red"
                  )}>
                    {formatNumber(selectedIndicator.z_score, 2)}
                  </div>
                </div>
              </div>
              {selectedIndicator.surprise !== null && selectedIndicator.surprise !== undefined && (
                <div className="mb-5 flex items-center justify-center gap-2 rounded-lg border border-border bg-bg-card px-4 py-2">
                  <span className="text-[10px] uppercase tracking-wider text-text-muted">Surprise</span>
                  <span className={cn(
                    "text-sm tabular-nums font-light",
                    selectedIndicator.surprise > 0 ? "text-accent-green" : selectedIndicator.surprise < 0 ? "text-accent-red" : "text-text-muted"
                  )}>
                    {selectedIndicator.surprise >= 0 ? "+" : ""}{selectedIndicator.surprise.toFixed(2)}
                  </span>
                </div>
              )}

              {historyChartData.length > 0 && (
                <LWChart
                  data={historyChartData}
                  series={[{ key: "value", color: "#a78bfa", label: selectedIndicator.name }]}
                  height={240}
                  periodSelector={false}
                />
              )}
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center">
              <p className="text-sm font-light text-text-muted">
                Select an indicator to view chart
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
