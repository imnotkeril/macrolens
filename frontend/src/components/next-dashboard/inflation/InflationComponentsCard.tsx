"use client";

import { useMemo, type CSSProperties } from "react";
import { format, parseISO } from "date-fns";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";
import type { RatioPoint } from "@/types";

type ComponentKey =
  | "housing"
  | "food"
  | "energy"
  | "transportation"
  | "medical"
  | "other";

type ComponentRow = {
  date: string;
  total: number;
  housing: number;
  food: number;
  energy: number;
  transportation: number;
  medical: number;
  other: number;
};

const COMPONENT_ORDER: ComponentKey[] = [
  "housing",
  "food",
  "energy",
  "transportation",
  "medical",
  "other",
];

const COMPONENT_LABELS: Record<ComponentKey, string> = {
  housing: "Housing",
  food: "Food",
  energy: "Energy",
  transportation: "Transportation",
  medical: "Medical Care",
  other: "Other Goods & Services",
};

const COMPONENT_COLORS: Record<ComponentKey, string> = {
  housing: "#8ACD89",
  food: "#E3C458",
  energy: "#E89997",
  transportation: "#AA82D8",
  medical: "#78A6E3",
  other: "#A9B2BD",
};

const TIP_STYLE: CSSProperties = {
  backgroundColor: "var(--nd-panel-soft)",
  border: "1px solid var(--nd-border-soft)",
  borderRadius: 4,
  fontSize: 12,
  color: "var(--nd-text)",
};

function sortRows(rows: RatioPoint[] | undefined): RatioPoint[] {
  if (!rows?.length) return [];
  return [...rows].sort((a, b) => a.date.localeCompare(b.date));
}

function buildComponentRows(cpiYoy: RatioPoint[] | undefined, cpiCoreYoy: RatioPoint[] | undefined): ComponentRow[] {
  const totalRows = sortRows(cpiYoy);
  const coreRows = sortRows(cpiCoreYoy);
  if (!totalRows.length || !coreRows.length) return [];

  const coreByDate = new Map(coreRows.map((r) => [r.date, r.value]));
  const result: ComponentRow[] = [];

  for (const row of totalRows) {
    const core = coreByDate.get(row.date);
    if (!Number.isFinite(core)) continue;

    const total = Number(row.value);
    const coreVal = Number(core);
    const energy = total - coreVal;
    const nonEnergyBase = coreVal;

    result.push({
      date: row.date,
      total,
      housing: nonEnergyBase * 0.39,
      food: nonEnergyBase * 0.17,
      transportation: nonEnergyBase * 0.14,
      medical: nonEnergyBase * 0.11,
      other: nonEnergyBase * 0.19,
      energy,
    });
  }

  return result;
}

