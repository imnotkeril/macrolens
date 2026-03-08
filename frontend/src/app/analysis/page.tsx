"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useMemo, useCallback } from "react";
import DashboardGrid from "@/components/DashboardGrid";
import LWChart from "@/components/LWChart";

const FedPolicyContent = dynamic(
  () => import("@/app/fed-policy/page").then((mod) => ({ default: mod.default })),
  { ssr: false }
);
import type { PanelConfig } from "@/components/DashboardGrid";
import { cn } from "@/lib/utils";
import {
  getBreadthDashboard,
  getMacroOverview,
  getInflationDashboard,
  getIndicesDashboard,
  getRatesDashboard,
  getCurrencyDashboard,
  getSentimentDashboard,
  getSectors,
  getYieldCurve,
  getYieldCurveHistory,
  getCurveDynamics,
  getSpreadHistory,
} from "@/lib/api";
import { YieldCurveChart } from "@/components/YieldCurveChart";
import type {
  BreadthDashboardData,
  MacroOverviewData,
  InflationDashboardData,
  IndicesDashboardData,
  RatesDashboardData,
  CurrencyDashboardData,
  SentimentDashboardData,
  SectorPerf,
  RatioPoint,
  YieldCurveSnapshot,
  CurveDynamics,
  TimeSeriesPoint,
} from "@/types";

/* ── Curve pattern config ────────────────────────────────── */

const PATTERN_CONFIG: Record<string, { color: string; border: string; bg: string }> = {
  bear_steepening: { color: "text-accent-amber", border: "border-accent-amber/20", bg: "bg-accent-amber/5" },
  bull_steepening: { color: "text-accent-green", border: "border-accent-green/20", bg: "bg-accent-green/5" },
  bear_flattening: { color: "text-accent-red", border: "border-accent-red/20", bg: "bg-accent-red/5" },
  bull_flattening: { color: "text-accent-blue", border: "border-accent-blue/20", bg: "bg-accent-blue/5" },
  stable: { color: "text-text-muted", border: "border-border", bg: "bg-bg-card" },
  mixed: { color: "text-accent-amber", border: "border-accent-amber/20", bg: "bg-accent-amber/5" },
};

const PATTERN_LABELS: Record<string, string> = {
  bear_steepening: "Bear Steepening",
  bull_steepening: "Bull Steepening",
  bear_flattening: "Bear Flattening",
  bull_flattening: "Bull Flattening",
  stable: "Stable",
  mixed: "Mixed",
};

const PATTERN_GUIDE = [
  { key: "bear_steepening", desc: "All rates UP, long end rises MORE. Growth + inflation expectations rising. Sell long bonds, buy commodities." },
  { key: "bull_steepening", desc: "All rates DOWN, short end falls MORE. Fed cutting, recovery expected. Buy long bonds, buy risk assets." },
  { key: "bear_flattening", desc: "All rates UP, short end rises MORE. Fed hiking, slowing growth ahead. Defensive positioning." },
  { key: "bull_flattening", desc: "All rates DOWN, long end falls MORE. Flight to safety, recession fears. Buy long-duration bonds." },
];

/* ── Tab definitions ─────────────────────────────────────── */

const ANALYSIS_TABS = [
  { id: "indices", label: "Major Indices & Bitcoin" },
  { id: "sectors", label: "Sectors & Sentiment" },
  { id: "rates", label: "Rates & Yield Curve" },
  { id: "breadth", label: "Market Breadth" },
  { id: "macro", label: "Macro Overview" },
  { id: "inflation", label: "US Inflation" },
  { id: "fed", label: "Fed Policy" },
] as const;

type AnalysisTab = (typeof ANALYSIS_TABS)[number]["id"];

const MACRO_PAGES = [
  { id: "fi", label: "Fixed Income & Liquidity" },
  { id: "commodities", label: "Commodities & Global Activity" },
  { id: "risk", label: "Risk Appetite & Relative Performance" },
] as const;

const MACRO_TOOLTIPS: Record<string, string> = {
  "Inflation Expectations (TIP/IEF)": "TIP/IEF ratio reflects inflation expectations priced in TIPS vs nominal Treasuries. Rising = higher inflation expectations.",
  "US Real Yields (5Y)": "5-Year Treasury minus 5Y breakeven inflation. Real yield = return after inflation. High real yields tighten financial conditions.",
  "10Y & 2Y US Bonds Spread": "10Y-2Y yield curve slope. Inversion (negative) often precedes recession. Steepening = growth/inflation expectations rising.",
  "Forward Federal Funds Rate": "Implied Fed rate from 30-day Fed Funds futures (ZQ). Market's expectation for near-term policy.",
  "Balance Sheets of Major Central Banks": "Combined Fed + ECB total assets. QE expands, QT contracts. Tighter liquidity when shrinking.",
  "US Liquidity (Fed BS − RRP)": "Fed balance sheet minus Reverse Repo. Proxy for bank reserves and dollar liquidity in the system.",
  "MOVE — Bond Market Volatility": "ICE BofA MOVE Index. Bond market volatility (options-implied). Spikes signal stress in rates markets.",
  "Overnight Reverse REPO": "Fed's RRP facility. Banks/MFs park excess cash. High levels = ample liquidity; decline can signal normalization or stress.",
  "Treasury General Account (TGA)": "US Treasury cash balance at Fed. Large TGA draws drain reserves; builds add liquidity when spent.",
  "SOFR − Fed Funds Spread": "SOFR vs EFFR spread. Widening can signal interbank stress or year-end liquidity pressure.",
  "Gold VS Oil": "Gold/Oil ratio. Rise = risk-off, inflation hedge demand. Fall = growth/commodity demand.",
  "Gold VS Copper": "Gold/Copper ratio. Copper = growth proxy. High ratio = defensive, low = risk-on.",
  "Gold VS Lumber": "Gold/Lumber ratio. Lumber = housing/construction. Reflects real estate and growth sentiment.",
  "IPO Index": "Renaissance IPO ETF. IPO activity reflects risk appetite and equity market receptivity.",
  "US Leading Economic Index": "Conference Board LEI. Forward-looking growth indicator. Declines often precede recessions.",
  "China Leading Indicator": "China LEI. Early signal for global manufacturing and trade demand.",
  "Dr. Copper (HG Futures)": "Copper futures. 'Doctor' of economy—sensitive to industrial demand and global growth.",
  "KOSPI — Korea": "Korea stock index. Export-oriented, tech-heavy. Barometer for Asian risk appetite.",
  "TAIEX — Taiwan": "Taiwan stock index. Tech/semiconductor proxy. Key for global supply chain sentiment.",
  "High Beta VS Low Beta (SPHB/SPLV)": "SPHB/SPLV ratio. High beta outperforms in risk-on; low beta in risk-off.",
  "Cyclical VS Non-Cyclical (XLY/XLP)": "Consumer Discretionary vs Staples. Cyclicals lead in expansion; defensives in contraction.",
  "Technology VS Materials (XLK/XLB)": "Tech vs Materials sector ratio. Tech outperforms in growth/low-rate regimes.",
  "Large Cap VS Small Cap (IVV/IJR)": "Large vs small cap relative strength. Small caps lead in early recovery; large caps in late cycle.",
  "Micro Cap VS Small Cap (IWC/IJR)": "Micro vs small cap. Most risk-on when micro outperforms.",
  "Emerging VS Developed (EEM/VEA)": "EM vs DM equities. EM outperforms in risk-on, dollar weakness; DM in risk-off.",
  "Credit Spreads (HYG/IEI)": "High yield vs investment grade bonds. Wider spreads = credit stress, risk-off.",
  "XLF Relative Strength (XLF/SPX)": "Financials vs S&P 500. Financials lead when rates rise and growth is strong.",
};

type MacroPage = (typeof MACRO_PAGES)[number]["id"];

/* ── Helpers ─────────────────────────────────────────────── */

