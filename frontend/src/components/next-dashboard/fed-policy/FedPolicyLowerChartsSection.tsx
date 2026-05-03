"use client";

import type { ComponentProps, CSSProperties } from "react";
import type { NextShellThemeContextValue } from "@/components/next-dashboard/nextShellTheme";
import {
  FedForwardRateRecharts,
  FedFundsHistoryRecharts,
  FedNetLiquidityRecharts,
  type FedFundsRateRow,
} from "@/components/next-dashboard/fed-policy/FedPolicyRecharts";
import { FedBalanceStackedChart } from "@/components/next-dashboard/fed-policy/FedBalanceStackedChart";
import type { BalanceStackRow } from "@/components/next-dashboard/fed-policy/fedPolicyUtils";
import type { NetLiquidityPoint, RatioPoint } from "@/types";

type Colors = NextShellThemeContextValue["colors"];
type BalancePalette = ComponentProps<typeof FedBalanceStackedChart>["palette"];

export function FedPolicyLowerChartsSection({
  panelStyle,
  palette,
  rateRows,
  rateHistPending,
  forwardRows,
  ratesDashPending,
  netLiqRows,
  netLiqPending,
  stackRows,
  bsPending,
  balancePalette,
}: {
  panelStyle: CSSProperties;
  palette: Colors;
  rateRows: FedFundsRateRow[];
  rateHistPending: boolean;
  forwardRows: RatioPoint[] | undefined;
  ratesDashPending: boolean;
  netLiqRows: NetLiquidityPoint[] | undefined;
  netLiqPending: boolean;
  stackRows: BalanceStackRow[];
  bsPending: boolean;
  balancePalette: BalancePalette;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        <div style={panelStyle}>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
            Fed funds rate history
          </div>
          {rateRows.length > 0 ? (
            <FedFundsHistoryRecharts palette={palette} rows={rateRows} height={300} />
          ) : (
            <div className="flex h-64 items-center justify-center text-[13px]" style={{ color: "var(--nd-muted)" }}>
              {rateHistPending ? "Loading…" : "—"}
            </div>
          )}
        </div>
        <div style={panelStyle}>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
            Forward fed funds (market)
          </div>
          {forwardRows?.length ? (
            <FedForwardRateRecharts palette={palette} rows={forwardRows} height={300} />
          ) : (
            <div className="flex h-64 items-center justify-center text-[13px]" style={{ color: "var(--nd-muted)" }}>
              {ratesDashPending ? "Loading…" : "—"}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        <div style={panelStyle}>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
            Fed balance sheet — stacked composition
          </div>
          {stackRows.length > 0 ? (
            <FedBalanceStackedChart rows={stackRows} palette={balancePalette} height={300} />
          ) : (
            <div className="flex h-64 items-center justify-center text-[13px]" style={{ color: "var(--nd-muted)" }}>
              {bsPending ? "Loading…" : "—"}
            </div>
          )}
        </div>
        <div style={panelStyle}>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
            Net liquidity
          </div>
          {netLiqRows?.length ? (
            <FedNetLiquidityRecharts palette={palette} rows={netLiqRows} height={300} />
          ) : (
            <div className="flex h-64 items-center justify-center text-[13px]" style={{ color: "var(--nd-muted)" }}>
              {netLiqPending ? "Loading…" : "—"}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