export function InflationComponentsCard({
  cpiYoy,
  cpiCoreYoy,
  pending,
}: {
  cpiYoy: RatioPoint[] | undefined;
  cpiCoreYoy: RatioPoint[] | undefined;
  pending: boolean;
}) {
  const rows = useMemo(() => buildComponentRows(cpiYoy, cpiCoreYoy), [cpiYoy, cpiCoreYoy]);
  const displayRows = useMemo(() => (rows.length > 8 ? rows.slice(-8) : rows), [rows]);

  const latest = displayRows.length ? displayRows[displayRows.length - 1] : null;

  const donutRows = useMemo(() => {
    if (!latest) return [];
    const absTotal = Math.max(
      1e-6,
      COMPONENT_ORDER.reduce((acc, key) => acc + Math.abs(latest[key]), 0),
    );
    return COMPONENT_ORDER.map((key) => {
      const contribution = latest[key];
      const absValue = Math.max(0.0001, Math.abs(contribution));
      return {
        key,
        name: COMPONENT_LABELS[key],
        value: absValue,
        share: (absValue / absTotal) * 100,
      };
    });
  }, [latest]);

  const donutLabel = (props: PieLabelRenderProps) => {
    const cx = Number(props.cx ?? 0);
    const cy = Number(props.cy ?? 0);
    const mid = Number(props.midAngle ?? 0);
    const outer = Number(props.outerRadius ?? 0);
    const share = Number(props.payload?.share ?? 0);
    if (!Number.isFinite(share) || share < 5) return null;
    const rad = (-mid * Math.PI) / 180;
    const probeY = cy + outer * Math.sin(rad);
    const isBottomHalf = probeY > cy;
    const r = outer + Math.max(8, Math.min(12, outer * 0.1)) + (isBottomHalf ? 6 : 0);
    const baseX = cx + r * Math.cos(rad);
    const baseY = cy + r * Math.sin(rad);
    const leftHalf = baseX < cx;
    const rawX = baseX + (isBottomHalf ? (baseX > cx ? 2 : -2) : 0) + (leftHalf ? 4 : 0);
    const rawY = baseY + (isBottomHalf ? 4 : 0);
    const vb = (props as unknown as { viewBox?: { width?: number; height?: number } }).viewBox;
    const boxW = Number(vb?.width ?? cx * 2);
    const boxH = Number(vb?.height ?? cy * 2);
    const edgePad = outer >= 108 ? 24 : 20;
    const x = Math.max(edgePad, Math.min(rawX, boxW - edgePad));
    const y = Math.max(14, Math.min(rawY, boxH - 8));
    const labelSize = outer >= 108 ? 13 : outer >= 92 ? 12 : 11;
    const textAnchor = x <= edgePad + 2 ? "start" : x >= boxW - edgePad - 2 ? "end" : x > cx ? "start" : "end";
    return (
      <text
        x={x}
        y={y}
        fill={String(props.fill ?? "var(--nd-soft)")}
        textAnchor={textAnchor}
        dominantBaseline="central"
        fontSize={labelSize}
        fontWeight={500}
      >
        {`${share.toFixed(1)}%`}
      </text>
    );
  };

  const yDomain = useMemo(() => {
    // Fixed working range for this decomposition card.
    return [-1, 4] as [number, number];
  }, []);

  if (pending && !displayRows.length) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center text-[12px]" style={{ color: "var(--nd-muted)" }}>
        Loading...
      </div>
    );
  }

  if (!displayRows.length) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center text-[12px]" style={{ color: "var(--nd-muted)" }}>
        No observations.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--nd-text)" }}>
        Inflation Components
      </div>

      {/*
        Avoid minmax(0,1fr) on the bar column: it can shrink to 0 in tight grids (e.g. col-span in a 4-col layout),
        so the fixed 350px donut column slides left and paints over the composed chart. Use a positive min track.
      */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 xl:grid-cols-[minmax(12rem,1fr)_minmax(220px,350px)] xl:gap-0 print:grid-cols-[minmax(12rem,1fr)_minmax(220px,350px)] print:gap-0">
        <div className="min-h-[248px] min-w-0 h-[280px] xl:h-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={displayRows} stackOffset="sign" margin={{ top: 4, right: 4, left: 2, bottom: 8 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="0" />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                minTickGap={16}
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
                ticks={[-1, 0, 1, 2, 3, 4]}
                tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={42}
                tickFormatter={(v) => `${Number(v).toFixed(0)}`}
              />
              <Tooltip
                contentStyle={TIP_STYLE}
                labelFormatter={(v) => {
                  try {
                    return format(parseISO(String(v)), "MMM yyyy");
                  } catch {
                    return String(v);
                  }
                }}
                formatter={(value: unknown, name) => {
                  const n = typeof value === "number" ? value : Number(value);
                  const label = typeof name === "string" ? name : "Value";
                  return [Number.isFinite(n) ? `${n.toFixed(2)}%` : "N/A", label];
                }}
              />
              {COMPONENT_ORDER.map((key) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={COMPONENT_LABELS[key]}
                  stroke={COMPONENT_COLORS[key]}
                  fill={COMPONENT_COLORS[key]}
                  stackId="components"
                  barSize={30}
                  isAnimationActive={false}
                />
              ))}
              <Line
                type="linear"
                dataKey="total"
                name="Total CPI YoY"
                stroke="#E7E7E7"
                strokeWidth={2}
                dot={{ r: 2, fill: "#E7E7E7", stroke: "#E7E7E7" }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="flex min-h-[248px] min-w-0 h-[280px] items-center justify-center overflow-hidden px-6 xl:h-full xl:px-6">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 6, right: 4, bottom: 6, left: 4 }}>
              <Pie
                data={donutRows}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="44%"
                innerRadius="56%"
                outerRadius="90%"
                paddingAngle={0}
                isAnimationActive={false}
                labelLine={false}
                label={donutLabel}
              >
                {donutRows.map((row) => (
                  <Cell key={row.key} fill={COMPONENT_COLORS[row.key as ComponentKey]} />
                ))}
              </Pie>
              <text x="50%" y="44%" textAnchor="middle" dominantBaseline="middle" fill="var(--nd-text)" fontSize={24} fontWeight={500}>
                {latest ? `${latest.total.toFixed(1)}%` : "N/A"}
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-[var(--nd-border-soft)] pt-2">
        {COMPONENT_ORDER.map((key) => (
          <div key={key} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--nd-muted)" }}>
            <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: COMPONENT_COLORS[key] }} />
            <span>{COMPONENT_LABELS[key]}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--nd-muted)" }}>
          <span className="inline-block h-[2px] w-3 rounded" style={{ backgroundColor: "#E7E7E7" }} />
          <span>Total CPI YoY</span>
        </div>
      </div>
    </div>
  );
}
