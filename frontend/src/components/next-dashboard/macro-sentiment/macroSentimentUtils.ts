import { parseISO, subMonths } from "date-fns";
import type { IndicatorCategory, IndicatorValue, IndicatorWithLatest } from "@/types";
import type { TrendDirection } from "@/types";
import { SLUG_TO_CATEGORY } from "@/components/next-dashboard/macro-sentiment/macroSentimentConstants";

export function slugToCategory(slug: string | undefined): IndicatorCategory {
  if (!slug) return "housing";
  return SLUG_TO_CATEGORY[slug] ?? "housing";
}

export function trendLabel(score: number, trend: TrendDirection): string {
  if (trend === "improving") {
    return score > 0.35 ? "Improving" : "Slightly Improving";
  }
  if (trend === "deteriorating") {
    return score < -0.35 ? "Weakening" : "Slightly Weakening";
  }
  return "Neutral";
}

export function formatSignedTwoDecimals(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(2)}`;
}

export function firstByCategory(all: IndicatorWithLatest[], cat: IndicatorCategory): IndicatorWithLatest | null {
  const rows = all
    .filter((i) => i.category === cat)
    .sort((a, b) => b.importance - a.importance);
  return rows[0] ?? null;
}

export function momPct(row: IndicatorWithLatest): string {
  if (row.latest_value == null || row.previous_value == null || row.previous_value === 0) return "—";
  const raw = ((row.latest_value - row.previous_value) / Math.abs(row.previous_value)) * 100;
  return `${raw >= 0 ? "+" : ""}${raw.toFixed(1)}%`;
}

export function approxYoY(history: IndicatorValue[] | undefined, row: IndicatorWithLatest): string {
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

export function historySparkValues(history: IndicatorValue[] | undefined, take: number): number[] {
  if (!history?.length) return [];
  const vals = history
    .slice(0, take)
    .map((h) => h.value)
    .filter((v): v is number => v != null && Number.isFinite(v))
    .reverse();
  return vals;
}

export function longHistorySpark(history: IndicatorValue[] | undefined): number[] {
  if (!history?.length) return [];
  const vals = [...history]
    .map((h) => h.value)
    .filter((v): v is number => v != null && Number.isFinite(v))
    .reverse();
  if (vals.length <= 48) return vals;
  const step = Math.ceil(vals.length / 48);
  return vals.filter((_, i) => i % step === 0);
}

export function fmtIndicator(value: number, unit: string | null): string {
  if (unit === "%" || unit?.includes("%")) return `${value.toFixed(2)}%`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(2)}k`;
  return value.toFixed(2);
}

/**
 * Rolling z-score: at each date, mean & sample σ over the last `windowSize` levels (including current).
 * First (windowSize − 1) points have no z yet → null (warm-up).
 */
export function computeRollingZScores(
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
    const z = std < 1e-12 || !Number.isFinite(last) ? null : (last - mean) / std;
    out.push({ date: levels[i].date, z });
  }
  return out;
}
