// ---- Enums ----
export type IndicatorCategory = "housing" | "orders" | "income_sales" | "employment" | "inflation";
export type IndicatorType = "leading" | "coincident" | "lagging";
export type TrendDirection = "improving" | "neutral" | "deteriorating";
export type Frequency = "daily" | "weekly" | "monthly" | "quarterly";
export type Importance = 1 | 2 | 3;
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertType =
  | "quadrant_transition"
  | "indicator_surprise"
  | "yield_curve_inversion"
  | "recession_threshold"
  | "vix_spike"
  | "fed_rate_change";

// ---- Indicators ----
export interface IndicatorWithLatest {
  id: number;
  name: string;
  fred_series_id: string;
  category: IndicatorCategory;
  importance: Importance;
  indicator_type: IndicatorType;
  frequency: Frequency;
  source: string;
  description: string | null;
  unit: string | null;
  latest_value: number | null;
  latest_date: string | null;
  previous_value: number | null;
  trend: TrendDirection | null;
  z_score: number | null;
  surprise: number | null;
}

export interface IndicatorValue {
  id: number;
  indicator_id: number;
  date: string;
  value: number;
  previous: number | null;
  forecast: number | null;
  surprise: number | null;
  trend: TrendDirection | null;
  z_score: number | null;
  created_at: string;
}

export interface CategoryScore {
  category: IndicatorCategory;
  score: number;
  trend: TrendDirection;
  indicator_count: number;
  color: "green" | "yellow" | "red";
}

// ---- Fed Policy ----
export interface FedPolicyStatus {
  current_rate_upper: number;
  current_rate_lower: number;
  effr: number | null;
  policy_score: number;
  stance: string;
  rate_direction: string;
  balance_sheet_direction: string;
  last_change_date: string | null;
}

export interface FedRate {
  id: number;
  date: string;
  target_upper: number;
  target_lower: number;
  effr: number | null;
}

export interface BalanceSheet {
  id: number;
  date: string;
  total_assets: number;
  treasuries: number | null;
  mbs: number | null;
  reserves: number | null;
}

export interface FomcMeetingProb {
  date: string;
  hold_pct: number;
  cut25_pct: number;
  cut50_pct: number;
  hike_pct: number;
  outcome: string;
  outcome_type: "hold" | "cut" | "hike";
}

export interface RatePathPoint {
  fed_median: number;
  market: number;
}

export interface FomcDashboard {
  meetings: FomcMeetingProb[];
  rate_path: Record<string, RatePathPoint>;
  current_rate: number;
  forward_rate: number | null;
}

// ---- Yield Curve ----
export interface YieldDataPoint {
  date: string;
  maturity: string;
  nominal_yield: number;
  tips_yield: number | null;
  breakeven: number | null;
}

export interface YieldSpread {
  name: string;
  value: number;
  historical_percentile: number | null;
  is_inverted: boolean;
}

export interface YieldCurveSnapshot {
  date: string;
  points: YieldDataPoint[];
  spreads: YieldSpread[];
}

export interface CurveDynamics {
  pattern: string;
  description: string;
  short_end_change_1m: number;
  long_end_change_1m: number;
  short_end_change_3m: number;
  long_end_change_3m: number;
}

// ---- Navigator ----
export interface NavigatorPosition {
  growth_score: number;
  fed_policy_score: number;
  quadrant: string;
  quadrant_label: string;
  confidence: number;
  direction: string;
  date: string;
}

export interface FactorAllocation {
  factor: string;
  weight: "overweight" | "neutral" | "underweight";
  description: string;
  tickers?: string[];
}

export interface TradingRecommendation {
  name: string;
  trade_type: string;
  legs: string;
  description: string;
  rationale?: string;
}

export interface SectorAllocation {
  sector: string;
  weight: string;
  rationale: string;
}

export interface AssetAllocation {
  equities_pct: number;
  bonds_pct: number;
  commodities_pct: number;
  cash_pct: number;
  gold_pct: number;
}

