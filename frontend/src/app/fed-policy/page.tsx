"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getFedStatus,
  getRateHistory,
  getBalanceSheetHistory,
  getRatesDashboard,
  getNetLiquidity,
  getFomcDashboard,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import LWChart from "@/components/LWChart";
import DashboardGrid from "@/components/DashboardGrid";
import type { PanelConfig } from "@/components/DashboardGrid";

/* ── Label maps ──────────────────────────────────────────── */

const STANCE_LABELS: Record<string, string> = {
  very_easy: "Very Easy", easy: "Easy", neutral: "Neutral",
  tight: "Tight", very_tight: "Very Tight",
};

const DIRECTION_BADGE: Record<string, { cls: string; label: string }> = {
  cutting: { cls: "bg-accent-green/10 text-accent-green border-accent-green/20", label: "Cutting" },
  hiking:  { cls: "bg-accent-red/10 text-accent-red border-accent-red/20", label: "Hiking" },
  paused:  { cls: "bg-bg-elevated text-text-muted border-border", label: "Pausing" },
};

const BS_BADGE: Record<string, { cls: string; label: string }> = {
  expanding: { cls: "bg-accent-green/10 text-accent-green border-accent-green/20", label: "QE" },
  shrinking: { cls: "bg-accent-red/10 text-accent-red border-accent-red/20", label: "QT Active" },
  stable:    { cls: "bg-bg-elevated text-text-muted border-border", label: "Balance Stable" },
};

const FED_PATTERN_GUIDE = [
  { key: "cutting", label: "Fed Cutting", desc: "Fed lowering rates. Typically supports risk assets, long duration. Watch for pivot toward pause." },
  { key: "hiking", label: "Fed Hiking", desc: "Fed raising rates. Pressure on growth, credit, long bonds. Defensive positioning." },
  { key: "pausing", label: "Fed Pausing", desc: "Rates on hold. Data-dependent mode. Forward guidance and dot plot matter for next move." },
  { key: "divergence", label: "Fed vs Market Divergence", desc: "Market prices more/less cuts than Fed dot plot. Divergence = repricing risk around FOMC." },
  { key: "qt", label: "QT Active", desc: "Balance sheet shrinking. Tighter liquidity beyond rate. Watch reserves, RRP for stress." },
];

/* ── Component ───────────────────────────────────────────── */

