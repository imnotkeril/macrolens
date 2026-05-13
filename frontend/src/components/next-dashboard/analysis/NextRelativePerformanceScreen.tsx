"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NextDashboardShell } from "@/components/next-dashboard/NextDashboardShell";
import { NEXT_DASHBOARD_NAV_ITEMS } from "@/components/next-dashboard/nextDashboardConfig";
import { QueryErrorBanner } from "@/components/next-dashboard/QueryErrorBanner";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";
import { nextPanelSurfaceStyle } from "@/components/next-dashboard/nextPanelSurface";
import { useDataRefresh } from "@/lib/useDataRefresh";
import {
  getCurrencyDashboard,
  getRecessionBands,
  getSectorsDashboard,
  getSentimentDashboard,
} from "@/lib/api";
import { NEXT_RELATIVE_PERFORMANCE_ROOT } from "@/components/next-dashboard/analysis/relativePerformanceQueryKeys";
import {
  RelPerfPeriodStrip,
  RelativePerformanceMacroLine,
  RelativePerformanceMainChart,
  type RelPerfSeriesDef,
} from "@/components/next-dashboard/analysis/relativePerformanceRecharts";
import {
  lastPointValue,
  mergeCurrencyLines,
  mergeSectorLines,
  mergeSentimentSeries,
  RELATIVE_PERF_CURRENCY_SYMBOLS,
  sanitizeSeriesKey,
  shortTickerFromCurrencyLabel,
  shortTickerFromSectorLabel,
  type SentimentRelPerfKey,
} from "@/components/next-dashboard/analysis/relativePerformanceUtils";
import type { RatioPoint, RecessionBand, SectorLine } from "@/types";

const SENTIMENT_META: Array<{
  key: SentimentRelPerfKey;
  title: string;
  formula: string;
}> = [
  { key: "non_cyclical", title: "Non-Cyclical", formula: "XLP + XLU + XLV" },
  { key: "cyclical", title: "Cyclical", formula: "XLY + XLB + XLRE + XLI" },
  { key: "sensitive", title: "Sensitive", formula: "XLF + XLC + XLK" },
  { key: "high_beta", title: "High Beta", formula: "SPHB / SPLV" },
];

function fmtPctSigned(v: number | null, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
}

function latestDateFromPoints(arrays: RatioPoint[][]): string {
  let max = "";
  for (const a of arrays) {
    const d = a[a.length - 1]?.date;
    if (d && d > max) max = d;
  }
  return max;
}

/** Legend strip — height synced across columns to the tallest via ResizeObserver (no fixed excess min-height). */
const LEGEND_CELL_CLASS =
  "flex flex-wrap content-center items-center justify-center gap-x-3 gap-y-1.5 border-t px-2 py-1 text-[11px] font-medium uppercase leading-snug tracking-wide";

/** Match inflation page: fixed px heights (no vh) so layout stays stable under browser zoom and shell scroll. */
const TOP_CARD_H = "h-[740px]";
/** Macro strips — taller than before so Recharts area stays readable (aligned with strip density on Yield Curve). */
const MACRO_ROW_H = "h-[120px]";