export interface NavigatorRecommendation {
  position: NavigatorPosition;
  factor_tilts: FactorAllocation[];
  sector_allocations: SectorAllocation[];
  asset_allocation: AssetAllocation;
  geographic: Record<string, string>;
  trading_recommendations?: TradingRecommendation[];
}

export interface CrossAssetSignal {
  name: string;
  signal: "bullish" | "bearish" | "neutral";
  value: number | null;
  description: string;
}

/** One cell of the Cross-Asset Radar grid (from /api/market/cross-asset-radar). */
export interface CrossAssetRadarCell {
  name: string;
  value: number | null;
  unit: string;
  signal: "bullish" | "bearish" | "neutral";
}

export interface RecessionCheckItem {
  name: string;
  triggered: boolean;
  current_value: string;
  threshold: string;
  description: string;
}

export interface RecessionCheck {
  score: number;
  total: number;
  confidence: string;
  items: RecessionCheckItem[];
}

// ---- Calendar ----
export interface CalendarEvent {
  date: string;
  name: string;
  event_type: "indicator_release" | "fomc_decision" | "fomc_minutes";
  importance: number;
  category: string | null;
  frequency: string | null;
  actual: number | null;
  previous: number | null;
  forecast: number | null;
  surprise_pct: number | null;
  market_reaction_1d: number | null;
  is_upcoming: boolean;
}

export interface CalendarSummary {
  upcoming: CalendarEvent[];
  recent: CalendarEvent[];
  next_fomc: CalendarEvent | null;
}

export interface EventImpact {
  indicator_name: string;
  release_count: number;
  avg_market_reaction: number | null;
  avg_surprise_pct: number | null;
  beat_count: number;
  miss_count: number;
  inline_count: number;
  history: CalendarEvent[];
}

// ---- Market / Time Series ----
export interface TimeSeriesPoint {
  date: string;
  value: number;
  change_pct?: number | null;
}

export interface NetLiquidityPoint {
  date: string;
  value: number;
  fed_bs: number;
  tga: number;
  rrp: number;
}

export interface RatioPoint {
  date: string;
  value: number;
}

export interface RecessionBand {
  start: string;
  end: string;
}

export interface SectorPerf {
  symbol: string;
  label: string;
  group: string;
  series: TimeSeriesPoint[];
  total_return: number;
  latest_value: number;
}

export interface SectorGroupPerf {
  group: string;
  series: TimeSeriesPoint[];
  total_return: number;
}

export interface FactorRatio {
  label: string;
  series: RatioPoint[];
}

export interface IndexStatus {
  symbol: string;
  price: number;
  dma_200: number;
  above_200dma: boolean;
  distance_pct: number;
  date: string;
}

export interface FxStrength {
  symbol: string;
  series: TimeSeriesPoint[];
  current: number;
  change_pct: number;
}

export interface InflationPoint {
  date: string;
  value: number;
}

export interface InflationLatest {
  name: string;
  full_name: string;
  yoy: number;
  date: string;
}

// ---- Regime / Cycle Radar ----
export interface CycleDriverContribution {
  name: string;
  raw_value: number | null;
  normalized: number;
  weight: number;
  contribution: number;
  direction: "positive" | "negative" | "neutral";
}

export interface RecessionModelResult {
  name: string;
  probability: number;
  description: string;
}

export interface PhaseTransitionSignal {
  name: string;
  current_value: string;
  threshold: string;
  status: "green" | "yellow" | "red";
  description: string;
}

export interface LightFCIComponent {
  name: string;
  weight: number;
  z_score: number | null;
  contribution: number | null;
  direction: "tightening" | "loosening" | "neutral";
}

export interface TacticalAllocationRow {
  asset_class: string;
  recovery: string;
  expansion: string;
  slowdown: string;
  contraction: string;
  current_signal: string;
}

