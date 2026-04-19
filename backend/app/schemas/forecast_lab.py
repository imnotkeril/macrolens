"""Pydantic schemas for Forecast Lab API."""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


class PhaseProbabilities(BaseModel):
    Q1_GOLDILOCKS: float = 0.25
    Q2_REFLATION: float = 0.25
    Q3_OVERHEATING: float = 0.25
    Q4_STAGFLATION: float = 0.25


class ExpertPhaseBreakdown(BaseModel):
    rule: PhaseProbabilities
    hmm: PhaseProbabilities = Field(
        description="HMM quadrant mix, lightly smoothed for display when posterior is one-hot; ensemble uses raw HMM vector.",
    )
    gbdt: PhaseProbabilities
    cycle: PhaseProbabilities | None = Field(
        default=None,
        description="Cycle Radar → quadrant soft prior when ensemble includes cycle expert.",
    )


class MacroForecastRow(BaseModel):
    series_id: str
    display_name: str | None = None
    horizon_months: int
    value: float | None = None
    trained: bool = False


class StressBlock(BaseModel):
    stress_score: float = Field(ge=0.0, le=1.0)
    stress_band: str  # low, medium, high
    drivers: list[str] = Field(default_factory=list)


class DashboardContextBlock(BaseModel):
    """Read-only cross-check vs Radar (cycle) and Navigator quadrant at the same as_of (PIT)."""

    cycle_phase_bucket: str | None = None
    cycle_phase_detail: str | None = None
    cycle_score: float | None = None
    navigator_quadrant: str | None = None
    matches_navigator_quadrant: bool | None = None


class ForecastLabSummaryResponse(BaseModel):
    as_of_date: date
    bundle_id: str
    trained: bool
    phase_class: str
    phase_probabilities: PhaseProbabilities
    confidence: float
    ensemble_weights: dict[str, float] | None = None
    experts: ExpertPhaseBreakdown | None = None
    macro_forecasts: list[MacroForecastRow] = Field(default_factory=list)
    stress: StressBlock
    recession_prob_12m: float | None = None
    recession_reason: str | None = None
    data_availability: dict[str, Any] = Field(default_factory=dict)
    dashboard_context: DashboardContextBlock | None = None
    training_label_mode: str | None = Field(
        default=None,
        description="Label strategy used when training the active bundle (from meta.json).",
    )


class BundleInfoResponse(BaseModel):
    bundle_id: str
    trained: bool
    trained_at: str | None = None
    metrics: dict[str, Any] = Field(default_factory=dict)
    feature_names: list[str] = Field(default_factory=list)
    label_mode: str | None = None
    label_stats: dict[str, Any] | None = None


class TrainStartResponse(BaseModel):
    status: str
    message: str


class TrainStatusResponse(BaseModel):
    done: bool
    percent: float
    message: str
    log_line: str | None = None


class DiagnosticsOOSResponse(BaseModel):
    bundle_id: str
    metrics: dict[str, Any] = Field(default_factory=dict)


class PhaseAssetAlignmentResponse(BaseModel):
    bundle_id: str
    horizon_months: int
    overall_hit_rate: float | None = None
    by_quadrant: dict[str, float] = Field(default_factory=dict)
    sample_size: int | None = None
    note: str | None = None


class LogSnapshotResponse(BaseModel):
    status: str
    id: int | None = None


class RegimeHistoryRow(BaseModel):
    """Monthly persisted regime timeline (Navigator UI vs FL rule vs asset-implied)."""

    obs_date: date
    navigator_growth_score: float
    navigator_fed_score: float
    navigator_quadrant: str
    fl_growth_score: float
    fl_fed_policy_score: float
    fl_yield_10y_minus_2y: float
    fl_hy_spread_proxy: float
    fl_rule_quadrant: str
    asset_implied_quadrant: str
    asset_confirmation_score: float
    asset_confirmed: bool
    asset_used_rule_fallback: bool
    forward_confirmation_score: float
    forward_regime_confirmed: bool
    confirmed_regime_quadrant: str | None = None
    yield_curve_pattern: str | None = None
    yield_curve_short_chg_1m_bp: float | None = None
    yield_curve_long_chg_1m_bp: float | None = None
    navigator_curve_matches_expectation: bool | None = None
    fl_rule_curve_matches_expectation: bool | None = None
    fl_curve_pattern_embed: float | None = None
    materialization_batch_id: str
    materialized_at: datetime | None = None

    model_config = {"from_attributes": True}


class RegimeHistoryListResponse(BaseModel):
    items: list[RegimeHistoryRow]
    count: int


class RegimeHistoryMaterializeResponse(BaseModel):
    rows: int
    batch_id: str
    horizon_months: int
    message: str | None = None
    errors: int | None = None
