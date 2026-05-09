"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NextDashboardShell } from "@/components/next-dashboard/NextDashboardShell";
import { NEXT_DASHBOARD_NAV_ITEMS } from "@/components/next-dashboard/nextDashboardConfig";
import { QueryErrorBanner } from "@/components/next-dashboard/QueryErrorBanner";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";
import { nextPanelSurfaceStyle } from "@/components/next-dashboard/nextPanelSurface";
import { useDataRefresh } from "@/lib/useDataRefresh";
import {
  getBreadthDashboard,
  getCryptoDominanceHistory,
  getIndicesDashboard,
  getMarketSeries,
} from "@/lib/api";
import { NEXT_MAJOR_INDICES_ROOT } from "@/components/next-dashboard/analysis/majorIndicesQueryKeys";
import {
  BreadthPercentChart,
  IndexWeeklyPriceChart,
  MajorIndicesPeriodStrip,
} from "@/components/next-dashboard/analysis/majorIndicesCharts";
import {
  computeRangeAth,
  dailyIndexToWeeklyLast,
  DEFAULT_MAJOR_INDICES_DAYS,
  filterRowsByLookback,
} from "@/components/next-dashboard/analysis/majorIndicesUtils";
import type {
  BreadthDashboardData,
  CryptoDominanceHistoryData,
  IndicesDashboardData,
  IndexPricePoint,
  RatioPoint,
} from "@/types";

/** Match Relative Performance / user tuning — fixed px, no vh. */
const TOP_CARD_H = "h-[740px]";
const MACRO_ROW_H = "h-[160px]";

function latestDashboardDate(data: IndicesDashboardData | undefined): string {
  if (!data) return "";
  let max = "";
  const seriesKeys: (keyof IndicesDashboardData)[] = [
    "spx",
    "ndx",
    "rut",
    "btc",
    "spx_above200",
    "spx_above50",
    "ndx_above200",
    "ndx_above50",
    "rut_above200",
    "rut_above50",
  ];
  for (const k of seriesKeys) {
    const arr = data[k];
    if (!Array.isArray(arr) || !arr.length) continue;
    const last = arr[arr.length - 1] as { date?: string };
    const d = last?.date;
    if (d && d > max) max = d;
  }
  return max;
}

/** Normalize API points (DB / JSON may use numeric strings). */
function rowsFromSeries(rows: unknown): RatioPoint[] {
  if (!Array.isArray(rows)) return [];
  const out: RatioPoint[] = [];
  for (const p of rows) {
    const row = p as { date?: string; value?: unknown };
    if (!row.date) continue;
    const raw = row.value;
    const v =
      typeof raw === "number" ? raw : typeof raw === "string" ? parseFloat(raw) : Number(raw);
    if (!Number.isFinite(v)) continue;
    out.push({ date: row.date, value: v });
  }
  return out;
}

/** Indices dashboard → breadth dashboard → raw /api/market/series (same DB path as Market Breadth page). */
function resolveBreadthTriple(
  primary: RatioPoint[],
  dashFb: RatioPoint[],
  seriesFb: RatioPoint[],
  days: number,
): RatioPoint[] {
  let m = filterRowsByLookback(primary, days);
  if (m.length) return m;
  m = filterRowsByLookback(dashFb, days);
  if (m.length) return m;
  return filterRowsByLookback(seriesFb, days);
}

const BREADTH_SERIES_DAYS = 365 * 5 + 300;

type EquityColumnDef = {
  id: string;
  rankLabel: string;
  title: string;
  symbol: string;
  priceKey: "spx" | "ndx" | "rut";
  above200Key: "spx_above200" | "ndx_above200" | "rut_above200";
  above50Key: "spx_above50" | "ndx_above50" | "rut_above50";
};

