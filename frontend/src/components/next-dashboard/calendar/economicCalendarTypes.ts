export type CalendarViewMode = "day" | "week";

export type CalendarImportance = "high" | "medium" | "low";

export type CalendarRegion = "US" | "EU" | "JP" | "GB" | "CN";

export type ConsensusSide = "above" | "below" | "in-line";

export type ProfileBias = "bullish" | "bearish" | "neutral";

export type ProfileSensitivity = "low" | "medium" | "high";

export interface CalendarHistoricalPoint {
  label: string;
  value: number;
  marker: "beat" | "miss" | "est";
}

export interface CalendarPriceActionProfile {
  symbol: string;
  bias: ProfileBias;
  avgMovePct: number;
  samples: number;
  pattern: string;
  sensitivity: ProfileSensitivity;
}

export interface CalendarExpandedDetails {
  fredSeriesLabel: string;
  fredSeriesUrl: string;
  historical: CalendarHistoricalPoint[];
  beats: number;
  inLine: number;
  misses: number;
  aiPrediction: {
    side: ConsensusSide;
    confidencePct: number;
    regimeTag: ProfileBias;
    rationale: string;
    factors: string[];
    relatedInstruments: string[];
    strongestRegimeImpact: string;
  };
  profiles: CalendarPriceActionProfile[];
}

export interface CalendarEventItem {
  id: string;
  time: string;
  region: CalendarRegion;
  currency: string;
  importance: CalendarImportance;
  event: string;
  actual: string;
  forecast: string;
  previous: string;
  released: boolean;
  beatMiss: "beat" | "miss" | "in-line" | "pending";
  details: CalendarExpandedDetails;
}

export interface CalendarDayGroup {
  id: string;
  label: string;
  eventsCount: number;
  events: CalendarEventItem[];
}
