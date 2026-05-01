"use client";

import { useId } from "react";
import Image from "next/image";
import { cn, weightBadgeColor } from "@/lib/utils";
import { NavigatorMatrix } from "@/components/NavigatorMatrix";
import { FedPolicyCard } from "@/components/FedPolicyCard";
import { DashboardAiPanel, MasterAiTiltsNote } from "@/components/DashboardAiPanel";
import type {
  NavigatorRecommendation,
  NavigatorPosition,
  CrossAssetSignal,
  RegimeSnapshot,
  FedPolicyStatus,
  CategoryScore,
  RegimeHistoryPoint,
  IndicatorCategory,
} from "@/types";
const QUADRANT_DISPLAY_LABEL: Record<string, string> = {
  Q1_GOLDILOCKS: "Risk ON",
  Q2_REFLATION: "GROWTH",
  Q3_OVERHEATING: "VALUE",
  Q4_STAGFLATION: "Risk OFF",
};

const REGIME_HEADLINE: Record<string, string> = {
  Q1_GOLDILOCKS: "text-[#49D17D]",
  Q2_REFLATION: "text-[#4F8DF7]",
  Q3_OVERHEATING: "text-[#F2C94C]",
  Q4_STAGFLATION: "text-[#FF5C5C]",
};

const CARD =
  "rounded-[10px] border border-tn-border bg-tn-card p-5 shadow-[0_6px_20px_rgba(0,0,0,0.35)]";

const CATEGORY_LABEL: Record<IndicatorCategory, string> = {
  housing: "Housing",
  orders: "Orders",
  income_sales: "Income / Sales",
  employment: "Employment",
  inflation: "Inflation",
};

const CROSS_ASSETS: { label: string; match: (name: string) => boolean; hint: string }[] = [
  { label: "Gold", match: (n) => n === "Gold", hint: "Safe haven / real rates" },
  { label: "DXY", match: (n) => n.includes("DXY") || n.includes("Dollar"), hint: "Broad USD" },
  { label: "Copper", match: (n) => n === "Copper", hint: "Growth impulse" },
  { label: "VIX", match: (n) => n === "VIX", hint: "Risk pricing" },
  { label: "Yield Curve", match: (n) => n.includes("Yield Curve") || n.includes("2Y10Y"), hint: "2s10s shape" },
  { label: "10Y Real Yield", match: (n) => n.includes("Real Yield") || n.includes("TIPS"), hint: "Financial conditions" },
];

function scoreToUnit(score: number, min: number, max: number) {
  return Math.min(100, Math.max(0, ((score - min) / (max - min)) * 100));
}

function MiniSparkline({ signal }: { signal: "bullish" | "bearish" | "neutral" }) {
  const up = "0,22 12,18 24,14 36,10 48,6 60,4 72,2 84,1 100,0";
  const down = "0,2 12,6 24,10 36,14 48,18 60,20 72,21 84,22 100,24";
  const flat = "0,12 20,11 40,12 60,11 80,12 100,12";
  const pts = signal === "bullish" ? up : signal === "bearish" ? down : flat;
  const stroke =
    signal === "bullish" ? "#63E39A" : signal === "bearish" ? "#FF6B6B" : "#7F8C8D";
  return (
    <svg
      viewBox="0 0 100 24"
      className="h-6 w-20 shrink-0"
      preserveAspectRatio="none"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function ConfidenceSegments({ pct }: { pct: number }) {
  const segments = 10;
  const filled = Math.round((pct / 100) * segments);
  return (
    <div className="mt-4 flex items-center gap-3 border-t border-tn-border pt-4">
      <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-tn-secondary">Confidence</span>
      <div className="flex flex-1 gap-0.5">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={cn("h-2 flex-1 rounded-sm", i < filled ? "bg-tn-positive" : "bg-tn-scale")}
          />
        ))}
      </div>
      <span className="text-[26px] font-medium tabular-nums leading-none text-tn-cream">{pct.toFixed(0)}%</span>
    </div>
  );
}

function QuickSlider({
  label,
  valueLabel,
  unit,
  trend,
}: {
  label: string;
  valueLabel: string;
  unit: number;
  trend: "up" | "down" | "flat";
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[13px] text-tn-secondary">
        <span className="font-medium uppercase tracking-wide">{label}</span>
        <span className="flex items-center gap-1 tabular-nums text-tn-cream">
          {valueLabel}
          {trend === "up" && <span className="text-tn-positive">↑</span>}
          {trend === "down" && <span className="text-tn-negative">↓</span>}
          {trend === "flat" && <span className="text-tn-muted">→</span>}
        </span>
      </div>
      <div className="relative h-1.5 rounded-[3px] bg-tn-scale">
        <div
          className="absolute top-0 h-full rounded-[3px] bg-tn-positive/50"
          style={{ width: `${unit}%` }}
        />
        <div
          className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-tn-card bg-white shadow-sm"
          style={{ left: `${unit}%` }}
        />
      </div>
    </div>
  );
}

