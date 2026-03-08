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
    date: date
    points: list[YieldDataResponse]
    spreads: list[YieldSpread]


class CurveDynamics(BaseModel):
    pattern: str  # bear_steepening, bull_steepening, bear_flattening, bull_flattening
    description: str
    short_end_change_1m: float
    long_end_change_1m: float
    short_end_change_3m: float
    long_end_change_3m: float
