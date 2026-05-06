"use client";

import type { CSSProperties } from "react";
import type { SpreadPercentileRow } from "@/types";

/** Sequential heat by percentile rank (0–100): cool slate → warm rose; never pure white. */
function heatPercentileCell(pct: number | null | undefined): CSSProperties {
  if (pct == null || !Number.isFinite(pct)) {
    return {
      backgroundColor: "rgba(255,255,255,0.06)",
      color: "var(--nd-muted)",
      fontWeight: 500,
    };
  }
  const t = Math.max(0, Math.min(100, pct)) / 100;
  const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
  const br = Math.round(lerp(42, 118, t));
  const bg = Math.round(lerp(58, 62, t));
  const bb = Math.round(lerp(78, 72, t));
  const ba = lerp(0.3, 0.42, t);
  const fr = Math.round(lerp(188, 228, t));
  const fg = Math.round(lerp(215, 198, t));
  const fb = Math.round(lerp(232, 208, t));
  const extreme = pct <= 12 || pct >= 88;
  return {
    backgroundColor: `rgba(${br},${bg},${bb},${ba})`,
    color: `rgb(${fr},${fg},${fb})`,
    fontWeight: extreme ? 600 : 500,
  };
}

function neutralBlock(): CSSProperties {
  return {
    backgroundColor: "rgba(255,255,255,0.07)",
    color: "var(--nd-text)",
    fontWeight: 500,
  };
}

function fmtBp(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(0)} bp`;
}

function fmtPct(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(0)}%`;
}

function CellBlock({ children, style }: { children: React.ReactNode; style: CSSProperties }) {
  return (
    <div
      className="rounded-[3px] px-1.5 py-2 text-center font-mono text-[10px] leading-tight tabular-nums"
      style={style}
    >
      {children}
    </div>
  );
}

export function YieldCurvePercentileTable({
  rows,
  pending,
}: {
  rows: SpreadPercentileRow[] | undefined;
  pending: boolean;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-muted)" }}>
        Yield curve percentile table
      </div>
      <div className="min-h-0 w-full overflow-x-auto">
        {pending && !rows?.length ? (
          <div className="py-5 text-center text-[11px]" style={{ color: "var(--nd-muted)" }}>
            Loading…
          </div>
        ) : !rows?.length ? (
          <div className="py-5 text-center text-[11px]" style={{ color: "var(--nd-muted)" }}>
            No percentile data.
          </div>
        ) : (
          <table className="w-full border-collapse font-mono text-[10px] tabular-nums" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "19%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "15%" }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                <th className="pb-1.5 pr-1 text-left align-bottom font-semibold uppercase tracking-wide" style={{ color: "var(--nd-muted)" }}>
                  Spread
                </th>
                <th className="px-0.5 pb-1.5 text-center align-bottom font-semibold uppercase tracking-wide" style={{ color: "var(--nd-muted)" }}>
                  Now
                </th>
                <th className="px-0.5 pb-1.5 text-center align-bottom font-semibold uppercase tracking-wide" style={{ color: "var(--nd-muted)" }}>
                  1Y pct
                </th>
                <th className="px-0.5 pb-1.5 text-center align-bottom font-semibold uppercase tracking-wide" style={{ color: "var(--nd-muted)" }}>
                  5Y pct
                </th>
                <th className="px-0.5 pb-1.5 text-center align-bottom font-semibold uppercase tracking-wide" style={{ color: "var(--nd-muted)" }}>
                  10Y pct
                </th>
                <th className="px-0.5 pb-1.5 text-center align-bottom font-semibold uppercase tracking-wide" style={{ color: "var(--nd-muted)" }}>
                  Hist avg
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td className="py-1.5 pr-1 align-middle text-left font-medium" style={{ color: "var(--nd-soft)" }}>
                    {r.label}
                  </td>
                  <td className="p-0.5 align-middle">
                    <CellBlock style={neutralBlock()}>{fmtBp(r.current_bp)}</CellBlock>
                  </td>
                  <td className="p-0.5 align-middle">
                    <CellBlock style={heatPercentileCell(r.percentile_1y)}>{fmtPct(r.percentile_1y)}</CellBlock>
                  </td>
                  <td className="p-0.5 align-middle">
                    <CellBlock style={heatPercentileCell(r.percentile_5y)}>{fmtPct(r.percentile_5y)}</CellBlock>
                  </td>
                  <td className="p-0.5 align-middle">
                    <CellBlock style={heatPercentileCell(r.percentile_10y)}>{fmtPct(r.percentile_10y)}</CellBlock>
                  </td>
                  <td className="p-0.5 align-middle">
                    <CellBlock style={neutralBlock()}>{fmtBp(r.historical_mean_bp)}</CellBlock>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
