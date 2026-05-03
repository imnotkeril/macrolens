"use client";

import type { NextShellThemeContextValue } from "@/components/next-dashboard/nextShellTheme";
import { REGIME_HISTORY_TABLE_BORDER } from "@/components/next-dashboard/nextDashboardTableTokens";
import type { RateDecisionHistoryRow } from "@/components/next-dashboard/fed-policy/fedPolicyUtils";
import { FedRateDecisionMovePill } from "@/components/next-dashboard/fed-policy/FedRateDecisionMovePill";

type Colors = NextShellThemeContextValue["colors"];

export function FedPolicyRateDecisionHistoryTable({
  palette: C,
  decisionRows,
  rateHistPending,
}: {
  palette: Colors;
  decisionRows: RateDecisionHistoryRow[];
  rateHistPending: boolean;
}) {
  if (rateHistPending) {
    return (
      <div className="py-8 text-center font-mono text-[13px]" style={{ color: "var(--nd-muted)" }}>
        Loading…
      </div>
    );
  }
  if (!decisionRows.length) {
    return (
      <div
        className="py-8 text-center font-mono text-[13px]"
        style={{ border: REGIME_HISTORY_TABLE_BORDER, color: "var(--nd-muted)" }}
      >
        No rate changes in range.
      </div>
    );
  }
  return (
    <table
      className="w-full min-w-[480px] table-fixed border-separate border-spacing-0 font-mono text-[13px]"
      style={{ border: REGIME_HISTORY_TABLE_BORDER }}
    >
      <colgroup>
        <col style={{ width: "20%" }} />
        <col style={{ width: "18%" }} />
        <col style={{ width: "14%" }} />
        <col style={{ width: "22%" }} />
        <col style={{ width: "26%" }} />
      </colgroup>
      <thead className="sticky top-0 z-[1]" style={{ background: "var(--nd-panel)" }}>
        <tr style={{ color: "var(--nd-muted)" }}>
          <th className="px-2 py-2 text-center font-semibold uppercase tracking-[0.08em]" style={{ border: REGIME_HISTORY_TABLE_BORDER, fontSize: 12 }}>
            DATE
          </th>
          <th className="px-2 py-2 text-center font-semibold uppercase tracking-[0.08em]" style={{ border: REGIME_HISTORY_TABLE_BORDER, fontSize: 12 }}>
            MOVE
          </th>
          <th className="px-2 py-2 text-center font-semibold uppercase tracking-[0.08em]" style={{ border: REGIME_HISTORY_TABLE_BORDER, fontSize: 12 }}>
            BPS
          </th>
          <th className="px-2 py-2 text-center font-semibold uppercase tracking-[0.08em]" style={{ border: REGIME_HISTORY_TABLE_BORDER, fontSize: 12 }}>
            TARGET
          </th>
          <th className="px-2 py-2 text-center font-semibold uppercase tracking-[0.08em]" style={{ border: REGIME_HISTORY_TABLE_BORDER, fontSize: 12 }}>
            SIGNAL
          </th>
        </tr>
      </thead>
      <tbody>
        {decisionRows.map((row) => {
          const bpsDisplay = row.bps === 0 ? "0" : `${row.bps > 0 ? "+" : ""}${row.bps}`;
          const bpsColor = row.bps < 0 ? C.green : row.bps > 0 ? C.red : "var(--nd-muted)";
          return (
            <tr key={row.date}>
              <td className="px-2 py-2 text-center tabular-nums align-middle" style={{ border: REGIME_HISTORY_TABLE_BORDER, color: "var(--nd-soft)" }}>
                {row.date}
              </td>
              <td className="px-2 py-2 text-center align-middle" style={{ border: REGIME_HISTORY_TABLE_BORDER }}>
                <div className="flex justify-center">
                  <FedRateDecisionMovePill decision={row.decision} />
                </div>
              </td>
              <td className="px-2 py-2 text-center tabular-nums align-middle font-medium" style={{ border: REGIME_HISTORY_TABLE_BORDER, color: bpsColor }}>
                {bpsDisplay}
              </td>
              <td className="px-2 py-2 text-center tabular-nums align-middle" style={{ border: REGIME_HISTORY_TABLE_BORDER, color: "var(--nd-text)" }}>
                {row.rangeAfter}
              </td>
              <td
                className="px-2 py-2 text-center align-middle font-sans text-[12px] leading-snug lowercase"
                style={{ border: REGIME_HISTORY_TABLE_BORDER, color: "var(--nd-soft)" }}
                title={row.signal}
              >
                {row.signal}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
