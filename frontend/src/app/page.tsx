"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getRegimeCurrent,
  getRegimeHistory,
  getRecessionBands,
  getNavigatorRecommendation,
  getNavigatorHistory,
  getNavigatorForward,
  getCrossAssetSignals,
  getRecessionCheck,
  getCategoryScores,
  getFedStatus,
} from "@/lib/api";
import { getForecastLabSummary } from "@/lib/forecastLabApi";
import { useRelativeTime } from "@/lib/useRelativeTime";
import { NavigatorTerminalChrome, NavigatorTerminalHeader } from "@/components/trading-navigator/NavigatorTerminalChrome";
import { NavigatorMainGrid } from "@/components/trading-navigator/NavigatorMainGrid";
import { RadarKpiBar } from "@/components/RadarKpiBar";
import { CycleGauge } from "@/components/CycleGauge";
import { RecessionPanel } from "@/components/RecessionPanel";
import { PhaseSignals } from "@/components/PhaseSignals";
import { TacticalAllocation } from "@/components/TacticalAllocation";
import { LightFCICard } from "@/components/LightFCI";
import { DashboardAiPanel } from "@/components/DashboardAiPanel";
import LWChart from "@/components/LWChart";
import { cn } from "@/lib/utils";
import type { RegimeHistoryPoint } from "@/types";

const PHASE_COLORS: Record<string, string> = {
  expansion: "#10b981",
  recovery: "#3b82f6",
  slowdown: "#f59e0b",
  contraction: "#ef4444",
};
const QUADRANT_DISPLAY_LABEL: Record<string, string> = {
  Q1_GOLDILOCKS: "Risk ON",
  Q2_REFLATION: "GROWTH",
  Q3_OVERHEATING: "VALUE",
  Q4_STAGFLATION: "Risk OFF",
};

