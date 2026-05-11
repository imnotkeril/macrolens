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
  getMacroOverview,
  getMarketRatios,
  getMarketSeries,
  getNetLiquidity,
  getRecessionBands,
} from "@/lib/api";
import { NEXT_MACRO_RATIOS_ROOT } from "@/components/next-dashboard/analysis/macroRatiosQueryKeys";
import {
  DualAxisMacroChart,
  MacroRatiosPageStrip,
  MacroRatiosTfStrip,
  MacroRatioCardHeader,
  macroRatiosTfDays,
  type MacroRatiosTfKey,
} from "@/components/next-dashboard/analysis/macroRatiosCharts";
import { LineMetricChart } from "@/components/next-dashboard/analysis/marketBreadthCharts";
import {
  computeCreditImpulsePctPts,
  mergeSpxWithSeries,
  millionsUsdToTrillions,
  rrpMillionsToBillions,
  weeklyLastRatioPoints,
  weeklyLastMerged,
} from "@/components/next-dashboard/analysis/macroRatiosUtils";
import { filterRowsByLookback } from "@/components/next-dashboard/analysis/majorIndicesUtils";
import type { MacroOverviewData, NetLiquidityPoint, RatioPoint, RecessionBand } from "@/types";
import {
  reportEmbedDenseGridClass,
  reportEmbedSectionClass,
} from "@/components/next-dashboard/reports/reportEmbedLayoutClasses";

const FETCH_DAYS = 365 * 15 + 400;

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

type MacroLineAgg = "weekly" | "daily" | "monthly";

function prepareMacroLine(
  raw: RatioPoint[] | undefined,
  lookbackDays: number,
  agg: MacroLineAgg,
  mapVal?: (v: number) => number,
): RatioPoint[] {
  let rows = rowsFromSeries(raw);
  if (mapVal) rows = rows.map((r) => ({ ...r, value: mapVal(r.value) }));
  rows = filterRowsByLookback(rows, lookbackDays);
  if (agg === "weekly") rows = weeklyLastRatioPoints(rows);
  return rows;
}

function rowsNetLiquidityTrillions(rows: NetLiquidityPoint[] | undefined, lookbackDays: number): RatioPoint[] {
  if (!rows?.length) return [];
  const mapped: RatioPoint[] = rows.map((r) => ({
    date: r.date,
    value: millionsUsdToTrillions(r.value),
  }));
  return filterRowsByLookback(mapped, lookbackDays);
}

function latestOverviewDate(data: MacroOverviewData | undefined): string {
  if (!data?.spx?.length) return "";
  const last = data.spx[data.spx.length - 1];
  return last?.date ?? "";
}

type Page1Spec = {
  n: number;
  title: string;
  tickers: string;
  hint: string;
  annotation?: string;
  ratioSource:
    | { kind: "macro"; key: keyof MacroOverviewData }
    | { kind: "eemefa" }
    | { kind: "ijh" };
  recession?: boolean;
};

