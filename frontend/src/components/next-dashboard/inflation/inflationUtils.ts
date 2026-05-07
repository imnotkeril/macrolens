import type { RatioPoint } from "@/types";
import { filterChartPeriod } from "@/components/next-dashboard/macro-sentiment/MacroSentimentChartBlocks";

export type InflationFrame = "1M" | "3M" | "6M" | "1Y" | "2Y" | "ALL";

export function sortSeries(rows: RatioPoint[] | undefined): RatioPoint[] {
  if (!rows?.length) return [];
  return [...rows].sort((a, b) => a.date.localeCompare(b.date));
}

export function filterSeriesByFrame(rows: RatioPoint[], frame: InflationFrame): RatioPoint[] {
  return filterChartPeriod(rows, frame);
}

export function computeBarColorFlags(rows: RatioPoint[]): Array<RatioPoint & { rising: boolean | null }> {
  return rows.map((row, idx) => {
    if (idx === 0) return { ...row, rising: null };
    const prev = rows[idx - 1]?.value;
    if (!Number.isFinite(prev)) return { ...row, rising: null };
    const rising = row.value > prev;
    return { ...row, rising };
  });
}

export function latestDateAcrossSeries(seriesList: Array<RatioPoint[] | undefined>): string {
  let latest = "";
  for (const series of seriesList) {
    const sorted = sortSeries(series);
    const tail = sorted[sorted.length - 1]?.date;
    if (tail && tail > latest) latest = tail;
  }
  return latest ? `${latest}T16:00:00.000Z` : "—";
}

export function alignSpreadSeries(
  lhs: RatioPoint[] | undefined,
  rhs: RatioPoint[] | undefined,
): RatioPoint[] {
  const left = sortSeries(lhs);
  const right = sortSeries(rhs);
  if (!left.length || !right.length) return [];
  const rMap = new Map(right.map((r) => [r.date, r.value]));
  const out: RatioPoint[] = [];
  for (const l of left) {
    const rv = rMap.get(l.date);
    if (!Number.isFinite(rv)) continue;
    out.push({ date: l.date, value: l.value - (rv as number) });
  }
  return out;
}

export function normalizeOverlayToRange(
  baseRows: Array<{ date: string; primary?: number; secondary?: number }>,
  overlayRows: RatioPoint[] | undefined,
): Record<string, number> {
  const byDate: Record<string, number> = {};
  const ov = sortSeries(overlayRows);
  if (!baseRows.length || !ov.length) return byDate;
  const yVals = baseRows
    .flatMap((r) => [r.primary, r.secondary])
    .filter((v): v is number => Number.isFinite(v));
  const xVals = ov.map((x) => x.value).filter(Number.isFinite);
  if (!yVals.length || !xVals.length) return byDate;
  const yLo = Math.min(...yVals);
  const yHi = Math.max(...yVals);
  const xLo = Math.min(...xVals);
  const xHi = Math.max(...xVals);
  const xSpan = Math.max(1e-9, xHi - xLo);
  // Build a continuous overlay on base dates using forward-fill from the latest known overlay value.
  let idx = 0;
  let current = ov[0]?.value;
  const baseSorted = [...baseRows].sort((a, b) => a.date.localeCompare(b.date));
  for (const row of baseSorted) {
    while (idx + 1 < ov.length && ov[idx + 1].date <= row.date) {
      idx += 1;
      current = ov[idx].value;
    }
    if (!Number.isFinite(current)) continue;
    const scaled = yLo + ((((current as number) - xLo) / xSpan) * (yHi - yLo));
    byDate[row.date] = scaled;
  }
  return byDate;
}

export function pickPastValue(rows: RatioPoint[], monthsBack: number): number | null {
  if (!rows.length) return null;
  const latestDate = rows[rows.length - 1].date;
  const cutoff = new Date(latestDate);
  cutoff.setMonth(cutoff.getMonth() - monthsBack);
  const c = cutoff.toISOString().slice(0, 10);
  let best: number | null = null;
  for (const row of rows) {
    if (row.date <= c) best = row.value;
  }
  return best;
}