export default function DashboardPage() {
  const [tab, setTab] = useState<"navigator" | "radar">("navigator");

  const { data: regime, isLoading: regimeLoading, isFetching: regimeFetching } = useQuery({
    queryKey: ["regime-current"],
    queryFn: getRegimeCurrent,
  });
  const { data: history } = useQuery({
    queryKey: ["regime-history"],
    queryFn: () => getRegimeHistory(60),
  });
  const { data: recessionBands } = useQuery({
    queryKey: ["recession-bands"],
    queryFn: getRecessionBands,
  });
  const { data: nav } = useQuery({
    queryKey: ["navigator"],
    queryFn: getNavigatorRecommendation,
  });
  const { data: navHistory } = useQuery({
    queryKey: ["navigator-history"],
    queryFn: getNavigatorHistory,
  });
  const { data: navForward } = useQuery({
    queryKey: ["navigator-forward"],
    queryFn: getNavigatorForward,
  });
  const { data: signals } = useQuery({
    queryKey: ["cross-asset-signals"],
    queryFn: getCrossAssetSignals,
  });
  const { data: recession } = useQuery({
    queryKey: ["recession-check"],
    queryFn: getRecessionCheck,
  });
  const { data: categories } = useQuery({
    queryKey: ["category-scores"],
    queryFn: getCategoryScores,
  });
  const { data: fedStatus } = useQuery({
    queryKey: ["fed-status"],
    queryFn: getFedStatus,
  });
  const { data: flSummary } = useQuery({
    queryKey: ["forecast-lab-summary", "dashboard", true],
    queryFn: () => getForecastLabSummary({ alignMonthEnd: true }),
    staleTime: 120_000,
  });

  const timelineData = useMemo(() => {
    if (!history?.length) return [];
    return history.map((p: RegimeHistoryPoint) => ({ date: p.date, cycle_score: p.cycle_score }));
  }, [history]);

  const recProbData = useMemo(() => {
    if (!history?.length) return [];
    return history.map((p: RegimeHistoryPoint) => ({ date: p.date, recession_prob: p.recession_prob }));
  }, [history]);

  const riskOnOffData = useMemo(() => {
    if (!signals?.length) return { compositeScore: 0, label: "Neutral", components: [] };
    let sum = 0;
    const components: { name: string; direction: string; arrow: "up" | "down" | "flat"; signal: "risk_on" | "risk_off" | "neutral" }[] = [];
    const mapping: { key: string; name: string }[] = [
      { key: "Yield Curve (2Y10Y)", name: "Credit Spreads" },
      { key: "VIX", name: "VIX" },
      { key: "10Y Real Yield", name: "Equity Momentum" },
      { key: "Gold", name: "FCI" },
    ];
    mapping.forEach(({ key, name }) => {
      const s = signals.find((x) => x.name === key) || signals.find((x) => x.name === "Dollar (DXY)");
      if (!s) return;
      const signalType = s.signal === "bullish" ? "risk_on" : s.signal === "bearish" ? "risk_off" : "neutral";
      const arrow: "up" | "down" | "flat" = s.value != null && s.value > 0 ? "up" : s.value != null && s.value < 0 ? "down" : "flat";
      if (key === "VIX") {
        sum += s.signal === "bearish" ? -1 : s.signal === "bullish" ? 1 : 0;
        components.push({ name: "VIX", direction: s.value != null ? ` ${s.value.toFixed(1)}` : "elevated", arrow: "flat", signal: signalType });
      } else {
        sum += s.signal === "bullish" ? 1 : s.signal === "bearish" ? -1 : 0;
        components.push({
          name: name === "Credit Spreads" ? "Credit Spreads" : name,
          direction: s.signal === "bullish" ? "tightening" : s.signal === "bearish" ? "widening" : "stable",
          arrow,
          signal: signalType,
        });
      }
    });
    const compositeScore = components.length ? (sum / components.length) * 2 : 0;
    const label = compositeScore > 0.5 ? "Mild Risk On" : compositeScore < -0.5 ? "Mild Risk Off" : "Neutral";
    return { compositeScore, label, components: components.slice(0, 4) };
  }, [signals]);

  const lastUpdatedLabel = useRelativeTime(regime?.timestamp);

  const isLoading = regimeLoading && !regime && !nav;

  if (isLoading) {
    return (
      <NavigatorTerminalChrome dataAsOf={null}>
        <NavigatorTerminalHeader tab={tab} onTabChange={setTab} lastUpdatedLabel="—" />
        <div className="flex min-h-[50vh] flex-1 items-center justify-center font-mono text-sm text-tn-muted">
          Loading macro data…
        </div>
      </NavigatorTerminalChrome>
    );
  }

  return (
    <NavigatorTerminalChrome dataAsOf={regime?.timestamp ?? null}>
      <NavigatorTerminalHeader tab={tab} onTabChange={setTab} lastUpdatedLabel={lastUpdatedLabel} />
      <div className="flex-1 overflow-y-auto">
        {tab === "navigator" && nav && (
          <NavigatorMainGrid
            nav={nav}
            navHistory={navHistory}
            navForward={navForward}
            regime={regime}
            signals={signals ?? []}
            fedStatus={fedStatus}
            categories={categories}
            cycleTimeline={history ?? []}
            riskComposite={riskOnOffData.compositeScore}
            riskLabel={riskOnOffData.label}
            riskComponents={riskOnOffData.components.map((c) => ({
              name: c.name,
              direction: c.direction,
              signal: c.signal,
            }))}
          />
        )}
        {tab === "navigator" && !nav && (
          <div className="p-10 text-center font-mono text-sm text-tn-muted">
            Navigator recommendation unavailable.
          </div>
        )}

      {tab === "radar" && (
        <>
          <DashboardAiPanel variant="radar" />
          {regime ? (
            <>
          <RadarKpiBar
            currentPhase={regime.phase_label}
            phaseColor={PHASE_COLORS[regime.phase] ?? "#6b7280"}
            cycleScore={regime.cycle_score}
            recessionProb12m={regime.recession_prob_12m}
            fciScore={regime.fci_score}
            dataCoveragePct={regime.data_completeness * 100}
          />
          {flSummary ? (
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.05] px-4 py-3 text-sm font-light">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-violet-200/90">
                  Forecast Lab reference
                </span>
                <span className="text-[10px] text-text-muted font-mono">
                  {flSummary.as_of_date} · {flSummary.bundle_id.slice(0, 8)}…
                </span>
              </div>
              <p className="text-[11px] text-text-muted mb-3 leading-snug">
                Month-end quadrant ensemble (macro features). This is not the cycle phase below — different model and
                as-of date. Recession % here uses the FL GBDT or NBER snapshot; the gauge uses the cycle stack.
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-text-secondary">
                <span>
                  <span className="text-text-muted">Phase </span>
                  <span className="text-text-primary">
                    {QUADRANT_DISPLAY_LABEL[flSummary.phase_class] ?? flSummary.phase_class}
                  </span>
                  <span className="text-text-muted text-[11px] ml-1">
                    ({(flSummary.confidence * 100).toFixed(0)}% conf)
                  </span>
                </span>
                <span
                  className="tabular-nums text-[12px]"
                  title="Те же четыре квадранта, что в Forecast Lab: Q1=Risk ON, Q2=GROWTH, Q3=VALUE, Q4=Risk OFF"
                >
                  {QUADRANT_DISPLAY_LABEL["Q1_GOLDILOCKS"]}{" "}
                  {(flSummary.phase_probabilities.Q1_GOLDILOCKS * 100).toFixed(0)}% ·{" "}
                  {QUADRANT_DISPLAY_LABEL["Q2_REFLATION"]} {(flSummary.phase_probabilities.Q2_REFLATION * 100).toFixed(0)}% ·{" "}
                  {QUADRANT_DISPLAY_LABEL["Q3_OVERHEATING"]} {(flSummary.phase_probabilities.Q3_OVERHEATING * 100).toFixed(0)}% ·{" "}
                  {QUADRANT_DISPLAY_LABEL["Q4_STAGFLATION"]}{" "}
                  {(flSummary.phase_probabilities.Q4_STAGFLATION * 100).toFixed(0)}%
                </span>
                <span>
                  <span className="text-text-muted">Anomaly </span>
                  <span className="capitalize">{flSummary.stress.stress_band}</span>
                </span>
                <span>
                  <span className="text-text-muted">FL rec. 12m </span>
                  {flSummary.recession_prob_12m != null
                    ? `${(flSummary.recession_prob_12m * 100).toFixed(0)}%`
                    : "N/A"}
                </span>
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[9fr_11fr]">
            <CycleGauge score={regime.cycle_score} phase={regime.phase} phaseLabel={regime.phase_label} size="large" />
            <RecessionPanel
              probability={regime.recession_prob_12m}
              models={regime.recession_models}
              drivers={regime.top_drivers}
            />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {timelineData.length > 0 && (
              <div className="card">
                <div className="card-header">Cycle Score Timeline</div>
                <LWChart
                  data={timelineData}
                  series={[{ key: "cycle_score", label: "Cycle Score", color: "#3b82f6", type: "line" }]}
                  thresholds={[
                    { value: 0, color: "#6b7280", label: "Neutral" },
                    { value: 20, color: "#10b981", label: "Expansion" },
                    { value: -20, color: "#f59e0b", label: "Slowdown" },
                  ]}
                  recessionBands={recessionBands}
                  height={260}
                />
              </div>
            )}
            {recProbData.length > 0 && (
              <div className="card">
                <div className="card-header">Recession Probability History</div>
                <LWChart
                  data={recProbData}
                  series={[{ key: "recession_prob", label: "Recession Prob %", color: "#ef4444", type: "area" }]}
                  thresholds={[
                    { value: 20, color: "#f59e0b", label: "Elevated" },
                    { value: 40, color: "#ef4444", label: "High Risk" },
                  ]}
                  recessionBands={recessionBands}
                  height={260}
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <LightFCICard
                score={regime.fci_score}
                gdpImpact={regime.fci_gdp_impact}
                components={regime.fci_components}
              />
            </div>
            <div className="lg:col-span-3">
              {recession && (
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <span className="card-header mb-0">Recession Checklist</span>
                    <span
                      className={cn(
                        "badge text-[10px]",
                        recession.confidence === "high"
                          ? "bg-accent-red/10 text-accent-red border-accent-red/20"
                          : recession.confidence === "moderate"
                            ? "bg-accent-amber/10 text-accent-amber border-accent-amber/20"
                            : "bg-accent-green/10 text-accent-green border-accent-green/20"
                      )}
                    >
                      {recession.score}/{recession.total} — {recession.confidence}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {recession.items.map((item) => (
                      <div
                        key={item.name}
                        className={cn(
                          "flex flex-col gap-1 rounded-lg border px-4 py-3",
                          item.triggered ? "border-accent-red/20 bg-accent-red/5" : "border-border bg-bg-card"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn("h-2 w-2 shrink-0 rounded-full mt-1.5", item.triggered ? "bg-accent-red" : "bg-accent-green")} />
                            <div className="min-w-0">
                              <div className="text-sm font-light text-text-primary">{item.name}</div>
                              <div className="text-[10px] text-text-muted">{item.threshold}</div>
                              {item.data_as_of ? (
                                <div className="text-[10px] text-text-muted/80 mt-0.5">Data as of {item.data_as_of}</div>
                              ) : null}
                            </div>
                          </div>
                          <span className="text-sm font-light tabular-nums text-text-secondary shrink-0">{item.current_value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs font-light text-text-muted">
                    5+ of 8 triggers for high-confidence recession call. Typical lead: 6–12 months.
                  </p>
                </div>
              )}
            </div>
          </div>
          {regime.phase_signals?.length > 0 && <PhaseSignals signals={regime.phase_signals} />}
          <div className="card">
            <div className="card-header">Tactical Asset Allocation by Cycle Phase</div>
            <TacticalAllocation
              allocation={regime.tactical_allocation}
              expectedReturns={regime.expected_returns}
              currentPhase={regime.phase}
            />
          </div>
          {regime.top_drivers?.length > 0 && (
            <div className="card">
              <div className="card-header">Cycle Score — Full Driver Attribution</div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-text-muted text-xs uppercase tracking-wider border-b border-border">
                      <th className="pb-2 text-left font-medium">Variable</th>
                      <th className="pb-2 text-right font-medium">Raw</th>
                      <th className="pb-2 text-right font-medium">Normalized</th>
                      <th className="pb-2 text-right font-medium">Weight</th>
                      <th className="pb-2 text-right font-medium">Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regime.top_drivers.map((d) => (
                      <tr key={d.name} className="border-b border-border/30">
                        <td className="py-2 text-text-primary font-light">{d.name}</td>
                        <td className="py-2 text-right tabular-nums text-text-secondary">
                          {d.raw_value !== null ? d.raw_value.toFixed(2) : "N/A"}
                        </td>
                        <td
                          className={cn(
                            "py-2 text-right tabular-nums font-medium",
                            d.normalized > 0 ? "text-accent-green" : d.normalized < 0 ? "text-accent-red" : "text-text-muted"
                          )}
                        >
                          {(d.normalized >= 0 ? "+" : "") + d.normalized.toFixed(3)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-text-muted">{(d.weight * 100).toFixed(0)}%</td>
                        <td
                          className={cn(
                            "py-2 text-right tabular-nums font-medium",
                            d.contribution > 0 ? "text-accent-green" : d.contribution < 0 ? "text-accent-red" : "text-text-muted"
                          )}
                        >
                          {(d.contribution >= 0 ? "+" : "") + d.contribution.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
            </>
          ) : regimeLoading || regimeFetching ? (
            <div className="rounded-lg border border-border bg-bg-card px-4 py-6 text-sm font-light text-text-muted text-center">
              Loading cycle radar…
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-bg-card px-4 py-6 text-sm font-light text-text-muted text-center">
              Cycle radar data unavailable.
            </div>
          )}
        </>
      )}
      </div>
    </NavigatorTerminalChrome>
  );
}