function mergeWithSpx(
  spx: RatioPoint[],
  indicator: RatioPoint[]
): Record<string, unknown>[] {
  const map = new Map<string, { spx?: number; value?: number }>();
  for (const pt of spx) {
    map.set(pt.date, { spx: pt.value });
  }
  for (const pt of indicator) {
    const existing = map.get(pt.date);
    if (existing) {
      existing.value = pt.value;
    } else {
      map.set(pt.date, { value: pt.value });
    }
  }
  return [...map.entries()]
    .filter(([, v]) => v.spx != null && v.value != null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, spx: v.spx, value: v.value }));
}

function dualPanel(
  title: string,
  spx: RatioPoint[],
  indicator: RatioPoint[],
  color: string,
  label: string,
  thresholds?: { value: number; color: string; label: string }[]
): PanelConfig | null {
  const data = mergeWithSpx(spx, indicator);
  if (!data.length) return null;
  return {
    title,
    chart: {
      data,
      series: [
        {
          key: "spx",
          color: "rgba(255,255,255,0.35)",
          label: "SPX",
          type: "line",
          lineWidth: 1,
          priceScaleId: "left",
        },
        { key: "value", color, label, type: "line" },
      ],
      thresholds,
      periodSelector: true,
      scrollable: true,
    },
  };
}

/* ── Component ───────────────────────────────────────────── */