const EQUITY_COLUMNS: EquityColumnDef[] = [
  {
    id: "spx",
    rankLabel: "1.",
    title: "S&P 500",
    symbol: "SPX",
    priceKey: "spx",
    above200Key: "spx_above200",
    above50Key: "spx_above50",
  },
  {
    id: "ndx",
    rankLabel: "2.",
    title: "NASDAQ 100",
    symbol: "NDX",
    priceKey: "ndx",
    above200Key: "ndx_above200",
    above50Key: "ndx_above50",
  },
  {
    id: "rut",
    rankLabel: "3.",
    title: "Russell 2000",
    symbol: "RUT",
    priceKey: "rut",
    above200Key: "rut_above200",
    above50Key: "rut_above50",
  },
];

export function NextMajorIndicesScreen() {
  const { shellThemeVars, toggleTheme, colors: C } = useNextShellTheme();
  const queryClient = useQueryClient();
  const { refreshing, refreshResult, progress, handleRefresh } = useDataRefresh();
  const surface = useMemo(() => nextPanelSurfaceStyle(C), [C]);
  const panel = useMemo(() => ({ ...surface, padding: "10px 14px" } as const), [surface]);

  const [colDays, setColDays] = useState<[number, number, number, number]>([
    DEFAULT_MAJOR_INDICES_DAYS,
    DEFAULT_MAJOR_INDICES_DAYS,
    DEFAULT_MAJOR_INDICES_DAYS,
    DEFAULT_MAJOR_INDICES_DAYS,
  ]);

  const setDaysForCol = (col: 0 | 1 | 2 | 3, days: number) => {
    setColDays((prev) => {
      const next = [...prev] as [number, number, number, number];
      next[col] = days;
      return next;
    });
  };

  const idxQ = useQuery({
    queryKey: [NEXT_MAJOR_INDICES_ROOT, "dashboard", BREADTH_SERIES_DAYS],
    queryFn: () => getIndicesDashboard(BREADTH_SERIES_DAYS),
    staleTime: 120_000,
  });

  const breadthQ = useQuery({
    queryKey: [NEXT_MAJOR_INDICES_ROOT, "breadth-dashboard", BREADTH_SERIES_DAYS],
    queryFn: () => getBreadthDashboard(BREADTH_SERIES_DAYS),
    staleTime: 120_000,
  });

  const domQ = useQuery({
    queryKey: [NEXT_MAJOR_INDICES_ROOT, "crypto-dominance-history", BREADTH_SERIES_DAYS],
    queryFn: () => getCryptoDominanceHistory(BREADTH_SERIES_DAYS),
    staleTime: 120_000,
  });

  const breadthSeriesQ = useQuery({
    queryKey: [NEXT_MAJOR_INDICES_ROOT, "market-breadth-series", BREADTH_SERIES_DAYS],
    queryFn: async () => {
      const [mmth, mmfi, naa200, naa50] = await Promise.all([
        getMarketSeries("MMTH", BREADTH_SERIES_DAYS),
        getMarketSeries("MMFI", BREADTH_SERIES_DAYS),
        getMarketSeries("NAA200", BREADTH_SERIES_DAYS),
        getMarketSeries("NAA50", BREADTH_SERIES_DAYS),
      ]);
      return {
        mmth: rowsFromSeries(mmth),
        mmfi: rowsFromSeries(mmfi),
        naa200: rowsFromSeries(naa200),
        naa50: rowsFromSeries(naa50),
      };
    },
    staleTime: 120_000,
  });

  const data = idxQ.data;
  const breadthDash = breadthQ.data as BreadthDashboardData | undefined;
  const breadthSeries = breadthSeriesQ.data;
  const domHistory = domQ.data as CryptoDominanceHistoryData | undefined;

  const updatedAt = useMemo(() => latestDashboardDate(data), [data]);

  const errors = useMemo(() => {
    const out: Array<{ label: string; message: string }> = [];
    if (idxQ.isError) out.push({ label: "Indices dashboard", message: String(idxQ.error) });
    if (breadthQ.isError) out.push({ label: "Breadth dashboard", message: String(breadthQ.error) });
    if (breadthSeriesQ.isError)
      out.push({ label: "Breadth series (MMTH/MMFI/NAA)", message: String(breadthSeriesQ.error) });
    if (domQ.isError) out.push({ label: "Crypto dominance history", message: String(domQ.error) });
    return out;
  }, [
    idxQ.isError,
    idxQ.error,
    breadthQ.isError,
    breadthQ.error,
    breadthSeriesQ.isError,
    breadthSeriesQ.error,
    domQ.isError,
    domQ.error,
  ]);

  const onRetry = () => void queryClient.invalidateQueries({ queryKey: [NEXT_MAJOR_INDICES_ROOT] });

  const equityPrepared = useMemo(() => {
    if (!data) return null;
    const mmthDash = rowsFromSeries(breadthDash?.MMTH);
    const mmfiDash = rowsFromSeries(breadthDash?.MMFI);
    const naa200Dash = rowsFromSeries(breadthDash?.NAA200);
    const naa50Dash = rowsFromSeries(breadthDash?.NAA50);
    const mmthS = breadthSeries?.mmth ?? [];
    const mmfiS = breadthSeries?.mmfi ?? [];
    const naa200S = breadthSeries?.naa200 ?? [];
    const naa50S = breadthSeries?.naa50 ?? [];

    const out: Record<
      string,
      {
        weekly: ReturnType<typeof dailyIndexToWeeklyLast>;
        ath: number | null;
        above200: RatioPoint[];
        above50: RatioPoint[];
      }
    > = {};
    EQUITY_COLUMNS.forEach((col, idx) => {
      const days = colDays[idx]!;
      const daily = (data[col.priceKey] as IndexPricePoint[]) ?? [];
      const filteredDaily = filterRowsByLookback(daily, days);
      const weekly = dailyIndexToWeeklyLast(filteredDaily);
      const ath = computeRangeAth(weekly);
      const primary200 = rowsFromSeries(data[col.above200Key]);
      const primary50 = rowsFromSeries(data[col.above50Key]);
      const isNasdaq = col.id === "ndx";
      const dash200 = isNasdaq ? naa200Dash : mmthDash;
      const dash50 = isNasdaq ? naa50Dash : mmfiDash;
      const series200 = isNasdaq ? naa200S : mmthS;
      const series50 = isNasdaq ? naa50S : mmfiS;
      const above200 = resolveBreadthTriple(primary200, dash200, series200, days);
      const above50 = resolveBreadthTriple(primary50, dash50, series50, days);
      out[col.id] = { weekly, ath, above200, above50 };
    });
    return out;
  }, [data, colDays, breadthDash, breadthSeries]);

  const btcPrepared = useMemo(() => {
    if (!data) return null;
    const days = colDays[3]!;
    const daily = data.btc ?? [];
    const filteredDaily = filterRowsByLookback(daily, days);
    const weekly = dailyIndexToWeeklyLast(filteredDaily);
    const ath = computeRangeAth(weekly);
    return { weekly, ath };
  }, [data, colDays]);

  const dominancePrepared = useMemo(() => {
    const days = colDays[3]!;
    if (!domHistory) {
      return {
        btc: [] as RatioPoint[],
        stable: [] as RatioPoint[],
        source: undefined as string | undefined,
        message: undefined as string | undefined,
      };
    }
    return {
      btc: filterRowsByLookback(rowsFromSeries(domHistory.btc_dominance_pct), days),
      stable: filterRowsByLookback(rowsFromSeries(domHistory.stable_dominance_pct), days),
      source: domHistory.source,
      message: domHistory.message,
    };
  }, [domHistory, colDays]);

  const loading = idxQ.isPending;

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
          <QueryErrorBanner colors={C} errors={errors} onRetry={onRetry} />

          {loading ? (
            <div className="py-16 text-center text-[13px]" style={{ color: "var(--nd-muted)" }}>
              Loading major indices…
            </div>
          ) : (
            <div className="grid gap-2 xl:grid-cols-4 xl:items-stretch">
              {EQUITY_COLUMNS.map((col, idx) => {
                const block = equityPrepared?.[col.id];
                const ci = idx as 0 | 1 | 2;
                return (
                  <div key={col.id} className="flex min-w-0 flex-col gap-1" style={panel}>
                    <div
                      className={`flex ${TOP_CARD_H} min-h-0 shrink-0 flex-col gap-2 overflow-hidden border-b pb-2`}
                      style={{ borderColor: "var(--nd-border-soft)" }}
                    >
                      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
                        <div>
                          <div
                            className="text-[10px] font-semibold uppercase tracking-[0.1em]"
                            style={{ color: "var(--nd-muted)" }}
                          >
                            {col.rankLabel} {col.title}{" "}
                            <span style={{ color: "var(--nd-soft)" }}>({col.symbol})</span>
                          </div>
                        </div>
                        <MajorIndicesPeriodStrip selectedDays={colDays[ci]} onSelect={(d) => setDaysForCol(ci, d)} />
                      </div>
                      <div className="min-h-0 w-full min-w-0 flex-1">
                        {block?.weekly?.length ? (
                          <IndexWeeklyPriceChart
                            data={block.weekly}
                            athPrice={block.ath}
                            colors={{ price: String(C.blue), ma200: String(C.purple) }}
                          />
                        ) : (
                          <div className="flex h-full items-center text-[12px]" style={{ color: "var(--nd-muted)" }}>
                            No data
                          </div>
                        )}
                      </div>
                      <div
                        className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t pt-1 text-[10px]"
                        style={{ borderColor: "var(--nd-border-soft)", color: "var(--nd-muted)" }}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: C.blue }} />
                          Price
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: C.purple }} />
                          200MA
                        </span>
                      </div>
                    </div>

                    <div
                      className={`flex ${MACRO_ROW_H} shrink-0 flex-col overflow-hidden border-t pt-1`}
                      style={{ borderColor: "var(--nd-border-soft)" }}
                    >
                      <div className="shrink-0 text-[8px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--nd-muted)" }}>
                        % of stocks above 200MA
                      </div>
                      <div className="relative min-h-[48px] w-full flex-1">
                        {block?.above200?.length ? (
                          <BreadthPercentChart
                            rows={block.above200}
                            lineColor={String(C.blue)}
                            referenceY={50}
                            referenceLabel="50%"
                            valueLabel="% &gt;200MA"
                            showDateAxis={false}
                          />
                        ) : (
                          <div className="flex h-full items-center text-[10px]" style={{ color: "var(--nd-muted)" }}>
                            No breadth data
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      className={`flex ${MACRO_ROW_H} shrink-0 flex-col overflow-hidden border-t pt-1`}
                      style={{ borderColor: "var(--nd-border-soft)" }}
                    >
                      <div className="shrink-0 text-[8px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--nd-muted)" }}>
                        % of stocks above 50MA
                      </div>
                      <div className="relative min-h-[48px] w-full flex-1">
                        {block?.above50?.length ? (
                          <BreadthPercentChart
                            rows={block.above50}
                            lineColor={String(C.blue)}
                            referenceY={50}
                            referenceLabel="50%"
                            valueLabel="% &gt;50MA"
                            showDateAxis
                          />
                        ) : (
                          <div className="flex h-full items-center text-[10px]" style={{ color: "var(--nd-muted)" }}>
                            No breadth data
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Column 4 — Bitcoin + dominance time series (CoinGecko market caps, see /api/market/crypto-dominance-history) */}
              <div className="flex min-w-0 flex-col gap-1" style={panel}>
                <div
                  className={`flex ${TOP_CARD_H} min-h-0 shrink-0 flex-col gap-2 overflow-hidden border-b pb-2`}
                  style={{ borderColor: "var(--nd-border-soft)" }}
                >
                  <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
                        4. Bitcoin <span style={{ color: "var(--nd-soft)" }}>(BTC)</span>
                      </div>
                    </div>
                    <MajorIndicesPeriodStrip selectedDays={colDays[3]} onSelect={(d) => setDaysForCol(3, d)} />
                  </div>
                  <div className="min-h-0 w-full min-w-0 flex-1">
                    {btcPrepared?.weekly?.length ? (
                      <IndexWeeklyPriceChart
                        data={btcPrepared.weekly}
                        athPrice={btcPrepared.ath}
                        colors={{ price: String(C.orange), ma200: String(C.purple) }}
                      />
                    ) : (
                      <div className="flex h-full items-center text-[12px]" style={{ color: "var(--nd-muted)" }}>
                        No data
                      </div>
                    )}
                  </div>
                  <div
                    className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t pt-1 text-[10px]"
                    style={{ borderColor: "var(--nd-border-soft)", color: "var(--nd-muted)" }}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: C.orange }} />
                      Price
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: C.purple }} />
                      200MA
                    </span>
                  </div>
                </div>

                <div
                  className={`flex ${MACRO_ROW_H} shrink-0 flex-col overflow-hidden border-t pt-1`}
                  style={{ borderColor: "var(--nd-border-soft)" }}
                >
                  <div className="shrink-0 text-[8px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--nd-muted)" }}>
                    BTC dominance (%)
                  </div>
                  <div className="relative min-h-[56px] w-full flex-1">
                    {domQ.isPending ? (
                      <div className="flex h-full items-center text-[10px]" style={{ color: "var(--nd-muted)" }}>
                        Loading dominance…
                      </div>
                    ) : dominancePrepared.btc.length ? (
                      <BreadthPercentChart
                        rows={dominancePrepared.btc}
                        lineColor={String(C.blue)}
                        referenceY={60}
                        referenceLabel="60%"
                        valueLabel="BTC dom."
                        domainMax={100}
                        showDateAxis={false}
                      />
                    ) : (
                      <div className="flex h-full items-center text-[10px]" style={{ color: "var(--nd-muted)" }}>
                        {dominancePrepared.message ?? "No dominance data"}
                      </div>
                    )}
                  </div>
                  {dominancePrepared.source ? (
                    <div className="shrink-0 pt-0.5 text-[8px] leading-tight" style={{ color: "var(--nd-muted)", opacity: 0.85 }}>
                      {dominancePrepared.source === "coingecko_market_caps"
                        ? "Source: CoinGecko (market caps, calibrated to /global)"
                        : dominancePrepared.source}
                    </div>
                  ) : null}
                </div>

                <div
                  className={`flex ${MACRO_ROW_H} shrink-0 flex-col overflow-hidden border-t pt-1`}
                  style={{ borderColor: "var(--nd-border-soft)" }}
                >
                  <div className="shrink-0 text-[8px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--nd-muted)" }}>
                    Stablecoin dominance (%)
                  </div>
                  <div className="relative min-h-[56px] w-full flex-1">
                    {domQ.isPending ? (
                      <div className="flex h-full items-center text-[10px]" style={{ color: "var(--nd-muted)" }}>
                        Loading dominance…
                      </div>
                    ) : dominancePrepared.stable.length ? (
                      <BreadthPercentChart
                        rows={dominancePrepared.stable}
                        lineColor={String(C.yellow)}
                        referenceY={8}
                        referenceLabel="8%"
                        valueLabel="Stable dom."
                        yDomain={[0, 20]}
                        showDateAxis
                      />
                    ) : (
                      <div className="flex h-full items-center text-[10px]" style={{ color: "var(--nd-muted)" }}>
                        {dominancePrepared.message ?? "No dominance data"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </NextDashboardShell>
    </>
  );
}