export interface ExpectedReturn {
  asset_class: string;
  avg_return: number;
  sharpe: number;
  beta_to_cycle: number;
}

export interface RegimeSnapshot {
  cycle_score: number;
  phase: string;
  phase_label: string;
  recession_prob_12m: number;
  recession_models: RecessionModelResult[];
  top_drivers: CycleDriverContribution[];
  fci_score: number | null;
  fci_gdp_impact: number | null;
  fci_components: LightFCIComponent[];
  phase_signals: PhaseTransitionSignal[];
  narrative: string;
  tactical_allocation: TacticalAllocationRow[];
  expected_returns: ExpectedReturn[];
  data_completeness: number;
  timestamp: string;
}

export interface RegimeHistoryPoint {
  date: string;
  cycle_score: number;
  phase: string;
  recession_prob: number;
}

// ---- S&P 500 Sectors Dashboard ----
export interface SectorLine {
  symbol: string;
  series: RatioPoint[];
  color: string;
}
export interface SectorsDashboardData {
  lines: SectorLine[];
  inversion: RatioPoint[];
  effr: RatioPoint[];
  cpi_yoy: RatioPoint[];
}

// ---- Currency Dashboard ----
export interface CurrencyLine {
  symbol: string;
  series: RatioPoint[];
}
export interface CurrencyDashboardData {
  lines: CurrencyLine[];
  inversion: RatioPoint[];
  effr: RatioPoint[];
  cpi_yoy: RatioPoint[];
}

// ---- Sentiment Dashboard ----
export interface SentimentDashboardData {
  non_cyclical: RatioPoint[];
  cyclical: RatioPoint[];
  sensitive: RatioPoint[];
  high_beta: RatioPoint[];
  gld: RatioPoint[];
  tlt: RatioPoint[];
  inversion: RatioPoint[];
  effr: RatioPoint[];
  cpi_yoy: RatioPoint[];
}

// ---- Rates & Yield Curve Dashboard ----
export interface YieldOverlayPoint {
  date: string;
  y2?: number;
  y5?: number;
  y10?: number;
  y30?: number;
}

export interface RatesDashboardData {
  forward_fed_rate: RatioPoint[];
  yield_overlay: YieldOverlayPoint[];
  real_yield_5y: RatioPoint[];
  real_yield_10y: RatioPoint[];
  yield_2y: RatioPoint[];
  breakeven_spread_10y_5y: RatioPoint[];
}

// ---- Indices & Bitcoin Dashboard ----
export interface IndexPricePoint {
  date: string;
  price: number;
  ma200: number | null;
}

export interface IndicesDashboardData {
  spx: IndexPricePoint[];
  ndx: IndexPricePoint[];
  rut: IndexPricePoint[];
  dji: IndexPricePoint[];
  btc: IndexPricePoint[];
  spx_above200: RatioPoint[];
  spx_above50: RatioPoint[];
  ndx_above200?: RatioPoint[];
  ndx_above50?: RatioPoint[];
  rut_above200?: RatioPoint[];
  rut_above50?: RatioPoint[];
  dji_above200?: RatioPoint[];
  dji_above50?: RatioPoint[];
  btc_dominance_current?: number | null;
  stable_dominance_current?: number | null;
}

// ---- Breadth Dashboard ----
export interface BreadthDashboardData {
  SP500?: TimeSeriesPoint[];
  MMTW?: TimeSeriesPoint[];
  MMFI?: TimeSeriesPoint[];
  MMTH?: TimeSeriesPoint[];
  VIX?: TimeSeriesPoint[];
  PCC?: TimeSeriesPoint[];
  NYHGH?: TimeSeriesPoint[];
  NYLOW?: TimeSeriesPoint[];
  NYMO?: TimeSeriesPoint[];
  NYSI?: TimeSeriesPoint[];
  "TVOL.US"?: TimeSeriesPoint[];
}

