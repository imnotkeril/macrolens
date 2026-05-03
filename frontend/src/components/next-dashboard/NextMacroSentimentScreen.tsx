"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { format, parseISO, subMonths } from "date-fns";
import { ArrowDown, ArrowRight, ArrowUp, Minus } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { NextDashboardShell } from "@/components/next-dashboard/NextDashboardShell";
import { NEXT_DASHBOARD_NAV_ITEMS } from "@/components/next-dashboard/nextDashboardConfig";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";
import type { NextShellThemeContextValue } from "@/components/next-dashboard/nextShellTheme";
import { nextPanelSurfaceStyle } from "@/components/next-dashboard/nextPanelSurface";
import { cycleScoreToZ } from "@/components/next-dashboard/nextRadarPanels";
import { useDataRefresh } from "@/lib/useDataRefresh";
import {
  getCategoryScores,
  getIndicatorHistory,
  getIndicators,
  getRegimeCurrent,
  getRegimeHistory,
} from "@/lib/api";
import { dashboardQueryKeys } from "@/features/dashboard/queryKeys";
import { deriveDashboardUpdatedAtLabel } from "@/features/dashboard/utils/dashboardAsOf";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/utils";
import type { CategoryScore, IndicatorCategory, IndicatorValue, IndicatorWithLatest } from "@/types";
import type { TrendDirection } from "@/types";

const CATEGORY_PHASE: Record<IndicatorCategory, string> = {
  housing: "Leading",
  orders: "Leading",
  income_sales: "Coincident",
  employment: "Lagging",
  inflation: "Coincident",
};

const SLUG_TO_CATEGORY: Record<string, IndicatorCategory> = {
  housing: "housing",
  "orders-production": "orders",
  orders: "orders",
  "income-sales": "income_sales",
  employment: "employment",
  inflation: "inflation",
};

/** Categories used for top KPI strip (four sector scores + composite). */
const KPI_SCORE_CATEGORIES: IndicatorCategory[] = ["housing", "orders", "income_sales", "employment"];

const SIDEBAR: { slug: string; label: string; note?: string }[] = [
  { slug: "housing", label: "Housing" },
  { slug: "orders-production", label: "Orders & Production" },
  { slug: "income-sales", label: "Income & Sales" },
  { slug: "employment", label: "Employment" },
  { slug: "inflation", label: "Inflation", note: "Tracked separately" },
];

function slugToCategory(slug: string | undefined): IndicatorCategory {
  if (!slug) return "housing";
  return SLUG_TO_CATEGORY[slug] ?? "housing";
}

function trendLabel(score: number, trend: TrendDirection): string {
  if (trend === "improving") return "Improving";
  if (trend === "deteriorating") {
    return score < -0.35 ? "Weakening" : "Slightly Weakening";
  }
  if (Math.abs(score) < 0.08) return "Neutral";
  return "Flat";
}

function formatSignedTwoDecimals(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(2)}`;
}

function MicroSparkline({
  values,
  stroke,
  height = 36,
}: {
  values: number[];
  stroke: string;
  height?: number;
}) {
  const pts = values.filter((v) => Number.isFinite(v));
  if (pts.length < 2) {
    return <div className="w-full opacity-30" style={{ height }} />;
  }
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const pad = Math.max(1e-6, (max - min) * 0.08);
  const lo = min - pad;
  const hi = max + pad;
  const w = 1000;
  const h = height - 4;
  const path = pts
    .map((v, i) => {
      const x = (i / Math.max(1, pts.length - 1)) * w;
      const y = h - ((v - lo) / (hi - lo)) * h + 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${w} ${height}`}
      className="block min-h-0 min-w-0 w-full"
      preserveAspectRatio="none"
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function firstByCategory(all: IndicatorWithLatest[], cat: IndicatorCategory): IndicatorWithLatest | null {
  const rows = all
    .filter((i) => i.category === cat)
    .sort((a, b) => b.importance - a.importance);
  return rows[0] ?? null;
}

function momPct(row: IndicatorWithLatest): string {
  if (row.latest_value == null || row.previous_value == null || row.previous_value === 0) return "—";
  const raw = ((row.latest_value - row.previous_value) / Math.abs(row.previous_value)) * 100;
  return `${raw >= 0 ? "+" : ""}${raw.toFixed(1)}%`;
}

