import type {
  BriefingArchiveDay,
  EveningBriefData,
  MorningBriefData,
} from "@/components/next-dashboard/calendar/briefingTypes";

const SNAPSHOT_CLEAN: MorningBriefData["marketSnapshot"] = [
  { symbol: "EEM", name: "EM equities", price: "42.18", changePct: 0.42 },
  { symbol: "GLD", name: "Gold", price: "234.55", changePct: -0.18 },
  { symbol: "HYG", name: "HY credit", price: "77.92", changePct: 0.11 },
  { symbol: "IWM", name: "Russell 2000", price: "201.34", changePct: -0.35 },
  { symbol: "LQD", name: "IG credit", price: "108.40", changePct: 0.06 },
  { symbol: "QQQ", name: "Nasdaq 100", price: "448.20", changePct: 0.28 },
  { symbol: "SPY", name: "S&P 500", price: "528.15", changePct: 0.19 },
  { symbol: "TLT", name: "20+ Yr Treas.", price: "92.10", changePct: -0.52 },
  { symbol: "XLP", name: "Staples", price: "75.22", changePct: 0.08 },
  { symbol: "XLY", name: "Discretionary", price: "188.90", changePct: 0.31 },
  { symbol: "BTC", name: "Bitcoin", price: "63,420", changePct: 0.84 },
  { symbol: "ETH", name: "Ethereum", price: "3,050", changePct: 0.55 },
  { symbol: "EUR/USD", name: "Euro", price: "1.0785", changePct: 0.12 },
  { symbol: "GBP/USD", name: "Sterling", price: "1.2540", changePct: -0.09 },
  { symbol: "USD/JPY", name: "Yen", price: "155.80", changePct: 0.22 },
  { symbol: "NZD/USD", name: "Kiwi", price: "0.6012", changePct: -0.14 },
  { symbol: "USD/CAD", name: "Loonie", price: "1.3680", changePct: 0.07 },
  { symbol: "USD/CHF", name: "Swiss", price: "0.9080", changePct: 0.05 },
  { symbol: "XAG/USD", name: "Silver", price: "28.45", changePct: -0.41 },
  { symbol: "XAU/USD", name: "Spot gold", price: "2,358", changePct: -0.12 },
];

const MORNING_KEY_EVENTS: MorningBriefData["keyEvents"] = [
  {
    time: "08:30",
    currency: "USD",
    event: "Nonfarm Payrolls",
    est: "185k",
    prev: "175k",
    act: "—",
    beatMiss: "pending",
    importance: "high",
  },
  {
    time: "08:30",
    currency: "USD",
    event: "Unemployment Rate",
    est: "3.8%",
    prev: "3.9%",
    act: "—",
    beatMiss: "pending",
    importance: "high",
  },
  {
    time: "10:00",
    currency: "USD",
    event: "ISM Services PMI",
    est: "52.1",
    prev: "51.4",
    act: "—",
    beatMiss: "pending",
    importance: "medium",
  },
];

const EVENING_KEY_EVENTS: MorningBriefData["keyEvents"] = [
  {
    time: "08:30",
    currency: "USD",
    event: "Nonfarm Payrolls",
    est: "185k",
    prev: "175k",
    act: "272k",
    beatMiss: "beat",
    importance: "high",
  },
  {
    time: "08:30",
    currency: "USD",
    event: "Unemployment Rate",
    est: "3.8%",
    prev: "3.9%",
    act: "3.7%",
    beatMiss: "beat",
    importance: "high",
  },
  {
    time: "10:00",
    currency: "USD",
    event: "ISM Services PMI",
    est: "52.1",
    prev: "51.4",
    act: "51.9",
    beatMiss: "in-line",
    importance: "medium",
  },
];

export const BRIEFING_ARCHIVE_DAYS: BriefingArchiveDay[] = [
  { date: "2025-05-16", label: "May 16, 2025" },
  { date: "2025-05-15", label: "May 15, 2025" },
  { date: "2025-05-14", label: "May 14, 2025" },
  { date: "2025-05-13", label: "May 13, 2025" },
];