export function NextRelativePerformanceScreen({ omitShell = false }: { omitShell?: boolean }) {
  const { shellThemeVars, toggleTheme, colors: C } = useNextShellTheme();
  const queryClient = useQueryClient();
  const { refreshing, refreshResult, progress, handleRefresh } = useDataRefresh();
  const surface = useMemo(() => nextPanelSurfaceStyle(C), [C]);
  const panel = useMemo(() => ({ ...surface, padding: "10px 14px" } as const), [surface]);

  const [colDays, setColDays] = useState<[number, number, number]>([365, 365, 365]);

  const setDaysForCol = (col: 0 | 1 | 2, days: number) => {
    setColDays((prev) => {
      const next = [...prev] as [number, number, number];
      next[col] = days;
      return next;
    });
  };

  const sectorsQ = useQuery({
    queryKey: [NEXT_RELATIVE_PERFORMANCE_ROOT, "sectors", colDays[0]],
    queryFn: () => getSectorsDashboard(colDays[0]),
    staleTime: 120_000,
  });
  const currencyQ = useQuery({
    queryKey: [NEXT_RELATIVE_PERFORMANCE_ROOT, "currency", colDays[1]],
    queryFn: () => getCurrencyDashboard(colDays[1]),
    staleTime: 120_000,
  });
  const sentimentQ = useQuery({
    queryKey: [NEXT_RELATIVE_PERFORMANCE_ROOT, "sentiment", colDays[2]],
    queryFn: () => getSentimentDashboard(colDays[2]),
    staleTime: 120_000,
  });
  const recessionQ = useQuery({
    queryKey: [NEXT_RELATIVE_PERFORMANCE_ROOT, "recession-bands"],
    queryFn: getRecessionBands,
    staleTime: 300_000,
  });

  const recessionBands: RecessionBand[] = recessionQ.data ?? [];

  const sectorChart = useMemo(() => {
    const lines = (sectorsQ.data?.lines ?? []).filter(Boolean) as SectorLine[];
    if (!lines.length) return null;

    const isSpy = (ln: SectorLine) =>
      ln.symbol.includes("S&P 500") || ln.symbol.toUpperCase().includes("SPY");

    const spyLines = lines.filter(isSpy);
    const otherLines = lines.filter((l) => !isSpy(l));

    const sortedRest = [...otherLines].sort((a, b) => {
      const la = lastPointValue(a.series) ?? -Infinity;
      const lb = lastPointValue(b.series) ?? -Infinity;
      return lb - la;
    });

    const orderedLines = [...spyLines, ...sortedRest];
    const { data, keys } = mergeSectorLines(orderedLines);

    const series: RelPerfSeriesDef[] = orderedLines.map((ln, i) => {
      const isBench = isSpy(ln);
      return {
        dataKey: keys[i],
        name: shortTickerFromSectorLabel(ln.symbol),
        color: isBench ? C.muted : ln.color,
        strokeWidth: isBench ? 1.25 : 1.75,
        strokeDasharray: isBench ? "4 4" : undefined,
      };
    });

    const legend = [...sortedRest, ...spyLines].map((ln) => {
      const k = sanitizeSeriesKey(ln.symbol);
      return {
        key: k,
        ticker: shortTickerFromSectorLabel(ln.symbol),
        name: ln.symbol,
        color: isSpy(ln) ? C.muted : ln.color,
        value: lastPointValue(ln.series),
      };
    });

    legend.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));

    return {
      data,
      series,
      legend,
    };
  }, [sectorsQ.data?.lines, C]);

  const currencyChart = useMemo(() => {
    const raw = currencyQ.data?.lines ?? [];
    const lines = raw.filter((ln) => RELATIVE_PERF_CURRENCY_SYMBOLS.has(ln.symbol));
    if (!lines.length) return null;

    const sortedLines = [...lines].sort((a, b) => {
      const la = lastPointValue(a.series) ?? -Infinity;
      const lb = lastPointValue(b.series) ?? -Infinity;
      return lb - la;
    });

    const { data, keys } = mergeCurrencyLines(sortedLines);
    const palette: Record<string, string> = {
      DXY: C.red,
      "EXY (EUR)": C.blue,
      "BXY (GBP)": C.purple,
      "AXY (AUD)": C.green,
      "CXY (CAD)": C.yellow,
      "JXY (JPY)": C.soft,
    };

    const series: RelPerfSeriesDef[] = sortedLines.map((ln, i) => ({
      dataKey: keys[i],
      name: shortTickerFromCurrencyLabel(ln.symbol),
      color: palette[ln.symbol] ?? C.soft,
    }));

    const legend = sortedLines.map((ln, i) => ({
      key: keys[i],
      ticker: shortTickerFromCurrencyLabel(ln.symbol),
      color: palette[ln.symbol] ?? C.soft,
      value: lastPointValue(ln.series),
    }));

    return { data, series, legend };
  }, [currencyQ.data?.lines, C]);

  const sentimentChart = useMemo(() => {
    const { data } = mergeSentimentSeries(sentimentQ.data);
    if (!data.length) return null;

    const colors: Record<SentimentRelPerfKey, string> = {
      non_cyclical: C.blue,
      cyclical: C.green,
      sensitive: C.purple,
      high_beta: C.red,
    };

    const series: RelPerfSeriesDef[] = SENTIMENT_META.filter(
      (m) => data.some((row) => row[m.key] != null),
    ).map((m) => ({
      dataKey: m.key,
      name: m.title,
      color: colors[m.key],
    }));

    const legend = SENTIMENT_META.map((m) => ({
      ...m,
      color: colors[m.key],
      value: lastPointValue(sentimentQ.data?.[m.key]),
    })).filter((l) => l.value != null);

    legend.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));

    return { data, series, legend };
  }, [sentimentQ.data, C]);

  const macroTriple = useMemo(
    () =>
      [
        {
          inversion: sectorsQ.data?.inversion ?? [],
          effr: sectorsQ.data?.effr ?? [],
          cpi: sectorsQ.data?.cpi_yoy ?? [],
        },
        {
          inversion: currencyQ.data?.inversion ?? [],
          effr: currencyQ.data?.effr ?? [],
          cpi: currencyQ.data?.cpi_yoy ?? [],
        },
        {
          inversion: sentimentQ.data?.inversion ?? [],
          effr: sentimentQ.data?.effr ?? [],
          cpi: sentimentQ.data?.cpi_yoy ?? [],
        },
      ] as const,
    [sectorsQ.data, currencyQ.data, sentimentQ.data],
  );

  const updatedAt = useMemo(() => {
    const dates: RatioPoint[][] = [];
    for (const ln of sectorsQ.data?.lines ?? []) {
      if (ln.series?.length) dates.push(ln.series);
    }
    for (const ln of currencyQ.data?.lines ?? []) {
      if (ln.series?.length) dates.push(ln.series);
    }
    for (const k of SENTIMENT_META) {
      const s = sentimentQ.data?.[k.key];
      if (s?.length) dates.push(s);
    }
    const d = latestDateFromPoints(dates);
    return d ? `${d}T12:00:00.000Z` : "—";
  }, [sectorsQ.data, currencyQ.data, sentimentQ.data]);

  const queryErrors = useMemo(() => {
    const errs: Array<{ label: string; message: string }> = [];
    if (sectorsQ.isError) errs.push({ label: "Sectors dashboard", message: String(sectorsQ.error) });
    if (currencyQ.isError) errs.push({ label: "Currency dashboard", message: String(currencyQ.error) });
    if (sentimentQ.isError) errs.push({ label: "Sentiment dashboard", message: String(sentimentQ.error) });
    if (recessionQ.isError) errs.push({ label: "Recession bands", message: String(recessionQ.error) });
    return errs;
  }, [sectorsQ.isError, sectorsQ.error, currencyQ.isError, currencyQ.error, sentimentQ.isError, sentimentQ.error, recessionQ.isError, recessionQ.error]);

  const onRetry = () =>
    void queryClient.invalidateQueries({ queryKey: [NEXT_RELATIVE_PERFORMANCE_ROOT] });

  const loading =
    sectorsQ.isPending || currencyQ.isPending || sentimentQ.isPending;

  const legendRef0 = useRef<HTMLDivElement>(null);
  const legendRef1 = useRef<HTMLDivElement>(null);
  const legendRef2 = useRef<HTMLDivElement>(null);
  const [legendBandPx, setLegendBandPx] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (loading) return;
    const measure = () => {
      const cur = [legendRef0.current, legendRef1.current, legendRef2.current].filter(
        (n): n is HTMLDivElement => n != null,
      );
      if (!cur.length) {
        setLegendBandPx(undefined);
        return;
      }
      const hs = cur.map((el) => el.offsetHeight);
      const m = Math.max(...hs);
      setLegendBandPx((prev) => (prev !== m ? m : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    [legendRef0, legendRef1, legendRef2].forEach((r) => {
      if (r.current) ro.observe(r.current);
    });
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [loading, sectorChart, currencyChart, sentimentChart, colDays]);

  const mainColumn = (
        <section className="flex flex-col gap-2">
          <QueryErrorBanner colors={C} errors={queryErrors} onRetry={onRetry} />

          {loading ? (
            <div className="py-16 text-center text-[13px]" style={{ color: "var(--nd-muted)" }}>
              Loading relative performance…
            </div>
          ) : (
            <div className="grid gap-2 lg:grid-cols-3 lg:items-stretch print:grid-cols-3">
              {/* Column 1 — Sectors */}
              <div className="flex min-w-0 flex-col gap-1" style={panel}>
                <div
                  className={`flex ${TOP_CARD_H} min-h-0 shrink-0 flex-col gap-2 overflow-hidden border-b pb-2`}
                  style={{ borderColor: "var(--nd-border-soft)" }}
                >
                  <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
                      S&amp;P500 sectors
                    </div>
                    <RelPerfPeriodStrip selectedDays={colDays[0]} onSelect={(d) => setDaysForCol(0, d)} />
                  </div>
                  {sectorChart ? (
                    <>
                      <div className="min-h-0 w-full min-w-0 flex-1">
                        <RelativePerformanceMainChart data={sectorChart.data} series={sectorChart.series} />
                      </div>
                      <div
                        ref={legendRef0}
                        className={`${LEGEND_CELL_CLASS} max-h-[72px] overflow-y-auto`}
                        style={{
                          borderColor: "var(--nd-border-soft)",
                          color: "var(--nd-muted)",
                          minHeight: legendBandPx,
                        }}
                      >
                        {sectorChart.legend.map((row) => (
                          <div key={row.key} className="flex items-baseline justify-center gap-1.5">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: row.color }} />
                            <span style={{ color: "var(--nd-soft)" }}>{row.ticker}</span>
                            <span
                              className="font-mono text-[11px] tabular-nums normal-case"
                              style={{
                                color: (row.value ?? 0) >= 0 ? "var(--nd-green)" : "var(--nd-red)",
                              }}
                            >
                              {fmtPctSigned(row.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-1 items-center text-[12px]" style={{ color: "var(--nd-muted)" }}>
                      No sector data
                    </div>
                  )}
                </div>
                <div className={`flex ${MACRO_ROW_H} shrink-0 min-w-0 flex-col overflow-hidden`}>
                  <MacroIndicatorRow
                    title="US inversion & recession"
                    data={macroTriple[0].inversion}
                    format={(v) => `${v.toFixed(2)}%`}
                    lineColor={C.blue}
                    recessionBands={recessionBands}
                    showDateAxis={false}
                  />
                </div>
                <div className={`flex ${MACRO_ROW_H} shrink-0 min-w-0 flex-col overflow-hidden`}>
                  <MacroIndicatorRow
                    title="US interest rate"
                    data={macroTriple[0].effr}
                    format={(v) => `${v.toFixed(2)}%`}
                    lineColor={C.green}
                    stepped
                    showDateAxis={false}
                  />
                </div>
                <div className={`flex ${MACRO_ROW_H} shrink-0 min-w-0 flex-col overflow-hidden`}>
                  <MacroIndicatorRow
                    title="US inflation"
                    data={macroTriple[0].cpi}
                    format={(v) => `${v.toFixed(2)}%`}
                    lineColor={C.purple}
                    showDateAxis
                  />
                </div>
              </div>

              {/* Column 2 — Currency */}
              <div className="flex min-w-0 flex-col gap-1" style={panel}>
                <div
                  className={`flex ${TOP_CARD_H} min-h-0 shrink-0 flex-col gap-2 overflow-hidden border-b pb-2`}
                  style={{ borderColor: "var(--nd-border-soft)" }}
                >
                  <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
                      Currency indices
                    </div>
                    <RelPerfPeriodStrip selectedDays={colDays[1]} onSelect={(d) => setDaysForCol(1, d)} />
                  </div>
                  {currencyChart ? (
                    <>
                      <div className="min-h-0 w-full min-w-0 flex-1">
                        <RelativePerformanceMainChart data={currencyChart.data} series={currencyChart.series} />
                      </div>
                      <div
                        ref={legendRef1}
                        className={`${LEGEND_CELL_CLASS} max-h-[72px] overflow-y-auto`}
                        style={{
                          borderColor: "var(--nd-border-soft)",
                          color: "var(--nd-muted)",
                          minHeight: legendBandPx,
                        }}
                      >
                        {currencyChart.legend.map((row) => (
                          <div key={row.key} className="flex items-baseline justify-center gap-1.5">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: row.color }} />
                            <span style={{ color: "var(--nd-soft)" }}>{row.ticker}</span>
                            <span
                              className="font-mono text-[11px] tabular-nums normal-case"
                              style={{
                                color: (row.value ?? 0) >= 0 ? "var(--nd-green)" : "var(--nd-red)",
                              }}
                            >
                              {fmtPctSigned(row.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-1 items-center text-[12px]" style={{ color: "var(--nd-muted)" }}>
                      No currency data
                    </div>
                  )}
                </div>
                <div className={`flex ${MACRO_ROW_H} shrink-0 min-w-0 flex-col overflow-hidden`}>
                  <MacroIndicatorRow
                    title="US inversion & recession"
                    data={macroTriple[1].inversion}
                    format={(v) => `${v.toFixed(2)}%`}
                    lineColor={C.blue}
                    recessionBands={recessionBands}
                    showDateAxis={false}
                  />
                </div>
                <div className={`flex ${MACRO_ROW_H} shrink-0 min-w-0 flex-col overflow-hidden`}>
                  <MacroIndicatorRow
                    title="US interest rate"
                    data={macroTriple[1].effr}
                    format={(v) => `${v.toFixed(2)}%`}
                    lineColor={C.green}
                    stepped
                    showDateAxis={false}
                  />
                </div>
                <div className={`flex ${MACRO_ROW_H} shrink-0 min-w-0 flex-col overflow-hidden`}>
                  <MacroIndicatorRow
                    title="US inflation"
                    data={macroTriple[1].cpi}
                    format={(v) => `${v.toFixed(2)}%`}
                    lineColor={C.purple}
                    showDateAxis
                  />
                </div>
              </div>

              {/* Column 3 — Sentiment groups */}
              <div className="flex min-w-0 flex-col gap-1" style={panel}>
                <div
                  className={`flex ${TOP_CARD_H} min-h-0 shrink-0 flex-col gap-2 overflow-hidden border-b pb-2`}
                  style={{ borderColor: "var(--nd-border-soft)" }}
                >
                  <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
                      Sentiment (sector groups)
                    </div>
                    <RelPerfPeriodStrip selectedDays={colDays[2]} onSelect={(d) => setDaysForCol(2, d)} />
                  </div>
                  {sentimentChart ? (
                    <>
                      <div className="min-h-0 w-full min-w-0 flex-1">
                        <RelativePerformanceMainChart data={sentimentChart.data} series={sentimentChart.series} />
                      </div>
                      <div
                        ref={legendRef2}
                        className={`${LEGEND_CELL_CLASS} max-h-[72px] overflow-y-auto`}
                        style={{
                          borderColor: "var(--nd-border-soft)",
                          color: "var(--nd-muted)",
                          minHeight: legendBandPx,
                        }}
                      >
                        {sentimentChart.legend.map((row) => (
                          <div key={row.key} className="max-w-[200px] text-center">
                            <div className="flex flex-wrap items-baseline justify-center gap-1.5">
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: row.color }} />
                              <span style={{ color: "var(--nd-soft)" }}>{row.title}</span>
                              <span
                                className="font-mono text-[11px] tabular-nums normal-case"
                                style={{
                                  color: (row.value ?? 0) >= 0 ? "var(--nd-green)" : "var(--nd-red)",
                                }}
                              >
                                {fmtPctSigned(row.value)}
                              </span>
                            </div>
                            <div className="mt-1 normal-case text-[9px] leading-tight" style={{ color: "var(--nd-muted)" }}>
                              {row.formula}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-1 items-center text-[12px]" style={{ color: "var(--nd-muted)" }}>
                      No sentiment data
                    </div>
                  )}
                </div>
                <div className={`flex ${MACRO_ROW_H} shrink-0 min-w-0 flex-col overflow-hidden`}>
                  <MacroIndicatorRow
                    title="US inversion & recession"
                    data={macroTriple[2].inversion}
                    format={(v) => `${v.toFixed(2)}%`}
                    lineColor={C.blue}
                    recessionBands={recessionBands}
                    showDateAxis={false}
                  />
                </div>
                <div className={`flex ${MACRO_ROW_H} shrink-0 min-w-0 flex-col overflow-hidden`}>
                  <MacroIndicatorRow
                    title="US interest rate"
                    data={macroTriple[2].effr}
                    format={(v) => `${v.toFixed(2)}%`}
                    lineColor={C.green}
                    stepped
                    showDateAxis={false}
                  />
                </div>
                <div className={`flex ${MACRO_ROW_H} shrink-0 min-w-0 flex-col overflow-hidden`}>
                  <MacroIndicatorRow
                    title="US inflation"
                    data={macroTriple[2].cpi}
                    format={(v) => `${v.toFixed(2)}%`}
                    lineColor={C.purple}
                    showDateAxis
                  />
                </div>
              </div>
            </div>
          )}
        </section>
  );

  return (
    <>
      {omitShell ? (
        mainColumn
      ) : (
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
          {mainColumn}
        </NextDashboardShell>
      )}
    </>
  );
}

function MacroIndicatorRow({
  title,
  subtitle,
  data,
  format,
  lineColor,
  recessionBands,
  stepped = false,
  showDateAxis = false,
}: {
  title: string;
  subtitle?: string;
  data: RatioPoint[];
  format: (v: number) => string;
  lineColor: string;
  recessionBands?: RecessionBand[];
  stepped?: boolean;
  showDateAxis?: boolean;
}) {
  const rows = useMemo(() => {
    return data
      .map((p) => ({ date: p.date, value: Number(p.value) }))
      .filter((p) => Number.isFinite(p.value));
  }, [data]);

  if (!rows.length) {
    return (
      <div
        className="flex h-full min-h-[52px] items-center px-2 text-[10px]"
        style={{ color: "var(--nd-muted)" }}
      >
        {title} — no data
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-[52px] min-w-0 flex-col border-t pt-1"
      style={{ borderColor: "var(--nd-border-soft)" }}
    >
      <div className="shrink-0 text-[8px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--nd-muted)" }}>
        {title}
      </div>
      {subtitle ? (
        <div className="shrink-0 text-[7px] font-light uppercase tracking-[0.06em]" style={{ color: "var(--nd-muted)" }}>
          {subtitle}
        </div>
      ) : null}
      <div className="relative min-h-[48px] w-full flex-1">
        <RelativePerformanceMacroLine
          rows={rows}
          lineColor={lineColor}
          tooltipLabel={subtitle ?? title}
          valueFormat={format}
          recessionBands={recessionBands}
          stepped={stepped}
          showDateAxis={showDateAxis}
          yAxisWidth={42}
        />
      </div>
    </div>
  );
}
