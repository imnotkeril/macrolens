import { format, parseISO, startOfWeek, subDays } from "date-fns";
import type { IndexPricePoint } from "@/types";

export const MAJOR_INDICES_PERIOD_OPTIONS = [
  { days: 180, label: "6M" },
  { days: 365, label: "1Y" },
  { days: 730, label: "2Y" },
  { days: 365 * 5, label: "ALL" },
] as const;

export const DEFAULT_MAJOR_INDICES_DAYS = 365;

export type WeeklyIndexPoint = {
  date: string;
  price: number;
  ma200: number | null;
};

function weekStartMondayKey(dateStr: string): string {
  const d = parseISO(dateStr);
  return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

/** Last trading day per ISO week — weekly price chart. */
export function dailyIndexToWeeklyLast(daily: IndexPricePoint[]): WeeklyIndexPoint[] {
  const groups = new Map<string, IndexPricePoint[]>();
  for (const p of daily) {
    const k = weekStartMondayKey(p.date);
    const g = groups.get(k) ?? [];
    g.push(p);
    groups.set(k, g);
  }
  const keys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));
  return keys.map((k) => {
    const group = groups.get(k)!;
    const last = group.reduce((a, b) => (a.date > b.date ? a : b));
    return {
      date: last.date,
      price: last.price,
      ma200: last.ma200,
    };
  });
}

export function filterRowsByLookback<T extends { date: string }>(rows: T[], lookbackDays: number): T[] {
  if (!rows.length) return [];
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const end = parseISO(sorted[sorted.length - 1].date);
  const start = subDays(end, lookbackDays);
  const startStr = format(start, "yyyy-MM-dd");
  return sorted.filter((r) => r.date >= startStr);
}

export function computeRangeAth(weekly: WeeklyIndexPoint[]): number | null {
  if (!weekly.length) return null;
  return Math.max(...weekly.map((w) => w.price));
}

/** Up to three swing lows (local minima) on the weekly series — dashed support lines. */
export function computeSwingSupportLevels(weekly: WeeklyIndexPoint[], maxLevels = 3): number[] {
  if (weekly.length < 3) return [];
  const p = weekly.map((w) => w.price);
  const troughs: number[] = [];
  for (let i = 1; i < weekly.length - 1; i++) {
    if (p[i] <= p[i - 1] && p[i] <= p[i + 1]) {
      troughs.push(p[i]);
    }
  }
  if (!troughs.length) return [];
  const rounded = troughs.map((x) => Math.round(x * 100) / 100);
  const uniq = Array.from(new Set(rounded)).sort((a, b) => a - b);
  return uniq.slice(0, maxLevels);
}

export function buildFlatMetricSeries(dates: string[], value: number | null | undefined): { date: string; value: number }[] {
  if (value == null || !Number.isFinite(value)) return [];
  return dates.map((date) => ({ date, value }));
}

export function lastRatioValue(rows: { date: string; value: number }[]): number | null {
  if (!rows.length) return null;
  const v = rows[rows.length - 1].value;
  return Number.isFinite(v) ? v : null;
}
