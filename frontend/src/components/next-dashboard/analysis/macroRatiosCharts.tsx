"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Info } from "lucide-react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { paddedYDomain } from "@/components/next-dashboard/analysis/chartYDomain";
import type { RecessionBand } from "@/types";

const TIP: React.CSSProperties = {
  backgroundColor: "var(--nd-panel-soft)",
  border: "1px solid var(--nd-border-soft)",
  borderRadius: 4,
  fontSize: 11,
  color: "var(--nd-text)",
};

export const MACRO_RATIOS_TF_OPTIONS = [
  { key: "1Y" as const, days: 365 },
  { key: "2Y" as const, days: 730 },
  { key: "3Y" as const, days: 1095 },
  { key: "ALL" as const, days: 365 * 15 },
];

export type MacroRatiosTfKey = (typeof MACRO_RATIOS_TF_OPTIONS)[number]["key"];

export function macroRatiosTfDays(key: MacroRatiosTfKey): number {
  return MACRO_RATIOS_TF_OPTIONS.find((x) => x.key === key)!.days;
}

export function MacroRatiosTfStrip({
  selectedKey,
  onSelect,
}: {
  selectedKey: MacroRatiosTfKey;
  onSelect: (key: MacroRatiosTfKey) => void;
}) {
  return (
    <div className="flex flex-shrink-0 flex-wrap justify-end gap-1">
      {MACRO_RATIOS_TF_OPTIONS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onSelect(p.key)}
          className="rounded-[2px] px-2 py-1 text-[10px] font-medium transition-colors"
          style={{
            border: `1px solid ${selectedKey === p.key ? "var(--nd-border)" : "transparent"}`,
            background: selectedKey === p.key ? "var(--nd-panel-soft)" : "transparent",
            color: selectedKey === p.key ? "var(--nd-text)" : "var(--nd-muted)",
          }}
        >
          {p.key}
        </button>
      ))}
    </div>
  );
}

export function MacroRatiosPageStrip({
  page,
  onSelect,
}: {
  page: 1 | 2;
  onSelect: (p: 1 | 2) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-[2px] p-0.5" style={{ background: "var(--nd-panel-soft)" }}>
      {([1, 2] as const).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onSelect(p)}
          className="rounded-[2px] px-2.5 py-1 text-[10px] font-medium transition-colors"
          style={{
            border: "1px solid transparent",
            background: page === p ? "var(--nd-panel)" : "transparent",
            color: page === p ? "var(--nd-text)" : "var(--nd-muted)",
            boxShadow: page === p ? "inset 0 0 0 1px var(--nd-border-soft)" : "none",
          }}
        >
          Page {p}
        </button>
      ))}
    </div>
  );
}

export function MacroRatioCardHeader({
  title,
  subtitle,
  hint,
}: {
  title: string;
  subtitle?: string;
  hint?: string;
}) {
  return (
    <div className="mb-1 flex min-h-[32px] shrink-0 items-start justify-between gap-2">
      <div className="min-w-0">
        <div
          className="text-[10px] font-semibold uppercase leading-tight tracking-[0.08em]"
          style={{ color: "var(--nd-muted)" }}
        >
          {title}
        </div>
        {subtitle ? (
          <div className="mt-0.5 text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--nd-soft)" }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      {hint ? (
        <span title={hint} className="inline-flex shrink-0 cursor-help p-0.5" style={{ color: "var(--nd-muted)" }}>
          <Info size={14} strokeWidth={2} aria-hidden />
        </span>
      ) : null}
    </div>
  );
}

/** SPX (left) + secondary Y (right: ratio or level). Optional US recession shading (chart 1). */
export function DualAxisMacroChart({
  data,
  rightName,
  rightColor,
  spxColor,
  formatRight,
  annotation,
  recessionBands,
}: {
  data: { date: string; spx: number; y: number }[];
  rightName: string;
  rightColor: string;
  spxColor: string;
  formatRight: (v: number) => string;
  annotation?: string;
  recessionBands?: RecessionBand[];
}) {
  const last = useMemo(() => (data.length ? data[data.length - 1] : null), [data]);

  const leftDomain = useMemo(() => paddedYDomain(data.map((d) => d.spx)), [data]);
  const rightDomain = useMemo(() => paddedYDomain(data.map((d) => d.y)), [data]);

  if (!data.length) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-[11px]" style={{ color: "var(--nd-muted)" }}>
        No data
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {last ? (
        <div className="pointer-events-none absolute right-1 top-8 z-10 flex flex-col items-end gap-0.5">
          <div
            className="rounded border px-1.5 py-0.5 font-mono text-[10px] tabular-nums"
            style={{
              borderColor: "var(--nd-border-soft)",
              background: "var(--nd-panel-soft)",
              color: "var(--nd-text)",
            }}
          >
            {formatRight(last.y)}
          </div>
          <div
            className="rounded border px-1.5 py-0.5 font-mono text-[10px] tabular-nums"
            style={{
              borderColor: "var(--nd-border-soft)",
              background: "var(--nd-panel-soft)",
              color: spxColor,
            }}
          >
            {Math.round(last.spx).toLocaleString("en-US")}
          </div>
        </div>
      ) : null}
      <div className="min-h-0 min-w-0 max-w-full w-full flex-1 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          {/* Right margin must fit right YAxis (width 44) + ticks; 12px clipped the scale when tiles use overflow-hidden */}
          <ComposedChart data={data} margin={{ top: 10, right: 80, left: 10, bottom: 20 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="0" />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--nd-muted)", fontSize: 9 }}
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
              yAxisId="left"
              domain={leftDomain}
              tick={{ fill: "var(--nd-muted)", fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v) => {
                const n = Number(v);
                if (!Number.isFinite(n)) return "";
                return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`;
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={rightDomain}
              tick={{ fill: "var(--nd-muted)", fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v) => formatRight(Number(v))}
            />
            <Tooltip
              contentStyle={{ ...TIP, fontSize: 10 }}
              labelFormatter={(v) => {
                try {
                  return format(parseISO(String(v)), "MMM d, yyyy");
                } catch {
                  return String(v);
                }
              }}
            />
            {recessionBands?.map((b, i) => (
              <ReferenceArea
                key={`${b.start}-${b.end}-${i}`}
                x1={b.start}
                x2={b.end}
                fill="rgba(140,140,150,0.22)"
                strokeOpacity={0}
              />
            ))}
            <Line
              yAxisId="left"
              type="linear"
              dataKey="spx"
              name="SPX"
              stroke={spxColor}
              strokeWidth={1.35}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              yAxisId="right"
              type="linear"
              dataKey="y"
              name={rightName}
              stroke={rightColor}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {annotation ? (
        <p className="mt-1 shrink-0 text-[8px] leading-snug" style={{ color: "var(--nd-muted)" }}>
          {annotation}
        </p>
      ) : null}
    </div>
  );
}
