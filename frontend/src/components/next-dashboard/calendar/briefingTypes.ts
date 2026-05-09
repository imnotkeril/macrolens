/** Shared types for Calendar → Briefings (Morning / Evening). API-ready shape. */

export type BriefingImportance = "high" | "medium" | "low";

export type BeatMiss = "beat" | "miss" | "in-line" | "pending";

export interface BriefingKeyEventRow {
  time: string;
  currency: string;
  event: string;
  est: string;
  prev: string;
  act: string;
  beatMiss: BeatMiss;
  importance: BriefingImportance;
}

export interface OvernightMove {
  label: string;
  changePct: number;
}

export interface ExpectedMoveRow {
  label: string;
  movePct: number;
  /** 0..1 for bar width */
  bar: number;
}

export interface TradeIdeaRow {
  title: string;
  rationale: string;
  entry: string;
  tp: string;
  sl: string;
}

export interface HistoricalPatternRow {
  occurrence: string;
  equity1d: number;
  yield10y1d: number;
  usd1d: number;
}

export interface MarketSnapshotItem {
  symbol: string;
  name: string;
  price: string;
  changePct: number;
}

export interface MorningBriefData {
  briefDate: string;
  headline: string;
  executiveSummary: string;
  keyEvents: BriefingKeyEventRow[];
  regimeLabel: string;
  regimeScore: number;
  overnightMoves: OvernightMove[];
  expectedMoves: ExpectedMoveRow[];
  tradeIdeas: TradeIdeaRow[];
  regimeNarrative: string;
  crossEventAnalysis: string;
  historicalPatternTitle: string;
  historicalPatternRows: HistoricalPatternRow[];
  historicalWinRatePct: number;
  marketSnapshotTimeEt: string;
  marketSnapshot: MarketSnapshotItem[];
}

export interface ScorecardRow {
  event: string;
  predicted: "up" | "down" | "flat";
  actual: "up" | "down" | "flat";
  surprisePct: number;
  correct: boolean;
}

export interface ResultsSummaryCard {
  metric: string;
  flagEmoji: string;
  outcome: BeatMiss;
  est: string;
  prev: string;
  act: string;
  analysis: string;
}

export interface EveningBriefData {
  briefDate: string;
  headline: string;
  executiveSummary: string;
  keyEvents: BriefingKeyEventRow[];
  accuracyPct: number;
  correct: number;
  incorrect: number;
  total: number;
  scorecard: ScorecardRow[];
  resultsCards: ResultsSummaryCard[];
  marketReaction: string;
  mainMovers: OvernightMove[];
  keyTakeaways: string[];
  tomorrowPreview: string;
  tomorrowEvents: Array<{ time: string; name: string }>;
  sideTickers: Array<{ symbol: string; price: string; changePct: number }>;
  marketSnapshotTimeEt: string;
  marketSnapshot: MarketSnapshotItem[];
}

export interface BriefingArchiveDay {
  date: string;
  label: string;
}
