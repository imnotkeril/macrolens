import { format, parseISO, startOfWeek } from "date-fns";
import type { RatioPoint } from "@/types";

/** Same Monday-week grouping as weekly index charts — last observation per week. */
export function breadthValuesToWeeklyLast(rows: RatioPoint[]): RatioPoint[] {
  if (!rows.length) return [];
  const groups = new Map<string, RatioPoint[]>();
  for (const p of rows) {
    if (!p.date || !Number.isFinite(p.value)) continue;
    const wk = format(startOfWeek(parseISO(p.date), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const g = groups.get(wk) ?? [];
    g.push(p);
    groups.set(wk, g);
  }
  const keys = [...groups.keys()].sort((a, b) => a.localeCompare(b));
  return keys.map((k) => {
    const group = groups.get(k)!;
    const last = group.reduce((a, b) => (a.date > b.date ? a : b));
    return { date: last.date, value: last.value };
  });
}

/** Merge highs/lows by date for bidirectional bar chart (lows as negative). */
export function mergeHighsLows(
  highs: RatioPoint[],
  lows: RatioPoint[],
): { date: string; highs: number | null; lows: number | null }[] {
  const byDate = new Map<string, { h?: number; l?: number }>();
  for (const p of highs) {
    if (!p.date || !Number.isFinite(p.value)) continue;
    const cur = byDate.get(p.date) ?? {};
    cur.h = p.value;
    byDate.set(p.date, cur);
  }
  for (const p of lows) {
    if (!p.date || !Number.isFinite(p.value)) continue;
    const cur = byDate.get(p.date) ?? {};
    cur.l = p.value;
    byDate.set(p.date, cur);
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({
      date,
      highs: v.h ?? null,
      lows: v.l != null ? -Math.abs(v.l) : null,
    }));
}

/** Inner join two series by date for dual-axis / overlay charts. */
export function innerJoinByDate(
  a: RatioPoint[],
  b: RatioPoint[],
): { date: string; a: number; b: number }[] {
  const mapB = new Map(b.map((p) => [p.date, p.value]));
  const out: { date: string; a: number; b: number }[] = [];
  for (const p of a) {
    const v = mapB.get(p.date);
    if (v == null || !Number.isFinite(v) || !Number.isFinite(p.value)) continue;
    out.push({ date: p.date, a: p.value, b: v });
  }
  return out.sort((x, y) => x.date.localeCompare(y.date));
}

export function meanOf(values: number[]): number | null {
  if (!values.length) return null;
  const s = values.reduce((acc, v) => acc + v, 0);
  return s / values.length;
}
