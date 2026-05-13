"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ArrowDown, ArrowRight, ArrowUp, Minus } from "lucide-react";
import { NextDashboardShell } from "@/components/next-dashboard/NextDashboardShell";
import { NEXT_DASHBOARD_NAV_ITEMS } from "@/components/next-dashboard/nextDashboardConfig";
import { QueryErrorBanner } from "@/components/next-dashboard/QueryErrorBanner";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";
import { nextPanelSurfaceStyle } from "@/components/next-dashboard/nextPanelSurface";
import { useDataRefresh } from "@/lib/useDataRefresh";
import { CATEGORY_LABELS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { NEXT_DASHBOARD_QUERY_ROOT } from "@/features/dashboard/queryKeys";
import {
  KPI_SCORE_CATEGORIES,
  SIDEBAR,
  MACRO_INDICATOR_NAME_MAX_PX,
  MACRO_PCT_COL_WIDTH_REM,
  TABLE_SCROLL_MAX_PX,
  Z_ROLLING_WINDOW,
} from "@/components/next-dashboard/macro-sentiment/macroSentimentConstants";
import { IndicatorDetailCharts } from "@/components/next-dashboard/macro-sentiment/MacroSentimentChartBlocks";
import { MacroSentimentMicroSparkline } from "@/components/next-dashboard/macro-sentiment/MacroSentimentMicroSparkline";
import {
  approxYoY,
  computeRollingZScores,
  fmtIndicator,
  formatSignedTwoDecimals,
  historySparkValues,
  longHistorySpark,
  momPct,
  slugToCategory,
  trendLabel,
} from "@/components/next-dashboard/macro-sentiment/macroSentimentUtils";
import { useMacroSentimentData } from "@/components/next-dashboard/macro-sentiment/useMacroSentimentData";
import type { TrendDirection } from "@/types";

export function NextMacroSentimentScreen({ sectionSlug }: { sectionSlug?: string }) {
  const { shellThemeVars, toggleTheme, colors: C } = useNextShellTheme();
  const queryClient = useQueryClient();
  const { refreshing, refreshResult, progress, handleRefresh } = useDataRefresh();
  const surface = useMemo(() => nextPanelSurfaceStyle(C), [C]);
  const topKpiSurface = useMemo(() => ({ ...surface, padding: "8px 12px" } as const), [surface]);
  /** Tighter vertical chrome than default `nextPanelSurfaceStyle` — only outer card padding, content unchanged. */
  const macroPanelSurface = useMemo(
    () => ({ ...surface, padding: "12px 22px" } as const),
    [surface],
  );
  const categoryRowHeightPx = 290;
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<number | null>(null);

  const activeCategory = slugToCategory(sectionSlug);
  const data = useMacroSentimentData(activeCategory);

  useEffect(() => {
    setSelectedIndicatorId(null);
  }, [activeCategory]);

  const selectedRow = useMemo(() => {
    const rows = data.categoryRows;
    return rows.find((r) => r.id === selectedIndicatorId) ?? null;
  }, [data.categoryRows, selectedIndicatorId]);

  const selectedRowIndex = useMemo(() => {
    const rows = data.categoryRows;
    if (selectedIndicatorId == null) return -1;
    return rows.findIndex((r) => r.id === selectedIndicatorId);
  }, [data.categoryRows, selectedIndicatorId]);
  const selectedHistory = selectedRowIndex >= 0 ? data.rowHistories[selectedRowIndex]?.data : undefined;
  const selectedHistoryPending =
    selectedRowIndex >= 0 ? Boolean(data.rowHistories[selectedRowIndex]?.isPending) : false;

  const detailChartData = useMemo(() => {
    if (!selectedHistory?.length) return [];
    const sorted = [...selectedHistory].sort(
      (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime(),
    );
    return sorted
      .filter((h) => h.value != null && Number.isFinite(h.value))
      .map((h) => ({ date: h.date.slice(0, 10), v: h.value as number }));
  }, [selectedHistory]);

  const zSeriesData = useMemo(
    () => computeRollingZScores(detailChartData, Z_ROLLING_WINDOW),
    [detailChartData],
  );

  const TrendGlyph = ({ trend, score }: { trend: TrendDirection; score: number }) => {
    const label = trendLabel(score, trend);
    const isSlightly = label.startsWith("Slightly ");
    const labelTail = isSlightly ? label.replace("Slightly ", "") : "";
    const Icon =
      trend === "improving" ? ArrowUp : trend === "deteriorating" ? ArrowDown : Math.abs(score) < 0.08 ? Minus : ArrowRight;
    const color =
      trend === "improving" ? C.green : trend === "deteriorating" ? C.red : C.muted;
    return (
      <span className="flex max-w-full items-start gap-1 text-[12px]" style={{ color }}>
        <Icon className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
        <span className="uppercase leading-[1.05] tracking-[0.06em]">
          {isSlightly ? (
            <>
              <span className="block">Slightly</span>
              <span className="block">{labelTail}</span>
            </>
          ) : (
            label
          )}
        </span>
      </span>
    );
  };

  return (
    <>
      <NextDashboardShell
        navItems={NEXT_DASHBOARD_NAV_ITEMS}
        colors={C}
        shellThemeVars={shellThemeVars}
        updatedAt={data.updatedAt}
        refreshing={refreshing}
        refreshResult={refreshResult}
        progress={progress}
        onRefresh={handleRefresh}
        onThemeToggle={toggleTheme}
      >
        <section className="flex flex-col gap-2">
          <QueryErrorBanner
            colors={C}
            errors={data.queryErrors}
            onRetry={() => void queryClient.invalidateQueries({ queryKey: [NEXT_DASHBOARD_QUERY_ROOT] })}
          />
          {/* KPI strip — composite first */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="flex flex-col px-0.5 py-0.5" style={topKpiSurface}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
                Composite Macro Sentiment
              </div>
              <div className="mt-2 flex items-start justify-between gap-2">
                <div className="w-[5.25rem] shrink-0">
                  <div
                    className="font-extralight leading-none tabular-nums"
                    style={{ color: C.blue, fontSize: "calc(28px + 0.05rem)" }}
                  >
                    {data.regime ? data.compositeZ.toFixed(2) : "—"}
                  </div>
                  <div
                    className="mt-2 w-full truncate text-[14px] tabular-nums tracking-[0.02em]"
                    style={{
                      color: data.compositeDelta != null ? (data.compositeDelta >= 0 ? C.green : C.red) : C.muted,
                    }}
                  >
                    {data.compositeDelta != null ? formatSignedTwoDecimals(data.compositeDelta) : "—"}
                  </div>
                </div>
                <div className="min-h-0 min-w-0 flex-1 self-stretch pt-1">
                  {data.compositeSpark.length >= 2 ? (
                    <MacroSentimentMicroSparkline values={data.compositeSpark} stroke={C.blue} height={44} />
                  ) : null}
                </div>
              </div>
            </div>
            {KPI_SCORE_CATEGORIES.map((cat, idx) => {
              const row = data.scoreByCat.get(cat);
              const sparkQ = data.kpiHistories[idx];
              const sparkVals = historySparkValues(sparkQ?.data, 10).slice(-8);
              const stroke = row?.color === "green" ? C.green : row?.color === "red" ? C.red : C.yellow;
              return (
                <div key={cat} className="flex flex-col px-0.5 py-0.5" style={topKpiSurface}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
                    {CATEGORY_LABELS[cat] ?? cat}
                  </div>
                  <div className="mt-2 flex items-start justify-between gap-2">
                    <div className="w-[5.95rem] shrink-0">
                      <div
                        className="font-extralight leading-none tabular-nums"
                        style={{ color: "var(--nd-text)", fontSize: "calc(28px + 0.05rem)" }}
                      >
                        {row ? row.score.toFixed(2) : "—"}
                      </div>
                      <div className="mt-2 w-full">
                        {row ? (
                          <TrendGlyph trend={row.trend} score={row.score} />
                        ) : (
                          <span style={{ color: C.muted }}>—</span>
                        )}
                      </div>
                    </div>
                    <div className="min-h-0 min-w-0 flex-1 self-stretch pt-1">
                      {sparkVals.length >= 2 ? (
                        <MacroSentimentMicroSparkline values={sparkVals} stroke={stroke} height={44} />
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sidebar + table — equal height on xl; table body scrolls */}
          <div className="flex min-h-0 flex-col gap-2 xl:flex-row xl:items-stretch">
            <aside
              className="flex w-full shrink-0 flex-col xl:w-[220px] xl:min-h-0"
              style={{ ...macroPanelSurface, height: categoryRowHeightPx, minHeight: categoryRowHeightPx }}
            >
              <div className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-muted)" }}>
                View by category
              </div>
              <nav className="mt-3 flex flex-col gap-1.5">
                {SIDEBAR.map((item) => {
                  const href = `/macro-sentiment/${item.slug}`;
                  const isActive = activeCategory === slugToCategory(item.slug);
                  return (
                    <Link
                      key={item.slug}
                      href={href}
                      className={cn(
                        "rounded-[2px] px-2.5 py-2.5 text-center text-[13px] font-light transition-colors",
                        isActive ? "border" : "border border-transparent hover:opacity-90",
                      )}
                      style={{
                        borderColor: isActive ? C.border : "transparent",
                        background: isActive ? "var(--nd-panel-soft)" : "transparent",
                        color: isActive ? C.text : C.soft,
                      }}
                    >
                      <div>{item.label}</div>
                      {item.note ? (
                        <div className="mt-0.5 text-[11px] leading-snug" style={{ color: C.muted }}>
                          {item.note}
                        </div>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </aside>

            <div
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden xl:min-h-0"
              style={{ ...macroPanelSurface, height: categoryRowHeightPx, minHeight: categoryRowHeightPx }}
            >
              <div className="shrink-0 border-b pb-1" style={{ borderColor: "var(--nd-border-soft)" }}>
                <h2 className="text-[16px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--nd-text)" }}>
                  {CATEGORY_LABELS[activeCategory] ?? activeCategory}
                </h2>
              </div>

              <div
                className="mt-1 min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain pb-1"
                style={{ maxHeight: categoryRowHeightPx - 44 }}
              >
                {data.indicatorsDetailPending ? (
                  <div className="flex min-h-[220px] items-center justify-center text-[14px]" style={{ color: C.muted }}>
                    Loading indicators…
                  </div>
                ) : data.categoryRows.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center text-[14px]" style={{ color: C.muted }}>
                    No indicators for this category.
                  </div>
                ) : (
                  <table className="w-full min-w-[920px] table-fixed border-collapse text-[13px]">
                    <colgroup>
                      <col style={{ width: MACRO_INDICATOR_NAME_MAX_PX }} />
                      <col style={{ width: "5.75rem" }} />
                      <col style={{ width: "4rem" }} />
                      <col style={{ width: "26%" }} />
                      <col style={{ width: MACRO_PCT_COL_WIDTH_REM }} />
                      <col style={{ width: MACRO_PCT_COL_WIDTH_REM }} />
                      <col style={{ width: "35%" }} />
                    </colgroup>
                    <thead>
                      <tr
                        className="sticky top-0 z-[1] border-b text-[11px] uppercase tracking-[0.08em] shadow-[0_1px_0_var(--nd-border-soft)]"
                        style={{
                          borderColor: "var(--nd-border-soft)",
                          color: "var(--nd-muted)",
                          background: "var(--nd-panel)",
                        }}
                      >
                        <th className="py-3 pl-0 pr-2 text-left font-medium" style={{ maxWidth: MACRO_INDICATOR_NAME_MAX_PX }}>
                          Indicator (FRED)
                        </th>
                        <th className="px-1 py-3 text-center font-medium">Latest</th>
                        <th className="px-1 py-3 text-center font-medium whitespace-nowrap">Z-Score</th>
                        <th className="px-1 py-3 text-center font-medium">Trend (6M)</th>
                        <th className="px-0.5 py-3 text-center font-medium" style={{ width: MACRO_PCT_COL_WIDTH_REM }}>
                          MoM
                        </th>
                        <th className="px-0.5 py-3 text-center font-medium" style={{ width: MACRO_PCT_COL_WIDTH_REM }}>
                          YoY
                        </th>
                        <th className="py-3 pl-2 pr-0 text-center font-medium">History</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.categoryRows.map((row, i) => {
                        const hist = data.rowHistories[i]?.data;
                        const six = historySparkValues(hist, 8);
                        const longVals = longHistorySpark(hist);
                        const zColor =
                          row.z_score == null ? C.muted : row.z_score >= 0 ? C.green : C.red;
                        const selected = selectedIndicatorId === row.id;
                        return (
                          <tr
                            key={row.id}
                            tabIndex={0}
                            aria-selected={selected}
                            onClick={() => setSelectedIndicatorId(row.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedIndicatorId(row.id);
                              }
                            }}
                            className={cn(
                              "cursor-pointer border-b transition-colors hover:opacity-[0.92]",
                              selected && "bg-[var(--nd-panel-soft)]",
                            )}
                            style={{ borderColor: "var(--nd-border-soft)" }}
                          >
                            <td className="py-3 pr-2 align-middle" style={{ maxWidth: MACRO_INDICATOR_NAME_MAX_PX, width: MACRO_INDICATOR_NAME_MAX_PX }}>
                              <div
                                className="line-clamp-2 break-words font-light leading-snug"
                                style={{ color: "var(--nd-text)", maxWidth: MACRO_INDICATOR_NAME_MAX_PX }}
                              >
                                {row.name}
                              </div>
                              <div className="mt-0.5 truncate font-mono text-[11px]" style={{ color: "var(--nd-muted)" }}>
                                {row.fred_series_id}
                              </div>
                            </td>
                            <td className="px-1 py-3 text-center align-middle tabular-nums">
                              <div className="flex justify-center" style={{ color: "var(--nd-text)" }}>
                                {row.latest_value != null ? fmtIndicator(row.latest_value, row.unit) : "—"}
                              </div>
                              <div className="mt-0.5 text-center text-[11px]" style={{ color: "var(--nd-muted)" }}>
                                {row.latest_date ? format(parseISO(row.latest_date), "MMM yyyy") : "—"}
                              </div>
                            </td>
                            <td className="px-1 py-3 text-center align-middle tabular-nums font-medium" style={{ color: zColor }}>
                              {row.z_score != null ? row.z_score.toFixed(2) : "—"}
                            </td>
                            <td className="min-w-0 px-1 py-3 align-middle">
                              <div className="flex min-w-0 justify-center">
                                {six.length >= 2 ? (
                                  <MacroSentimentMicroSparkline values={six} stroke={C.blue} height={36} />
                                ) : (
                                  "—"
                                )}
                              </div>
                            </td>
                            <td
                              className="px-0.5 py-3 text-center align-middle font-mono tabular-nums text-[12px] whitespace-nowrap"
                              style={{ color: "var(--nd-soft)", width: MACRO_PCT_COL_WIDTH_REM, maxWidth: MACRO_PCT_COL_WIDTH_REM }}
                            >
                              {momPct(row)}
                            </td>
                            <td
                              className="px-0.5 py-3 text-center align-middle font-mono tabular-nums text-[12px] whitespace-nowrap"
                              style={{ color: "var(--nd-soft)", width: MACRO_PCT_COL_WIDTH_REM, maxWidth: MACRO_PCT_COL_WIDTH_REM }}
                            >
                              {approxYoY(hist, row)}
                            </td>
                            <td className="min-w-0 py-3 pl-2 pr-0 align-middle">
                              <div className="flex min-w-0 justify-center">
                                {longVals.length >= 2 ? (
                                  <MacroSentimentMicroSparkline values={longVals} stroke={C.soft} height={32} />
                                ) : (
                                  "—"
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {selectedRow ? (
            selectedHistoryPending ? (
              <div className="px-4 py-10 text-center text-[14px]" style={{ ...macroPanelSurface, color: C.muted }}>
                Loading chart…
              </div>
            ) : detailChartData.length >= 2 ? (
              <div className="flex min-h-0 flex-col overflow-hidden" style={macroPanelSurface}>
                <div
                  className="flex shrink-0 flex-wrap items-baseline justify-between gap-2 border-b px-4 pb-2 pt-3"
                  style={{ borderColor: "var(--nd-border-soft)" }}
                >
                  <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--nd-text)" }}>
                    {selectedRow.name}
                  </h3>
                  <span className="font-mono text-[11px]" style={{ color: "var(--nd-muted)" }}>
                    {selectedRow.fred_series_id}
                  </span>
                </div>
                <IndicatorDetailCharts
                  palette={C}
                  selectedRow={selectedRow}
                  levelRows={detailChartData}
                  zRows={zSeriesData}
                />
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-[14px]" style={{ ...macroPanelSurface, color: C.muted }}>
                Not enough history to chart this indicator.
              </div>
            )
          ) : null}
        </section>
      </NextDashboardShell>
    </>
  );
}
