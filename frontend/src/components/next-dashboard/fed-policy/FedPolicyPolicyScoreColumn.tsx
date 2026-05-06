"use client";

import type { CSSProperties } from "react";
import { FedPolicyScaleBar, fmtNumber } from "@/features/dashboard/components/dashboardVisuals";
import type { NextShellThemeContextValue } from "@/components/next-dashboard/nextShellTheme";
import type { FedPolicyStatus } from "@/types";
import {
  balanceSheetScoreLabel,
  directionScoreLabel,
  rateVsRStarComponent,
  R_STAR_FALLBACK,
} from "@/components/next-dashboard/fed-policy/fedPolicyUtils";

const STANCE_LABELS: Record<string, string> = {
  very_easy: "Very Easy",
  easy: "Easy",
  neutral: "Neutral",
  tight: "Tight",
  very_tight: "Very Tight",
};

type Colors = NextShellThemeContextValue["colors"];

type Sentiment = { score: number; pct: number; label: string; fromRhetoric?: boolean };

export function FedPolicyPolicyScoreColumn({
  panelStyle,
  status,
  statusPending,
  colors: C,
  sentiment,
  hawkColor,
}: {
  panelStyle: CSSProperties;
  status: FedPolicyStatus | undefined;
  statusPending: boolean;
  colors: Colors;
  sentiment: Sentiment | null;
  hawkColor: string;
}) {
  const neutralNominal =
    status && status.neutral_rate_nominal != null && Number.isFinite(status.neutral_rate_nominal)
      ? status.neutral_rate_nominal
      : R_STAR_FALLBACK;
  const mid = status ? (status.current_rate_upper + status.current_rate_lower) / 2 : null;
  const rateComp = mid != null ? rateVsRStarComponent(mid, neutralNominal) : null;
  const dirS = status ? directionScoreLabel(status.rate_direction) : null;
  const bsS = status ? balanceSheetScoreLabel(status.balance_sheet_direction) : null;

  return (
    <div className="flex min-h-0 flex-col gap-3 xl:col-span-3" style={panelStyle}>
      {status ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
              Policy score
            </div>
            {status.last_change_date ? (
              <div className="max-w-[55%] shrink-0 text-right text-[9px] normal-case leading-snug" style={{ color: "var(--nd-muted)" }}>
                Last rate change: {String(status.last_change_date)}
              </div>
            ) : null}
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0">
              <div className="text-[28px] font-extralight leading-none tabular-nums" style={{ color: "var(--nd-text)" }}>
                {fmtNumber(status.policy_score)}
              </div>
              <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: C.green }}>
                {STANCE_LABELS[status.stance] ?? status.stance}
              </div>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <FedPolicyScaleBar value={status.policy_score} />
            </div>
          </div>
          {(() => {
            const ppDiff = mid != null ? mid - neutralNominal : null;
            const ppStr = ppDiff == null ? "—" : `${ppDiff >= 0 ? "+" : ""}${ppDiff.toFixed(2)}pp`;
            const rateCompStr = rateComp == null ? "—" : `${rateComp >= 0 ? "+" : ""}${rateComp.toFixed(2)}`;
            const ppTone =
              ppDiff == null
                ? "var(--nd-muted)"
                : ppDiff > 0.02
                  ? C.red
                  : ppDiff < -0.02
                    ? C.green
                    : "var(--nd-text)";
            const rcTone =
              rateComp == null
                ? "var(--nd-muted)"
                : rateComp > 0.02
                  ? C.red
                  : rateComp < -0.02
                    ? C.green
                    : "var(--nd-soft)";

            const rd = status.rate_direction?.toLowerCase() ?? "";
            const dirLabelColor = rd === "cutting" ? C.green : rd === "hiking" ? C.red : "var(--nd-text)";
            const dirDeltaTone =
              dirS == null
                ? "var(--nd-muted)"
                : dirS.delta > 0
                  ? C.red
                  : dirS.delta < 0
                    ? C.green
                    : "var(--nd-soft)";

            const bsDir = status.balance_sheet_direction?.toLowerCase() ?? "";
            const bsLabelColor =
              bsDir === "shrinking" ? C.yellow : bsDir === "expanding" ? C.green : "var(--nd-soft)";
            const bsDeltaTone =
              bsS == null
                ? "var(--nd-muted)"
                : bsS.delta > 0
                  ? C.red
                  : bsS.delta < 0
                    ? C.green
                    : "var(--nd-soft)";

            const ppDisplay = ppStr === "—" ? "—" : ppStr.replace(/pp/i, "PP");

            return (
              <div className="mt-2 border-t pt-2 text-[10px] uppercase tracking-[0.06em]" style={{ borderColor: "var(--nd-border-soft)" }}>
                <table className="w-full table-fixed border-collapse">
                  <colgroup>
                    <col className="min-w-0" />
                    <col style={{ width: "5.75rem" }} />
                    <col style={{ width: "5.75rem" }} />
                  </colgroup>
                  <tbody>
                    <tr className="border-b" style={{ borderColor: "var(--nd-border-soft)" }}>
                      <td className="min-w-0 py-2.5 align-middle pr-3">
                        <div style={{ color: "var(--nd-text)" }}>Rate vs Neutral (SEP LR)</div>
                      </td>
                      <td
                        className="px-2 py-2.5 align-middle text-center text-[12px] tabular-nums"
                        style={{
                          color: ppTone,
                          borderLeft: "1px solid var(--nd-border-soft)",
                          borderRight: "1px solid var(--nd-border-soft)",
                        }}
                      >
                        {ppDisplay}
                      </td>
                      <td className="pl-3 pr-0 py-2.5 align-middle text-center text-[12px] tabular-nums" style={{ color: rcTone }}>
                        {rateCompStr}
                      </td>
                    </tr>
                    <tr className="border-b" style={{ borderColor: "var(--nd-border-soft)" }}>
                      <td className="min-w-0 py-2.5 align-middle pr-3">
                        <div style={{ color: "var(--nd-text)" }}>Rate direction</div>
                      </td>
                      <td
                        className="px-2 py-2.5 align-middle text-center text-[12px] tabular-nums uppercase"
                        style={{
                          color: dirLabelColor,
                          borderLeft: "1px solid var(--nd-border-soft)",
                          borderRight: "1px solid var(--nd-border-soft)",
                        }}
                      >
                        {dirS ? dirS.label : "—"}
                      </td>
                      <td className="pl-3 pr-0 py-2.5 align-middle text-center text-[12px] tabular-nums" style={{ color: dirDeltaTone }}>
                        {dirS ? (
                          <>
                            {dirS.delta >= 0 ? "+" : ""}
                            {dirS.delta.toFixed(2)}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                    <tr className="border-b" style={{ borderColor: "var(--nd-border-soft)" }}>
                      <td className="min-w-0 py-2.5 align-middle pr-3">
                        <div style={{ color: "var(--nd-text)" }}>Balance sheet</div>
                      </td>
                      <td
                        className="px-2 py-2.5 align-middle text-center text-[12px] tabular-nums uppercase"
                        style={{
                          color: bsLabelColor,
                          borderLeft: "1px solid var(--nd-border-soft)",
                          borderRight: "1px solid var(--nd-border-soft)",
                        }}
                      >
                        {bsS ? bsS.label : "—"}
                      </td>
                      <td className="pl-3 pr-0 py-2.5 align-middle text-center text-[12px] tabular-nums" style={{ color: bsDeltaTone }}>
                        {bsS ? (
                          <>
                            {bsS.delta >= 0 ? "+" : ""}
                            {bsS.delta.toFixed(2)}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}
          {sentiment ? (
            <div className="mt-3 text-[10px] uppercase tracking-[0.06em]">
              <div className="mb-2 text-[10px] font-semibold tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
                {sentiment.fromRhetoric ? "Rhetoric (Fed/CB agent)" : "Hawkish / dovish (policy score)"}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-10 text-center text-[10px] normal-case" style={{ color: C.green }}>
                    Dovish
                  </span>
                  <div
                    className="relative h-2 flex-1 rounded-full border"
                    style={{
                      borderColor: "var(--nd-border-soft)",
                      background:
                        "linear-gradient(90deg, rgba(114,173,102,0.25) 0%, var(--nd-panel-soft) 50%, rgba(212,93,114,0.25) 100%)",
                    }}
                  >
                    <div
                      className="absolute top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-[var(--nd-text)] shadow"
                      style={{ left: `${sentiment.pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-center text-[10px] normal-case" style={{ color: C.red }}>
                    Hawkish
                  </span>
                </div>
                <div className="text-center text-[14px] font-semibold uppercase tracking-[0.06em]" style={{ color: hawkColor }}>
                  {sentiment.label}
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
            Policy score
          </div>
          <div className="py-8 text-center text-[13px]" style={{ color: "var(--nd-muted)" }}>
            {statusPending ? "Loading…" : "—"}
          </div>
        </>
      )}
    </div>
  );
}
