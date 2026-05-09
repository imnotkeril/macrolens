import { format, parseISO, startOfWeek } from "date-fns";
import type { RatioPoint } from "@/types";

/** Last observation per ISO week — single-series macro lines (Page 2). */
export function weeklyLastRatioPoints(rows: RatioPoint[]): RatioPoint[] {
  if (!rows.length) return [];
  const groups = new Map<string, RatioPoint[]>();
  for (const r of rows) {
    if (!r.date || !Number.isFinite(r.value)) continue;
    const wk = format(startOfWeek(parseISO(r.date), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const g = groups.get(wk) ?? [];
    g.push(r);
    groups.set(wk, g);
  }
  const keys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));
  return keys.map((k) => {
    const g = groups.get(k)!;
    const last = g.reduce((a, b) => (a.date > b.date ? a : b));
    return { date: last.date, value: last.value };
  });
}

/**
 * Credit impulse: YoY change of YoY % growth (monthly private credit, e.g. TOTALSL) — axis in percentage points.
 * Requires ≥25 consecutive monthly observations (same calendar spacing).
 */
export function computeCreditImpulsePctPts(sortedAsc: RatioPoint[]): RatioPoint[] {
  const s = [...sortedAsc].sort((a, b) => a.date.localeCompare(b.date));
  if (s.length < 25) return [];
  const pctYoy: (number | null)[] = s.map((_, i) => {
    if (i < 12) return null;
    const prev = s[i - 12]!.value;
    if (!Number.isFinite(prev) || prev === 0) return null;
    return ((s[i]!.value - prev) / prev) * 100;
  });
  const out: RatioPoint[] = [];
  for (let i = 24; i < s.length; i++) {
    const a = pctYoy[i];
    const b = pctYoy[i - 12];
    if (a == null || b == null) continue;
    out.push({ date: s[i]!.date, value: a - b });
  }
  return out;
}

/** Map macro balance-sheet millions USD → trillions USD for axis/labels. */
export function millionsUsdToTrillions(v: number): number {
  return v / 1_000_000;
}

/** RRP (FRED millions USD) → billions for display. */
export function rrpMillionsToBillions(v: number): number {
  return v / 1000;
}

/** Last observation per ISO week (Monday week key) — aligns ratio + SPX overlays. */
export function weeklyLastMerged(
  rows: { date: string; spx: number; y: number }[],
): { date: string; spx: number; y: number }[] {
  if (!rows.length) return [];
  const groups = new Map<string, { date: string; spx: number; y: number }[]>();
  for (const r of rows) {
    if (!r.date || !Number.isFinite(r.spx) || !Number.isFinite(r.y)) continue;
    const wk = format(startOfWeek(parseISO(r.date), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const g = groups.get(wk) ?? [];
    g.push(r);
    groups.set(wk, g);
  }
  const keys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));
  return keys.map((k) => {
    const g = groups.get(k)!;
    const last = g.reduce((a, b) => (a.date > b.date ? a : b));
    return { date: last.date, spx: last.spx, y: last.y };
  });
}

/** Inner join SPX with another series by date (daily). */
export function mergeSpxWithSeries(
  spx: RatioPoint[],
  series: RatioPoint[],
): { date: string; spx: number; y: number }[] {
  const mapS = new Map(spx.map((p) => [p.date, p.value]));
  const out: { date: string; spx: number; y: number }[] = [];
  for (const p of series) {
    const sx = mapS.get(p.date);
    if (sx == null || !Number.isFinite(sx) || !Number.isFinite(p.value)) continue;
    out.push({ date: p.date, spx: sx, y: p.value });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