const PAGE1_CHARTS: Page1Spec[] = [
  {
    n: 1,
    title: "High beta vs low beta",
    tickers: "SPHB / SPLV",
    hint: "Higher = risk appetite (high beta leadership). Shaded zones = US recessions (USREC).",
    annotation: "Rising = risk appetite rising",
    ratioSource: { kind: "macro", key: "high_beta_low_beta" },
    recession: true,
  },
  {
    n: 2,
    title: "Cyclical vs non-cyclical",
    tickers: "XLY / XLP",
    hint: "Discretionary vs staples. Rising = cyclical optimism; falling = defensive rotation.",
    annotation: "Rising = economic optimism · Falling = defensive rotation",
    ratioSource: { kind: "macro", key: "cyclical_non_cyclical" },
  },
  {
    n: 3,
    title: "Technology vs materials",
    tickers: "XLK / XLB",
    hint: "Growth/momentum vs inflation-sensitive materials.",
    annotation: "Rising = growth regime · Falling = value / commodities tilt",
    ratioSource: { kind: "macro", key: "tech_materials" },
  },
  {
    n: 4,
    title: "Large cap vs small cap",
    tickers: "IVV / IJR",
    hint: "Large-cap ETF vs small-cap ETF relative strength.",
    annotation: "Rising = large-cap leadership (often late-cycle / quality)",
    ratioSource: { kind: "macro", key: "large_small" },
  },
  {
    n: 5,
    title: "Mid cap vs small cap",
    tickers: "IJH / IJR",
    hint: "Mid-cap vs small-cap size factor; breadth context.",
    annotation: "Size factor breadth — requires IJH & IJR in MarketData",
    ratioSource: { kind: "ijh" },
  },
  {
    n: 6,
    title: "Emerging vs developed",
    tickers: "EEM / EFA",
    hint: "Uses EEM/EFA when both series exist; otherwise falls back to macro EEM/VEA.",
    annotation: "Rising = EM risk-on / weak USD tilt · Falling = USD strength / DM preference",
    ratioSource: { kind: "eemefa" },
  },
  {
    n: 7,
    title: "Gold vs copper",
    tickers: "Gold / Copper",
    hint: "Macro overview ratio — growth vs defensive commodities.",
    annotation: "Rising = growth slowing vs cyclical copper · Falling = global growth firm",
    ratioSource: { kind: "macro", key: "gold_copper" },
  },
  {
    n: 8,
    title: "Gold vs oil",
    tickers: "Gold / WTI",
    hint: "Inflation hedge vs energy demand.",
    annotation: "Rising = deflationary / risk-off tilt · Falling = reflation / growth",
    ratioSource: { kind: "macro", key: "gold_oil" },
  },
  {
    n: 9,
    title: "Gold vs lumber",
    tickers: "Gold / Lumber",
    hint: "Housing / construction proxy via lumber.",
    annotation: "Rising = housing / construction soft vs gold bid",
    ratioSource: { kind: "macro", key: "gold_lumber" },
  },
];

