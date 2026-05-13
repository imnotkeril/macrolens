export type EventsRegion = "USD" | "EUR" | "JPY" | "GBP" | "CNY";
export type EventsHistory = "last_month" | "last_3m" | "last_year" | "all";
export type EventsImportance = "high" | "medium" | "low";
export type EventsRegime = "all" | "risk_on" | "value" | "growth" | "risk_off";
export type EventsBias = "bullish" | "bearish" | "neutral";

export interface EventsPoint {
  label: string;
  actual: number;
  forecast: number;
  spy: number;
}

export interface EventsReleaseRow {
  date: string;
  forecast: string;
  actual: string;
  surprise: number;
}

export interface EventsPriceActionItem {
  symbol: string;
  bias: EventsBias;
  accuracyPct: number;
  events: number;
}

export interface EventsIndicatorCard {
  id: string;
  title: string;
  region: EventsRegion;
  releases: number;
  importance: EventsImportance;
  fredLabel: string;
  fredUrl: string;
  regimeTags: Array<Exclude<EventsRegime, "all">>;
  points: EventsPoint[];
  releasesTable: EventsReleaseRow[];
  priceAction: EventsPriceActionItem[];
}