export function getMorningBriefDemo(archiveDate?: string): MorningBriefData {
  const briefDate = archiveDate ?? "2025-05-17";
  return {
    briefDate,
    headline: "Jobs Data in Focus as Markets Eye Rate Path",
    executiveSummary:
      "Liquidity conditions remain constructive into payrolls, with rate-cut pricing still skewed late-year. A tight labor print could reprice front-end yields faster than equities, while a soft report would reinforce the soft-landing basket. Watch breadth and USD beta around the release — cross-asset correlations typically spike for 90 minutes after the number.",
    keyEvents: MORNING_KEY_EVENTS,
    regimeLabel: "RISK ON",
    regimeScore: 0.42,
    overnightMoves: [
      { label: "S&P 500 Futures", changePct: 0.24 },
      { label: "10Y UST Yield", changePct: 3.2 },
      { label: "DXY Index", changePct: -0.11 },
      { label: "WTI Crude", changePct: 0.58 },
    ],
    expectedMoves: [
      { label: "SPY (1d)", movePct: 0.85, bar: 0.72 },
      { label: "TLT (1d)", movePct: 0.62, bar: 0.55 },
      { label: "GLD (1d)", movePct: 0.48, bar: 0.4 },
      { label: "BTC (1d)", movePct: 1.9, bar: 0.88 },
    ],
    tradeIdeas: [
      {
        title: "LONG SPY",
        rationale: "Soft-landing path; carry futures into payrolls with defined risk.",
        entry: "527.80",
        tp: "532.50",
        sl: "524.20",
      },
      {
        title: "FLATTENER 2s10s",
        rationale: "If payrolls beat, belly underperforms — curve flattens from the front.",
        entry: "−42 bp",
        tp: "−52 bp",
        sl: "−35 bp",
      },
      {
        title: "LONG GOLD",
        rationale: "Real rates roll over on any labor miss; USD hedge.",
        entry: "2,340",
        tp: "2,395",
        sl: "2,305",
      },
    ],
    regimeNarrative:
      "Risk-on tilt is driven by stable financial conditions and easing financial stress proxies. Ideas lean pro-cyclical into the print while keeping a rates hedge via curve structure.",
    crossEventAnalysis:
      "Labor data has high historical correlation with USD and front-end yields; equity beta is positive but lags until the press conference cycle. When payrolls and ISM land the same session, equity volatility mean-reverts faster than FX.",
    historicalPatternTitle: "HISTORICAL PATTERN (LAST 10 OCCURRENCES)",
    historicalPatternRows: [
      { occurrence: "Avg 1D", equity1d: 0.31, yield10y1d: 4.1, usd1d: 0.18 },
      { occurrence: "Median 1D", equity1d: 0.22, yield10y1d: 3.0, usd1d: 0.11 },
    ],
    historicalWinRatePct: 70,
    marketSnapshotTimeEt: "07:15 AM ET",
    marketSnapshot: SNAPSHOT_CLEAN,
  };
}

export function getEveningBriefDemo(archiveDate?: string): EveningBriefData {
  const briefDate = archiveDate ?? "2025-05-16";
  return {
    briefDate,
    headline: "Stronger Jobs, Higher Yields, Risk Assets Hold Up",
    executiveSummary:
      "The morning bias leaned soft-landing; payrolls delivered a clean beat with unemployment ticking down. Front-end yields led the repricing, yet equities absorbed supply — AI-led growth narratives and buybacks capped drawdowns. AI accuracy for direction was mixed on rates but solid on USD.",
    keyEvents: EVENING_KEY_EVENTS,
    accuracyPct: 68,
    correct: 13,
    incorrect: 6,
    total: 19,
    scorecard: [
      {
        event: "Nonfarm Payrolls",
        predicted: "down",
        actual: "up",
        surprisePct: 1.8,
        correct: false,
      },
      {
        event: "Unemployment Rate",
        predicted: "flat",
        actual: "down",
        surprisePct: 0.6,
        correct: true,
      },
      {
        event: "ISM Services",
        predicted: "up",
        actual: "up",
        surprisePct: 0.4,
        correct: true,
      },
    ],
    resultsCards: [
      {
        metric: "Nonfarm Payrolls",
        flagEmoji: "🇺🇸",
        outcome: "beat",
        est: "185k",
        prev: "175k",
        act: "272k",
        analysis: "Equities dipped then recovered; cyclicals led into the close as the market framed a no-landing skew.",
      },
      {
        metric: "Unemployment Rate",
        flagEmoji: "🇺🇸",
        outcome: "beat",
        est: "3.8%",
        prev: "3.9%",
        act: "3.7%",
        analysis: "USD caught a bid into London fix; EM FX lagged the G10 move.",
      },
      {
        metric: "ISM Services PMI",
        flagEmoji: "🇺🇸",
        outcome: "in-line",
        est: "52.1",
        prev: "51.4",
        act: "51.9",
        analysis: "Rates stayed offered at the long end; breakevens were unchanged.",
      },
    ],
    marketReaction:
      "Curve bear-flattened into the afternoon with 10Y yields +6 bps. Credit outperformed rates; high-beta equities finished green despite a higher discount rate.",
    mainMovers: [
      { label: "SPX", changePct: 0.21 },
      { label: "NDX", changePct: 0.34 },
      { label: "10Y UST", changePct: 6.0 },
      { label: "DXY", changePct: 0.28 },
    ],
    keyTakeaways: [
      "Labor trend re-accelerated — cuts priced for September drifted later.",
      "Equities shrugged higher yields as earnings breadth improved.",
      "USD strength concentrated vs low-yielders; JPY underperformed.",
      "Vol crush post-data — gamma positioning muted tails.",
      "Watch next CPI revision risk for Fed speak.",
    ],
    tomorrowPreview:
      "Focus shifts to producer prices and Fed speakers — any pushback on market easing would re-steepen the belly.",
    tomorrowEvents: [
      { time: "08:30", name: "PPI Final Demand" },
      { time: "10:00", name: "Michigan Consumer Sentiment" },
    ],
    sideTickers: [
      { symbol: "BTC/USD", price: "63,380", changePct: 0.62 },
      { symbol: "TLT", price: "91.95", changePct: -0.48 },
    ],
    marketSnapshotTimeEt: "04:35 PM ET",
    marketSnapshot: SNAPSHOT_CLEAN.map((s) => ({
      ...s,
      changePct: s.changePct * (s.symbol === "TLT" ? -1 : 1) * 0.9,
    })),
  };
}
