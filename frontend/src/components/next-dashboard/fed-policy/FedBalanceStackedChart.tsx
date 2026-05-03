"use client";

import { useMemo, useState } from "react";
import { format, parseISO, subMonths } from "date-fns";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_PERIODS } from "@/components/next-dashboard/macro-sentiment/macroSentimentConstants";
import type { BalanceStackRow } from "@/components/next-dashboard/fed-policy/fedPolicyUtils";

function filterByPeriod(rows: BalanceStackRow[], period: string): BalanceStackRow[] {
  if (period === "ALL") return rows;
  const p = CHART_PERIODS.find((x) => x.label === period);
  if (!p || p.months === 0) return rows;
  const cutoff = subMonths(new Date(), p.months).toISOString().slice(0, 10);
  return rows.filter((d) => d.date >= cutoff);
}

type HexPalette = {
  treasuries: string;
  mbs: string;
  reserves: string;
  other: string;
  /** Line color for Fed total assets overlay (matches top of stack). */
  totalAssets: string;
};

function fmtTrillions(v: number) {
  return `$${(v / 1e6).toFixed(2)}T`;
}

function FedBalanceTooltipBody({
  active,
  payload,
  palette,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  palette: HexPalette;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as BalanceStackRow | undefined;
  if (!row?.date) return null;

  let dateStr: string;
  try {
    dateStr = format(parseISO(row.date), "MMM d, yyyy");
  } catch {
    dateStr = row.date;
  }

  const item = (labelText: string, value: number, labelColor: string) => (
    <div key={labelText} className="leading-snug">
      <span style={{ color: labelColor }}>{labelText}</span>
      <span style={{ color: "var(--nd-muted)" }}> : </span>
      <span className="tabular-nums" style={{ color: "var(--nd-text)" }}>
        {Number.isFinite(value) ? fmtTrillions(value) : "—"}
      </span>
    </div>
  );

  return (
    <div
      className="rounded border px-3 py-2 font-mono text-[12px]"
      style={{
        backgroundColor: "var(--nd-panel-soft)",
        border: "1px solid var(--nd-border-soft)",
        borderRadius: 4,
        color: "var(--nd-text)",
      }}
    >
      <div className="mb-1.5 tabular-nums" style={{ color: "var(--nd-text)" }}>
        {dateStr}
      </div>
      <div className="flex flex-col gap-0.5">
        {item("Total assets", row.total, palette.totalAssets)}
        {item("Treasuries", row.treasuries, palette.treasuries)}
        {item("MBS", row.mbs, palette.mbs)}
        {item("Reserves", row.reserves, palette.reserves)}
        {item("Other", row.other, palette.other)}
      </div>
    </div>
  );
}

export function FedBalanceStackedChart({
  rows,
  palette,
  height = 320,
}: {
  rows: BalanceStackRow[];
  palette: HexPalette;
  height?: number;
}) {
  const [period, setPeriod] = useState("1Y");
  const filtered = useMemo(() => filterByPeriod(rows, period), [rows, period]);

  const fmtT = fmtTrillions;

  if (!filtered.length) {
    return (
      <div
        className="flex items-center justify-center rounded-[2px] text-[12px]"
        style={{ height, color: "var(--nd-muted)", background: "rgba(255,255,255,0.02)" }}
      >
        No balance sheet data.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap justify-end gap-1">
        {CHART_PERIODS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setPeriod(p.label)}
            className="rounded-[2px] px-2 py-1 text-[11px] font-medium transition-colors"
            style={{
              border: period === p.label ? "1px solid var(--nd-border)" : "1px solid transparent",
              background: period === p.label ? "var(--nd-panel-soft)" : "transparent",
              color: period === p.label ? "var(--nd-text)" : "var(--nd-muted)",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={filtered} margin={{ top: 8, right: 12, left: 2, bottom: 4 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="0" />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
              tickFormatter={(v: string) => {
                try {
                  return format(parseISO(v), "MMM yy");
                } catch {
                  return v;
                }
              }}
            />
            <YAxis
              tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v) => fmtT(Number(v))}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => (
                <FedBalanceTooltipBody active={active} payload={payload} palette={palette} />
              )}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "var(--nd-muted)" }}
              formatter={(value) => <span style={{ color: "var(--nd-soft)" }}>{value}</span>}
            />
            <Area
              type="monotone"
              dataKey="treasuries"
              name="Treasuries"
              stackId="bs"
              stroke={palette.treasuries}
              fill={palette.treasuries}
              fillOpacity={0.85}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="mbs"
              name="MBS"
              stackId="bs"
              stroke={palette.mbs}
              fill={palette.mbs}
              fillOpacity={0.85}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="reserves"
              name="Reserves"
              stackId="bs"
              stroke={palette.reserves}
              fill={palette.reserves}
              fillOpacity={0.85}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="other"
              name="Other"
              stackId="bs"
              stroke={palette.other}
              fill={palette.other}
              fillOpacity={0.75}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="total"
              name="Total assets"
              stroke={palette.totalAssets}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
