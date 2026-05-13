"use client";

import type { CSSProperties } from "react";
import type { BalanceSheetMetricsSnapshot } from "@/components/next-dashboard/fed-policy/fedPolicyUtils";
import { FedPolicyCompactMetric } from "@/components/next-dashboard/fed-policy/FedPolicyCompactMetric";

export function FedPolicyBalanceMetricsColumn({
  panelStyle,
  bsMetrics,
  bsPending,
}: {
  panelStyle: CSSProperties;
  bsMetrics: BalanceSheetMetricsSnapshot | null;
  bsPending: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-col gap-2 xl:col-span-4 print:col-span-4" style={panelStyle}>
      <div className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
        Balance sheet · key metrics
      </div>
      {bsMetrics ? (
        <div className="grid grid-cols-2 gap-2">
          <FedPolicyCompactMetric
            label="Total assets"
            value={`$${(bsMetrics.totalAssets / 1e6).toFixed(2)}T`}
            valueColor="var(--nd-yellow)"
            sub={`Peak $${(bsMetrics.peakAssets / 1e6).toFixed(2)}T (${bsMetrics.peakDate})`}
          />
          <FedPolicyCompactMetric
            label="QT pace"
            value={
              bsMetrics.qtPaceMonthly != null && bsMetrics.qtPaceMonthly > 0
                ? `$${(bsMetrics.qtPaceMonthly / 1e3).toFixed(0)}B/mo`
                : "N/A"
            }
            valueColor="var(--nd-text)"
            sub="Recent slope"
          />
          <FedPolicyCompactMetric
            label="Treasuries"
            value={bsMetrics.treasuries != null ? `$${(bsMetrics.treasuries / 1e6).toFixed(2)}T` : "—"}
            valueColor="var(--nd-blue)"
            sub="Holdings"
          />
          <FedPolicyCompactMetric
            label="MBS"
            value={bsMetrics.mbs != null ? `$${(bsMetrics.mbs / 1e6).toFixed(2)}T` : "—"}
            valueColor="var(--nd-orange)"
            sub="Agency MBS"
          />
          <FedPolicyCompactMetric
            label="Reserves"
            value={bsMetrics.reserves != null ? `$${(bsMetrics.reserves / 1e6).toFixed(2)}T` : "—"}
            valueColor="var(--nd-green)"
            sub="Bank reserves"
          />
          <FedPolicyCompactMetric
            label="Δ from peak"
            value={`−${(((bsMetrics.peakAssets - bsMetrics.totalAssets) / bsMetrics.peakAssets) * 100).toFixed(1)}%`}
            valueColor="var(--nd-red)"
            sub={`−$${((bsMetrics.peakAssets - bsMetrics.totalAssets) / 1e6).toFixed(2)}T`}
          />
        </div>
      ) : (
        <div className="py-6 text-center text-[12px]" style={{ color: "var(--nd-muted)" }}>
          {bsPending ? "Loading…" : "—"}
        </div>
      )}
    </div>
  );
}
