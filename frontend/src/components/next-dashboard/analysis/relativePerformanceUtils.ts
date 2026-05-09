import type { RatioPoint } from "@/types";
import type { CurrencyLine, SectorLine, SentimentDashboardData } from "@/types";

export const RELATIVE_PERF_PERIOD_OPTIONS = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "2Y", days: 730 },
  { label: "ALL", days: 365 * 5 },
] as const;

/** Currency indices shown in Relative Performance (matches dashboard backend labels). */
export const RELATIVE_PERF_CURRENCY_SYMBOLS = new Set([
  "DXY",
  "EXY (EUR)",
  "CXY (CAD)",
  "AXY (AUD)",
  "BXY (GBP)",
  "JXY (JPY)",
]);

export function sanitizeSeriesKey(label: string): string {
  return label.replace(/[^a-zA-Z0-9]/g, "_");
}

export function shortTickerFromSectorLabel(label: string): string {
  if (label.includes("S&P 500")) return "SPY";
  if (label.startsWith("BTC")) return "BTC";
  const dash = label.indexOf(" - ");
  if (dash > 0) return label.slice(0, dash).trim();
  const sp = label.split(/\s+/)[0];
  return sp ?? label;
}

export function shortTickerFromCurrencyLabel(symbol: string): string {
  const paren = symbol.indexOf(" (");
  return paren > 0 ? symbol.slice(0, paren).trim() : symbol.trim();
}

export function lastPointValue(pts: RatioPoint[] | undefined): number | null {
  if (!pts?.length) return null;
  const v = pts[pts.length - 1]?.value;
  return v == null || !Number.isFinite(v) ? null : v;
}

/** Row for merged multi-series LWChart data (date + numeric series keys). */
export type MergedChartRow = { date: string; [key: string]: string | number | null };

export function mergeSectorLines(lines: SectorLine[]): {
  data: MergedChartRow[];
  keys: string[];
} {
  const dateMap = new Map<string, MergedChartRow>();
  const keys = lines.map((ln) => sanitizeSeriesKey(ln.symbol));

  lines.forEach((ln, i) => {
    const key = keys[i];
    for (const pt of ln.series) {
      if (!dateMap.has(pt.date)) dateMap.set(pt.date, { date: pt.date });
      dateMap.get(pt.date)![key] = pt.value;
    }
  });

  const data = Array.from(dateMap.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );
  return { data, keys };
}

export function mergeCurrencyLines(lines: CurrencyLine[]): {
  data: MergedChartRow[];
  keys: string[];
} {
  const dateMap = new Map<string, MergedChartRow>();
  const keys = lines.map((ln) => sanitizeSeriesKey(ln.symbol));

  lines.forEach((ln, i) => {
    const key = keys[i];
    for (const pt of ln.series) {
      if (!dateMap.has(pt.date)) dateMap.set(pt.date, { date: pt.date });
      dateMap.get(pt.date)![key] = pt.value;
    }
  });

  const data = Array.from(dateMap.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );
  return { data, keys };
}

export type SentimentRelPerfKey = "non_cyclical" | "cyclical" | "sensitive" | "high_beta";

export function mergeSentimentSeries(sentiment: SentimentDashboardData | undefined): {
  data: MergedChartRow[];
} {
  const keys: SentimentRelPerfKey[] = ["non_cyclical", "cyclical", "sensitive", "high_beta"];
  const dateMap = new Map<string, MergedChartRow>();

  for (const k of keys) {
    const arr = sentiment?.[k];
    if (!arr?.length) continue;
    for (const pt of arr) {
      if (!dateMap.has(pt.date)) dateMap.set(pt.date, { date: pt.date });
      dateMap.get(pt.date)![k] = pt.value;
    }
  }

  const data = Array.from(dateMap.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );
  return { data };
}
