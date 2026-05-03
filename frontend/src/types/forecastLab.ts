export interface PhaseProbabilities {
  Q1_GOLDILOCKS: number;
  Q2_REFLATION: number;
  Q3_OVERHEATING: number;
  Q4_STAGFLATION: number;
}

export interface ExpertPhaseBreakdown {
  rule: PhaseProbabilities;
  hmm: PhaseProbabilities;
  gbdt: PhaseProbabilities;
  cycle?: PhaseProbabilities | null;
}

export interface MacroForecastRow {
  series_id: string;
  display_name?: string | null;
  horizon_months: number;
  value: number | null;
  trained: boolean;
}

export interface StressZContributor {
  symbol: string;
  z_abs: number;
}

export interface StressBlock {
  stress_score: number;
  stress_band: string;
  drivers: string[];
  universe_symbols?: string[];
  insufficient_history?: boolean;
  top_z_contributors?: StressZContributor[];
}

export interface DashboardContext {
  cycle_phase_bucket?: string | null;
  cycle_phase_detail?: string | null;
  cycle_score?: number | null;
  navigator_quadrant?: string | null;
  matches_navigator_quadrant?: boolean | null;
}

export interface ForecastLabSummary {
  as_of_date: string;
  bundle_id: string;
  trained: boolean;
  phase_class: string;
  phase_probabilities: PhaseProbabilities;
  confidence: number;
  ensemble_weights: Record<string, number> | null;
  experts: ExpertPhaseBreakdown | null;
  macro_forecasts: MacroForecastRow[];
  stress: StressBlock;
  recession_prob_12m: number | null;
  recession_reason: string | null;
  data_availability: Record<string, unknown>;
  dashboard_context?: DashboardContext | null;
  training_label_mode?: string | null;
}

export interface BundleInfo {
  bundle_id: string;
  trained: boolean;
  trained_at?: string | null;
  metrics: Record<string, unknown>;
  feature_names: string[];
  label_mode?: string | null;
  label_stats?: Record<string, unknown> | null;
}

export interface TrainStatus {
  done: boolean;
  percent: number;
  message: string;
  log_line?: string | null;
}

export interface PhaseAssetAlignment {
  bundle_id: string;
  horizon_months: number;
  overall_hit_rate: number | null;
  /** Per-quadrant mean forward hit rate; null if that regime never occurred in the evaluation window. */
  by_quadrant: Record<string, number | null>;
  sample_size?: number | null;
  note?: string | null;
}

/** Row from GET /api/forecast-lab/regime-history (monthly materialized timeline). */
export interface RegimeHistoryRow {
  obs_date: string;
  navigator_growth_score: number;
  navigator_fed_score: number;
  navigator_quadrant: string;
  fl_growth_score: number;
  fl_fed_policy_score: number;
  fl_yield_10y_minus_2y: number;
  fl_hy_spread_proxy: number;
  fl_rule_quadrant: string;
  /** Ensemble headline from latest prediction log for this as_of_date (API-enriched). */
  fl_ensemble_quadrant?: string | null;
  asset_implied_quadrant: string;
  asset_confirmation_score: number;
  asset_confirmed: boolean;
  asset_used_rule_fallback: boolean;
  forward_confirmation_score: number;
  forward_regime_confirmed: boolean;
  confirmed_regime_quadrant?: string | null;
  yield_curve_pattern?: string | null;
  yield_curve_short_chg_1m_bp?: number | null;
  yield_curve_long_chg_1m_bp?: number | null;
  navigator_curve_matches_expectation?: boolean | null;
  fl_rule_curve_matches_expectation?: boolean | null;
  fl_curve_pattern_embed?: number | null;
  materialization_batch_id: string;
  materialized_at?: string | null;
}

export interface RegimeHistoryListResponse {
  items: RegimeHistoryRow[];
  count: number;
}

export interface RegimeHistoryMaterializeResponse {
  rows: number;
  batch_id: string;
  horizon_months: number;
  message?: string | null;
  errors?: number | null;
}
