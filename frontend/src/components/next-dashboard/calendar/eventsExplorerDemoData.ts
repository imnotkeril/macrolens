import type { EventsIndicatorCard } from "@/components/next-dashboard/calendar/eventsExplorerTypes";

const PRICE_ACTION = [
  { symbol: "GBP/USD", bias: "bullish", accuracyPct: 64, events: 26 },
  { symbol: "BTC", bias: "neutral", accuracyPct: 52, events: 26 },
  { symbol: "USD/JPY", bias: "bearish", accuracyPct: 61, events: 26 },
  { symbol: "EUR/USD", bias: "bullish", accuracyPct: 58, events: 26 },
  { symbol: "SPY", bias: "bearish", accuracyPct: 63, events: 26 },
  { symbol: "GLD", bias: "neutral", accuracyPct: 48, events: 26 },
] as const;

function makeCard(
  id: string,
  title: string,
  importance: "high" | "medium" | "low",
  fredLabel: string,
  regimeTags: Array<"risk_on" | "value" | "growth" | "risk_off">,
): EventsIndicatorCard {
  return {
    id,
    title,
    region: "USD",
    releases: 36,
    importance,
    fredLabel,
    fredUrl: "https://fred.stlouisfed.org/",
    regimeTags,
    points: [
      { label: "Feb 2", actual: 2.5, forecast: 2.2, spy: 497 },
      { label: "Feb 16", actual: 2.8, forecast: 2.6, spy: 503 },
      { label: "Mar 1", actual: 2.1, forecast: 2.3, spy: 511 },
      { label: "Mar 15", actual: 2.0, forecast: 2.1, spy: 508 },
      { label: "Apr 5", actual: 1.5, forecast: 1.9, spy: 518 },
      { label: "Apr 19", actual: 2.1, forecast: 2.0, spy: 523 },
      { label: "May 3", actual: 2.3, forecast: 2.1, spy: 530 },
    ],
    releasesTable: [
      { date: "May 3, 2025", forecast: "2.1%", actual: "2.3%", surprise: 0.2 },
      { date: "Apr 19, 2025", forecast: "2.0%", actual: "2.1%", surprise: 0.1 },
      { date: "Apr 5, 2025", forecast: "1.9%", actual: "1.5%", surprise: -0.4 },
      { date: "Mar 15, 2025", forecast: "2.1%", actual: "2.0%", surprise: -0.1 },
      { date: "Mar 1, 2025", forecast: "2.3%", actual: "2.1%", surprise: -0.2 },
    ],
    priceAction: PRICE_ACTION.map((x) => ({ ...x })),
  };
}

export const EVENTS_INDICATOR_CARDS: EventsIndicatorCard[] = [
  makeCard("nfp", "Nonfarm Payrolls (Total)", "high", "PAYEMS", ["risk_off", "value"]),
  makeCard("cpi", "Consumer Price Index (CPI YoY)", "high", "CPIAUCSL", ["risk_off", "growth"]),
  makeCard("ism", "ISM Manufacturing PMI", "medium", "NAPM", ["value", "growth"]),
  makeCard("retail", "Retail Sales MoM", "medium", "RSXFS", ["risk_on", "growth"]),
];
