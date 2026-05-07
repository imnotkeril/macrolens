"use client";

import { format, parseISO } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type AnyRow = Record<string, unknown> & { date: string };

export type BaseChartReferenceLine = {
  y: number;
  stroke?: string;
  strokeDasharray?: string;
  strokeWidth?: number;
  label?: {
    value: string;
    position?: "right" | "insideRight";
    fill?: string;
    fontSize?: number;
  };
};

export type BaseChartReferenceArea = {
  y1: number;
  y2: number;
  fill?: string;
  fillOpacity?: number;
  x1?: string;
  x2?: string;
  ifOverflow?: "hidden" | "visible" | "discard" | "extendDomain";
};

function roundedAutoDomain(values: number[], minStep = 0.1, padPct = 0.1): [number, number] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(1e-9, hi - lo);
  const rawLo = lo - span * padPct;
  const rawHi = hi + span * padPct;
  const stepBase = Math.max(minStep, Math.abs(rawHi - rawLo) / 8);
  const pow10 = Math.pow(10, Math.floor(Math.log10(stepBase)));
  const step = Math.ceil(stepBase / pow10) * pow10;
  return [Math.floor(rawLo / step) * step, Math.ceil(rawHi / step) * step];
}

export function BaseTimeSeriesLineChart<T extends AnyRow>({
  data,
  dataKey,
  height,
  lineColor,
  lineName,
  yTickFormatter,
  tooltipValueFormatter,
  yMinStep = 0.1,
  yPadPct = 0.12,
  includeValuesInDomain,
  referenceLines,
  referenceAreas,
  yAxisWidth = 40,
  strokeWidth = 1.25,
}: {
  data: T[];
  dataKey: keyof T;
  height: number;
  lineColor: string;
  lineName: string;
  yTickFormatter: (v: number) => string;
  tooltipValueFormatter: (v: number) => string;
  yMinStep?: number;
  yPadPct?: number;
  includeValuesInDomain?: number[];
  referenceLines?: BaseChartReferenceLine[];
  referenceAreas?: BaseChartReferenceArea[];
  yAxisWidth?: number;
  strokeWidth?: number;
}) {
  const vals = data
    .map((d) => Number(d[dataKey]))
    .filter((v) => Number.isFinite(v));

  const yDomain = vals.length
    ? roundedAutoDomain([...(includeValuesInDomain ?? []), ...vals], yMinStep, yPadPct)
    : ([0, 1] as [number, number]);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="0" />
          {referenceAreas?.map((a, i) => (
            <ReferenceArea
              key={`ra-${i}`}
              x1={a.x1}
              x2={a.x2}
              y1={a.y1}
              y2={a.y2}
              fill={a.fill ?? "rgba(255,255,255,0.08)"}
              fillOpacity={a.fillOpacity ?? 0.12}
              strokeOpacity={0}
              ifOverflow={a.ifOverflow ?? "visible"}
            />
          ))}
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
            domain={yDomain}
            tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={yAxisWidth}
            tickFormatter={(v) => yTickFormatter(Number(v))}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--nd-panel-soft)",
              border: "1px solid var(--nd-border-soft)",
              borderRadius: 4,
              fontSize: 11,
              color: "var(--nd-text)",
            }}
            labelFormatter={(v) => {
              try {
                return format(parseISO(String(v)), "MMM d, yyyy");
              } catch {
                return String(v);
              }
            }}
            formatter={(value: unknown) => {
              const n = typeof value === "number" ? value : Number(value);
              return [Number.isFinite(n) ? tooltipValueFormatter(n) : "—", lineName];
            }}
          />
          {referenceLines?.map((r, i) => (
            <ReferenceLine
              key={`rl-${i}`}
              y={r.y}
              stroke={r.stroke ?? "rgba(255,255,255,0.25)"}
              strokeDasharray={r.strokeDasharray ?? "4 4"}
              strokeWidth={r.strokeWidth ?? 1}
              label={r.label}
            />
          ))}
          <Line
            type="linear"
            dataKey={String(dataKey)}
            stroke={lineColor}
            strokeWidth={strokeWidth}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

