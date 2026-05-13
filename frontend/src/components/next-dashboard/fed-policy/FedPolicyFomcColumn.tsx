"use client";

import type { CSSProperties } from "react";
import type { FomcMeetingProb } from "@/types";
import { FomcProbabilitiesTable } from "@/components/next-dashboard/fed-policy/FomcProbabilitiesTable";

export function FedPolicyFomcColumn({
  panelStyle,
  meetings,
  isPending,
  meetingsSource,
}: {
  panelStyle: CSSProperties;
  meetings: FomcMeetingProb[] | undefined;
  isPending: boolean;
  meetingsSource?: string | null;
}) {
  const src =
    meetingsSource === "cme_fedwatch"
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
          <div className="mt-0.5 text-[9px] normal-case tracking-[0.02em]" style={{ color: "var(--nd-muted)" }}>
            Source: {src}
          </div>
        ) : null}
      </div>

      {meetings?.length ? (
        <FomcProbabilitiesTable meetings={meetings} />
      ) : (
        <div className="text-[12px]" style={{ color: "var(--nd-muted)" }}>
          {isPending ? "Loading FOMC…" : "FOMC data unavailable."}
        </div>
      )}
    </div>
  );
}
