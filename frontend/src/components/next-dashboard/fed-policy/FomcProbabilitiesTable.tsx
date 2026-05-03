"use client";

import type { FomcMeetingProb } from "@/types";

const BAR = {
  hold: "var(--nd-yellow)",
  cut25: "#7dd87a",
  cut50: "#2d8a52",
  hike: "var(--nd-red)",
} as const;

function barFractions(m: FomcMeetingProb) {
  const t = m.hold_pct + m.cut25_pct + m.cut50_pct + m.hike_pct;
  if (t <= 0) return { hold: 0, cut25: 0, cut50: 0, hike: 0 };
  return {
    hold: (m.hold_pct / t) * 100,
    cut25: (m.cut25_pct / t) * 100,
    cut50: (m.cut50_pct / t) * 100,
    hike: (m.hike_pct / t) * 100,
  };
}

function outcomeColor(outcomeType: FomcMeetingProb["outcome_type"]) {
  if (outcomeType === "hold") return "var(--nd-yellow)";
  if (outcomeType === "cut") return "var(--nd-green)";
  return "var(--nd-red)";
}

export function FomcProbabilitiesTable({ meetings }: { meetings: FomcMeetingProb[] }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[440px] table-fixed border-collapse text-[10px] uppercase tracking-[0.06em]">
        <thead>
          <tr>
            <th className="pb-2 pr-2 text-left align-bottom font-medium" style={{ color: "var(--nd-muted)", width: "22%" }}>
              Meeting date
            </th>
            <th className="px-1 pb-2 text-center font-medium" style={{ color: "var(--nd-muted)", width: "13%" }}>
              Hold
            </th>
            <th className="px-1 pb-2 text-center font-medium" style={{ color: "var(--nd-muted)", width: "13%" }}>
              Cut 25bps
            </th>
            <th className="px-1 pb-2 text-center font-medium" style={{ color: "var(--nd-muted)", width: "13%" }}>
              Cut 50bps
            </th>
            <th className="px-1 pb-2 text-center font-medium" style={{ color: "var(--nd-muted)", width: "13%" }}>
              Hike
            </th>
            <th className="pb-2 pl-2 text-right align-bottom font-medium" style={{ color: "var(--nd-muted)", width: "14%" }}>
              Outcome
            </th>
          </tr>
        </thead>
        <tbody>
          {meetings.map((m) => {
            const w = barFractions(m);
            return (
              <tr key={m.date} className="align-top">
                <td className="py-2.5 pr-2 align-top text-[10px] normal-case tabular-nums" style={{ color: "var(--nd-soft)" }}>
                  {m.date}
                </td>
                <td colSpan={4} className="px-0 py-2.5 align-top">
                  <div className="grid grid-cols-4 gap-0">
                    <div className="px-1 text-center text-[11px] tabular-nums normal-case" style={{ color: "var(--nd-text)" }}>
                      {m.hold_pct}%
                    </div>
                    <div className="px-1 text-center text-[11px] tabular-nums normal-case" style={{ color: "var(--nd-text)" }}>
                      {m.cut25_pct}%
                    </div>
                    <div className="px-1 text-center text-[11px] tabular-nums normal-case" style={{ color: "var(--nd-text)" }}>
                      {m.cut50_pct}%
                    </div>
                    <div className="px-1 text-center text-[11px] tabular-nums normal-case" style={{ color: "var(--nd-text)" }}>
                      {m.hike_pct}%
                    </div>
                  </div>
                  <div
                    className="mt-1.5 flex h-2.5 w-full overflow-hidden rounded-[2px]"
                    style={{ background: "var(--nd-border-soft)" }}
                  >
                    {w.hold > 0 ? (
                      <div className="h-full min-w-0 shrink-0" style={{ width: `${w.hold}%`, background: BAR.hold }} />
                    ) : null}
                    {w.cut25 > 0 ? (
                      <div className="h-full min-w-0 shrink-0" style={{ width: `${w.cut25}%`, background: BAR.cut25 }} />
                    ) : null}
                    {w.cut50 > 0 ? (
                      <div className="h-full min-w-0 shrink-0" style={{ width: `${w.cut50}%`, background: BAR.cut50 }} />
                    ) : null}
                    {w.hike > 0 ? (
                      <div className="h-full min-w-0 shrink-0" style={{ width: `${w.hike}%`, background: BAR.hike }} />
                    ) : null}
                  </div>
                </td>
                <td
                  className="py-2.5 pl-2 text-right text-[11px] font-semibold tabular-nums uppercase"
                  style={{ color: outcomeColor(m.outcome_type) }}
                >
                  {m.outcome}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
