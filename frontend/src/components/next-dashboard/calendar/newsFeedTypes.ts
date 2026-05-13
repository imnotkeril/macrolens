export type NewsImpact = "high" | "medium" | "low";

export type NewsCategory =
  | "Geopolitics"
  | "Equities"
  | "Commodities"
  | "Rates"
  | "FX"
  | "Macro"
  | "Central Banks";

export type NewsInstrument = "SPY" | "GLD" | "TLT" | "USD";

export interface NewsFredSeries {
  code: string;
  name: string;
}

export interface NewsItem {
  id: string;
  unread: boolean;
  timeLabel: string;
  source: string;
  category: NewsCategory;
  headline: string;
  impact: NewsImpact;
  instruments: NewsInstrument[];
  articleUrl: string;
  publishedAgo: string;
  summary: string;
  keyPoints: string[];
  regimeImpact: string;
  fredSeries: NewsFredSeries[];
}
