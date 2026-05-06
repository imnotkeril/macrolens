import { differenceInMonths, format, parseISO, subDays } from "date-fns";
import type { RatioPoint, TimeSeriesPoint, YieldSpread } from "@/types";
import { YIELD_SNAPSHOT_TENORS, type YieldSnapshotTenor } from "./yieldCurveConstants";

export function spreadBpByName(spreads: YieldSpread[] | undefined, name: string): number | null {
  const row = spreads?.find((s) => s.name === name);
  return row != null && Number.isFinite(row.value) ? row.value : null;
}

export function buildSnapshotTenorRows(
  snapshotPoints: Array<{ maturity: string; nominal_yield: number }>,
  historySnapshots: Array<{ points: Array<{ maturity: string; nominal_yield: number }> }> | undefined,
): Array<{
  tenor: YieldSnapshotTenor;
  now: number | null;
  ago3m: number | null;
  ago6m: number | null;
  ago1y: number | null;
}> {
  const hist = historySnapshots ?? [];
  const ago3m = hist[0]?.points;
  const ago6m = hist[1]?.points;
  const ago1y = hist[2]?.points;

  const pick = (pts: Array<{ maturity: string; nominal_yield: number }> | undefined, m: string) =>
    pts?.find((p) => p.maturity === m)?.nominal_yield ?? null;

  return YIELD_SNAPSHOT_TENORS.map((tenor) => ({
    tenor,
    now: pick(snapshotPoints, tenor),
    ago3m: pick(ago3m, tenor),
    ago6m: pick(ago6m, tenor),
    ago1y: pick(ago1y, tenor),
  }));
}

/**
 * Months of continuous 2s10s inversion implied by the series (last point must be < 0).
 * Walks backward from the latest observation until the spread is last >= 0.
 */
/** Map FRED/Yahoo market series points to `RatioPoint` for Recharts cards. */
export function marketSeriesToRatioPoints(data: TimeSeriesPoint[] | undefined): RatioPoint[] | undefined {
  if (!data?.length) return undefined;
  return data.map((d) => ({ date: d.date, value: d.value }));
}

/**
 * Rolling speed of 2Y–10Y spread change: compare current spread to value ~90 calendar days ago,
 * divide by 3 to express as bp per month (matches "3-month change / 3").
 */
export function buildCurveMomentumBpPerMonth(
  points: TimeSeriesPoint[],
  lagDays = 90,
  monthsPerWindow = 3,
): RatioPoint[] {
  if (!points?.length) return [];
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const out: RatioPoint[] = [];
  const denom = Math.max(1e-6, monthsPerWindow);

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    if (!Number.isFinite(cur.value)) continue;
    const end = parseISO(cur.date);
    const cutoffStr = format(subDays(end, lagDays), "yyyy-MM-dd");
    let prev: number | null = null;
    for (let j = i; j >= 0; j--) {
      if (sorted[j].date <= cutoffStr) {
        const v = sorted[j].value;
        if (Number.isFinite(v)) prev = v;
        break;
      }
    }
    if (prev == null) continue;
    const bpPerMo = (cur.value - prev) / denom;
    out.push({ date: cur.date, value: Math.round(bpPerMo * 100) / 100 });
  }
  return out;
}

export function consecutiveInversionMonths(
  rows: Array<{ date: string; value: number }>,
): number | null {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return null;
  const last = sorted[sorted.length - 1];
  if (!Number.isFinite(last.value) || last.value >= 0) return null;

  let startIdx = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].value >= 0) {
      startIdx = i + 1;
      break;
    }
    if (i === 0) startIdx = 0;
  }

  const start = parseISO(sorted[startIdx].date);
  const end = parseISO(last.date);
  const months = differenceInMonths(end, start);
  return Math.max(1, months + 1);
}

/** Consecutive weeks where 2s10s momentum keeps the same sign (proxy for regime persistence). */
export function estimateRegimePersistenceWeeks(
  rows: Array<{ date: string; value: number }>,
  epsilon = 0.05,
): number | null {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return null;
  const signOf = (v: number) => (v > epsilon ? 1 : v < -epsilon ? -1 : 0);
  const lastSign = signOf(sorted[sorted.length - 1].value);
  if (lastSign === 0) return null;

  let count = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (signOf(sorted[i].value) !== lastSign) break;
    count += 1;
  }
  return Math.max(1, Math.round(count / 5));
}
