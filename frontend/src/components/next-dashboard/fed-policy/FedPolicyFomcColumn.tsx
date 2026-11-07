"use client";

import type { CSSProperties } from "react";
import type { FomcMeetingProb } from "@/types";
import { NextNoData } from "@/components/next-dashboard/NextNoData";
import { FomcProbabilitiesTable } from "@/components/next-dashboard/fed-policy/FomcProbabilitiesTable";

export function FedPolicyFomcColumn({
  panelStyle,
  meetings,
  isPending,
  meetingsSource,
  inputsMissing = false,
}: {
  panelStyle: CSSProperties;
  meetings: FomcMeetingProb[] | undefined;
  isPending: boolean;
  meetingsSource?: string | null;
  /** True when the Fed status reports no rate inputs: never show fallback probabilities. */
  inputsMissing?: boolean;
}) {
  // A meeting whose probabilities sum to 0% carries no information (heuristic fallback without rate inputs).
  const usable = inputsMissing
    ? []
    : (meetings ?? []).filter((m) => m.hold_pct + m.cut25_pct + m.cut50_pct + m.hike_pct > 0);
  const src =
    usable.length > 0 && meetingsSource === "cme_fedwatch"
      ? "CME FedWatch"
      : meetingsSource === "zq_heuristic"
        ? "ZQ heuristic (fallback)"
        : null;
  return (
    <div className="flex min-h-0 flex-col gap-3 xl:col-span-5 print:col-span-5" style={panelStyle}>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
          FOMC probabilities
        </div>
        {src ? (
          <div className="mt-0.5 text-[11px] normal-case tracking-[0.02em]" style={{ color: "var(--nd-muted)" }}>
            Source: {src}
          </div>
        ) : null}
      </div>

      {usable.length ? (
        <FomcProbabilitiesTable meetings={usable} />
      ) : isPending ? (
        <div className="text-[12px]" style={{ color: "var(--nd-muted)" }}>
          Loading FOMC…
        </div>
      ) : (
        <NextNoData compact />
      )}
    </div>
  );
}