export default function FedPolicyPage() {
  const { data: status } = useQuery({ queryKey: ["fed-status"], queryFn: getFedStatus });
  const { data: rateHistory } = useQuery({ queryKey: ["rate-history"], queryFn: () => getRateHistory(3000) });
  const { data: balanceSheet } = useQuery({ queryKey: ["balance-sheet-3000"], queryFn: () => getBalanceSheetHistory(3000) });
  const { data: ratesDash } = useQuery({ queryKey: ["rates-dash-fed"], queryFn: () => getRatesDashboard(1825) });
  const { data: netLiq } = useQuery({ queryKey: ["net-liq-fed"], queryFn: () => getNetLiquidity(1825) });
  const { data: fomcDash } = useQuery({ queryKey: ["fomc-dashboard"], queryFn: getFomcDashboard });

  /* ── Derived chart data ────────────────────────────────── */

  const rateData = useMemo(() => {
    if (!rateHistory?.length) return [];
    return [...rateHistory].reverse().map((r) => ({
      date: r.date, target_upper: r.target_upper, target_lower: r.target_lower, effr: r.effr,
    }));
  }, [rateHistory]);

  const bsData = useMemo(() => {
    if (!balanceSheet?.length) return [];
    return [...balanceSheet].reverse().map((b) => ({
      date: b.date, total_assets: b.total_assets,
    }));
  }, [balanceSheet]);

  const bsComponentData = useMemo(() => {
    if (!balanceSheet?.length) return [];
    return [...balanceSheet].reverse().map((b) => ({
      date: b.date,
      treasuries: b.treasuries,
      mbs: b.mbs,
      reserves: b.reserves,
    }));
  }, [balanceSheet]);

  const forwardFedPanel: PanelConfig | null = useMemo(() => {
    if (!ratesDash?.forward_fed_rate?.length) return null;
    return {
      title: "Forward Fed Funds Rate (Market Expectations)",
      chart: {
        data: ratesDash.forward_fed_rate,
        series: [{ key: "value", color: "#fbbf24", label: "Forward Rate" }],
        formatValue: (v: number) => `${v.toFixed(2)}%`,
        periodSelector: true,
      },
    };
  }, [ratesDash]);

  const netLiqPanel: PanelConfig | null = useMemo(() => {
    if (!netLiq?.length) return null;
    return {
      title: "Net Liquidity (Fed BS − TGA − RRP)",
      chart: {
        data: netLiq,
        series: [{ key: "value", color: "#a78bfa", label: "Net Liquidity", type: "area" as const }],
        formatValue: (v: number) => `$${(v / 1e6).toFixed(2)}T`,
        periodSelector: true,
      },
    };
  }, [netLiq]);

  /* ── Balance sheet metrics (computed) ──────────────────── */

  const bsMetrics = useMemo(() => {
    if (!balanceSheet?.length) return null;
    const sorted = [...balanceSheet].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];
    const peakAssets = Math.max(...sorted.map((b) => b.total_assets));
    const peakDate = sorted.find((b) => b.total_assets === peakAssets)?.date ?? "";

    let qtPace: number | null = null;
    if (sorted.length >= 5) {
      const recent = sorted.slice(-5);
      const first = recent[0];
      const last = recent[recent.length - 1];
      const daysDiff = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 0) {
        qtPace = ((first.total_assets - last.total_assets) / daysDiff) * 30;
      }
    }

    return {
      totalAssets: latest.total_assets,
      treasuries: latest.treasuries,
      mbs: latest.mbs,
      reserves: latest.reserves,
      peakAssets,
      peakDate: peakDate.slice(0, 7),
      qtPaceMonthly: qtPace,
      latestDate: latest.date,
    };
  }, [balanceSheet]);

  /* ── Auto checklist (derived from real data) ───────────── */

  const checklist = useMemo(() => {
    if (!status) return [];
    const items: { label: string; value: string; status: "green" | "red" | "amber" }[] = [];

    const stanceLabel = STANCE_LABELS[status.stance] || status.stance;
    const isEasy = status.stance.includes("easy");
    const isTight = status.stance.includes("tight");
    items.push({
      label: "Stance",
      value: `${stanceLabel} (${status.current_rate_lower.toFixed(2)}–${status.current_rate_upper.toFixed(2)}% vs r*≈2.5%)`,
      status: isEasy ? "green" : isTight ? "red" : "amber",
    });

    items.push({
      label: "Direction",
      value: status.rate_direction === "cutting" ? "Cutting cycle"
        : status.rate_direction === "hiking" ? "Hiking cycle" : "Pausing",
      status: status.rate_direction === "cutting" ? "green"
        : status.rate_direction === "hiking" ? "red" : "amber",
    });

    items.push({
      label: "Balance Sheet",
      value: status.balance_sheet_direction === "shrinking" ? "QT (tightening)"
        : status.balance_sheet_direction === "expanding" ? "QE (easing)" : "Stable",
      status: status.balance_sheet_direction === "expanding" ? "green"
        : status.balance_sheet_direction === "shrinking" ? "red" : "amber",
    });

    if (bsMetrics) {
      const decline = ((bsMetrics.peakAssets - bsMetrics.totalAssets) / bsMetrics.peakAssets * 100);
      items.push({
        label: "BS from Peak",
        value: `−${decline.toFixed(1)}% from $${(bsMetrics.peakAssets / 1e6).toFixed(2)}T`,
        status: decline > 20 ? "red" : decline > 10 ? "amber" : "green",
      });
    }

    if (ratesDash?.forward_fed_rate?.length) {
      const fwd = ratesDash.forward_fed_rate[ratesDash.forward_fed_rate.length - 1].value;
      const current = (status.current_rate_upper + status.current_rate_lower) / 2;
      const diff = fwd - current;
      items.push({
        label: "Market Expects",
        value: `Forward rate ${fwd.toFixed(2)}% (${diff >= 0 ? "+" : ""}${(diff * 100).toFixed(0)}bp vs current)`,
        status: diff < -0.25 ? "green" : diff > 0.25 ? "red" : "amber",
      });
    }

    items.push({
      label: "Policy Score",
      value: `${status.policy_score >= 0 ? "+" : ""}${status.policy_score.toFixed(2)} (${status.policy_score < -0.5 ? "dovish" : status.policy_score > 0.5 ? "hawkish" : "neutral"})`,
      status: status.policy_score < -0.5 ? "green" : status.policy_score > 0.5 ? "red" : "amber",
    });

    return items;
  }, [status, bsMetrics, ratesDash]);

  /* ── Sentiment derived from policy_score ───────────────── */

  const sentiment = useMemo(() => {
    if (!status) return null;
    const score = status.policy_score;
    const pct = ((score + 2) / 4) * 100;
    const label = score <= -1 ? "Very Dovish"
      : score <= -0.3 ? "Mildly Dovish"
      : score >= 1 ? "Very Hawkish"
      : score >= 0.3 ? "Mildly Hawkish"
      : "Neutral";
    const color = score <= -0.3 ? "text-accent-green"
      : score >= 0.3 ? "text-accent-red"
      : "text-accent-amber";
    return { score, pct, label, color };
  }, [status]);

  const pct = status ? ((status.policy_score + 2) / 4) * 100 : 50;

  const STATUS_DOT: Record<string, string> = {
    green: "bg-accent-green",
    red: "bg-accent-red",
    amber: "bg-accent-amber",
  };

  return (
    <div className="space-y-3 animate-fade-in">
      {/* ── Header ─────────────────────────────── */}
      <div className="text-center py-4">
        <h1 className="text-3xl font-extralight tracking-tight text-text-primary mb-1">
          Fed Policy Analysis
        </h1>
        <p className="text-[11px] font-light text-text-muted uppercase tracking-wider">
          Monitor monetary policy stance · rate trajectory · balance sheet dynamics
        </p>
      </div>

      {/* ══ ROW 1: Policy Status + Methodology ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse shadow-[0_0_5px_theme(colors.accent.green)]" />
            <span className="text-[9px] uppercase tracking-[1.5px] text-text-muted font-medium">Fed Policy</span>
          </div>

          {status ? (
            <>
              <div className="mb-4">
                <span className="text-4xl font-bold tabular-nums text-text-primary">
                  {status.current_rate_lower.toFixed(2)}–{status.current_rate_upper.toFixed(2)}%
                </span>
                <span className="ml-2 text-sm text-text-muted font-light">target rate</span>
              </div>

              <div className="flex gap-2 mb-4 flex-wrap">
                {(() => {
                  const s = STANCE_LABELS[status.stance] || status.stance;
                  const clr = status.stance === "neutral"
                    ? "bg-[#2a1a4a] text-[#9b7fff] border-[#3d2a6a]"
                    : status.stance.includes("easy")
                      ? "bg-accent-green/10 text-accent-green border-accent-green/20"
                      : "bg-accent-red/10 text-accent-red border-accent-red/20";
                  return <span className={cn("px-3 py-1 rounded-md text-[11px] font-semibold tracking-wide border", clr)}>{s}</span>;
                })()}
                {(() => {
                  const d = DIRECTION_BADGE[status.rate_direction] || DIRECTION_BADGE.paused;
                  return <span className={cn("px-3 py-1 rounded-md text-[11px] font-semibold tracking-wide border", d.cls)}>{d.label}</span>;
                })()}
                {(() => {
                  const b = BS_BADGE[status.balance_sheet_direction] || BS_BADGE.stable;
                  return <span className={cn("px-3 py-1 rounded-md text-[11px] font-semibold tracking-wide border", b.cls)}>{b.label}</span>;
                })()}
              </div>

              <div className="mt-2">
                <div className="flex justify-between text-[9px] text-text-muted mb-1.5">
                  <span>Very Easy −2</span><span>Neutral 0</span><span>Very Tight +2</span>
                </div>
                <div className="relative h-1 rounded-full bg-gradient-to-r from-accent-green via-[#404060] to-accent-red">
                  <div
                    className="absolute top-1/2 w-2.5 h-2.5 rounded-full bg-[#9b7fff] shadow-[0_0_8px_#9b7fff] -translate-y-1/2 transition-all duration-500"
                    style={{ left: `calc(${pct}% - 5px)` }}
                  />
                </div>
                <div className="text-center text-[11px] text-[#9b7fff] mt-1.5">
                  Score: {status.policy_score >= 0 ? "+" : ""}{status.policy_score.toFixed(2)}
                </div>
              </div>

              {status.last_change_date && (
                <div className="text-[9px] text-text-muted mt-3 text-center">
                  Last rate change: {status.last_change_date}
                </div>
              )}
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-text-muted font-light text-sm">Loading…</div>
          )}
        </div>

        {/* Methodology + Sentiment */}
        <div className="flex flex-col gap-3">
          <div className="card flex-1">
            <div className="text-[9px] uppercase tracking-[1.5px] text-text-muted font-medium mb-3">
              Policy Score Methodology
            </div>
            <p className="text-sm text-text-secondary font-light mb-3">
              Score from <span className="text-accent-green font-semibold">−2 (very easy)</span> to{" "}
              <span className="text-accent-red font-semibold">+2 (very tight)</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Rate vs Neutral", value: "Distance from r*≈2.5%" },
                { label: "Rate Direction", value: "Hiking +0.5 / Cutting −0.5" },
                { label: "Balance Sheet", value: "QT +0.5 / QE −0.5" },
              ].map((m) => (
                <div key={m.label} className="rounded-lg border border-border bg-bg-card p-3">
                  <div className="text-[8px] uppercase tracking-wider text-text-muted mb-1">{m.label}</div>
                  <div className="text-[11px] text-text-secondary">{m.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Sentiment (derived from policy_score) */}
          {sentiment && (
            <div className="card">
              <div className="text-[9px] uppercase tracking-[1.5px] text-text-muted font-medium mb-3">
                Hawkish / Dovish Meter
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-accent-green w-12 text-center">Dovish</span>
                <div className="flex-1 relative h-2 rounded bg-gradient-to-r from-accent-green/20 via-bg-elevated to-accent-red/20 border border-border">
                  <div
                    className="absolute w-[3px] h-4 bg-text-primary rounded top-1/2 -translate-y-1/2 shadow-[0_0_6px_rgba(255,255,255,0.3)]"
                    style={{ left: `calc(${sentiment.pct}% - 1.5px)` }}
                  />
                </div>
                <span className="text-[10px] text-accent-red w-12 text-center">Hawkish</span>
              </div>
              <div className="text-center mt-2">
                <span className={cn("text-lg font-bold", sentiment.color)}>{sentiment.label}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ FOMC Probabilities + Rate Path ───────────────── */}
      {fomcDash && (
        <>
          <Divider label="Market Rate Expectations" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* FOMC Meeting Probabilities */}
            <div className="card">
              <div className="text-[9px] uppercase tracking-[1.5px] text-text-muted font-medium mb-3 text-center">
                FOMC Meeting Probabilities
              </div>
              <div className="flex flex-wrap justify-center gap-3 mb-3">
                <div className="flex items-center gap-1.5 text-[9px] text-text-muted">
                  <span className="w-2 h-2 rounded-sm bg-accent-amber" /> Hold
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-text-muted">
                  <span className="w-2 h-2 rounded-sm bg-accent-green" /> Cut 25bps
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-text-muted">
                  <span className="w-2 h-2 rounded-sm bg-[#1fffaa]" /> Cut 50bps
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-text-muted">
                  <span className="w-2 h-2 rounded-sm bg-accent-red" /> Hike
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                {fomcDash.meetings.map((m) => (
                  <div key={m.date} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-bg-elevated border border-border">
                    <span className="text-[10px] text-text-secondary w-24 flex-shrink-0">{m.date}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-[9px] text-text-muted mb-1">
                        <span>Hold {m.hold_pct}%</span><span>Cut {m.cut25_pct + m.cut50_pct}%</span>
                      </div>
                      <div className="h-1.5 rounded bg-border overflow-hidden flex">
                        <div
                          className={cn("h-full", m.outcome_type === "hold" ? "bg-accent-amber" : "bg-accent-green")}
                          style={{ width: `${m.outcome_type === "hold" ? m.hold_pct : m.cut25_pct + m.cut50_pct}%` }}
                        />
                      </div>
                    </div>
                    <span className={cn(
                      "text-[10px] font-semibold w-16 text-right flex-shrink-0",
                      m.outcome_type === "hold" ? "text-accent-amber" : m.outcome_type === "cut" ? "text-accent-green" : "text-accent-red"
                    )}>
                      {m.outcome}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rate Path — Dot Plot vs Market */}
            <div className="card">
              <div className="text-[9px] uppercase tracking-[1.5px] text-text-muted font-medium mb-3 text-center">
                Rate Path — Dot Plot vs Market
              </div>
              <div className="relative h-[140px] my-2">
                <div className="absolute inset-0 flex flex-col justify-between">
                  {["5.00", "4.50", "4.00", "3.50", "3.00", "2.50"].map((lbl) => (
                    <div key={lbl} className="flex items-center gap-2">
                      <span className="text-[9px] text-text-muted w-8 text-right">{lbl}</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 flex items-end pl-10 pt-2 pb-6">
                  {["now", "q2_26", "q4_26", "2027", "lt"].map((key) => {
                    const pt = fomcDash.rate_path[key];
                    if (!pt) return null;
                    const rateToY = (r: number) => Math.max(0, Math.min(140, ((r - 2.5) / 2.5) * 140));
                    const fedY = rateToY(pt.fed_median);
                    const mktY = rateToY(pt.market);
                    const labels: Record<string, string> = { now: "Now", q2_26: "Q2 26", q4_26: "Q4 26", "2027": "2027", lt: "LT r*" };
                    return (
                      <div key={key} className="flex-1 relative flex flex-col items-center justify-end">
                        <div
                          className="absolute w-2.5 h-2.5 rounded-full bg-accent-green shadow-[0_0_8px_theme(colors.accent.green)] -translate-x-1/2"
                          style={{ bottom: fedY, left: "50%" }}
                        />
                        {key !== "lt" && (
                          <div
                            className="absolute w-2 h-2 rounded-full bg-accent-amber shadow-[0_0_6px_theme(colors.accent.amber)] -translate-x-1/2"
                            style={{ bottom: mktY, left: "65%" }}
                          />
                        )}
                        <span className="absolute -bottom-5 text-[9px] text-text-muted whitespace-nowrap">{labels[key]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-center gap-4 mt-6">
                <div className="flex items-center gap-1.5 text-[9px] text-text-secondary">
                  <span className="w-2 h-2 rounded-full bg-accent-green" /> Fed Median (Dot Plot)
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-text-secondary">
                  <span className="w-2 h-2 rounded-full bg-[#9b7fff]" /> FOMC Members
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-text-secondary">
                  <span className="w-2 h-2 rounded-full bg-accent-amber" /> Market Pricing
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══ ROW 2: Auto Checklist ══ */}
      {checklist.length > 0 && (
        <>
          <Divider label="Policy Checklist" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {checklist.map((item) => (
              <div key={item.label} className="rounded-lg border border-border bg-bg-card p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[item.status])} />
                  <span className="text-[9px] uppercase tracking-wider text-text-muted">{item.label}</span>
                </div>
                <div className="text-[11px] text-text-secondary leading-snug">{item.value}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ══ ROW 3: Charts — Rate History + Forward Rate ══ */}
      <Divider label="Rate Analysis" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card">
          <div className="text-[9px] uppercase tracking-[1.5px] text-text-muted font-medium mb-3">
            Fed Funds Rate History
          </div>
          {rateData.length > 0 ? (
            <LWChart
              data={rateData}
              series={[
                { key: "target_upper", color: "#a78bfa", label: "Upper Target", type: "area" },
                { key: "target_lower", color: "#7c3aed", label: "Lower Target", type: "area" },
                { key: "effr", color: "#34d399", label: "EFFR" },
              ]}
              height={360}
              periodSelector
              formatValue={(v) => `${v.toFixed(2)}%`}
            />
          ) : (
            <div className="h-72 flex items-center justify-center text-text-muted font-light text-sm">Loading…</div>
          )}
        </div>

        {forwardFedPanel && (
          <DashboardGrid panels={[forwardFedPanel]} columns={1} panelHeight={420} />
        )}
      </div>

      {/* ══ ROW 4: Balance Sheet Charts ══ */}
      <Divider label="Balance Sheet" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card">
          <div className="text-[9px] uppercase tracking-[1.5px] text-text-muted font-medium mb-3">
            Fed Balance Sheet (Total Assets)
          </div>
          {bsData.length > 0 ? (
            <LWChart
              data={bsData}
              series={[{ key: "total_assets", color: "#fbbf24", label: "Total Assets", type: "area" }]}
              height={360}
              periodSelector
              formatValue={(v) => `$${(v / 1e6).toFixed(2)}T`}
            />
          ) : (
            <div className="h-72 flex items-center justify-center text-text-muted font-light text-sm">Loading…</div>
          )}
        </div>

        <div className="card">
          <div className="text-[9px] uppercase tracking-[1.5px] text-text-muted font-medium mb-3">
            Balance Sheet Components
          </div>
          {bsComponentData.length > 0 ? (
            <LWChart
              data={bsComponentData}
              series={[
                { key: "treasuries", color: "#60a5fa", label: "Treasuries" },
                { key: "mbs", color: "#fb923c", label: "MBS" },
                { key: "reserves", color: "#34d399", label: "Reserves" },
              ]}
              height={360}
              periodSelector
              formatValue={(v) => v != null ? `$${(v / 1e6).toFixed(2)}T` : "—"}
            />
          ) : (
            <div className="h-72 flex items-center justify-center text-text-muted font-light text-sm">Loading…</div>
          )}
        </div>
      </div>

      {/* ══ ROW 5: BS Metrics + Net Liquidity ══ */}
      {(bsMetrics || netLiqPanel) && (
        <>
          <Divider label="Liquidity & Metrics" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {bsMetrics && (
              <div className="card">
                <div className="text-[9px] uppercase tracking-[1.5px] text-text-muted font-medium mb-3">Key Metrics</div>
                <div className="grid grid-cols-2 gap-2">
                  <MetricBox
                    label="Total Assets"
                    value={`$${(bsMetrics.totalAssets / 1e6).toFixed(2)}T`}
                    color="text-accent-amber"
                    sub={`Peak $${(bsMetrics.peakAssets / 1e6).toFixed(2)}T (${bsMetrics.peakDate})`}
                  />
                  <MetricBox
                    label="QT Pace"
                    value={bsMetrics.qtPaceMonthly != null && bsMetrics.qtPaceMonthly > 0
                      ? `$${(bsMetrics.qtPaceMonthly / 1e3).toFixed(0)}B/mo`
                      : "N/A"}
                    color="text-text-primary"
                    sub="Estimated from recent data"
                  />
                  {bsMetrics.treasuries != null && (
                    <MetricBox
                      label="Treasuries"
                      value={`$${(bsMetrics.treasuries / 1e6).toFixed(2)}T`}
                      color="text-[#60a5fa]"
                      sub="Holdings"
                    />
                  )}
                  {bsMetrics.mbs != null && (
                    <MetricBox
                      label="MBS"
                      value={`$${(bsMetrics.mbs / 1e6).toFixed(2)}T`}
                      color="text-[#fb923c]"
                      sub="Agency MBS holdings"
                    />
                  )}
                  {bsMetrics.reserves != null && (
                    <MetricBox
                      label="Reserve Balances"
                      value={`$${(bsMetrics.reserves / 1e6).toFixed(2)}T`}
                      color="text-accent-green"
                      sub="Bank reserves at Fed"
                    />
                  )}
                  <MetricBox
                    label="BS Decline from Peak"
                    value={`−${((bsMetrics.peakAssets - bsMetrics.totalAssets) / bsMetrics.peakAssets * 100).toFixed(1)}%`}
                    color="text-accent-red"
                    sub={`−$${((bsMetrics.peakAssets - bsMetrics.totalAssets) / 1e6).toFixed(2)}T`}
                  />
                </div>
              </div>
            )}

            {netLiqPanel && (
              <DashboardGrid panels={[netLiqPanel]} columns={1} panelHeight={420} />
            )}
          </div>
        </>
      )}

      {/* ══ FED Pattern Guide ────────────────────────────── */}
      <div className="card mt-6">
        <div className="card-header">FED Pattern Guide</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FED_PATTERN_GUIDE.map((item) => {
            const cfg = item.key === "cutting" ? { border: "border-accent-green/20", bg: "bg-accent-green/5" }
              : item.key === "hiking" ? { border: "border-accent-red/20", bg: "bg-accent-red/5" }
              : item.key === "pausing" ? { border: "border-accent-amber/20", bg: "bg-accent-amber/5" }
              : item.key === "divergence" ? { border: "border-[#9b7fff]/20", bg: "bg-[#9b7fff]/5" }
              : { border: "border-border", bg: "bg-bg-card" };
            return (
              <div key={item.key} className={cn("rounded-lg border p-4", cfg.border, cfg.bg)}>
                <div className="font-medium text-text-primary text-sm mb-1">{item.label}</div>
                <div className="text-[12px] text-text-secondary leading-relaxed">{item.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────── */

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mt-4 mb-1">
      <span className="text-[9px] uppercase tracking-[2px] text-text-muted whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function MetricBox({ label, value, color, sub }: { label: string; value: string; color: string; sub: string }) {
  return (
    <div className="p-3 bg-bg-elevated rounded-lg border border-border">
      <div className="text-[9px] uppercase tracking-wider text-text-muted mb-1">{label}</div>
      <div className={cn("text-xl font-semibold", color)}>{value}</div>
      <div className="text-[9px] text-text-muted mt-0.5">{sub}</div>
    </div>
  );
}