export default function AnalysisPage() {
  const [tab, setTab] = useState<AnalysisTab>("indices");
  const [indicesPeriod, setIndicesPeriod] = useState(365 * 2); // days: 2Y default
  const [inflSubTab, setInflSubTab] = useState<"cpi" | "pce" | "ppi">("cpi");
  const [macroPage, setMacroPage] = useState<MacroPage>("fi");

  /* Indices state */
  const [idx, setIdx] = useState<IndicesDashboardData | null>(null);
  const [idxLoading, setIdxLoading] = useState(false);

  /* Sectors & Sentiment & Currency (unified tab) */
  const [sectorPeriod, setSectorPeriod] = useState(180);
  const [sectorPerfs, setSectorPerfs] = useState<SectorPerf[]>([]);
  const [sentiment, setSentiment] = useState<SentimentDashboardData | null>(null);
  const [currency, setCurrency] = useState<CurrencyDashboardData | null>(null);
  const [sectorsLoading, setSectorsLoading] = useState(false);

  const [rates, setRates] = useState<RatesDashboardData | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesLoaded, setRatesLoaded] = useState(false);

  /* Breadth state */
  const [breadth, setBreadth] = useState<BreadthDashboardData>({});
  const [breadthLoading, setBreadthLoading] = useState(false);
  const [breadthLoaded, setBreadthLoaded] = useState(false);

  /* Macro state */
  const [macro, setMacro] = useState<MacroOverviewData | null>(null);
  const [macroLoading, setMacroLoading] = useState(false);
  const [macroLoaded, setMacroLoaded] = useState(false);

  /* Inflation state */
  const [infl, setInfl] = useState<InflationDashboardData | null>(null);
  const [inflLoading, setInflLoading] = useState(false);
  const [inflLoaded, setInflLoaded] = useState(false);

  /* Yield curve state (for rates tab enrichment) */
  const [ycSnapshot, setYcSnapshot] = useState<YieldCurveSnapshot | null>(null);
  const [ycHistory, setYcHistory] = useState<YieldCurveSnapshot[] | undefined>(undefined);
  const [ycDynamics, setYcDynamics] = useState<CurveDynamics | null>(null);
  const [ycSpread2y10y, setYcSpread2y10y] = useState<TimeSeriesPoint[]>([]);
  const [ycLoaded, setYcLoaded] = useState(false);

  const loadIndices = useCallback((days: number) => {
    setIdxLoading(true);
    getIndicesDashboard(days)
      .then(setIdx)
      .catch(() => {})
      .finally(() => setIdxLoading(false));
  }, []);

  const loadSectorsData = useCallback((days: number) => {
    setSectorsLoading(true);
    Promise.all([
      getSectors(days).then(setSectorPerfs).catch(() => {}),
      getSentimentDashboard(days).then(setSentiment).catch(() => {}),
      getCurrencyDashboard(days).then(setCurrency).catch(() => {}),
    ]).finally(() => setSectorsLoading(false));
  }, []);

  const loadRates = useCallback(() => {
    if (ratesLoaded) return;
    setRatesLoading(true);
    getRatesDashboard()
      .then(setRates)
      .catch(() => {})
      .finally(() => {
        setRatesLoading(false);
        setRatesLoaded(true);
      });
  }, [ratesLoaded]);

  const loadYieldCurve = useCallback(() => {
    if (ycLoaded) return;
    Promise.all([
      getYieldCurve().then(setYcSnapshot).catch(() => {}),
      getYieldCurveHistory().then(setYcHistory).catch(() => {}),
      getCurveDynamics().then(setYcDynamics).catch(() => {}),
      getSpreadHistory("2Y10Y", 730).then(setYcSpread2y10y).catch(() => {}),
    ]).finally(() => setYcLoaded(true));
  }, [ycLoaded]);

  const loadBreadth = useCallback(() => {
    if (breadthLoaded) return;
    setBreadthLoading(true);
    getBreadthDashboard()
      .then(setBreadth)
      .catch(() => {})
      .finally(() => {
        setBreadthLoading(false);
        setBreadthLoaded(true);
      });
  }, [breadthLoaded]);

  const refetchBreadth = useCallback(() => {
    setBreadthLoading(true);
    getBreadthDashboard()
      .then(setBreadth)
      .catch(() => {})
      .finally(() => setBreadthLoading(false));
  }, []);

  const loadMacro = useCallback(() => {
    if (macroLoaded) return;
    setMacroLoading(true);
    getMacroOverview()
      .then(setMacro)
      .catch(() => {})
      .finally(() => {
        setMacroLoading(false);
        setMacroLoaded(true);
      });
  }, [macroLoaded]);

  const loadInflation = useCallback(() => {
    if (inflLoaded) return;
    setInflLoading(true);
    getInflationDashboard()
      .then(setInfl)
      .catch(() => {})
      .finally(() => {
        setInflLoading(false);
        setInflLoaded(true);
      });
  }, [inflLoaded]);

  useEffect(() => {
    if (tab === "indices") loadIndices(indicesPeriod);
    if (tab === "sectors") loadSectorsData(sectorPeriod);
    if (tab === "rates") { loadRates(); loadYieldCurve(); }
    if (tab === "breadth") loadBreadth();
    if (tab === "macro") loadMacro();
    if (tab === "inflation") loadInflation();
  }, [tab, indicesPeriod, sectorPeriod, loadIndices, loadSectorsData, loadRates, loadYieldCurve, loadBreadth, loadMacro, loadInflation]);

  /* ── Rates & Yield Curve panels ─────────────────────── */

  const forwardFedPanel: PanelConfig | null = useMemo(() => {
    if (!rates?.forward_fed_rate?.length) return null;
    return {
      title: "Forward Fed Funds Rate (from ZQ Futures)",
      chart: {
        data: rates.forward_fed_rate,
        series: [{ key: "value", color: "#f87171", label: "Implied Rate", type: "line" }],
        periodSelector: true,
      },
    };
  }, [rates]);

  const spread2y10yPanel: PanelConfig | null = useMemo(() => {
    if (!ycSpread2y10y.length) return null;
    return {
      title: "2Y-10Y Spread",
      chart: {
        data: ycSpread2y10y,
        series: [{ key: "value", color: "#a78bfa", label: "2Y10Y Spread (bp)", type: "line" }],
        thresholds: [{ value: 0, color: "#f87171", label: "Inversion" }],
        periodSelector: true,
      },
    };
  }, [ycSpread2y10y]);

  const realYield5yPanel: PanelConfig | null = useMemo(() => {
    if (!rates?.real_yield_5y?.length) return null;
    return {
      title: "5Y Real Yield (US05Y − T5YIE)",
      chart: {
        data: rates.real_yield_5y,
        series: [{ key: "value", color: "#a78bfa", label: "5Y Real Yield", type: "line" }],
        thresholds: [{ value: 0, color: "#fbbf24", label: "Zero" }],
        periodSelector: true,
      },
    };
  }, [rates]);

  const realYield10yPanel: PanelConfig | null = useMemo(() => {
    if (!rates?.real_yield_10y?.length) return null;
    return {
      title: "10Y Real Yield (US10Y − T10YIE)",
      chart: {
        data: rates.real_yield_10y,
        series: [{ key: "value", color: "#fb923c", label: "10Y Real Yield", type: "line" }],
        thresholds: [{ value: 0, color: "#fbbf24", label: "Zero" }],
        periodSelector: true,
      },
    };
  }, [rates]);

  /* ── Sectors & Sentiment & Currency panels ───────────── */

  const SECTOR_PERIOD_OPTIONS = [
    { label: "1M", days: 30 },
    { label: "3M", days: 90 },
    { label: "6M", days: 180 },
    { label: "1Y", days: 365 },
    { label: "ALL", days: 365 * 5 },
  ];

  const GROUP_COLORS: Record<string, string> = {
    "Non-Cyclical": "#60a5fa",
    "Cyclical": "#f87171",
    "Sensitive": "#fbbf24",
    "High Beta": "#a78bfa",
  };

  const SENTIMENT_CONFIG = [
    { key: "non_cyclical", label: "Non-Cyclical", color: "#60a5fa" },
    { key: "cyclical", label: "Cyclical", color: "#f87171" },
    { key: "sensitive", label: "Sensitive", color: "#fbbf24" },
    { key: "high_beta", label: "High Beta", color: "#a78bfa" },
    { key: "gld", label: "GLD (Gold)", color: "#facc15" },
    { key: "tlt", label: "TLT (Long Bonds)", color: "#f472b6" },
  ];

  const SECTOR_COLORS = [
    "#f87171", "#fb923c", "#fbbf24", "#34d399", "#22d3ee",
    "#60a5fa", "#a78bfa", "#e879f9", "#f472b6", "#a3e635", "#94a3b8",
  ];

  const CURRENCY_COLORS: Record<string, string> = {
    "DXY": "#ef4444",
    "EXY (EUR)": "#60a5fa",
    "BXY (GBP)": "#a78bfa",
    "AXY (AUD)": "#22c55e",
    "CXY (CAD)": "#fbbf24",
    "JXY (JPY)": "#f472b6",
    "CNY": "#38bdf8",
    "CEW (EM FX)": "#fb923c",
  };

  const sentimentPanel: PanelConfig | null = useMemo(() => {
    if (!sentiment) return null;
    const keys = SENTIMENT_CONFIG.map((c) => c.key);
    const dateMap = new Map<string, Record<string, number>>();
    for (const cfg of SENTIMENT_CONFIG) {
      const arr = (sentiment as Record<string, RatioPoint[]>)[cfg.key];
      if (!arr?.length) continue;
      for (const pt of arr) {
        if (!dateMap.has(pt.date)) dateMap.set(pt.date, {});
        dateMap.get(pt.date)![cfg.key] = pt.value;
      }
    }
    const merged = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, vals]) => ({ date: d, ...vals }));
    if (merged.length === 0) return null;
    const series = SENTIMENT_CONFIG
      .filter((c) => merged.some((row) => c.key in row))
      .map((c) => ({ key: c.key, color: c.color, label: c.label, type: "line" as const }));
    return {
      title: "Sector Group Rotation (rebased % performance)",
      chart: { data: merged, series, thresholds: [{ value: 0, color: "#52525b", label: "Zero" }] },
    };
  }, [sentiment]);

  const sentimentLegend = useMemo(() => {
    if (!sentiment) return [];
    return SENTIMENT_CONFIG.map((cfg) => {
      const arr = (sentiment as Record<string, RatioPoint[]>)[cfg.key];
      const last = arr?.length ? arr[arr.length - 1].value : null;
      return { label: cfg.label, color: cfg.color, value: last };
    }).filter((l) => l.value !== null);
  }, [sentiment]);

  const allSectorsPanel: PanelConfig | null = useMemo(() => {
    if (sectorPerfs.length === 0) return null;
    const allDates = new Set<string>();
    sectorPerfs.forEach((s) => s.series.forEach((pt) => allDates.add(pt.date)));
    const dates = [...allDates].sort();
    const data = dates.map((d) => {
      const row: Record<string, unknown> = { date: d };
      sectorPerfs.forEach((s) => {
        const pt = s.series.find((p) => p.date === d);
        row[s.symbol] = pt?.value ?? null;
      });
      return row;
    });
    if (data.length === 0) return null;
    return {
      title: "All Sectors (Rebased to 0%)",
      chart: {
        data,
        series: sectorPerfs.map((s, i) => ({
          key: s.symbol, color: SECTOR_COLORS[i % SECTOR_COLORS.length], label: s.label,
        })),
        thresholds: [{ value: 0, color: "#52525b", label: "Zero" }],
      },
    };
  }, [sectorPerfs]);

  const sectorLegend = useMemo(() => {
    return sectorPerfs.map((s, i) => ({
      label: s.symbol, color: SECTOR_COLORS[i % SECTOR_COLORS.length], value: s.total_return,
    }));
  }, [sectorPerfs]);

  const currencyPanel: PanelConfig | null = useMemo(() => {
    if (!currency?.lines?.length) return null;
    const dateMap = new Map<string, Record<string, number>>();
    const keys: string[] = [];
    for (const line of currency.lines) {
      const key = line.symbol.replace(/[^a-zA-Z0-9]/g, "_");
      keys.push(key);
      for (const pt of line.series) {
        if (!dateMap.has(pt.date)) dateMap.set(pt.date, {});
        dateMap.get(pt.date)![key] = pt.value;
      }
    }
    const merged = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, vals]) => ({ date: d, ...vals }));
    if (merged.length === 0) return null;
    const series = currency.lines.map((line, i) => ({
      key: keys[i], color: CURRENCY_COLORS[line.symbol] ?? "#94a3b8", label: line.symbol, type: "line" as const,
    }));
    return {
      title: "Currency Indices (rebased % performance)",
      chart: { data: merged, series, thresholds: [{ value: 0, color: "#52525b", label: "Zero" }] },
    };
  }, [currency]);

  const currencyLegend = useMemo(() => {
    if (!currency?.lines?.length) return [];
    return currency.lines.map((line) => {
      const last = line.series.length ? line.series[line.series.length - 1].value : null;
      return { label: line.symbol, color: CURRENCY_COLORS[line.symbol] ?? "#94a3b8", value: last };
    }).filter((l) => l.value !== null);
  }, [currency]);

  /* ── Indices panels (vertical blocks per index) ───────── */

  const INDICES_PERIOD_OPTIONS = [
    { days: 30, label: "1M" },
    { days: 90, label: "3M" },
    { days: 180, label: "6M" },
    { days: 365, label: "1Y" },
    { days: 365 * 2, label: "2Y" },
    { days: 365 * 5, label: "ALL" },
  ];

  const indexBlocks = useMemo(() => {
    if (!idx) return [];
    const indices: {
      key: keyof IndicesDashboardData;
      title: string;
      color: string;
      sub200?: { key: keyof IndicesDashboardData; title: string; thresholds: { value: number; color: string; label: string }[] };
      sub50?: { key: keyof IndicesDashboardData; title: string; thresholds: { value: number; color: string; label: string }[] };
    }[] = [
      {
        key: "spx", title: "S&P 500", color: "#a78bfa",
        sub200: { key: "spx_above200", title: "% of stocks above 200MA", thresholds: [{ value: 80, color: "#f87171", label: "80" }, { value: 10, color: "#34d399", label: "10" }] },
        sub50: { key: "spx_above50", title: "% of stocks above 50MA", thresholds: [{ value: 85, color: "#f87171", label: "85" }, { value: 5, color: "#34d399", label: "5" }] },
      },
      {
        key: "ndx", title: "NASDAQ 100", color: "#60a5fa",
        sub200: { key: "ndx_above200", title: "% of stocks above 200MA", thresholds: [{ value: 80, color: "#f87171", label: "80" }, { value: 10, color: "#34d399", label: "10" }] },
        sub50: { key: "ndx_above50", title: "% of stocks above 50MA", thresholds: [{ value: 85, color: "#f87171", label: "85" }, { value: 5, color: "#34d399", label: "5" }] },
      },
      {
        key: "rut", title: "Russell 2000", color: "#34d399",
        sub200: { key: "rut_above200", title: "% of stocks above 200MA", thresholds: [{ value: 80, color: "#f87171", label: "80" }, { value: 10, color: "#34d399", label: "10" }] },
        sub50: { key: "rut_above50", title: "% of stocks above 50MA", thresholds: [{ value: 85, color: "#f87171", label: "85" }, { value: 5, color: "#34d399", label: "5" }] },
      },
      {
        key: "dji", title: "Dow Jones 30", color: "#fbbf24",
        sub200: { key: "dji_above200", title: "% of stocks above 200MA", thresholds: [{ value: 80, color: "#f87171", label: "80" }, { value: 10, color: "#34d399", label: "10" }] },
        sub50: { key: "dji_above50", title: "% of stocks above 50MA", thresholds: [{ value: 85, color: "#f87171", label: "85" }, { value: 5, color: "#34d399", label: "5" }] },
      },
      { key: "btc", title: "Bitcoin", color: "#fb923c" },
    ];

    const blocks: Array<{
      title: string;
      pricePanel: PanelConfig;
      sub200Panel?: PanelConfig & { currentValue?: number };
      sub50Panel?: PanelConfig & { currentValue?: number };
      btcDominance?: number;
      stableDominance?: number;
    }> = [];

    for (const cfg of indices) {
      const data = idx[cfg.key] as { date: string; price: number; ma200: number | null }[];
      if (!data?.length) continue;

      const pricePanel: PanelConfig = {
        title: cfg.title,
        chart: {
          data,
          series: [
            { key: "price", color: cfg.color, label: cfg.title, type: "line" },
            { key: "ma200", color: "#a78bfa", label: "200MA", type: "line", lineWidth: 1 },
          ],
          periodSelector: true,
        },
      };

      const block: typeof blocks[0] = { title: cfg.title, pricePanel };

      if (cfg.sub200) {
        const breadthData = idx[cfg.sub200.key] as { date: string; value: number }[] | undefined;
        if (breadthData?.length) {
          const last = breadthData[breadthData.length - 1];
          block.sub200Panel = {
            title: cfg.sub200.title,
            chart: {
              data: breadthData,
              series: [{ key: "value", color: "#a78bfa", label: "% >200MA" }],
              thresholds: cfg.sub200.thresholds,
              periodSelector: true,
              formatValue: (v: number) => `${v.toFixed(1)}%`,
            },
            currentValue: last?.value,
          };
        }
      }

      if (cfg.sub50) {
        const breadthData = idx[cfg.sub50.key] as { date: string; value: number }[] | undefined;
        if (breadthData?.length) {
          const last = breadthData[breadthData.length - 1];
          block.sub50Panel = {
            title: cfg.sub50.title,
            chart: {
              data: breadthData,
              series: [{ key: "value", color: "#60a5fa", label: "% >50MA" }],
              thresholds: cfg.sub50.thresholds,
              periodSelector: true,
              formatValue: (v: number) => `${v.toFixed(1)}%`,
            },
            currentValue: last?.value,
          };
        }
      }

      if (cfg.key === "btc" && idx) {
        block.btcDominance = idx.btc_dominance_current ?? undefined;
        block.stableDominance = idx.stable_dominance_current ?? undefined;
      }

      blocks.push(block);
    }
    return blocks;
  }, [idx]);

  /* ── Breadth panels ──────────────────────────────────── */

  const highsLowsData = useMemo(() => {
    const highs = breadth.NYHGH ?? [];
    const lows = breadth.NYLOW ?? [];
    const dateMap = new Map<string, { new_high: number; new_low: number }>();
    for (const pt of highs) dateMap.set(pt.date, { new_high: pt.value, new_low: 0 });
    for (const pt of lows) {
      const existing = dateMap.get(pt.date);
      if (existing) existing.new_low = -Math.abs(pt.value);
      else dateMap.set(pt.date, { new_high: 0, new_low: -Math.abs(pt.value) });
    }
    return [...dateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }));
  }, [breadth.NYHGH, breadth.NYLOW]);

  // SPX with 200-period moving average (TradingView-style)
  const spxWithMaData = useMemo(() => {
    const arr = breadth.SP500 ?? [];
    if (arr.length === 0) return [];
    const period = 200;
    return arr
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((pt, i, sorted) => {
        const start = Math.max(0, i - period + 1);
        const window = sorted.slice(start, i + 1).map((x) => x.value);
        const ma = window.length ? window.reduce((s, v) => s + v, 0) / window.length : pt.value;
        return { date: pt.date, value: pt.value, ma200: Math.round(ma * 100) / 100 };
      });
  }, [breadth.SP500]);

  // Row 1: SPX, % above 20MA, % above 50MA, % above 200MA (same order as TradingView screenshot)
  const breadthRow1: PanelConfig[] = useMemo(() => {
    const p: PanelConfig[] = [];
    if (spxWithMaData.length) {
      p.push({
        title: "SPX — S&P 500 Index",
        chart: {
          data: spxWithMaData,
          series: [
            { key: "value", color: "rgba(255,255,255,0.35)", label: "SPX", type: "line", lineWidth: 1 },
            { key: "ma200", color: "#a78bfa", label: "MA", type: "line", lineWidth: 1 },
          ],
        },
      });
    }
    if (breadth.MMTW?.length)
      p.push({
        title: "% of stocks above 20MA",
        chart: {
          data: breadth.MMTW,
          series: [{ key: "value", color: "#60a5fa", label: "% above 20MA", type: "line" }],
          thresholds: [
            { value: 85, color: "#f87171", label: "85" },
            { value: 25, color: "#34d399", label: "25" },
          ],
        },
      });
    if (breadth.MMFI?.length)
      p.push({
        title: "% of stocks above 50MA",
        chart: {
          data: breadth.MMFI,
          series: [{ key: "value", color: "#60a5fa", label: "% above 50MA", type: "line" }],
          thresholds: [
            { value: 75, color: "#f87171", label: "75" },
            { value: 25, color: "#34d399", label: "25" },
          ],
        },
      });
    if (breadth.MMTH?.length)
      p.push({
        title: "% of stocks above 200MA",
        chart: {
          data: breadth.MMTH,
          series: [{ key: "value", color: "#60a5fa", label: "% above 200MA", type: "line" }],
          thresholds: [
            { value: 65, color: "#f87171", label: "65" },
            { value: 25, color: "#34d399", label: "25" },
          ],
        },
      });
    return p;
  }, [breadth, spxWithMaData]);

  // Row 2: TVOL.US, High-Low index, Put/Call, VIX (same order as TradingView screenshot)
  const breadthRow2: PanelConfig[] = useMemo(() => {
    const p: PanelConfig[] = [];
    const tvolData = breadth["TVOL.US"];
    if (tvolData?.length)
      p.push({
        title: "US stocks Total Volume",
        chart: {
          data: tvolData,
          series: [{ key: "value", color: "#60a5fa", label: "Volume", type: "histogram" }],
          thresholds: [{ value: 10_000_000_000, color: "#f87171", label: "10B" }],
          formatValue: (v: number) => (v / 1e9).toFixed(2) + "B",
        },
      });
    if (highsLowsData.length)
      p.push({
        title: "HIGH-LO: New High / New Low",
        chart: {
          data: highsLowsData,
          series: [
            { key: "new_high", color: "#34d399", label: "New High", type: "histogram" },
            { key: "new_low", color: "#f87171", label: "New Low", type: "histogram" },
          ],
          thresholds: [
            { value: 456, color: "#34d399", label: "New High" },
            { value: -370, color: "#f87171", label: "New Low" },
          ],
        },
      });
    if (breadth.PCC?.length)
      p.push({
        title: "Put/Call Ratio [Equities+Indices] CBOE",
        chart: {
          data: breadth.PCC,
          series: [{ key: "value", color: "#fbbf24", label: "Put/Call Ratio", type: "line" }],
          thresholds: [
            { value: 1.2, color: "#34d399", label: "1.200" },
            { value: 0.7, color: "#f87171", label: "0.700" },
          ],
        },
      });
    if (breadth.VIX?.length)
      p.push({
        title: "VIX — Volatility S&P 500 Index",
        chart: {
          data: breadth.VIX,
          series: [{ key: "value", color: "#f87171", label: "VIX", type: "line" }],
          thresholds: [{ value: 20, color: "#f87171", label: "20.00" }],
        },
      });
    return p;
  }, [breadth, highsLowsData]);

  /* ── Macro panels ────────────────────────────────────── */

  const spx = macro?.spx ?? [];

  const withMacroTooltip = (p: PanelConfig | null): PanelConfig | null =>
    p ? { ...p, tooltip: MACRO_TOOLTIPS[p.title] } : null;

  const fiRow1: PanelConfig[] = useMemo(() => {
    if (!macro) return [];
    return [
      withMacroTooltip(dualPanel("Inflation Expectations (TIP/IEF)", spx, macro.inflation_expectations, "#a78bfa", "TIP/IEF")),
      withMacroTooltip(dualPanel("US Real Yields (5Y)", spx, macro.real_yields, "#60a5fa", "Real Yield")),
      withMacroTooltip(dualPanel("10Y & 2Y US Bonds Spread", spx, macro.yield_spread_10y_2y, "#fbbf24", "10Y-2Y")),
      withMacroTooltip(dualPanel("Forward Federal Funds Rate", spx, macro.forward_fed_rate, "#f87171", "Fwd Rate")),
    ].filter(Boolean) as PanelConfig[];
  }, [macro, spx]);

  const fiRow2: PanelConfig[] = useMemo(() => {
    if (!macro) return [];
    return [
      withMacroTooltip(dualPanel("Balance Sheets of Major Central Banks", spx, macro.central_bank_bs, "#a78bfa", "CB Assets")),
      withMacroTooltip(dualPanel("US Liquidity (Fed BS − RRP)", spx, macro.us_liquidity, "#34d399", "Liquidity")),
      withMacroTooltip(dualPanel("MOVE — Bond Market Volatility", spx, macro.move, "#fb923c", "MOVE")),
      withMacroTooltip(dualPanel("Overnight Reverse REPO", spx, macro.rrp, "#60a5fa", "RRP")),
    ].filter(Boolean) as PanelConfig[];
  }, [macro, spx]);

  const fiRow3: PanelConfig[] = useMemo(() => {
    if (!macro) return [];
    return [
      withMacroTooltip(dualPanel("Treasury General Account (TGA)", spx, macro.tga, "#fbbf24", "TGA")),
      withMacroTooltip(dualPanel("SOFR − Fed Funds Spread", spx, macro.sofr_ff_spread, "#f87171", "SOFR-FF")),
    ].filter(Boolean) as PanelConfig[];
  }, [macro, spx]);

  const comRow1: PanelConfig[] = useMemo(() => {
    if (!macro) return [];
    return [
      withMacroTooltip(dualPanel("Gold VS Oil", spx, macro.gold_oil, "#fbbf24", "Gold/Oil")),
      withMacroTooltip(dualPanel("Gold VS Copper", spx, macro.gold_copper, "#fbbf24", "Gold/Copper")),
      withMacroTooltip(dualPanel("Gold VS Lumber", spx, macro.gold_lumber, "#fbbf24", "Gold/Lumber")),
    ].filter(Boolean) as PanelConfig[];
  }, [macro, spx]);

  const comRow2: PanelConfig[] = useMemo(() => {
    if (!macro) return [];
    return [
      withMacroTooltip(dualPanel("IPO Index", spx, macro.ipo, "#a78bfa", "IPO")),
      withMacroTooltip(dualPanel("US Leading Economic Index", spx, macro.us_lei, "#60a5fa", "US LEI")),
      withMacroTooltip(dualPanel("China Leading Indicator", spx, macro.cn_lei, "#f87171", "CN LEI")),
    ].filter(Boolean) as PanelConfig[];
  }, [macro, spx]);

  const comRow3: PanelConfig[] = useMemo(() => {
    if (!macro) return [];
    return [
      withMacroTooltip(dualPanel("Dr. Copper (HG Futures)", spx, macro.copper, "#fb923c", "Copper")),
      withMacroTooltip(dualPanel("KOSPI — Korea", spx, macro.kospi, "#60a5fa", "KOSPI")),
      withMacroTooltip(dualPanel("TAIEX — Taiwan", spx, macro.taiex, "#a78bfa", "TAIEX")),
    ].filter(Boolean) as PanelConfig[];
  }, [macro, spx]);

  const riskRow1: PanelConfig[] = useMemo(() => {
    if (!macro) return [];
    return [
      withMacroTooltip(dualPanel("High Beta VS Low Beta (SPHB/SPLV)", spx, macro.high_beta_low_beta, "#a78bfa", "HB/LB")),
      withMacroTooltip(dualPanel("Cyclical VS Non-Cyclical (XLY/XLP)", spx, macro.cyclical_non_cyclical, "#34d399", "Cyc/Def")),
      withMacroTooltip(dualPanel("Technology VS Materials (XLK/XLB)", spx, macro.tech_materials, "#60a5fa", "Tech/Mat")),
    ].filter(Boolean) as PanelConfig[];
  }, [macro, spx]);

  const riskRow2: PanelConfig[] = useMemo(() => {
    if (!macro) return [];
    return [
      withMacroTooltip(dualPanel("Large Cap VS Small Cap (IVV/IJR)", spx, macro.large_small, "#fbbf24", "Large/Small")),
      withMacroTooltip(dualPanel("Micro Cap VS Small Cap (IWC/IJR)", spx, macro.micro_small, "#fb923c", "Micro/Small")),
      withMacroTooltip(dualPanel("Emerging VS Developed (EEM/VEA)", spx, macro.em_dm, "#e879f9", "EM/DM")),
    ].filter(Boolean) as PanelConfig[];
  }, [macro, spx]);

  const riskRow3: PanelConfig[] = useMemo(() => {
    if (!macro) return [];
    return [
      withMacroTooltip(dualPanel("Credit Spreads (HYG/IEI)", spx, macro.hyg_iei, "#f87171", "HYG/IEI")),
      withMacroTooltip(dualPanel("XLF Relative Strength (XLF/SPX)", spx, macro.xlf_relative, "#34d399", "XLF/SPX")),
    ].filter(Boolean) as PanelConfig[];
  }, [macro, spx]);

  /* ── Inflation panels (per sub-tab) ─────────────────── */

  const fedTarget = [{ value: 2, color: "#f87171", label: "Fed Target 2%" }];
  const inflSpx = infl?.spx ?? [];

  const cpiPanels = useMemo(() => {
    if (!infl) return { main: [] as PanelConfig[], row2: [] as PanelConfig[], row3: [] as PanelConfig[] };
    const main = [
      dualPanel("CPI YoY", inflSpx, infl.cpi_yoy, "#34d399", "CPI YoY", fedTarget),
      dualPanel("CPI Core YoY", inflSpx, infl.cpi_core_yoy, "#a78bfa", "Core CPI", fedTarget),
      dualPanel("CPI MoM", inflSpx, infl.cpi_mom, "#60a5fa", "CPI MoM"),
    ].filter(Boolean) as PanelConfig[];
    const row2 = [
      dualPanel("Sticky CPI ex F&E (Atlanta Fed)", inflSpx, infl.sticky_cpi, "#f87171", "Sticky CPI", fedTarget),
      dualPanel("Michigan 5Y Inflation Expectations", inflSpx, infl.mich, "#fbbf24", "MICH", fedTarget),
    ].filter(Boolean) as PanelConfig[];
    const row3 = [
      dualPanel("5Y Breakeven Inflation (T5YIE)", inflSpx, infl.t5yie, "#fb923c", "T5YIE", fedTarget),
      dualPanel("10Y Breakeven Inflation (T10YIE)", inflSpx, infl.t10yie, "#e879f9", "T10YIE", fedTarget),
    ].filter(Boolean) as PanelConfig[];
    return { main, row2, row3 };
  }, [infl, inflSpx]);

  const pcePanels = useMemo(() => {
    if (!infl) return [] as PanelConfig[];
    return [
      dualPanel("PCE YoY", inflSpx, infl.pce_yoy, "#34d399", "PCE YoY", fedTarget),
      dualPanel("PCE Core YoY", inflSpx, infl.pce_core_yoy, "#a78bfa", "Core PCE", fedTarget),
      dualPanel("PCE MoM", inflSpx, infl.pce_mom, "#60a5fa", "PCE MoM"),
    ].filter(Boolean) as PanelConfig[];
  }, [infl, inflSpx]);

  const ppiPanels = useMemo(() => {
    if (!infl) return [] as PanelConfig[];
    return [
      dualPanel("PPI YoY", inflSpx, infl.ppi_yoy, "#34d399", "PPI YoY", fedTarget),
      dualPanel("PPI Core YoY", inflSpx, infl.ppi_core_yoy, "#a78bfa", "Core PPI", fedTarget),
      dualPanel("PPI MoM", inflSpx, infl.ppi_mom, "#60a5fa", "PPI MoM"),
    ].filter(Boolean) as PanelConfig[];
  }, [infl, inflSpx]);

  /* ── Render helpers ──────────────────────────────────── */

  const gridCols = (panels: PanelConfig[]) =>
    panels.length >= 4 ? 4 : Math.max(panels.length, 1);

  const renderGrid = (panels: PanelConfig[]) =>
    panels.length > 0 ? (
      <DashboardGrid panels={panels} columns={gridCols(panels)} panelHeight={220} />
    ) : null;

  const renderMacroGrid = (panels: PanelConfig[]) =>
    panels.length > 0 ? (
      <DashboardGrid panels={panels} columns={2} panelHeight={380} />
    ) : null;

  const renderLoading = (text: string) => (
    <div className="text-center text-text-muted py-20 text-sm">{text}</div>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extralight tracking-tight text-text-primary mb-1">
          Analysis
        </h1>
        <p className="text-sm text-text-muted font-light">
          In-depth market analysis dashboards
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2">
        {ANALYSIS_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as AnalysisTab)}
            className={cn(
              "rounded-lg px-5 py-2 text-sm font-light transition-all duration-200",
              tab === t.id
                ? "bg-accent/10 text-accent border border-accent/20"
                : "text-text-muted hover:text-text-secondary hover:bg-bg-hover border border-transparent"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Major Indices & Bitcoin ──────────────────────── */}
      {tab === "indices" && (
        <div className="space-y-6 animate-fade-in">
          <div className="rounded-xl border border-border bg-bg-card p-5">
            <h2 className="text-sm font-medium text-text-primary mb-1">
              Major Indices & Bitcoin
            </h2>
            <p className="text-xs text-text-muted font-light leading-relaxed">
              US major indices with 200-day moving average overlay and breadth sub-indicators.
              Bitcoin includes BTC Dominance and Stablecoin Dominance when available.
            </p>
          </div>

          {/* Period selector */}
          <div className="flex gap-1.5">
            {INDICES_PERIOD_OPTIONS.map((p) => (
              <button
                key={p.days}
                onClick={() => setIndicesPeriod(p.days)}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-light transition-all duration-200",
                  indicesPeriod === p.days
                    ? "bg-accent/10 text-accent border border-accent/20"
                    : "text-text-muted hover:text-text-secondary hover:bg-bg-hover border border-transparent"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {idxLoading ? renderLoading("Loading indices data…") : (
            <>
              {indexBlocks.length === 0 && renderLoading("No index data available. Run the data collector first.")}
              {indexBlocks.map((block) => (
                <div key={block.title} className="space-y-3">
                  {/* Main price chart — full width */}
                  <DashboardGrid
                    panels={[block.pricePanel]}
                    columns={1}
                    panelHeight={420}
                  />
                  {/* Sub-charts: % above 200MA, % above 50MA — full width stacked */}
                  {(block.sub200Panel || block.sub50Panel) && (
                    <div className="space-y-3">
                      {block.sub200Panel && (
                        <div className="rounded-xl border border-border bg-bg-card p-4">
                          <h3 className="text-[10px] font-medium tracking-wider uppercase text-text-muted mb-2">
                            {block.sub200Panel.title}
                          </h3>
                          <LWChart
                            {...block.sub200Panel.chart}
                            height={280}
                            periodSelector={true}
                          />
                          {block.sub200Panel.currentValue != null && (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-[#a78bfa]" />
                              <span className="text-sm tabular-nums text-text-primary font-medium">
                                {block.sub200Panel.currentValue.toFixed(2)}%
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      {block.sub50Panel && (
                        <div className="rounded-xl border border-border bg-bg-card p-4">
                          <h3 className="text-[10px] font-medium tracking-wider uppercase text-text-muted mb-2">
                            {block.sub50Panel.title}
                          </h3>
                          <LWChart
                            {...block.sub50Panel.chart}
                            height={280}
                            periodSelector={true}
                          />
                          {block.sub50Panel.currentValue != null && (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-[#60a5fa]" />
                              <span className="text-sm tabular-nums text-text-primary font-medium">
                                {block.sub50Panel.currentValue.toFixed(2)}%
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {/* BTC: dominance cards (current only) */}
                  {block.title === "Bitcoin" && (block.btcDominance != null || block.stableDominance != null) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {block.btcDominance != null && (
                        <div className="rounded-xl border border-border bg-bg-card p-4">
                          <h3 className="text-[10px] font-medium tracking-wider uppercase text-text-muted mb-2">
                            BTC Dominance
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#a78bfa]" />
                            <span className="text-2xl tabular-nums text-text-primary font-medium">
                              {block.btcDominance.toFixed(2)}%
                            </span>
                          </div>
                          <p className="text-[10px] text-text-muted mt-1">Current (CoinGecko)</p>
                        </div>
                      )}
                      {block.stableDominance != null && (
                        <div className="rounded-xl border border-border bg-bg-card p-4">
                          <h3 className="text-[10px] font-medium tracking-wider uppercase text-text-muted mb-2">
                            Stablecoin Dominance
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#60a5fa]" />
                            <span className="text-2xl tabular-nums text-text-primary font-medium">
                              {block.stableDominance.toFixed(2)}%
                            </span>
                          </div>
                          <p className="text-[10px] text-text-muted mt-1">USDT+USDC+DAI+… (CoinGecko)</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Rates & Yield Curve ─────────────────────────── */}
      {tab === "rates" && (
        <div className="space-y-6 animate-fade-in">
          <div className="rounded-xl border border-border bg-bg-card p-5">
            <h2 className="text-sm font-medium text-text-primary mb-1">
              Rates & Yield Curve
            </h2>
            <p className="text-xs text-text-muted font-light leading-relaxed">
              Yield curve snapshot, curve dynamics, forward rate expectations,
              key spreads, and real yields (TIPS-adjusted).
            </p>
          </div>

          {/* Row 1: Yield Curve + Curve Dynamics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>{ycSnapshot && <YieldCurveChart snapshot={ycSnapshot} history={ycHistory} />}</div>

            <div className="card">
              <div className="card-header">Curve Dynamics</div>
              {ycDynamics ? (
                <div className="space-y-5">
                  <div className="text-center">
                    <span className="text-[10px] uppercase tracking-wider text-text-muted">Current Pattern</span>
                    <div className={cn("text-xl font-light mt-1", PATTERN_CONFIG[ycDynamics.pattern]?.color || "text-text-secondary")}>
                      {PATTERN_LABELS[ycDynamics.pattern] || ycDynamics.pattern}
                    </div>
                  </div>
                  <p className="text-sm font-light text-text-secondary text-center">{ycDynamics.description}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Short End (2Y) 1M", value: ycDynamics.short_end_change_1m },
                      { label: "Long End (10Y) 1M", value: ycDynamics.long_end_change_1m },
                      { label: "Short End (2Y) 3M", value: ycDynamics.short_end_change_3m },
                      { label: "Long End (10Y) 3M", value: ycDynamics.long_end_change_3m },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border border-border bg-bg-card p-3 text-center">
                        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">{item.label}</div>
                        <div className={cn(
                          "text-lg font-extralight tabular-nums",
                          item.value > 0 ? "text-accent-red" : item.value < 0 ? "text-accent-green" : "text-text-muted"
                        )}>
                          {item.value >= 0 ? "+" : ""}{item.value.toFixed(1)}bp
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-text-muted font-light text-sm">Loading dynamics…</div>
              )}
            </div>
          </div>

          {/* Row 2: Forward Fed Rate + 2Y-10Y Spread */}
          {ratesLoading ? renderLoading("Loading rates data…") : (
            <DashboardGrid
              panels={[forwardFedPanel, spread2y10yPanel].filter(Boolean) as PanelConfig[]}
              columns={2}
              panelHeight={420}
            />
          )}

          {/* Row 3: 5Y Real Yield + 10Y Real Yield */}
          {!ratesLoading && (
            <DashboardGrid
              panels={[realYield5yPanel, realYield10yPanel].filter(Boolean) as PanelConfig[]}
              columns={2}
              panelHeight={420}
            />
          )}

          {/* Row 4: Curve Pattern Guide */}
          <div className="card">
            <div className="card-header">Curve Pattern Guide</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PATTERN_GUIDE.map((item) => {
                const cfg = PATTERN_CONFIG[item.key];
                return (
                  <div key={item.key} className={cn("rounded-lg border p-4", cfg.border, cfg.bg)}>
                    <h4 className={cn("text-sm font-medium mb-1", cfg.color)}>
                      {PATTERN_LABELS[item.key]}
                    </h4>
                    <p className="text-xs font-light text-text-secondary leading-relaxed">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Sectors & Sentiment & Currency ──────────────── */}
      {tab === "sectors" && (
        <div className="space-y-6 animate-fade-in">
          <div className="rounded-xl border border-border bg-bg-card p-5">
            <h2 className="text-sm font-medium text-text-primary mb-1">
              Sectors, Sentiment & Currency
            </h2>
            <p className="text-xs text-text-muted font-light leading-relaxed">
              Sector group rotation (Non-Cyclical, Cyclical, Sensitive, High Beta + GLD & TLT),
              all S&amp;P 500 sector ETFs, currency indices — all rebased to 0% from period start.
            </p>
          </div>

          {/* Period selector */}
          <div className="flex gap-1.5">
            {SECTOR_PERIOD_OPTIONS.map((p) => (
              <button
                key={p.label}
                onClick={() => setSectorPeriod(p.days)}
                className={cn(
                  "rounded-md px-4 py-1.5 text-xs font-light transition-all duration-200",
                  sectorPeriod === p.days
                    ? "bg-accent/10 text-accent border border-accent/20"
                    : "text-text-muted hover:text-text-secondary hover:bg-bg-hover border border-transparent"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {sectorsLoading ? renderLoading("Loading data…") : (
            <>
              {/* Chart 1: Sector Group Rotation (6 lines) */}
              {sentimentPanel && (
                <>
                  <DashboardGrid panels={[sentimentPanel]} columns={1} panelHeight={420} />
                  <div className="flex flex-wrap gap-x-4 gap-y-1 px-1">
                    {sentimentLegend.map((l) => (
                      <div key={l.label} className="flex items-center gap-1.5 text-[11px]">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                        <span className="text-text-muted">{l.label}</span>
                        <span className={cn("tabular-nums font-medium", (l.value ?? 0) > 0 ? "text-accent-green" : "text-accent-red")}>
                          {(l.value ?? 0) > 0 ? "+" : ""}{(l.value ?? 0).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Chart 2: All Sectors */}
              {allSectorsPanel && (
                <>
                  <DashboardGrid panels={[allSectorsPanel]} columns={1} panelHeight={420} />
                  <div className="flex flex-wrap gap-x-4 gap-y-1 px-1">
                    {sectorLegend.map((l) => (
                      <div key={l.label} className="flex items-center gap-1.5 text-[11px]">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                        <span className="text-text-muted">{l.label}</span>
                        <span className={cn("tabular-nums font-medium", (l.value ?? 0) > 0 ? "text-accent-green" : "text-accent-red")}>
                          {(l.value ?? 0) > 0 ? "+" : ""}{(l.value ?? 0).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Chart 3: Currency Indices */}
              {currencyPanel && (
                <>
                  <DashboardGrid panels={[currencyPanel]} columns={1} panelHeight={420} />
                  <div className="flex flex-wrap gap-x-4 gap-y-1 px-1">
                    {currencyLegend.map((l) => (
                      <div key={l.label} className="flex items-center gap-1.5 text-[11px]">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                        <span className="text-text-muted">{l.label}</span>
                        <span className={cn("tabular-nums font-medium", (l.value ?? 0) > 0 ? "text-accent-green" : "text-accent-red")}>
                          {(l.value ?? 0) > 0 ? "+" : ""}{(l.value ?? 0).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Sector Performance Ranking Table */}
              {sectorPerfs.length > 0 && (
                <div className="card p-0 overflow-hidden">
                  <div className="px-5 pt-5 pb-3">
                    <div className="card-header mb-0">Sector Performance Ranking</div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-text-muted">
                        <th className="pb-2 pl-5 font-medium">Rank</th>
                        <th className="pb-2 font-medium">Sector</th>
                        <th className="pb-2 font-medium">Symbol</th>
                        <th className="pb-2 font-medium">Group</th>
                        <th className="pb-2 text-right font-medium pr-5">Return</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectorPerfs.map((s, i) => (
                        <tr key={s.symbol} className="border-b border-border/50 hover:bg-bg-hover transition-colors">
                          <td className="py-3 pl-5 text-text-muted tabular-nums">{i + 1}</td>
                          <td className="py-3 font-light text-text-primary">{s.label}</td>
                          <td className="py-3 text-text-muted">{s.symbol}</td>
                          <td className="py-3">
                            <span
                              className="inline-flex items-center gap-1.5 text-xs"
                              style={{ color: GROUP_COLORS[s.group] || "#94a3b8" }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GROUP_COLORS[s.group] || "#94a3b8" }} />
                              {s.group}
                            </span>
                          </td>
                          <td className={cn(
                            "py-3 pr-5 text-right tabular-nums font-medium",
                            s.total_return > 0 ? "text-accent-green" : "text-accent-red"
                          )}>
                            {s.total_return > 0 ? "+" : ""}{s.total_return.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Analysis Guide */}
              <div className="card">
                <div className="card-header">Sector & Sentiment Analysis Guide</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-lg border border-accent-green/20 bg-accent-green/5 p-4">
                    <h4 className="text-sm font-medium mb-1 text-accent-green">Risk-On Signal</h4>
                    <p className="text-xs font-light text-text-secondary leading-relaxed">
                      Cyclical & High Beta outperforming Non-Cyclical. GLD & TLT underperforming.
                      DXY weakening. Broad market participation.
                    </p>
                  </div>
                  <div className="rounded-lg border border-accent-red/20 bg-accent-red/5 p-4">
                    <h4 className="text-sm font-medium mb-1 text-accent-red">Risk-Off Signal</h4>
                    <p className="text-xs font-light text-text-secondary leading-relaxed">
                      Non-Cyclical (XLP, XLU, XLV) leading. GLD & TLT rallying.
                      DXY strengthening. Flight to safety and defensive rotation.
                    </p>
                  </div>
                  <div className="rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-4">
                    <h4 className="text-sm font-medium mb-1 text-accent-amber">Rotation & Divergence</h4>
                    <p className="text-xs font-light text-text-secondary leading-relaxed">
                      Watch for sector divergence — narrow leadership (few sectors up) signals
                      fragile rally. Broad participation = healthy trend. TLT = long-duration bonds sensitivity to rates.
                    </p>
                  </div>
                </div>
              </div>

              {!sentimentPanel && !allSectorsPanel && !currencyPanel &&
                renderLoading("No data available. Click Refresh to collect data.")}
            </>
          )}
        </div>
      )}

      {/* ── Market Breadth ───────────────────────────────── */}
      {tab === "breadth" && (
        <div className="space-y-6 animate-fade-in">
          <div className="rounded-xl border border-border bg-bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-medium text-text-primary mb-1">
                  Market Breadth Dashboard — S&P 500
                </h2>
                <p className="text-xs text-text-muted font-light leading-relaxed">
                  Internal market strength assessment. Shows not just where the index stands,
                  but how broadly stocks participate in the move. Divergences between price and
                  breadth signal potential reversals.
                </p>
              </div>
              <button
                type="button"
                onClick={refetchBreadth}
                disabled={breadthLoading}
                className="rounded-md px-3 py-1.5 text-xs font-light border border-border text-text-muted hover:text-text-secondary hover:bg-bg-hover disabled:opacity-50 transition-colors"
              >
                {breadthLoading ? "Loading…" : "Reload"}
              </button>
            </div>
          </div>
          {breadthLoading
            ? renderLoading("Loading breadth data…")
            : (
              <>
                {breadthRow1.length + breadthRow2.length > 0 ? (
                  <>
                    {breadthRow1.length + breadthRow2.length < 8 && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200/90">
                        To see all 8 charts, ensure breadth data is loaded. Refresh fetches the last 14 days of breadth;
                        for full history run Data Collector → Load historical breadth data. Showing only indicators that have data.
                      </div>
                    )}
                    <DashboardGrid
                      panels={[...breadthRow1, ...breadthRow2]}
                      columns={4}
                      panelHeight={240}
                    />
                  </>
                ) : (
                  <div className="rounded-xl border border-border bg-bg-card p-8 text-center">
                    <p className="text-text-muted text-sm mb-2">
                      No breadth data available.
                    </p>
                    <p className="text-text-muted text-xs max-w-md mx-auto">
                      <strong>Refresh</strong> (top nav) fetches the last 14 days of breadth from Yahoo. After Refresh click <strong>Reload</strong> above to refetch this dashboard.
                      For full history run Data Collector → Load historical breadth data.
                    </p>
                  </div>
                )}
              </>
            )}
        </div>
      )}

      {/* ── Macro Overview ───────────────────────────────── */}
      {tab === "macro" && (
        <div className="space-y-6 animate-fade-in">
          <div className="rounded-xl border border-border bg-bg-card p-5">
            <h2 className="text-sm font-medium text-text-primary mb-1">
              Macro Overview Dashboard
            </h2>
            <p className="text-xs text-text-muted font-light leading-relaxed">
              Rates, liquidity, commodity ratios, and relative sector/style performance.
              White line = SPX overlay for visual regime comparison.
            </p>
          </div>

          {/* Macro page selector */}
          <div className="flex gap-1.5">
            {MACRO_PAGES.map((p) => (
              <button
                key={p.id}
                onClick={() => setMacroPage(p.id as MacroPage)}
                className={cn(
                  "rounded-md px-4 py-1.5 text-xs font-light transition-all duration-200",
                  macroPage === p.id
                    ? "bg-white/5 text-text-primary border border-border"
                    : "text-text-muted hover:text-text-secondary border border-transparent"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {macroLoading ? renderLoading("Loading macro data…") : (
            <>
              {/* Page 1: Fixed Income & Liquidity — single grid so 10 panels = 5 rows of 2 */}
              {macroPage === "fi" && (
                <div className="animate-fade-in">
                  {fiRow1.length + fiRow2.length + fiRow3.length > 0
                    ? renderMacroGrid([...fiRow1, ...fiRow2, ...fiRow3])
                    : renderLoading("No fixed income data available.")}
                </div>
              )}

              {/* Page 2: Commodities & Global Activity — single grid, 9 panels */}
              {macroPage === "commodities" && (
                <div className="animate-fade-in">
                  {comRow1.length + comRow2.length + comRow3.length > 0
                    ? renderMacroGrid([...comRow1, ...comRow2, ...comRow3])
                    : renderLoading("No commodity data available.")}
                </div>
              )}

              {/* Page 3: Risk Appetite & Relative Performance — single grid so 8 panels = 4 rows of 2 */}
              {macroPage === "risk" && (
                <div className="animate-fade-in">
                  {riskRow1.length + riskRow2.length + riskRow3.length > 0
                    ? renderMacroGrid([...riskRow1, ...riskRow2, ...riskRow3])
                    : renderLoading("No risk appetite data available.")}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── US Inflation ─────────────────────────────────── */}
      {tab === "inflation" && (
        <div className="space-y-6 animate-fade-in">
          {/* Sub-tab selector: CPI / PCE / PPI */}
          <div className="flex gap-1.5">
            {(["cpi", "pce", "ppi"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setInflSubTab(st)}
                className={cn(
                  "rounded-lg px-5 py-2 text-sm font-light transition-all duration-200",
                  inflSubTab === st
                    ? "bg-accent/10 text-accent border border-accent/20"
                    : "text-text-muted hover:text-text-secondary hover:bg-bg-hover border border-transparent"
                )}
              >
                {st.toUpperCase()}
              </button>
            ))}
          </div>

          {inflLoading ? renderLoading("Loading inflation data…") : (
            <>
              {/* CPI sub-tab */}
              {inflSubTab === "cpi" && (
                <div className="space-y-5 animate-fade-in">
                  {cpiPanels.main.length > 0 ? (
                    <>
                      {cpiPanels.main.map((p, i) => (
                        <DashboardGrid key={`cpi-main-${i}`} panels={[p]} columns={1} panelHeight={420} />
                      ))}
                      {cpiPanels.row2.length > 0 && (
                        <DashboardGrid panels={cpiPanels.row2} columns={2} panelHeight={420} />
                      )}
                      {cpiPanels.row3.length > 0 && (
                        <DashboardGrid panels={cpiPanels.row3} columns={2} panelHeight={420} />
                      )}
                    </>
                  ) : renderLoading("No CPI data available.")}
                </div>
              )}

              {/* PCE sub-tab */}
              {inflSubTab === "pce" && (
                <div className="space-y-5 animate-fade-in">
                  {pcePanels.length > 0 ? (
                    pcePanels.map((p, i) => (
                      <DashboardGrid key={`pce-${i}`} panels={[p]} columns={1} panelHeight={420} />
                    ))
                  ) : renderLoading("No PCE data available.")}
                </div>
              )}

              {/* PPI sub-tab */}
              {inflSubTab === "ppi" && (
                <div className="space-y-5 animate-fade-in">
                  {ppiPanels.length > 0 ? (
                    ppiPanels.map((p, i) => (
                      <DashboardGrid key={`ppi-${i}`} panels={[p]} columns={1} panelHeight={420} />
                    ))
                  ) : renderLoading("No PPI data available.")}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Fed Policy ────────────────────────────────────── */}
      {tab === "fed" && (
        <div className="animate-fade-in">
          <FedPolicyContent />
        </div>
      )}
    </div>
  );
}
