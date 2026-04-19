from datetime import date
from pydantic import BaseModel

from app.schemas.forecast_lab import ExpertPhaseBreakdown, PhaseProbabilities


class NavigatorPosition(BaseModel):
    growth_score: float  # -2 to +2
    fed_policy_score: float  # -2 to +2
    quadrant: str  # Q1_GOLDILOCKS, Q2_REFLATION, Q3_OVERHEATING, Q4_STAGFLATION
    quadrant_label: str
    matrix_quadrant: str | None = None  # axes-only quadrant; canonical `quadrant` = FL phase when trained
    confidence: float  # 0-1 based on cross-asset confirmation
    direction: str  # direction of travel
    date: date
    # Soft-rule barycenter on the same axes (for past/future dots); full ensemble only on current via `ensemble`.
    ensemble_growth_score: float | None = None
    ensemble_fed_policy_score: float | None = None


class NavigatorPhaseContext(BaseModel):
    """PIT yield curve dynamics + alignment with methodology expectations (TZ §5–§6)."""

    as_of_date: date
    curve_pattern: str
    curve_description: str
    short_end_change_1m_bp: float
    long_end_change_1m_bp: float
    short_end_change_3m_bp: float
    long_end_change_3m_bp: float
    methodology_expected_curve_patterns: list[str] = []
    curve_matches_methodology: bool | None = None


class FactorAllocation(BaseModel):
    factor: str
    weight: str  # "overweight", "neutral", "underweight"
    description: str
    tickers: list[str] = []  # Representative ETFs/tickers for the factor


class TradingRecommendation(BaseModel):
    """Single trading idea (spread, pair, directional)."""
    name: str
    trade_type: str  # "spread", "pair", "directional", "curve"
    legs: str  # e.g. "Long XLY / Short XLP", "Long 2Y / Short 10Y"
    description: str
    rationale: str = ""


class SectorAllocation(BaseModel):
    sector: str
    weight: str
    rationale: str


class AssetAllocation(BaseModel):
    equities_pct: float
    bonds_pct: float
    commodities_pct: float
    cash_pct: float
    gold_pct: float


class NavigatorEnsembleOverlay(BaseModel):
    """Forecast Lab ensemble snapshot at the same as_of as the navigator (month-end aligned if configured)."""

    as_of_date: date
    trained: bool
    phase_class: str
    phase_probabilities: PhaseProbabilities
    confidence: float
    # Modal-phase corner (matches phase_class / argmax) — used for the purple dot on the matrix
    growth_score: float
    fed_policy_score: float
    # Probability-mass center (mix); can differ from modal; e.g. mix in Risk ON while headline is VALUE
    mix_growth_score: float | None = None
    mix_fed_policy_score: float | None = None
    ensemble_weights: dict[str, float] | None = None
    experts: ExpertPhaseBreakdown | None = None


class NavigatorRecommendation(BaseModel):
    position: NavigatorPosition
    factor_tilts: list[FactorAllocation]
    sector_allocations: list[SectorAllocation]
    asset_allocation: AssetAllocation
    geographic: dict[str, str]  # {"DM": "overweight", "EM": "underweight"}
    trading_recommendations: list[TradingRecommendation] = []
    phase_context: NavigatorPhaseContext | None = None
    ensemble: NavigatorEnsembleOverlay | None = None


class CrossAssetSignal(BaseModel):
    name: str
    signal: str  # "bullish", "bearish", "neutral"
    value: float | None = None
    description: str


class RecessionCheckItem(BaseModel):
    name: str
    triggered: bool
    current_value: str
    threshold: str
    description: str
    data_as_of: str | None = None  # ISO date of underlying observation when known


class RecessionCheck(BaseModel):
    score: int  # count of triggered items (need 5+ of 8 for high confidence)
    total: int  # always 8 checklist slots
    confidence: str  # "low", "moderate", "high"
    items: list[RecessionCheckItem]
