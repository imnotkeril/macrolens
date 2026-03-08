"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getNavigatorRecommendation, getCategoryScores, getFedStatus,
  getYieldCurve, getCrossAssetSignals, getRecessionCheck,
} from "@/lib/api";
import { cn, CATEGORY_LABELS, trendArrow, trendColor } from "@/lib/utils";

export default function ReportsPage() {
  const { data: nav } = useQuery({ queryKey: ["navigator"], queryFn: getNavigatorRecommendation });
  const { data: categories } = useQuery({ queryKey: ["category-scores"], queryFn: getCategoryScores });
  const { data: fed } = useQuery({ queryKey: ["fed-status"], queryFn: getFedStatus });
  const { data: yieldCurve } = useQuery({ queryKey: ["yield-curve"], queryFn: getYieldCurve });
  const { data: signals } = useQuery({ queryKey: ["cross-asset-signals"], queryFn: getCrossAssetSignals });
  const { data: recession } = useQuery({ queryKey: ["recession-check"], queryFn: getRecessionCheck });

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-end justify-between py-4">
        <div>
          <h1 className="text-3xl font-extralight tracking-tight text-text-primary mb-1">
            MacroLens Report
          </h1>
          <p className="text-sm font-light text-text-muted">Weekly macro summary</p>
        </div>
        <span className="text-xs text-text-muted">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </span>
      </div>

      {/* Executive summary */}
      <div className="card">
        <div className="card-header">Executive Summary</div>
        {nav && fed && (
          <div className="space-y-3 text-sm font-light text-text-secondary">
            <p>
              <span className="text-text-muted">Regime:</span>{" "}
              <span className="text-accent font-medium">{nav.position.quadrant_label}</span>{" "}
              (Sentiment {nav.position.growth_score.toFixed(2)}, Fed {nav.position.fed_policy_score.toFixed(2)})
            </p>
            <p>
              <span className="text-text-muted">Policy:</span>{" "}
              {fed.stance.replace("_", " ")} — Rate {fed.current_rate_lower.toFixed(2)}%–{fed.current_rate_upper.toFixed(2)}%,{" "}
              Direction: {fed.rate_direction}, Balance Sheet: {fed.balance_sheet_direction}
            </p>
            <p>
              <span className="text-text-muted">Confidence:</span>{" "}
              {(nav.position.confidence * 100).toFixed(0)}% — Direction: {nav.position.direction}
            </p>
          </div>
        )}
      </div>

      {/* Category scores */}
      <div className="card">
        <div className="card-header">Economic Indicators</div>
        {categories && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-text-muted">
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium text-right">Score</th>
                <th className="pb-2 font-medium text-center">Trend</th>
                <th className="pb-2 font-medium text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.category} className="border-b border-border/50">
                  <td className="py-2.5 font-light text-text-primary">{CATEGORY_LABELS[cat.category]}</td>
                  <td className="py-2.5 text-right tabular-nums font-light">
                    <span className={cat.score >= 0 ? "text-accent-green" : "text-accent-red"}>
                      {cat.score >= 0 ? "+" : ""}{cat.score.toFixed(2)}
                    </span>
                  </td>
                  <td className={cn("py-2.5 text-center", trendColor(cat.trend))}>
                    {trendArrow(cat.trend)}
                  </td>
                  <td className="py-2.5 text-right text-text-muted">{cat.indicator_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Spreads */}
      <div className="card">
        <div className="card-header">Yield Curve</div>
        {yieldCurve && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {yieldCurve.spreads.map((s) => (
              <div
                key={s.name}
                className={cn(
                  "rounded-lg border p-3 text-center",
                  s.is_inverted ? "border-accent-red/20 bg-accent-red/5" : "border-border bg-bg-card"
                )}
              >
                <div className="text-[10px] uppercase tracking-wider text-text-muted">{s.name.replace("_", " ")}</div>
                <div className={cn("text-lg font-extralight tabular-nums mt-1",
                  s.is_inverted ? "text-accent-red" : "text-text-primary"
                )}>
                  {s.value >= 0 ? "+" : ""}{s.value.toFixed(1)}bp
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Signals */}
      <div className="card">
        <div className="card-header">Cross-Asset Signals</div>
        {signals && (
          <div className="space-y-2">
            {signals.map((s) => (
              <div key={s.name} className="flex items-start gap-3 text-sm">
                <div className={cn(
                  "mt-1.5 h-1.5 w-1.5 rounded-full shrink-0",
                  s.signal === "bullish" ? "bg-accent-green" : s.signal === "bearish" ? "bg-accent-red" : "bg-accent-amber"
                )} />
                <div>
                  <span className="font-medium text-text-primary">{s.name}: </span>
                  <span className="font-light text-text-secondary">{s.description}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recession */}
      {recession && (
        <div className="card">
          <div className="card-header">
            Recession Risk: {recession.score}/{recession.total} — {recession.confidence}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {recession.items.map((item) => (
              <div
                key={item.name}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5",
                  item.triggered ? "border-accent-red/20 bg-accent-red/5" : "border-border bg-bg-card"
                )}
              >
                <div className={cn("h-1.5 w-1.5 rounded-full shrink-0",
                  item.triggered ? "bg-accent-red" : "bg-accent-green"
                )} />
                <span className="text-sm font-light text-text-primary">{item.name}</span>
                <span className="ml-auto text-xs tabular-nums text-text-muted">{item.current_value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tilts */}
      {nav && (
        <div className="card">
          <div className="card-header">Recommended Tilts — {nav.position.quadrant_label}</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(["overweight", "neutral", "underweight"] as const).map((w) => {
              const items = nav.factor_tilts.filter((f) => f.weight === w);
              const color = w === "overweight" ? "text-accent-green" : w === "underweight" ? "text-accent-red" : "text-accent-amber";
              return (
                <div key={w}>
                  <h4 className={cn("text-[10px] font-medium uppercase tracking-wider mb-2", color)}>
                    {w}
                  </h4>
                  <ul className="space-y-1">
                    {items.map((f) => (
                      <li key={f.factor} className="text-sm font-light text-text-secondary">
                        {f.factor}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