function approxYoY(history: IndicatorValue[] | undefined, row: IndicatorWithLatest): string {
  if (!history?.length || row.latest_value == null || !row.latest_date) return "—";
  const latestD = parseISO(row.latest_date);
  const target = subMonths(latestD, 12);
  const chronological = [...history].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
  let best: IndicatorValue | null = null;
  for (const h of chronological) {
    if (parseISO(h.date) <= target && h.value != null) best = h;
  }
  if (!best?.value || best.value === 0) return "—";
  const raw = ((row.latest_value - best.value) / Math.abs(best.value)) * 100;
  return `${raw >= 0 ? "+" : ""}${raw.toFixed(1)}%`;
}

function historySparkValues(history: IndicatorValue[] | undefined, take: number): number[] {
  if (!history?.length) return [];
  const vals = history
    .slice(0, take)
    .map((h) => h.value)
    .filter((v): v is number => v != null && Number.isFinite(v))
    .reverse();
  return vals;
}

function longHistorySpark(history: IndicatorValue[] | undefined): number[] {
  if (!history?.length) return [];
  const vals = [...history]
    .map((h) => h.value)
    .filter((v): v is number => v != null && Number.isFinite(v))
    .reverse();
  if (vals.length <= 48) return vals;
  const step = Math.ceil(vals.length / 48);
  return vals.filter((_, i) => i % step === 0);
}

type NextShellColors = NextShellThemeContextValue["colors"];

/** Table body scroll — ~5 rows + header; aligns with sidebar column height on xl. */
const TABLE_SCROLL_MAX_PX = 340;

const CHART_PERIODS = [
  { label: "1M", months: 1 },
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "2Y", months: 24 },
  { label: "ALL", months: 0 },
] as const;

function filterChartPeriod<T extends { date: string }>(rows: T[], period: string): T[] {
  if (period === "ALL") return rows;
  const p = CHART_PERIODS.find((x) => x.label === period);
  if (!p || p.months === 0) return rows;
  const cutoff = subMonths(new Date(), p.months).toISOString().slice(0, 10);
  return rows.filter((d) => d.date >= cutoff);
}

/** Rolling window length (monthly → ~2 years of history). */
const Z_ROLLING_WINDOW = 24;

/**
 * Rolling z-score: at each date, mean & sample σ over the last `windowSize` levels (including current).
 * First (windowSize − 1) points have no z yet → null (warm-up).
 */
function computeRollingZScores(
  levels: Array<{ date: string; v: number }>,
  windowSize: number,
): Array<{ date: string; z: number | null }> {
  if (levels.length === 0) return [];
  const out: Array<{ date: string; z: number | null }> = [];
  const w = windowSize;

  for (let i = 0; i < levels.length; i++) {
    if (i < w - 1) {
      out.push({ date: levels[i].date, z: null });
      continue;
    }
    const slice = levels.slice(i - w + 1, i + 1).map((p) => p.v);
    const mean = slice.reduce((a, b) => a + b, 0) / w;
    let variance = 0;
    for (const x of slice) {
      variance += (x - mean) ** 2;
    }
    variance /= w - 1;
    const std = Math.sqrt(Math.max(variance, 0));
    const last = levels[i].v;
    const z =
      std < 1e-12 || !Number.isFinite(last) ? null : (last - mean) / std;
    out.push({ date: levels[i].date, z });
  }
  return out;
}

/** ±2σ band for rolling-z reference guides. */
const Z_SCORE_BAND = 2;

const rechartsTooltipStyle = {
  backgroundColor: "var(--nd-panel-soft)",
  border: "1px solid var(--nd-border-soft)",
  borderRadius: 4,
  fontSize: 12,
  color: "var(--nd-text)",
};

function ChartPeriodStrip({ period, onChange }: { period: string; onChange: (p: string) => void }) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {CHART_PERIODS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => onChange(p.label)}
          className="rounded-[2px] px-2 py-1.5 text-[11px] font-medium transition-colors"
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
  );
}