function RecessionDonut({ probability, riskLabel }: { probability: number; riskLabel: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const dash = (probability / 100) * c;
  const color = probability < 20 ? "#49D17D" : probability < 40 ? "#F2994A" : "#FF5C5C";
  return (
    <div className={cn(CARD)}>
      <div className="text-sm font-semibold uppercase tracking-wide text-tn-secondary">Recession probability</div>
      <div className="mt-3 flex flex-col items-center">
        <div className="relative h-[70px] w-[70px]">
          <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
            <circle cx="40" cy="40" r={r} fill="none" stroke="#2A3037" strokeWidth="8" />
            <circle
              cx="40"
              cy="40"
              r={r}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[26px] font-semibold tabular-nums leading-none text-tn-cream">
              {probability.toFixed(0)}%
            </span>
          </div>
        </div>
        <span className="mt-2 text-[11px] font-medium uppercase tracking-wide text-tn-positive">{riskLabel}</span>
        <p className="mt-1 text-[11px] text-tn-muted">12-month horizon · ensemble snapshot</p>
      </div>
    </div>
  );
}

function MicroCycleArea({ series }: { series: { v: number }[] }) {
  const gid = useId();
  if (series.length < 2) {
    return <div className="h-[60px] w-full rounded-md bg-tn-scale/40" />;
  }
  const vals = series.map((x) => x.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const w = 100;
  const h = 60;
  const linePts = vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - ((v - min) / (max - min + 1e-9)) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  const areaPts = `0,${h} ${linePts} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[60px] w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(73,209,125,0.3)" />
          <stop offset="100%" stopColor="rgba(73,209,125,0)" />
        </linearGradient>
      </defs>
      <polygon points={areaPts} fill={`url(#${gid})`} />
      <polyline points={linePts} fill="none" stroke="#63E39A" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function AllocationDonut({
  equities_pct,
  bonds_pct,
  commodities_pct,
  gold_pct,
  cash_pct,
}: {
  equities_pct: number;
  bonds_pct: number;
  commodities_pct: number;
  gold_pct: number;
  cash_pct: number;
}) {
  const segs = [
    { pct: equities_pct, color: "#49D17D" },
    { pct: bonds_pct, color: "#5DA9FF" },
    { pct: commodities_pct, color: "#F2C94C" },
    { pct: gold_pct, color: "#A78BFA" },
    { pct: cash_pct, color: "#9AA1A9" },
  ].filter((s) => s.pct > 0);
  let start = 0;
  const gradient = segs
    .map((s) => {
      const a = start;
      start += s.pct;
      return `${s.color} ${a}% ${start}%`;
    })
    .join(", ");
  return (
    <div
      className="mx-auto h-[120px] w-[120px] shrink-0 rounded-full border border-tn-border"
      style={{
        background: `conic-gradient(${gradient})`,
      }}
    />
  );
}

export interface NavigatorMainGridProps {
  nav: NavigatorRecommendation;
  navHistory?: NavigatorPosition[];
  navForward?: NavigatorPosition[];
  regime: RegimeSnapshot | undefined;
  signals: CrossAssetSignal[];
  fedStatus: FedPolicyStatus | undefined;
  categories: CategoryScore[] | undefined;
  cycleTimeline: RegimeHistoryPoint[];
  riskComposite: number;
  riskLabel: string;
  riskComponents: { name: string; direction: string; signal: string }[];
}

export function NavigatorMainGrid({
  nav,
  navHistory,
  navForward,
  regime,
  signals,
  fedStatus,
  categories,
  cycleTimeline,
  riskComposite,
  riskLabel,
  riskComponents,
}: NavigatorMainGridProps) {
  const growth = nav.position.growth_score;
  const fed = fedStatus?.policy_score ?? nav.position.fed_policy_score;
  const confidencePct = nav.position.confidence * 100;

  const macroUnit = scoreToUnit(growth, -2, 2);
  const fedUnit = scoreToUnit(fed, -2, 2);
  const recProb = regime?.recession_prob_12m ?? 0;
  const recUnit = Math.min(100, Math.max(0, recProb));
  const cycleUnit = regime ? scoreToUnit(regime.cycle_score, -100, 100) : 50;

  const cycleZ = regime ? (regime.cycle_score / 100).toFixed(2) : "—";
  const cycleSeries = cycleTimeline.map((p) => ({ v: p.cycle_score }));

  const regimeTitle =
    QUADRANT_DISPLAY_LABEL[nav.position.quadrant] ?? nav.position.quadrant.replace(/_/g, " ");
  const regimeTint =
    REGIME_HEADLINE[nav.position.quadrant] ?? "text-tn-cream";

  const recRiskWord = recProb < 20 ? "LOW RISK" : recProb < 40 ? "ELEVATED" : "HIGH RISK";

  const stanceWord =
    fedStatus?.stance === "neutral"
      ? "MODERATE"
      : fedStatus?.stance?.includes("tight")
        ? "TIGHT"
        : "ACCOMMODATIVE";

  return (
    <div className="space-y-6 px-8 pb-8 pt-7 font-sans">
      <DashboardAiPanel variant="navigator" />

      <div className="grid grid-cols-12 gap-6">
        {/* Macro Navigator + confidence */}
        <div className={cn("col-span-12 flex h-[420px] flex-col lg:col-span-6", CARD)}>
          <NavigatorMatrix
            title="MACRO NAVIGATOR"
            position={nav.position}
            history={navHistory}
            forward={navForward}
            large
            className="bg-transparent p-0"
            ensembleCaption={
              nav.ensemble
                ? `Forecast Lab · ${QUADRANT_DISPLAY_LABEL[nav.ensemble.phase_class] ?? nav.ensemble.phase_class} · ${(nav.ensemble.confidence * 100).toFixed(0)}% · ${nav.ensemble.as_of_date}`
                : null
            }
            ensembleMix={
              nav.ensemble?.mix_growth_score != null && nav.ensemble?.mix_fed_policy_score != null
                ? { growth: nav.ensemble.mix_growth_score, fed: nav.ensemble.mix_fed_policy_score }
                : null
            }
          />
          <ConfidenceSegments pct={confidencePct} />
        </div>

        {/* Cross-asset */}
        <div className={cn("col-span-12 h-[420px] lg:col-span-4", CARD)}>
          <div className="mb-4 text-sm font-semibold uppercase tracking-wide text-tn-secondary">
            Cross-asset signals
          </div>
          <div className="divide-y divide-tn-border">
            {CROSS_ASSETS.map((row) => {
              const sig =
                signals.find((s) => row.match(s.name)) ?? ({ name: row.label, signal: "neutral", value: null, description: "" } as CrossAssetSignal);
              const badge =
                sig.signal === "bullish"
                  ? "BULLISH"
                  : sig.signal === "bearish"
                    ? "BEARISH"
                    : "NEUTRAL";
              const badgeCls =
                sig.signal === "bullish"
                  ? "border-transparent bg-[rgba(73,209,125,0.15)] text-[#49D17D]"
                  : sig.signal === "bearish"
                    ? "border-transparent bg-[rgba(255,92,92,0.15)] text-[#FF5C5C]"
                    : "border-tn-border bg-tn-scale/50 text-tn-muted";
              const pct =
                sig.value != null
                  ? `${sig.value >= 0 ? "+" : ""}${sig.value.toFixed(1)}${sig.name.includes("Yield") ? " bp" : "%"}`
                  : "—";
              return (
                <div key={row.label} className="flex min-h-[48px] items-center gap-3 py-1 first:pt-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-tn-cream">{row.label}</div>
                    <div className="truncate text-[11px] text-tn-muted">{row.hint}</div>
                  </div>
                  <div className="flex shrink-0 justify-end">
                    <MiniSparkline signal={sig.signal} />
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
                      badgeCls
                    )}
                  >
                    {badge}
                  </span>
                  <span className="w-14 shrink-0 text-right font-mono text-[13px] tabular-nums text-tn-secondary">
                    {pct}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick view */}
        <div className={cn("col-span-12 h-[420px] lg:col-span-2", CARD)}>
          <div className="mb-4 text-sm font-semibold uppercase tracking-wide text-tn-secondary">Quick view</div>
          <div className="space-y-6">
            <QuickSlider
              label="Macro sentiment"
              valueLabel={growth.toFixed(2)}
              unit={macroUnit}
              trend={growth > 0.1 ? "up" : growth < -0.1 ? "down" : "flat"}
            />
            <QuickSlider
              label="Fed policy"
              valueLabel={fed.toFixed(2)}
              unit={fedUnit}
              trend={fed > 0.1 ? "up" : fed < -0.1 ? "down" : "flat"}
            />
            <QuickSlider
              label="Recession prob"
              valueLabel={`${recProb.toFixed(0)}%`}
              unit={recUnit}
              trend={recProb > 35 ? "up" : recProb < 15 ? "down" : "flat"}
            />
            <QuickSlider
              label="Cycle score"
              valueLabel={regime ? regime.cycle_score.toFixed(0) : "—"}
              unit={cycleUnit}
              trend={regime && regime.cycle_score > 10 ? "up" : regime && regime.cycle_score < -10 ? "down" : "flat"}
            />
          </div>
        </div>
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 h-[230px] lg:col-span-3">
          <RecessionDonut probability={recProb} riskLabel={recRiskWord} />
          {regime && regime.recession_models.length > 0 ? (
            <div className="mt-3 rounded-[10px] border border-tn-border bg-tn-canvas/50 p-3 text-[11px] text-tn-muted">
              {regime.recession_models.slice(0, 3).map((m) => (
                <div key={m.name} className="flex justify-between gap-2 border-b border-white/[0.04] py-1 last:border-0">
                  <span className="truncate">{m.name}</span>
                  <span className="tabular-nums text-tn-cream">{m.probability.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className={cn("col-span-12 h-[230px] lg:col-span-3", CARD)}>
          <div className="text-sm font-semibold uppercase tracking-wide text-tn-secondary">Economic cycle score</div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-[26px] font-semibold tabular-nums text-tn-cream">{cycleZ}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-tn-positive">Z-score</span>
          </div>
          <MicroCycleArea series={cycleSeries.length ? cycleSeries : [{ v: 0 }, { v: 1 }]} />
          {categories && categories.length > 0 ? (
            <div className="mt-4 space-y-2 border-t border-tn-border pt-4">
              {categories.slice(0, 5).map((c) => (
                <div key={c.category} className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-tn-muted">{CATEGORY_LABEL[c.category]}</span>
                  <div className="h-5 w-16 opacity-80">
                    <MiniSparkline
                      signal={c.color === "green" ? "bullish" : c.color === "red" ? "bearish" : "neutral"}
                    />
                  </div>
                  <span className="w-10 text-right font-mono text-[10px] tabular-nums text-tn-cream">
                    {c.score.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="col-span-12 h-[230px] lg:col-span-3">
          {fedStatus ? (
            <FedPolicyCard
              status={fedStatus}
              className={cn(CARD, "!shadow-none")}
            />
          ) : (
            <div className={cn(CARD, "text-[13px] text-tn-muted")}>
              Fed policy data unavailable.
            </div>
          )}
          {fedStatus ? (
            <p className="mt-2 font-mono text-[9px] leading-relaxed text-tn-muted">
              Stance reads as{" "}
              <span className="text-tn-cream">{stanceWord}</span> · Rate direction:{" "}
              <span className="uppercase text-tn-cream">{fedStatus.rate_direction}</span> · Balance sheet:{" "}
              {fedStatus.balance_sheet_direction === "shrinking" ? "QT" : "QE / stable"}
            </p>
          ) : null}
        </div>

        <div className={cn("col-span-12 h-[230px] overflow-hidden lg:col-span-3", CARD, "p-0")}>
          <div className="flex h-full min-h-[220px]">
            <div className="flex flex-1 flex-col justify-between p-5">
              <div className="text-sm font-semibold uppercase tracking-wide text-tn-secondary">Active regime</div>
              <div>
                <div className={cn("font-sans text-[32px] font-bold uppercase leading-tight tracking-tight", regimeTint)}>
                  {regimeTitle}
                </div>
                <p className="mt-2 font-mono text-[10px] text-tn-muted">
                  Navigator quadrant · {nav.position.quadrant.replace(/_/g, " ")}
                </p>
                <p className="mt-1 font-mono text-[9px] text-tn-muted">
                  Composite {riskComposite.toFixed(2)} · {riskLabel}
                </p>
              </div>
              <ul className="space-y-1.5 font-mono text-[10px] text-tn-cream/90">
                {(riskComponents.length ? riskComponents : [{ name: "Signals", direction: "—", signal: "neutral" }]).map(
                  (c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-tn-positive">▸</span>
                      <span>
                        {c.name}: <span className="text-tn-muted">{c.direction}</span>
                      </span>
                    </li>
                  )
                )}
              </ul>
            </div>
            <div className="relative hidden w-[38%] shrink-0 sm:block">
              <Image
                src="/navigator-hero.png"
                alt=""
                fill
                className="object-cover object-center opacity-[0.15]"
                sizes="200px"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-r from-tn-panel via-tn-panel/40 to-transparent" />
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations snapshot */}
      <div id="recs" className={cn(CARD, "h-[210px]")}>
        <div className="mb-5 text-sm font-semibold uppercase tracking-wide text-tn-secondary">
          Recommendations snapshot
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-6 lg:col-span-2">
            <div className="font-mono text-[9px] uppercase tracking-wider text-tn-muted">Factor tilts</div>
            <ul className="mt-2 space-y-2">
              {nav.factor_tilts.map((f) => (
                <li key={f.factor} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-tn-cream">{f.factor}</span>
                  <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[8px]", weightBadgeColor(f.weight))}>
                    {f.weight}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="col-span-12 md:col-span-6 lg:col-span-3">
            <div className="font-mono text-[9px] uppercase tracking-wider text-tn-muted">Sector allocation</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {nav.sector_allocations.map((s) => (
                <span
                  key={s.sector}
                  className={cn(
                    "rounded border px-2 py-1 font-mono text-[9px]",
                    weightBadgeColor(s.weight),
                    "border-current/30"
                  )}
                >
                  {s.sector}: {s.weight}
                </span>
              ))}
            </div>
          </div>
          <div className="col-span-12 md:col-span-6 lg:col-span-2">
            <div className="font-mono text-[9px] uppercase tracking-wider text-tn-muted">Asset allocation</div>
            <div className="mt-3 flex flex-col items-center gap-2">
              <AllocationDonut {...nav.asset_allocation} />
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 font-mono text-[9px] text-tn-muted">
                {nav.asset_allocation.equities_pct > 0 ? (
                  <span>
                    <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#49D17D]" />
                    Eq {nav.asset_allocation.equities_pct}%
                  </span>
                ) : null}
                {nav.asset_allocation.bonds_pct > 0 ? (
                  <span>
                    <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#5DA9FF]" />
                    Fi {nav.asset_allocation.bonds_pct}%
                  </span>
                ) : null}
                {nav.asset_allocation.commodities_pct > 0 ? (
                  <span>
                    <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#F2C94C]" />
                    Cmdty {nav.asset_allocation.commodities_pct}%
                  </span>
                ) : null}
                {nav.asset_allocation.gold_pct > 0 ? (
                  <span>
                    <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#A78BFA]" />
                    Gold {nav.asset_allocation.gold_pct}%
                  </span>
                ) : null}
                {nav.asset_allocation.cash_pct > 0 ? (
                  <span>
                    <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#9AA1A9]" />
                    Cash {nav.asset_allocation.cash_pct}%
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="col-span-12 md:col-span-6 lg:col-span-2">
            <div className="font-mono text-[9px] uppercase tracking-wider text-tn-muted">Geography</div>
            <div className="mt-4 space-y-2">
              {Object.entries(nav.geographic).map(([region, weight]) => {
                const w = parseFloat(weight.replace(/[^0-9.-]/g, "")) || 0;
                return (
                  <div key={region}>
                    <div className="mb-0.5 flex justify-between font-mono text-[10px] text-tn-cream">
                      <span>{region}</span>
                      <span>{weight}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-tn-scale">
                      <div className="h-full rounded-full bg-tn-positive" style={{ width: `${Math.min(100, w)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="col-span-12 lg:col-span-3">
            <div className="font-mono text-[9px] uppercase tracking-wider text-tn-muted">Trading ideas</div>
            <ul className="mt-2 space-y-2">
              {(nav.trading_recommendations ?? []).slice(0, 6).map((t) => (
                <li key={t.name} className="rounded-[10px] border border-tn-border bg-tn-canvas/40 px-3 py-2">
                  <div className="text-[11px] text-tn-cream">{t.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1 font-mono text-[9px]">
                    <span className="rounded bg-tn-positive/20 px-1.5 py-0.5 text-tn-positive">Relative</span>
                    <span className="text-tn-muted">{t.legs}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <MasterAiTiltsNote />
      </div>

      {nav.phase_context ? (
        <div className="rounded-[10px] border border-tn-border bg-tn-canvas/60 px-5 py-4 text-[13px] text-tn-muted">
          Yield curve (PIT):{" "}
          <span className="text-tn-cream">{nav.phase_context.curve_pattern}</span> · {nav.phase_context.curve_description}
        </div>
      ) : null}
    </div>
  );
}
