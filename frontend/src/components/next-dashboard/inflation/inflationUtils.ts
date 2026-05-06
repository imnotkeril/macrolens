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

