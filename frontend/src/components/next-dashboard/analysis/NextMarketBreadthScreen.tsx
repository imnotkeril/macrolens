"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NextDashboardShell } from "@/components/next-dashboard/NextDashboardShell";
import { NEXT_DASHBOARD_NAV_ITEMS } from "@/components/next-dashboard/nextDashboardConfig";
import { QueryErrorBanner } from "@/components/next-dashboard/QueryErrorBanner";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";
import { nextPanelSurfaceStyle } from "@/components/next-dashboard/nextPanelSurface";
import { useDataRefresh } from "@/lib/useDataRefresh";
import { getBreadthDashboard, getIndicesDashboard } from "@/lib/api";
import { NEXT_MARKET_BREADTH_ROOT } from "@/components/next-dashboard/analysis/marketBreadthQueryKeys";
import {
  BreadthDualRefChart,
  ChartCardHeader,
  HighsLowsBarChart,
  LineMetricChart,
  MARKET_BREADTH_TF_OPTIONS,
  MarketBreadthTfStrip,
  type MarketBreadthTfKey,
  NysiVersusSpxChart,
  SpxWeeklyPricePanel,
  TvolBarChart,
} from "@/components/next-dashboard/analysis/marketBreadthCharts";
import {
  breadthValuesToWeeklyLast,
  innerJoinByDate,
  meanOf,
  mergeHighsLows,
} from "@/components/next-dashboard/analysis/marketBreadthUtils";
import {
  computeRangeAth,
  dailyIndexToWeeklyLast,
  filterRowsByLookback,
} from "@/components/next-dashboard/analysis/majorIndicesUtils";
import type { BreadthDashboardData, IndexPricePoint, IndicesDashboardData, RatioPoint } from "@/types";

const FETCH_DAYS = 365 * 15 + 400;

function tfDays(key: MarketBreadthTfKey): number {
  return MARKET_BREADTH_TF_OPTIONS.find((x) => x.key === key)!.days;
}

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

function latestDashboardDate(data: IndicesDashboardData | undefined): string {
  if (!data) return "";
  let max = "";
  const keys: (keyof IndicesDashboardData)[] = ["spx", "ndx", "rut", "btc"];
  for (const k of keys) {
    const arr = data[k];
    if (!Array.isArray(arr) || !arr.length) continue;
    const last = arr[arr.length - 1] as { date?: string };
    const d = last?.date;
    if (d && d > max) max = d;
  }
  return max;
}

