from datetime import date

from pydantic import BaseModel


class YieldDataResponse(BaseModel):
    date: date
    maturity: str
    nominal_yield: float
    tips_yield: float | None = None
    breakeven: float | None = None

    model_config = {"from_attributes": True}


class YieldSpread(BaseModel):
    name: str  # "2Y10Y", "3M10Y"
    value: float
    historical_percentile: float | None = None
    is_inverted: bool


class YieldCurveSnapshot(BaseModel):
    date: date | None  # null when there is no curve data at all (never "today")
    points: list[YieldDataResponse]
    spreads: list[YieldSpread]
    insufficient_data: bool = False


class CurveDynamics(BaseModel):
    pattern: str  # bear_steepening, bull_steepening, bear_flattening, bull_flattening
    description: str
    short_end_change_1m: float
    long_end_change_1m: float
    short_end_change_3m: float
    long_end_change_3m: float
    #: True when the 2Y/10Y yields needed for the classification are missing (changes are 0.0).
    insufficient_data: bool = False


class SpreadPercentileRow(BaseModel):
    """Key curve spreads with multi-window percentile ranks vs history."""

    key: str
    label: str
    current_bp: float
    percentile_1y: float | None
    percentile_5y: float | None
    percentile_10y: float | None
    historical_mean_bp: float | None