// ---- Macro Overview Dashboard ----
export interface MacroOverviewData {
  spx: RatioPoint[];
  // Page 1: Fixed Income & Liquidity
  inflation_expectations: RatioPoint[];
  real_yields: RatioPoint[];
  yield_spread_10y_2y: RatioPoint[];
  forward_fed_rate: RatioPoint[];
  central_bank_bs: RatioPoint[];
  us_liquidity: RatioPoint[];
  move: RatioPoint[];
  rrp: RatioPoint[];
  tga: RatioPoint[];
  sofr_ff_spread: RatioPoint[];
  // Page 2: Commodities & Global Activity
  gold_oil: RatioPoint[];
  gold_copper: RatioPoint[];
  gold_lumber: RatioPoint[];
  copper: RatioPoint[];
  kospi: RatioPoint[];
  taiex: RatioPoint[];
  ipo: RatioPoint[];
  us_lei: RatioPoint[];
  cn_lei: RatioPoint[];
  // Page 3: Risk Appetite & Relative Performance
  high_beta_low_beta: RatioPoint[];
  cyclical_non_cyclical: RatioPoint[];
  tech_materials: RatioPoint[];
  large_small: RatioPoint[];
  micro_small: RatioPoint[];
  em_dm: RatioPoint[];
  hyg_iei: RatioPoint[];
  xlf_relative: RatioPoint[];
}

// ---- Inflation Dashboard ----
export interface InflationDashboardData {
  spx: RatioPoint[];
  cpi_yoy: RatioPoint[];
  cpi_core_yoy: RatioPoint[];
  cpi_mom: RatioPoint[];
  pce_yoy: RatioPoint[];
  pce_core_yoy: RatioPoint[];
  pce_mom: RatioPoint[];
  ppi_yoy: RatioPoint[];
  ppi_core_yoy: RatioPoint[];
  ppi_mom: RatioPoint[];
  mich: RatioPoint[];
  t5yie: RatioPoint[];
  t10yie: RatioPoint[];
  sticky_cpi: RatioPoint[];
}

// ---- Alerts ----
export interface Alert {
  id: number;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface AlertCount {
  total: number;
  unread: number;
  critical: number;
}

// ---- ML Regime Prediction ----
export interface MLModelProbs {
  quadrant: string | null;
  p_q1: number | null;
  p_q2: number | null;
  p_q3: number | null;
  p_q4: number | null;
}

export interface MLRegimePredict {
  quadrant_rule: string;
  quadrant_ensemble: string;
  confidence: number;
  p_q1: number;
  p_q2: number;
  p_q3: number;
  p_q4: number;
  by_model: Record<string, MLModelProbs>;
  trained: boolean;
  ensemble_weights: Record<string, number> | null;
}

export interface MLBacktestRow {
  date: string;
  quadrant_actual: string;
  quadrant_ensemble: string;
  match: boolean;
  p_q1: number;
  p_q2: number;
  p_q3: number;
  p_q4: number;
}

export interface MLRegimeBacktest {
  backtest: MLBacktestRow[];
  test_start: string | null;
  test_end: string | null;
}

export interface MLRegimeMetrics {
  trained_at: string | null;
  train_end: string | null;
  val_end: string | null;
  test_start: string | null;
  test_end: string | null;
  train_rows: number | null;
  val_rows: number | null;
  test_rows: number | null;
  metrics: Record<string, number>;
  confusion_matrix: number[][] | null;
}

export interface MLDatasetInfo {
  rows: number;
  date_min: string | null;
  date_max: string | null;
  features: string[];
  last_built: string | null;
  path: string;
  build_error?: string | null;
}

export interface MLTrainResponse {
  status: string;
  version: string | null;
  metrics: Record<string, number> | null;
  error: string | null;
}

/** Progress for long-running tasks (refresh / train). Poll from frontend. */
export interface TaskProgress {
  phase: string;
  percent: number;
  message: string;
  logs: string[];
  done: boolean;
  error: string | null;
}