export function NextMarketBreadthScreen() {
  const { shellThemeVars, toggleTheme, colors: C } = useNextShellTheme();
  const queryClient = useQueryClient();
  const { refreshing, refreshResult, progress, handleRefresh } = useDataRefresh();
  const surface = useMemo(() => nextPanelSurfaceStyle(C), [C]);
  const panel = useMemo(() => ({ ...surface, padding: "10px 14px" } as const), [surface]);
  /** Uniform grid cells — equal row/col fractions; inner charts flex-fill */
  const chartCard = "flex h-full min-h-0 min-w-0 flex-col overflow-hidden";

  const [tfKey, setTfKey] = useState<MarketBreadthTfKey>("2Y");
  const lookbackDays = tfDays(tfKey);

  const idxQ = useQuery({
    queryKey: [NEXT_MARKET_BREADTH_ROOT, "indices", FETCH_DAYS],
    queryFn: () => getIndicesDashboard(FETCH_DAYS),
    staleTime: 120_000,
  });

  const breadthQ = useQuery({
    queryKey: [NEXT_MARKET_BREADTH_ROOT, "breadth", FETCH_DAYS],
    queryFn: () => getBreadthDashboard(FETCH_DAYS),
    staleTime: 120_000,
  });

  const data = idxQ.data;
  const bd = breadthQ.data as BreadthDashboardData | undefined;

  const updatedAt = useMemo(() => latestDashboardDate(data), [data]);

  const errors = useMemo(() => {
    const out: Array<{ label: string; message: string }> = [];
    if (idxQ.isError) out.push({ label: "Indices dashboard", message: String(idxQ.error) });
    if (breadthQ.isError) out.push({ label: "Breadth dashboard", message: String(breadthQ.error) });
    return out;
  }, [idxQ.isError, idxQ.error, breadthQ.isError, breadthQ.error]);

  const onRetry = () => void queryClient.invalidateQueries({ queryKey: [NEXT_MARKET_BREADTH_ROOT] });

  const prepared = useMemo(() => {
    const spxDaily = filterRowsByLookback((data?.spx as IndexPricePoint[]) ?? [], lookbackDays);
    const weekly = dailyIndexToWeeklyLast(spxDaily);
    const ath = computeRangeAth(weekly);

    const mmthW = breadthValuesToWeeklyLast(filterRowsByLookback(rowsFromSeries(bd?.MMTH), lookbackDays));
    const mmfiW = breadthValuesToWeeklyLast(filterRowsByLookback(rowsFromSeries(bd?.MMFI), lookbackDays));
    const mmtwW = breadthValuesToWeeklyLast(filterRowsByLookback(rowsFromSeries(bd?.MMTW), lookbackDays));

    const nyh = filterRowsByLookback(rowsFromSeries(bd?.NYHGH), lookbackDays);
    const nyl = filterRowsByLookback(rowsFromSeries(bd?.NYLOW), lookbackDays);
    const highsLows = mergeHighsLows(nyh, nyl);

    const nysi = filterRowsByLookback(rowsFromSeries(bd?.NYSI), lookbackDays);
    const spxClose = filterRowsByLookback(rowsFromSeries(bd?.SP500), lookbackDays);
    const joined = innerJoinByDate(nysi, spxClose).map((r) => ({ date: r.date, nysi: r.a, spx: r.b }));

    const tvol = filterRowsByLookback(rowsFromSeries(bd?.["TVOL.US"]), lookbackDays);
    const tvolVals = tvol.map((p) => p.value).filter(Number.isFinite);
    const tvolAvg = meanOf(tvolVals);

    const pcc = filterRowsByLookback(rowsFromSeries(bd?.PCC), lookbackDays);
    const vix = filterRowsByLookback(rowsFromSeries(bd?.VIX), lookbackDays);

    return {
      weekly,
      ath,
      mmthW,
      mmfiW,
      mmtwW,
      highsLows,
      nysiSpx: joined,
      tvol,
      tvolAvg,
      pcc,
      vix,
    };
  }, [data, bd, lookbackDays]);

  const loading = idxQ.isPending || breadthQ.isPending;

  const vixDomain = useMemo((): [number, number] => {
    const vals = prepared.vix.map((p) => p.value).filter(Number.isFinite);
    if (!vals.length) return [0, 40];
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = Math.max(2, (hi - lo) * 0.08);
    return [Math.max(0, Math.floor(lo - pad)), Math.ceil(hi + pad)];
  }, [prepared.vix]);

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
        <section className="flex min-h-0 flex-1 flex-col gap-3">
          <QueryErrorBanner colors={C} errors={errors} onRetry={onRetry} />

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
            <p className="max-w-[min(100%,52rem)] text-[12px] leading-snug" style={{ color: "var(--nd-muted)" }}>
              Market breadth — NYSE / S&P 500 participation (MMTH, MMFI, MMTW from StockCharts-style Yahoo
              symbols). McClellan Summation (NYSI) used where cumulative NYSE A/D is unavailable on this data path.
            </p>
            <MarketBreadthTfStrip selectedKey={tfKey} onSelect={setTfKey} />
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center py-16 text-[13px]" style={{ color: "var(--nd-muted)" }}>
              Loading market breadth…
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[repeat(9,minmax(0,1fr))] gap-2 xl:grid-cols-3 xl:grid-rows-[repeat(3,minmax(0,1fr))]">
              {/* Row 1 */}
              <div className={`${chartCard}`} style={panel}>
                <ChartCardHeader
                  title="1. SPX price"
                  subtitle="Weekly"
                  hint="S&P 500 index with 200-day moving average. Up/down volume sub-panel requires separate NYSE advance/decline volume feed (not in current Yahoo breadth set)."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                <SpxWeeklyPricePanel
                  weekly={prepared.weekly}
                  athPrice={prepared.ath}
                  colors={{ price: String(C.blue), ma200: String(C.purple) }}
                />
                </div>
              </div>

              <div className={`${chartCard}`} style={panel}>
                <ChartCardHeader
                  title="2. % Stocks above 200MA"
                  subtitle="Weekly · MMTH"
                  hint="% of S&P 500 stocks above 200-day MA. &lt; 25% = bear market, defensive positioning."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                <BreadthDualRefChart
                  rows={prepared.mmthW}
                  lineColor={String(C.blue)}
                  refHigh={65}
                  refLow={25}
                  valueLabel="% &gt;200MA"
                  footnote={"< 25% = bear market, defensive positioning"}
                />
                </div>
              </div>

              <div className={`${chartCard}`} style={panel}>
                <ChartCardHeader
                  title="3. % Stocks above 50MA"
                  subtitle="Weekly · MMFI"
                  hint="% of S&P 500 stocks above 50-day MA."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                <BreadthDualRefChart
                  rows={prepared.mmfiW}
                  lineColor={String(C.blue)}
                  refHigh={75}
                  refLow={25}
                  valueLabel="% &gt;50MA"
                />
                </div>
              </div>

              {/* Row 2 */}
              <div className={`${chartCard}`} style={panel}>
                <ChartCardHeader
                  title="4. % Stocks above 20MA"
                  subtitle="Weekly · MMTW"
                  hint="&lt; 25% = short-term oversold, bounce more likely."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                <BreadthDualRefChart
                  rows={prepared.mmtwW}
                  lineColor={String(C.blue)}
                  refHigh={85}
                  refLow={25}
                  valueLabel="% &gt;20MA"
                  footnote={"< 25% = short-term oversold, bounce likely"}
                />
                </div>
              </div>

              <div className={`${chartCard}`} style={panel}>
                <ChartCardHeader
                  title="5. New highs vs new lows"
                  subtitle="Daily · NYSE"
                  hint="NYSE new highs (up) vs new lows (down). Combined tape breadth."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                  <HighsLowsBarChart data={prepared.highsLows} colors={{ high: String(C.green), low: String(C.red) }} />
                </div>
                <p className="mt-1 shrink-0 text-[8px]" style={{ color: "var(--nd-muted)" }}>
                  Source: NYSE (^NYHGH / ^NYLOW) via Yahoo
                </p>
              </div>

              <div className={`${chartCard}`} style={panel}>
                <ChartCardHeader
                  title="6. Breadth vs SPX"
                  subtitle="Daily · NYSI + SPX"
                  hint="McClellan Summation Index (NYSI) vs S&P 500 close. Divergence (SPX up, NYSI down) often precedes breadth deterioration — classic warning when cumulative NYSE A/D is unavailable here."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                  <NysiVersusSpxChart
                    rows={prepared.nysiSpx}
                    colors={{ nysi: String(C.blue), spx: "rgba(180,170,160,0.65)" }}
                  />
                </div>
                <p className="mt-1 shrink-0 text-[8px] leading-snug" style={{ color: "var(--nd-muted)" }}>
                  NYSI is a cumulative breadth oscillator — proxy when raw NYSE A/D line is not loaded.
                </p>
              </div>

              {/* Row 3 */}
              <div className={`${chartCard}`} style={panel}>
                <ChartCardHeader
                  title="7. US stocks total volume"
                  subtitle="Daily · TVOL"
                  hint="NYSE consolidated tape volume (TVOL.US)."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                  <TvolBarChart rows={prepared.tvol} avgLine={prepared.tvolAvg} color={String(C.blue)} />
                </div>
              </div>

              <div className={`${chartCard}`} style={panel}>
                <ChartCardHeader
                  title="8. Put/call ratio"
                  subtitle="Daily · PCC"
                  hint="CBOE equity put/call ratio. &gt; 1.2 = extreme fear (contrarian bullish); &lt; 0.7 = complacency."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                <LineMetricChart
                  rows={prepared.pcc}
                  lineColor={String(C.blue)}
                  valueLabel="PCC"
                  formatY={(n) => n.toFixed(2)}
                  references={[
                    { y: 1.2, stroke: String(C.green), label: "1.2 fear" },
                    { y: 0.7, stroke: String(C.red), label: "0.7 greed" },
                  ]}
                />
                </div>
              </div>

              <div className={`${chartCard}`} style={panel}>
                <ChartCardHeader
                  title="9. VIX"
                  subtitle="Daily"
                  hint="Implied volatility index. &gt; 30 panic; ~20 elevated; &lt; 15 low vol."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                <LineMetricChart
                  rows={prepared.vix}
                  lineColor={String(C.blue)}
                  valueLabel="VIX"
                  formatY={(n) => n.toFixed(1)}
                  domain={vixDomain}
                  references={[
                    { y: 30, stroke: String(C.red), label: "30 panic" },
                    { y: 20, stroke: String(C.red), dash: "3 3", label: "20" },
                    { y: 15, stroke: String(C.green), label: "15 low vol" },
                  ]}
                />
                </div>
              </div>
            </div>
          )}
        </section>
      </NextDashboardShell>
    </>
  );
}