function MacroSentimentDetailChart({
  palette: C,
  rows,
  height,
  formatY,
  period,
}: {
  palette: NextShellColors;
  rows: Array<{ date: string; v: number }>;
  height: number;
  formatY: (v: number) => string;
  period: string;
}) {
  const filtered = useMemo(() => filterChartPeriod(rows, period), [rows, period]);

  const yDomain = useMemo(() => {
    if (!filtered.length) return [0, 1] as [number, number];
    const vals = filtered.map((d) => d.v).filter(Number.isFinite);
    if (!vals.length) return [0, 1];
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = Math.max(1e-9, (hi - lo) * 0.08);
    return [lo - pad, hi + pad] as [number, number];
  }, [filtered]);

  if (!filtered.length) {
    return (
      <div
        className="flex items-center justify-center rounded-[2px] text-[12px]"
        style={{ height, color: "var(--nd-muted)", background: "rgba(255,255,255,0.02)" }}
      >
        No observations in this range.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={filtered} margin={{ top: 6, right: 10, left: 2, bottom: 6 }}>
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
            domain={yDomain}
            tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v) => formatY(Number(v))}
          />
          <Tooltip
            contentStyle={rechartsTooltipStyle}
            labelFormatter={(v) => {
              try {
                return format(parseISO(String(v)), "MMM d, yyyy");
              } catch {
                return String(v);
              }
            }}
            formatter={(value) => {
              const v = typeof value === "number" ? value : Number(value);
              return [Number.isFinite(v) ? formatY(v) : "—", "Level"];
            }}
          />
          <Line
            type="linear"
            dataKey="v"
            stroke={String(C.blue)}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Rolling z vs trailing window — same period strip as level chart; ±2σ guides (green/red). */
function MacroSentimentZScoreChart({
  palette: C,
  rows,
  height,
  period,
}: {
  palette: NextShellColors;
  rows: Array<{ date: string; z: number | null }>;
  height: number;
  period: string;
}) {
  const filtered = useMemo(() => filterChartPeriod(rows, period), [rows, period]);

  const neutralZStroke = String(C.muted);

  const zDomain = useMemo(() => {
    const vals = filtered.map((d) => d.z).filter((z): z is number => z != null && Number.isFinite(z));
    if (!vals.length) return [-2.5, 2.5] as [number, number];
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    const span = hi - lo;
    const pad = Math.max(span * 0.12, 0.35);
    lo -= pad;
    hi += pad;
    lo = Math.max(lo, -4);
    hi = Math.min(hi, 4);
    if (hi - lo < 2) {
      const mid = (hi + lo) / 2;
      lo = mid - 1.1;
      hi = mid + 1.1;
    }
    return [lo, hi] as [number, number];
  }, [filtered]);

  const hasAnyZ = useMemo(
    () => filtered.some((d) => d.z != null && Number.isFinite(d.z)),
    [filtered],
  );

  if (!filtered.length || !hasAnyZ) {
    return (
      <div
        className="flex items-center justify-center rounded-[2px] text-[12px]"
        style={{ height, color: "var(--nd-muted)", background: "rgba(255,255,255,0.02)" }}
      >
        Need at least {Z_ROLLING_WINDOW} points before the rolling z appears (warm-up).
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={filtered} margin={{ top: 6, right: 10, left: 2, bottom: 6 }}>
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
            domain={zDomain}
            tick={{ fill: "var(--nd-muted)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v) => Number(v).toFixed(1)}
          />
          <Tooltip
            contentStyle={rechartsTooltipStyle}
            labelFormatter={(v) => {
              try {
                return format(parseISO(String(v)), "MMM d, yyyy");
              } catch {
                return String(v);
              }
            }}
            formatter={(value) => {
              if (value == null || value === "") return ["—", "Z"];
              const v = typeof value === "number" ? value : Number(value);
              return [Number.isFinite(v) ? v.toFixed(2) : "—", "Z"];
            }}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" strokeWidth={1} />
          <ReferenceLine
            y={Z_SCORE_BAND}
            stroke={String(C.green)}
            strokeDasharray="5 5"
            strokeWidth={1}
            label={{ value: "+2σ", fill: String(C.green), fontSize: 9 }}
          />
          <ReferenceLine
            y={-Z_SCORE_BAND}
            stroke={String(C.red)}
            strokeDasharray="5 5"
            strokeWidth={1}
            label={{ value: "−2σ", fill: String(C.red), fontSize: 9 }}
          />
          <Line
            type="linear"
            dataKey="z"
            stroke={neutralZStroke}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function IndicatorDetailCharts({
  palette: C,
  selectedRow,
  levelRows,
  zRows,
}: {
  palette: NextShellColors;
  selectedRow: IndicatorWithLatest;
  levelRows: Array<{ date: string; v: number }>;
  zRows: Array<{ date: string; z: number | null }>;
}) {
  const [period, setPeriod] = useState("1Y");

  useEffect(() => {
    setPeriod("1Y");
  }, [selectedRow.id]);

  return (
    <div className="flex flex-col px-4 pb-3 pt-2">
      <ChartPeriodStrip period={period} onChange={setPeriod} />
      <div className="mt-2 grid gap-3 lg:grid-cols-1">
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
            Level
          </div>
          <MacroSentimentDetailChart
            palette={C}
            rows={levelRows}
            period={period}
            height={200}
            formatY={(v) => fmtIndicator(v, selectedRow.unit)}
          />
        </div>
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
            Rolling z-score (window {Z_ROLLING_WINDOW})
          </div>
          <MacroSentimentZScoreChart palette={C} rows={zRows} period={period} height={172} />
        </div>
      </div>
    </div>
  );
}

export function NextMacroSentimentScreen({ sectionSlug }: { sectionSlug?: string }) {
  const { shellThemeVars, toggleTheme, colors: C } = useNextShellTheme();
  const { refreshing, refreshResult, progress, handleRefresh } = useDataRefresh();
  const surface = useMemo(() => nextPanelSurfaceStyle(C), [C]);
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<number | null>(null);

  const activeCategory = slugToCategory(sectionSlug);

  useEffect(() => {
    setSelectedIndicatorId(null);
  }, [activeCategory]);

  const regimeQ = useQuery({
    queryKey: dashboardQueryKeys.regime,
    queryFn: getRegimeCurrent,
    staleTime: 120_000,
  });
  const categoriesQ = useQuery({
    queryKey: dashboardQueryKeys.categories,
    queryFn: getCategoryScores,
    staleTime: 120_000,
  });
  const indicatorsAllQ = useQuery({
    queryKey: dashboardQueryKeys.indicatorsAll,
    queryFn: () => getIndicators(),
    staleTime: 120_000,
  });
  const regimeHistQ = useQuery({
    queryKey: [...dashboardQueryKeys.regimeHistory, "macro-sentiment-composite"],
    queryFn: () => getRegimeHistory(36),
    staleTime: 120_000,
  });
  const indicatorsCategoryQ = useQuery({
    queryKey: dashboardQueryKeys.indicatorsByCategory(activeCategory),
    queryFn: () => getIndicators(activeCategory),
    staleTime: 120_000,
  });

  const regime = regimeQ.data;

  const firstIdPerKpi = useMemo(() => {
    const all = indicatorsAllQ.data ?? [];
    return KPI_SCORE_CATEGORIES.map((cat) => firstByCategory(all, cat)?.id ?? null);
  }, [indicatorsAllQ.data]);

  const kpiHistories = useQueries({
    queries: KPI_SCORE_CATEGORIES.map((cat, idx) => {
      const id = firstIdPerKpi[idx];
      return {
        queryKey:
          id != null
            ? dashboardQueryKeys.indicatorHistory(id, 14)
            : (["next-dashboard", "indicator-history-kpi-empty", cat] as const),
        queryFn: () => getIndicatorHistory(id!, 14),
        staleTime: 120_000,
        enabled: id != null,
      };
    }),
  });

  const categoryRows = indicatorsCategoryQ.data ?? [];

  const rowHistories = useQueries({
    queries: categoryRows.map((ind) => ({
      queryKey: dashboardQueryKeys.indicatorHistory(ind.id, 300),
      queryFn: () => getIndicatorHistory(ind.id, 300),
      staleTime: 120_000,
      enabled: categoryRows.length > 0,
    })),
  });

  const compositeZ = regime ? cycleScoreToZ(regime.cycle_score) : 0;
  const compositeSpark = useMemo(() => {
    const pts = regimeHistQ.data?.map((p) => cycleScoreToZ(p.cycle_score)) ?? [];
    return pts.length >= 2 ? pts.slice(-24) : pts;
  }, [regimeHistQ.data]);

  const compositeDelta = useMemo(() => {
    const h = regimeHistQ.data;
    if (!h || h.length < 2) return null;
    const a = cycleScoreToZ(h[h.length - 2].cycle_score);
    const b = cycleScoreToZ(h[h.length - 1].cycle_score);
    return b - a;
  }, [regimeHistQ.data]);

  const updatedAt = deriveDashboardUpdatedAtLabel({
    regime,
    navigator: undefined,
    regimePending: regimeQ.isPending,
    navigatorPending: false,
  });

  const scoreByCat = useMemo(() => {
    const list = categoriesQ.data ?? [];
    const m = new Map<string, CategoryScore>();
    for (const c of list) m.set(c.category, c);
    return m;
  }, [categoriesQ.data]);

  const selectedRow = useMemo(() => {
    const rows = indicatorsCategoryQ.data ?? [];
    return rows.find((r) => r.id === selectedIndicatorId) ?? null;
  }, [indicatorsCategoryQ.data, selectedIndicatorId]);

  const selectedRowIndex = useMemo(() => {
    const rows = indicatorsCategoryQ.data ?? [];
    if (selectedIndicatorId == null) return -1;
    return rows.findIndex((r) => r.id === selectedIndicatorId);
  }, [indicatorsCategoryQ.data, selectedIndicatorId]);
  const selectedHistory = selectedRowIndex >= 0 ? rowHistories[selectedRowIndex]?.data : undefined;
  const selectedHistoryPending = selectedRowIndex >= 0 ? Boolean(rowHistories[selectedRowIndex]?.isPending) : false;

  const detailChartData = useMemo(() => {
    if (!selectedHistory?.length) return [];
    const sorted = [...selectedHistory].sort(
      (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime(),
    );
    return sorted
      .filter((h) => h.value != null && Number.isFinite(h.value))
      .map((h) => ({ date: h.date.slice(0, 10), v: h.value as number }));
  }, [selectedHistory]);

  const zSeriesData = useMemo(
    () => computeRollingZScores(detailChartData, Z_ROLLING_WINDOW),
    [detailChartData],
  );

  const TrendGlyph = ({ trend, score }: { trend: TrendDirection; score: number }) => {
    const label = trendLabel(score, trend);
    const Icon =
      trend === "improving" ? ArrowUp : trend === "deteriorating" ? ArrowDown : Math.abs(score) < 0.08 ? Minus : ArrowRight;
    const color =
      trend === "improving" ? C.green : trend === "deteriorating" ? C.red : C.muted;
    return (
      <span className="flex items-center gap-1 text-[12px]" style={{ color }}>
        <Icon className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
        <span className="uppercase tracking-[0.06em]">{label}</span>
      </span>
    );
  };

  return (
    <>
      <NextDashboardShell
        navItems={NEXT_DASHBOARD_NAV_ITEMS}
        colors={C}
        shellThemeVars={shellThemeVars}
        updatedAt={updatedAt}
        refreshing={refreshing}
        refreshResult={refreshResult}
        progress={progress}
        onRefresh={handleRefresh}
        onThemeToggle={toggleTheme}
      >
        <section className="flex flex-col gap-2">
          {/* KPI strip — composite first */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="flex flex-col px-0.5 py-0.5" style={surface}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
                Composite Macro Sentiment
              </div>
              <div className="mt-2 flex items-start justify-between gap-2">
                <div className="shrink-0">
                  <div className="text-[28px] font-extralight leading-none tabular-nums" style={{ color: C.blue }}>
                    {regime ? compositeZ.toFixed(2) : "—"}
                  </div>
                  <div
                    className="mt-2 text-[12px] tabular-nums tracking-[0.02em]"
                    style={{ color: compositeDelta != null ? (compositeDelta >= 0 ? C.green : C.red) : C.muted }}
                  >
                    {compositeDelta != null ? formatSignedTwoDecimals(compositeDelta) : "—"}
                  </div>
                </div>
                <div className="min-h-0 min-w-0 flex-1 self-stretch pt-1">
                  {compositeSpark.length >= 2 ? <MicroSparkline values={compositeSpark} stroke={C.blue} height={44} /> : null}
                </div>
              </div>
            </div>
            {KPI_SCORE_CATEGORIES.map((cat, idx) => {
              const row = scoreByCat.get(cat);
              const sparkQ = kpiHistories[idx];
              const sparkVals = historySparkValues(sparkQ?.data, 10).slice(-8);
              const stroke = row?.color === "green" ? C.green : row?.color === "red" ? C.red : C.yellow;
              return (
                <div key={cat} className="flex flex-col px-0.5 py-0.5" style={surface}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
                    {CATEGORY_LABELS[cat] ?? cat}
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--nd-muted)" }}>
                    {CATEGORY_PHASE[cat]}
                  </div>
                  <div className="mt-2 flex items-start justify-between gap-2">
                    <div className="shrink-0">
                      <div className="text-[28px] font-extralight leading-none tabular-nums" style={{ color: "var(--nd-text)" }}>
                        {row ? row.score.toFixed(2) : "—"}
                      </div>
                      <div className="mt-2">
                        {row ? <TrendGlyph trend={row.trend} score={row.score} /> : <span style={{ color: C.muted }}>—</span>}
                      </div>
                    </div>
                    <div className="min-h-0 min-w-0 flex-1 self-stretch pt-1">
                      {sparkVals.length >= 2 ? <MicroSparkline values={sparkVals} stroke={stroke} height={44} /> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sidebar + table — equal height on xl; table body scrolls */}
          <div className="flex min-h-0 flex-col gap-2 xl:flex-row xl:items-stretch" style={{ minHeight: TABLE_SCROLL_MAX_PX + 80 }}>
            <aside
              className="flex w-full shrink-0 flex-col xl:w-[248px] xl:min-h-0"
              style={{ ...surface, minHeight: TABLE_SCROLL_MAX_PX + 56 }}
            >
              <div className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
                View by category
              </div>
              <nav className="mt-3 flex flex-1 flex-col gap-1.5">
                {SIDEBAR.map((item) => {
                  const href = `/next/macro-sentiment/${item.slug}`;
                  const isActive = activeCategory === slugToCategory(item.slug);
                  return (
                    <Link
                      key={item.slug}
                      href={href}
                      className={cn(
                        "rounded-[2px] px-3 py-2.5 text-[13px] font-light transition-colors",
                        isActive ? "border" : "border border-transparent hover:opacity-90",
                      )}
                      style={{
                        borderColor: isActive ? C.border : "transparent",
                        background: isActive ? "var(--nd-panel-soft)" : "transparent",
                        color: isActive ? C.text : C.soft,
                      }}
                    >
                      <div>{item.label}</div>
                      {item.note ? (
                        <div className="mt-0.5 text-[11px] leading-snug" style={{ color: C.muted }}>
                          {item.note}
                        </div>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </aside>

            <div
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden xl:min-h-0"
              style={{ ...surface, minHeight: TABLE_SCROLL_MAX_PX + 56 }}
            >
              <div className="shrink-0 border-b pb-3" style={{ borderColor: "var(--nd-border-soft)" }}>
                <h2 className="text-[16px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-text)" }}>
                  {CATEGORY_LABELS[activeCategory] ?? activeCategory}{" "}
                  <span className="font-normal" style={{ color: "var(--nd-muted)" }}>
                    ({CATEGORY_PHASE[activeCategory]})
                  </span>
                </h2>
              </div>

              <div
                className="mt-2 min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain"
                style={{ maxHeight: TABLE_SCROLL_MAX_PX }}
              >
                {indicatorsCategoryQ.isPending ? (
                  <div className="flex min-h-[220px] items-center justify-center text-[14px]" style={{ color: C.muted }}>
                    Loading indicators…
                  </div>
                ) : categoryRows.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center text-[14px]" style={{ color: C.muted }}>
                    No indicators for this category.
                  </div>
                ) : (
                  <table className="w-full min-w-[760px] table-fixed border-collapse text-[13px]">
                    <colgroup>
                      <col className="w-[26%]" />
                      <col className="w-[14%]" />
                      <col className="w-[10%]" />
                      <col className="w-[12%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                      <col className="w-[18%]" />
                    </colgroup>
                    <thead>
                      <tr
                        className="sticky top-0 z-[1] border-b text-[11px] uppercase tracking-[0.08em] shadow-[0_1px_0_var(--nd-border-soft)]"
                        style={{
                          borderColor: "var(--nd-border-soft)",
                          color: "var(--nd-muted)",
                          background: "var(--nd-panel)",
                        }}
                      >
                        <th className="py-3 pl-0 pr-2 text-left font-medium">Indicator (FRED)</th>
                        <th className="px-1 py-3 text-right font-medium">Latest</th>
                        <th className="px-1 py-3 text-right font-medium">Z-Score</th>
                        <th className="px-1 py-3 text-center font-medium">Trend (6M)</th>
                        <th className="px-1 py-3 text-right font-medium">MoM</th>
                        <th className="px-1 py-3 text-right font-medium">YoY</th>
                        <th className="py-3 pl-2 pr-0 text-center font-medium">History</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryRows.map((row, i) => {
                        const hist = rowHistories[i]?.data;
                        const six = historySparkValues(hist, 8);
                        const longVals = longHistorySpark(hist);
                        const zColor =
                          row.z_score == null ? C.muted : row.z_score >= 0 ? C.green : C.red;
                        const selected = selectedIndicatorId === row.id;
                        return (
                          <tr
                            key={row.id}
                            tabIndex={0}
                            aria-selected={selected}
                            onClick={() => setSelectedIndicatorId(row.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedIndicatorId(row.id);
                              }
                            }}
                            className={cn(
                              "cursor-pointer border-b transition-colors hover:opacity-[0.92]",
                              selected && "bg-[var(--nd-panel-soft)]",
                            )}
                            style={{ borderColor: "var(--nd-border-soft)" }}
                          >
                            <td className="py-3 pr-2 align-top">
                              <div className="line-clamp-2 font-light leading-snug" style={{ color: "var(--nd-text)" }}>
                                {row.name}
                              </div>
                              <div className="mt-0.5 truncate font-mono text-[11px]" style={{ color: "var(--nd-muted)" }}>
                                {row.fred_series_id}
                              </div>
                            </td>
                            <td className="px-1 py-3 text-right align-top tabular-nums">
                              <div style={{ color: "var(--nd-text)" }}>{row.latest_value != null ? fmtIndicator(row.latest_value, row.unit) : "—"}</div>
                              <div className="mt-0.5 text-[11px]" style={{ color: "var(--nd-muted)" }}>
                                {row.latest_date ? format(parseISO(row.latest_date), "MMM yyyy") : "—"}
                              </div>
                            </td>
                            <td className="px-1 py-3 text-right align-top tabular-nums font-medium" style={{ color: zColor }}>
                              {row.z_score != null ? row.z_score.toFixed(2) : "—"}
                            </td>
                            <td className="px-1 py-3 align-middle">
                              <div className="flex justify-center">{six.length >= 2 ? <MicroSparkline values={six} stroke={C.blue} height={36} /> : "—"}</div>
                            </td>
                            <td className="px-1 py-3 text-right align-top tabular-nums" style={{ color: "var(--nd-soft)" }}>
                              {momPct(row)}
                            </td>
                            <td className="px-1 py-3 text-right align-top tabular-nums" style={{ color: "var(--nd-soft)" }}>
                              {approxYoY(hist, row)}
                            </td>
                            <td className="py-3 pl-2 pr-0 align-middle">
                              <div className="flex justify-center">
                                {longVals.length >= 2 ? <MicroSparkline values={longVals} stroke={C.soft} height={32} /> : "—"}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* Detail chart — appears when a row is selected */}
          {selectedRow ? (
            selectedHistoryPending ? (
              <div className="px-4 py-10 text-center text-[14px]" style={{ ...surface, color: C.muted }}>
                Loading chart…
              </div>
            ) : detailChartData.length >= 2 ? (
              <div className="flex min-h-0 flex-col overflow-hidden" style={surface}>
                <div
                  className="flex shrink-0 flex-wrap items-baseline justify-between gap-2 border-b px-4 pb-2 pt-3"
                  style={{ borderColor: "var(--nd-border-soft)" }}
                >
                  <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--nd-text)" }}>
                    {selectedRow.name}
                  </h3>
                  <span className="font-mono text-[11px]" style={{ color: "var(--nd-muted)" }}>
                    {selectedRow.fred_series_id}
                  </span>
                </div>
                <IndicatorDetailCharts
                  palette={C}
                  selectedRow={selectedRow}
                  levelRows={detailChartData}
                  zRows={zSeriesData}
                />
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-[14px]" style={{ ...surface, color: C.muted }}>
                Not enough history to chart this indicator.
              </div>
            )
          ) : null}
        </section>
      </NextDashboardShell>
    </>
  );
}

function fmtIndicator(value: number, unit: string | null): string {
  if (unit === "%" || unit?.includes("%")) return `${value.toFixed(2)}%`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(2)}k`;
  return value.toFixed(2);
}