export function NextMacroRatiosScreen({
  omitShell = false,
  /** When set (e.g. PDF section), lock Macro overview to this page and hide Page 1 / Page 2 toggle */
  macroOverviewPage,
}: {
  omitShell?: boolean;
  macroOverviewPage?: 1 | 2;
}) {
  const { shellThemeVars, toggleTheme, colors: C } = useNextShellTheme();
  const queryClient = useQueryClient();
  const { refreshing, refreshResult, progress, handleRefresh } = useDataRefresh();
  const surface = useMemo(() => nextPanelSurfaceStyle(C), [C]);
  const panel = useMemo(() => ({ ...surface, padding: "10px 14px" } as const), [surface]);
  const chartCard =
    "flex h-full min-h-0 min-w-0 flex-col overflow-hidden print:overflow-visible print:h-auto print:min-h-[280px]";

  const [tfKey, setTfKey] = useState<MacroRatiosTfKey>("2Y");
  const [pageInternal, setPageInternal] = useState<1 | 2>(1);
  const macroPageLocked = macroOverviewPage != null;
  const page: 1 | 2 = macroOverviewPage ?? pageInternal;
  const lookbackDays = macroRatiosTfDays(tfKey);

  const macroQ = useQuery({
    queryKey: [NEXT_MACRO_RATIOS_ROOT, "overview", FETCH_DAYS],
    queryFn: () => getMacroOverview(FETCH_DAYS),
    staleTime: 120_000,
  });

  const recessionQ = useQuery({
    queryKey: [NEXT_MACRO_RATIOS_ROOT, "recession-bands"],
    queryFn: () => getRecessionBands(),
    staleTime: 3600_000,
  });

  const ijhQ = useQuery({
    queryKey: [NEXT_MACRO_RATIOS_ROOT, "ratio-ijh-ijr", FETCH_DAYS],
    queryFn: () => getMarketRatios("IJH", "IJR", FETCH_DAYS),
    staleTime: 120_000,
  });

  const eemEfaQ = useQuery({
    queryKey: [NEXT_MACRO_RATIOS_ROOT, "ratio-eem-efa", FETCH_DAYS],
    queryFn: () => getMarketRatios("EEM", "EFA", FETCH_DAYS),
    staleTime: 120_000,
  });

  const bdiyQ = useQuery({
    queryKey: [NEXT_MACRO_RATIOS_ROOT, "series-bdiy", FETCH_DAYS],
    queryFn: () => getMarketSeries("BDIY", FETCH_DAYS),
    staleTime: 120_000,
  });

  const netLiqQ = useQuery({
    queryKey: [NEXT_MACRO_RATIOS_ROOT, "net-liquidity", FETCH_DAYS],
    queryFn: () => getNetLiquidity(FETCH_DAYS),
    staleTime: 120_000,
  });

  const consumerCreditQ = useQuery({
    queryKey: [NEXT_MACRO_RATIOS_ROOT, "consumer-credit", FETCH_DAYS],
    queryFn: () => getMarketSeries("CONSUMER_CREDIT", FETCH_DAYS),
    staleTime: 120_000,
    retry: 1,
  });

  const commodityBondsQ = useQuery({
    queryKey: [NEXT_MACRO_RATIOS_ROOT, "ratio-dbc-zb", FETCH_DAYS],
    queryFn: () => getMarketRatios("DBC", "ZB_FUT", FETCH_DAYS),
    staleTime: 120_000,
  });

  const ismOrdersInvQ = useQuery({
    queryKey: [NEXT_MACRO_RATIOS_ROOT, "ratio-ism-no-invt", FETCH_DAYS],
    queryFn: () => getMarketRatios("ISM_NO", "ISM_INVT", FETCH_DAYS),
    staleTime: 120_000,
  });

  const overview = macroQ.data as MacroOverviewData | undefined;
  const bands = (recessionQ.data ?? []) as RecessionBand[];

  const errors = useMemo(() => {
    const out: Array<{ label: string; message: string }> = [];
    if (macroQ.isError) out.push({ label: "Macro overview", message: String(macroQ.error) });
    if (recessionQ.isError) out.push({ label: "Recession bands", message: String(recessionQ.error) });
    if (ijhQ.isError) out.push({ label: "IJH/IJR ratio", message: String(ijhQ.error) });
    if (eemEfaQ.isError) out.push({ label: "EEM/EFA ratio", message: String(eemEfaQ.error) });
    if (bdiyQ.isError) out.push({ label: "BDIY series", message: String(bdiyQ.error) });
    if (netLiqQ.isError) out.push({ label: "Net liquidity", message: String(netLiqQ.error) });
    if (consumerCreditQ.isError)
      out.push({ label: "Consumer credit (credit impulse)", message: String(consumerCreditQ.error) });
    if (commodityBondsQ.isError)
      out.push({ label: "DBC/ZB commodity vs bonds", message: String(commodityBondsQ.error) });
    if (ismOrdersInvQ.isError) out.push({ label: "ISM orders/inventories", message: String(ismOrdersInvQ.error) });
    return out;
  }, [
    macroQ.isError,
    macroQ.error,
    recessionQ.isError,
    recessionQ.error,
    ijhQ.isError,
    ijhQ.error,
    eemEfaQ.isError,
    eemEfaQ.error,
    bdiyQ.isError,
    bdiyQ.error,
    netLiqQ.isError,
    netLiqQ.error,
    consumerCreditQ.isError,
    consumerCreditQ.error,
    commodityBondsQ.isError,
    commodityBondsQ.error,
    ismOrdersInvQ.isError,
    ismOrdersInvQ.error,
  ]);

  const onRetry = () => void queryClient.invalidateQueries({ queryKey: [NEXT_MACRO_RATIOS_ROOT] });

  const spxDaily = useMemo(() => rowsFromSeries(overview?.spx), [overview]);

  const ratioMerged = useMemo(() => {
    if (!overview) return null;
    const spx = spxDaily;

    const fromMacroKey = (key: keyof MacroOverviewData) => {
      const ratio = rowsFromSeries(overview[key] as unknown);
      let m = mergeSpxWithSeries(spx, ratio);
      m = filterRowsByLookback(m, lookbackDays);
      return weeklyLastMerged(m);
    };

    const ijh = rowsFromSeries(ijhQ.data);
    let ijhM = mergeSpxWithSeries(spx, ijh);
    ijhM = filterRowsByLookback(ijhM, lookbackDays);
    const ijhW = weeklyLastMerged(ijhM);

    const eemEfa = rowsFromSeries(eemEfaQ.data);
    let emM = mergeSpxWithSeries(spx, eemEfa);
    emM = filterRowsByLookback(emM, lookbackDays);
    let emW = weeklyLastMerged(emM);
    const fallbackEm = fromMacroKey("em_dm");
    if (!emW.length && fallbackEm.length) emW = fallbackEm;

    const ipo = rowsFromSeries(overview.ipo);
    let ipoM = mergeSpxWithSeries(spx, ipo);
    ipoM = filterRowsByLookback(ipoM, lookbackDays);
    const ipoW = weeklyLastMerged(ipoM);

    const bdiyPts = rowsFromSeries(bdiyQ.data);
    let bdiM = mergeSpxWithSeries(spx, bdiyPts);
    bdiM = filterRowsByLookback(bdiM, lookbackDays);
    const bdiW = weeklyLastMerged(bdiM);

    const commBond = rowsFromSeries(commodityBondsQ.data);
    let commM = mergeSpxWithSeries(spx, commBond);
    commM = filterRowsByLookback(commM, lookbackDays);
    const commW = weeklyLastMerged(commM);

    return {
      high_beta_low_beta: fromMacroKey("high_beta_low_beta"),
      cyclical_non_cyclical: fromMacroKey("cyclical_non_cyclical"),
      tech_materials: fromMacroKey("tech_materials"),
      large_small: fromMacroKey("large_small"),
      gold_copper: fromMacroKey("gold_copper"),
      gold_oil: fromMacroKey("gold_oil"),
      gold_lumber: fromMacroKey("gold_lumber"),
      ijh_ijr: ijhW,
      em_chart: emW,
      ipo_spx: ipoW,
      bdi_spx: bdiW,
      commodity_bonds: commW,
    };
  }, [overview, spxDaily, lookbackDays, ijhQ.data, eemEfaQ.data, bdiyQ.data, commodityBondsQ.data]);

  const page2Series = useMemo(() => {
    if (!overview) return null;
    const mk = (key: keyof MacroOverviewData, agg: MacroLineAgg, mapVal?: (v: number) => number) =>
      prepareMacroLine(overview[key] as RatioPoint[] | undefined, lookbackDays, agg, mapVal);

    const creditRaw = rowsFromSeries(consumerCreditQ.data);
    const creditScoped = filterRowsByLookback(creditRaw, lookbackDays);
    const creditImpulse = computeCreditImpulsePctPts(creditScoped);

    const ismRatioPts = rowsFromSeries(ismOrdersInvQ.data);
    const ismOrdersInv = prepareMacroLine(ismRatioPts, lookbackDays, "monthly");

    return {
      inflation: mk("inflation_expectations", "weekly"),
      realYield: mk("real_yields", "weekly"),
      spread: mk("yield_spread_10y_2y", "weekly"),
      fwdFed: mk("forward_fed_rate", "daily"),
      cbBs: mk("central_bank_bs", "weekly", millionsUsdToTrillions),
      netLiq: rowsNetLiquidityTrillions(netLiqQ.data, lookbackDays),
      move: mk("move", "daily"),
      rrp: mk("rrp", "daily", rrpMillionsToBillions),
      usLei: mk("us_lei", "monthly"),
      cnLei: mk("cn_lei", "monthly"),
      creditImpulse,
      ismOrdersInv,
    };
  }, [overview, lookbackDays, netLiqQ.data, consumerCreditQ.data, ismOrdersInvQ.data]);

  const loading = macroQ.isPending;

  const chartColors = [
    String(C.blue),
    String(C.green),
    String(C.orange),
    String(C.yellow),
    String(C.red),
    String(C.purple),
    String(C.blue),
    String(C.green),
    String(C.orange),
    String(C.yellow),
  ];

  function dataForSpec(spec: Page1Spec): {
    rows: { date: string; spx: number; y: number }[];
    rightLabel: string;
    formatR: (v: number) => string;
  } {
    if (!ratioMerged) return { rows: [], rightLabel: "Ratio", formatR: (v) => v.toFixed(2) };
    const fmtRatio = (v: number) => v.toFixed(2);

    switch (spec.ratioSource.kind) {
      case "macro": {
        const map: Partial<
          Record<keyof MacroOverviewData, keyof typeof ratioMerged>
        > = {
          high_beta_low_beta: "high_beta_low_beta",
          cyclical_non_cyclical: "cyclical_non_cyclical",
          tech_materials: "tech_materials",
          large_small: "large_small",
          gold_copper: "gold_copper",
          gold_oil: "gold_oil",
          gold_lumber: "gold_lumber",
        };
        const mergedKey = map[spec.ratioSource.key];
        const rows =
          mergedKey != null ? ratioMerged[mergedKey] : ([] as typeof ratioMerged.high_beta_low_beta);
        return { rows, rightLabel: "Ratio", formatR: fmtRatio };
      }
      case "ijh":
        return { rows: ratioMerged.ijh_ijr, rightLabel: "IJH/IJR", formatR: fmtRatio };
      case "eemefa":
        return { rows: ratioMerged.em_chart, rightLabel: "EM/DM", formatR: fmtRatio };
      default:
        return { rows: [], rightLabel: "Ratio", formatR: fmtRatio };
    }
  }

  const mainColumn = (
        <section className={reportEmbedSectionClass(omitShell)}>
          <QueryErrorBanner colors={C} errors={errors} onRetry={onRetry} />

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
            <p className="max-w-[min(100%,48rem)] text-[12px] leading-snug" style={{ color: "var(--nd-muted)" }}>
              {page === 1 ? (
                <>
                  Macro overview — SPX (left) vs relative strength or level (right), weekly sampling. Page 1: factor,
                  rotation & commodities. Page 2: rates, liquidity & leading indicators (single-series macro lines).
                </>
              ) : (
                <>
                  Page 2 — rates, liquidity & leading indicators: one series per panel (weekly last where noted).
                  Net liquidity uses Fed BS − TGA − RRP (same units as balance sheet). Central bank aggregate is Fed +
                  ECB until additional CB series are wired.
                </>
              )}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {!macroPageLocked ? <MacroRatiosPageStrip page={page} onSelect={setPageInternal} /> : null}
              <MacroRatiosTfStrip selectedKey={tfKey} onSelect={setTfKey} />
            </div>
          </div>

          {loading ? (
            <div
              className={`flex items-center justify-center py-16 text-[13px] ${omitShell ? "min-h-[960px] shrink-0" : "flex-1"}`}
              style={{ color: "var(--nd-muted)" }}
            >
              Loading macro overview…
            </div>
          ) : page === 1 ? (
            <div
              className={`nd-report-dense-chart-grid grid grid-cols-1 grid-rows-[repeat(12,minmax(0,1fr))] gap-2 sm:grid-cols-2 lg:grid-rows-[repeat(6,minmax(0,1fr))] xl:grid-cols-4 xl:grid-rows-[repeat(3,minmax(0,1fr))] print:grid-cols-4 print:grid-rows-[repeat(3,minmax(0,1fr))] print:flex-none print:h-auto ${reportEmbedDenseGridClass(omitShell)}`}
            >
              {PAGE1_CHARTS.map((spec, idx) => {
                const { rows, rightLabel, formatR } = dataForSpec(spec);
                return (
                  <div key={spec.n} className={chartCard} style={panel}>
                    <MacroRatioCardHeader
                      title={`${spec.n}. ${spec.title}`}
                      subtitle={`Weekly · ${spec.tickers}`}
                      hint={spec.hint}
                    />
                    <div className="flex min-h-0 flex-1 flex-col">
                      <DualAxisMacroChart
                        data={rows}
                        rightName={rightLabel}
                        rightColor={chartColors[idx % chartColors.length]!}
                        spxColor={String(C.purple)}
                        formatRight={formatR}
                        annotation={spec.annotation}
                        recessionBands={spec.recession ? bands : undefined}
                      />
                    </div>
                  </div>
                );
              })}
              <div className={chartCard} style={panel}>
                <MacroRatioCardHeader
                  title="10. Commodity index vs bonds"
                  subtitle="Weekly · DBC / ZB=F (BCOM / ZB proxies)"
                  hint="DBC (commodity ETF) vs CBOT Treasury bond futures — loaded via Yahoo into MarketData."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                  <DualAxisMacroChart
                    data={ratioMerged?.commodity_bonds ?? []}
                    rightName="DBC/ZB"
                    rightColor={String(C.yellow)}
                    spxColor={String(C.purple)}
                    formatRight={(v) => v.toFixed(3)}
                    annotation="Rising = commodities strong vs bonds · Falling = bond bid / disinflation"
                  />
                </div>
              </div>
              {/* 11 BDI vs SPX */}
              <div className={chartCard} style={panel}>
                <MacroRatioCardHeader
                  title="11. Baltic Dry vs SPX"
                  subtitle="Weekly · BDRY (BDIY) vs SP500"
                  hint="BDRY ETF (dry bulk / Baltic proxy) stored as symbol BDIY in MarketData."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                  <DualAxisMacroChart
                    data={ratioMerged?.bdi_spx ?? []}
                    rightName="BDIY"
                    rightColor={String(C.blue)}
                    spxColor={String(C.purple)}
                    formatRight={(v) => v.toFixed(0)}
                    annotation="Leading global shipping demand proxy vs equities"
                  />
                </div>
              </div>
              {/* 12 IPO vs SPX */}
              <div className={chartCard} style={panel}>
                <MacroRatioCardHeader
                  title="12. IPO ETF vs SPX"
                  subtitle="Weekly · IPO vs SP500"
                  hint="Renaissance IPO ETF vs broad market — liquidity & risk appetite proxy."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                  <DualAxisMacroChart
                    data={ratioMerged?.ipo_spx ?? []}
                    rightName="IPO ETF"
                    rightColor={String(C.orange)}
                    spxColor={String(C.purple)}
                    formatRight={(v) => v.toFixed(2)}
                    annotation="IPO ETF vs SPX — risk appetite / liquidity"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div
              className={`nd-report-dense-chart-grid grid grid-cols-1 grid-rows-[repeat(12,minmax(0,1fr))] gap-2 sm:grid-cols-2 lg:grid-rows-[repeat(6,minmax(0,1fr))] xl:grid-cols-4 xl:grid-rows-[repeat(3,minmax(0,1fr))] print:grid-cols-4 print:grid-rows-[repeat(3,minmax(0,1fr))] print:flex-none print:h-auto ${reportEmbedDenseGridClass(omitShell)}`}
            >
              <div className={chartCard} style={panel}>
                <MacroRatioCardHeader
                  title="1. Inflation expectations (TIP/IEF)"
                  subtitle="Weekly · Ratio: TIPS ETF / 7–10Y Treasury ETF"
                  hint="Macro overview: TIP/IEF where both ETFs exist in MarketData."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                  <LineMetricChart
                    rows={page2Series?.inflation ?? []}
                    lineColor={String(C.purple)}
                    valueLabel="TIP/IEF"
                    formatY={(v) => v.toFixed(2)}
                    references={[]}
                  />
                  <p className="mt-1 shrink-0 text-[8px] leading-snug" style={{ color: "var(--nd-muted)" }}>
                    Rising = inflation expectations rising.
                  </p>
                </div>
              </div>
              <div className={chartCard} style={panel}>
                <MacroRatioCardHeader
                  title="2. 5Y real yield (US05Y − T5YIE)"
                  subtitle="Weekly · Nominal 5Y yield minus 5Y breakeven"
                  hint="Approximate ex-ante real short rate from Treasury curve + breakeven."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                  <LineMetricChart
                    rows={page2Series?.realYield ?? []}
                    lineColor={String(C.blue)}
                    valueLabel="Real yield"
                    formatY={(v) => v.toFixed(2)}
                    references={[]}
                  />
                  <p className="mt-1 shrink-0 text-[8px] leading-snug" style={{ color: "var(--nd-muted)" }}>
                    High = tight financial conditions, pressure on growth assets.
                  </p>
                </div>
              </div>
              <div className={chartCard} style={panel}>
                <MacroRatioCardHeader
                  title="3. 10Y−2Y spread"
                  subtitle="Weekly · 10Y Treasury yield minus 2Y Treasury yield"
                  hint="Yield curve slope; negative = inversion."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                  <LineMetricChart
                    rows={page2Series?.spread ?? []}
                    lineColor={String(C.blue)}
                    valueLabel="10Y−2Y"
                    formatY={(v) => v.toFixed(2)}
                    references={[{ y: 0, stroke: String(C.red), dash: "4 3", label: "0" }]}
                  />
                  <p className="mt-1 shrink-0 text-[8px] leading-snug" style={{ color: "var(--nd-muted)" }}>
                    Below 0 = inversion, recession signal.
                  </p>
                </div>
              </div>
              <div className={chartCard} style={panel}>
                <MacroRatioCardHeader
                  title="4. Forward Fed Funds rate (100 − ZQ)"
                  subtitle="Daily · Implied Fed Funds from ZQ futures (100 − price)"
                  hint="Uses ZQ futures level from MarketData when present."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                  <LineMetricChart
                    rows={page2Series?.fwdFed ?? []}
                    lineColor={String(C.green)}
                    valueLabel="Fwd Fed"
                    formatY={(v) => v.toFixed(2)}
                    references={[]}
                  />
                  <p className="mt-1 shrink-0 text-[8px] leading-snug" style={{ color: "var(--nd-muted)" }}>
                    Where the market expects the Fed Funds rate.
                  </p>
                </div>
              </div>
              <div className={chartCard} style={panel}>
                <MacroRatioCardHeader
                  title="5. Balance sheet — major central banks"
                  subtitle="Weekly · Fed + ECB (extend to BoJ/BoE/PBoC when series exist)"
                  hint="Sum of Fed balance sheet (WALCL) + ECB assets (ECBBS), USD millions → trillions."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                  <LineMetricChart
                    rows={page2Series?.cbBs ?? []}
                    lineColor={String(C.purple)}
                    valueLabel="CB assets"
                    formatY={(v) => `${v.toFixed(1)}T`}
                    references={[]}
                  />
                  <p className="mt-1 shrink-0 text-[8px] leading-snug" style={{ color: "var(--nd-muted)" }}>
                    Rising = global liquidity expansion, tailwind for risk assets.
                  </p>
                </div>
              </div>
              <div className={chartCard} style={panel}>
                <MacroRatioCardHeader
                  title="6. Net liquidity (Fed BS − RRP − TGA)"
                  subtitle="Weekly · Trillions USD"
                  hint="From /api/market/net-liquidity — WALCL-based Fed BS minus Treasury General Account and RRP."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                  <LineMetricChart
                    rows={page2Series?.netLiq ?? []}
                    lineColor={String(C.blue)}
                    valueLabel="Net liq"
                    formatY={(v) => `${v.toFixed(2)}T`}
                    references={[]}
                  />
                  <p className="mt-1 shrink-0 text-[8px] leading-snug" style={{ color: "var(--nd-muted)" }}>
                    Higher = more liquidity in the system.
                  </p>
                </div>
              </div>
              <div className={chartCard} style={panel}>
                <MacroRatioCardHeader
                  title="7. MOVE index"
                  subtitle="Daily · Implied volatility of US Treasuries"
                  hint="ICE BofA MOVE index (^MOVE) when loaded into MarketData."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                  <LineMetricChart
                    rows={page2Series?.move ?? []}
                    lineColor={String(C.orange)}
                    valueLabel="MOVE"
                    formatY={(v) => v.toFixed(1)}
                    references={[
                      { y: 100, stroke: String(C.red), dash: "4 3", label: "100" },
                      { y: 80, stroke: String(C.green), dash: "4 3", label: "80" },
                    ]}
                  />
                  <p className="mt-1 shrink-0 text-[8px] leading-snug" style={{ color: "var(--nd-muted)" }}>
                    Elevated bond vol above ~100 · ~80 closer to normal conditions.
                  </p>
                </div>
              </div>
              <div className={chartCard} style={panel}>
                <MacroRatioCardHeader
                  title="8. Overnight reverse repo (RRP)"
                  subtitle="Daily · NY Fed RRP usage (RRPONTSYD)"
                  hint="Stored as symbol RRP — FRED daily usage in millions USD; chart shows billions."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                  <LineMetricChart
                    rows={page2Series?.rrp ?? []}
                    lineColor={String(C.green)}
                    valueLabel="RRP"
                    formatY={(v) => `${Math.round(v)}B`}
                    references={[]}
                  />
                  <p className="mt-1 shrink-0 text-[8px] leading-snug" style={{ color: "var(--nd-muted)" }}>
                    Declining = liquidity leaving RRP and flowing into markets.
                  </p>
                </div>
              </div>
              <div className={chartCard} style={panel}>
                <MacroRatioCardHeader
                  title="9. US leading economic index"
                  subtitle="Monthly · Conference Board LEI (USSLIND)"
                  hint="Macro overview LEI series from MarketData."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                  <LineMetricChart
                    rows={page2Series?.usLei ?? []}
                    lineColor={String(C.blue)}
                    valueLabel="US LEI"
                    formatY={(v) => v.toFixed(1)}
                    references={[]}
                  />
                  <p className="mt-1 shrink-0 text-[8px] leading-snug" style={{ color: "var(--nd-muted)" }}>
                    Leading indicator for US economy.
                  </p>
                </div>
              </div>
              <div className={chartCard} style={panel}>
                <MacroRatioCardHeader
                  title="10. China leading economic index"
                  subtitle="Monthly · OECD China CLI (CHNLOLITONOSTSAM)"
                  hint="China composite leading indicator — macro overview CNLEI."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                  <LineMetricChart
                    rows={page2Series?.cnLei ?? []}
                    lineColor={String(C.yellow)}
                    valueLabel="China LEI"
                    formatY={(v) => v.toFixed(1)}
                    references={[]}
                  />
                  <p className="mt-1 shrink-0 text-[8px] leading-snug" style={{ color: "var(--nd-muted)" }}>
                    Leading indicator for China activity / EM tilt.
                  </p>
                </div>
              </div>
              <div className={chartCard} style={panel}>
                <MacroRatioCardHeader
                  title="11. Credit impulse"
                  subtitle="Monthly · YoY change of YoY % growth (TOTALSL)"
                  hint="Computed from CONSUMER_CREDIT (FRED TOTALSL) — needs regime history in MarketData."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                  <LineMetricChart
                    rows={page2Series?.creditImpulse ?? []}
                    lineColor="#14b8a6"
                    valueLabel="Impulse"
                    formatY={(v) => `${v.toFixed(1)} pp`}
                    references={[]}
                  />
                  <p className="mt-1 shrink-0 text-[8px] leading-snug" style={{ color: "var(--nd-muted)" }}>
                    Leads recessions by ~9–12 months when momentum rolls over.
                  </p>
                </div>
              </div>
              <div className={chartCard} style={panel}>
                <MacroRatioCardHeader
                  title="12. ISM new orders / inventories"
                  subtitle="Monthly · NAPMNO / NAPMII (FRED)"
                  hint="FRED NAPMNO / NAPMII (ISM manufacturing new orders / inventories diffusion indices)."
                />
                <div className="flex min-h-0 flex-1 flex-col">
                  <LineMetricChart
                    rows={page2Series?.ismOrdersInv ?? []}
                    lineColor={String(C.purple)}
                    valueLabel="NO/Inv"
                    formatY={(v) => v.toFixed(2)}
                    references={[]}
                  />
                  <p className="mt-1 shrink-0 text-[8px] leading-snug" style={{ color: "var(--nd-muted)" }}>
                    Rising = expansion ahead · Falling = inventory buildup / slowdown.
                  </p>
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
          updatedAt={latestOverviewDate(overview)}
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
