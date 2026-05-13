import type {
  CalendarDayGroup,
  CalendarRegion,
  CalendarViewMode,
} from "@/components/next-dashboard/calendar/economicCalendarTypes";

const HIST_TEMPLATE = [
  { label: "Oct 2023", value: 8.1, marker: "est" as const },
  { label: "Nov 2023", value: 7.8, marker: "beat" as const },
  { label: "Dec 2023", value: 7.7, marker: "beat" as const },
  { label: "Jan 2024", value: 7.9, marker: "miss" as const },
  { label: "Feb 2024", value: 7.5, marker: "miss" as const },
  { label: "Mar 2024", value: 7.7, marker: "est" as const },
];

export const CALENDAR_WEEK_RANGES = [
  { id: "2025-05-04_2025-05-10", label: "May 4 - May 10" },
  { id: "2025-05-11_2025-05-17", label: "May 11 - May 17" },
];

function makeEvent(id: string, region: CalendarRegion, event: string, time: string, released = true) {
  return {
    id,
    time,
    region,
    currency: region === "EU" ? "EUR" : region === "JP" ? "JPY" : region === "GB" ? "GBP" : region === "CN" ? "CNY" : "USD",
    importance: id.includes("high") ? ("high" as const) : id.includes("low") ? ("low" as const) : ("medium" as const),
    event,
    actual: released ? "7.40M" : "—",
    forecast: "7.50M",
    previous: "7.56M",
    released,
    beatMiss: released ? ("miss" as const) : ("pending" as const),
    details: {
      fredSeriesLabel: "FRED Series: JTSJOL",
      fredSeriesUrl: "https://fred.stlouisfed.org/series/JTSJOL",
      historical: HIST_TEMPLATE,
      beats: 3,
      inLine: 1,
      misses: 2,
      aiPrediction: {
        side: "below",
        confidencePct: 68,
        regimeTag: "bearish",
        rationale:
          "Model suggests downside surprise vs consensus due to softer hiring intentions and declining labor turnover. Regime-sensitive assets typically react strongest in risk-off windows.",
        factors: [
          "Declining job openings and lower quits rate",
          "Tighter financial conditions",
          "Leading indicators point to slower demand",
        ],
        relatedInstruments: ["SPY", "QQQ", "IWM", "US10Y", "USD/JPY", "EUR/USD"],
        strongestRegimeImpact: "Strongest in RISK OFF",
      },
      profiles: [
        { symbol: "SPY", bias: "bearish", avgMovePct: -0.28, samples: 32, pattern: "One Way Train", sensitivity: "high" },
        { symbol: "GLD", bias: "bullish", avgMovePct: 0.21, samples: 27, pattern: "Chopfest", sensitivity: "low" },
        { symbol: "TLT", bias: "bullish", avgMovePct: 0.35, samples: 31, pattern: "One Way Train", sensitivity: "high" },
        { symbol: "EUR/USD", bias: "bearish", avgMovePct: -0.18, samples: 28, pattern: "Chopfest", sensitivity: "medium" },
        { symbol: "USD/JPY", bias: "neutral", avgMovePct: 0.05, samples: 26, pattern: "Chopfest", sensitivity: "low" },
      ],
    },
  };
}

export function getCalendarDemoGroups(rangeId: string, mode: CalendarViewMode): CalendarDayGroup[] {
  const base: CalendarDayGroup[] = [
    {
      id: "2025-05-04",
      label: "Monday, May 4",
      eventsCount: 11,
      events: [
        makeEvent("m4-high-1", "US", "Nonfarm Payrolls (Apr)", "08:30"),
        makeEvent("m4-med-2", "US", "Average Hourly Earnings MoM (Apr)", "08:30"),
        makeEvent("m4-med-3", "US", "ISM Services PMI (Apr)", "10:00"),
        makeEvent("m4-low-4", "US", "Factory Orders MoM (Mar)", "10:00"),
        makeEvent("m4-high-5", "US", "JOLTS Job Openings (Mar)", "14:00"),
      ],
    },
    {
      id: "2025-05-05",
      label: "Tuesday, May 5",
      eventsCount: 9,
      events: [makeEvent("m5-med-1", "EU", "Retail Sales YoY (Mar)", "05:00", false)],
    },
    {
      id: "2025-05-06",
      label: "Wednesday, May 6",
      eventsCount: 12,
      events: [makeEvent("m6-high-1", "JP", "BoJ Summary of Opinions", "01:50", false)],
    },
    {
      id: "2025-05-07",
      label: "Thursday, May 7",
      eventsCount: 10,
      events: [makeEvent("m7-med-1", "GB", "BoE Rate Decision", "07:00", false)],
    },
    {
      id: "2025-05-08",
      label: "Friday, May 8",
      eventsCount: 8,
      events: [makeEvent("m8-low-1", "CN", "Trade Balance", "22:00", false)],
    },
    {
      id: "2025-05-09",
      label: "Saturday, May 9",
      eventsCount: 3,
      events: [],
    },
    {
      id: "2025-05-10",
      label: "Sunday, May 10",
      eventsCount: 2,
      events: [],
    },
  ];

  const selected = rangeId === CALENDAR_WEEK_RANGES[1].id ? base.map((g) => ({ ...g, id: g.id.replace("05-0", "05-1") })) : base;
  if (mode === "day") return selected.slice(0, 1);
  return selected;
}
