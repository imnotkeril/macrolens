from datetime import date, datetime
from pydantic import BaseModel

from app.models.indicator import (
    IndicatorCategory, IndicatorType, Frequency, Importance, TrendDirection,
)


class IndicatorBase(BaseModel):
    name: str
    fred_series_id: str
    category: IndicatorCategory
    importance: Importance
    indicator_type: IndicatorType
    frequency: Frequency
    source: str
    description: str | None = None
    unit: str | None = None


class IndicatorResponse(IndicatorBase):
    id: int
    model_config = {"from_attributes": True}


class IndicatorWithLatest(IndicatorResponse):
    latest_value: float | None = None
    latest_date: date | None = None
    previous_value: float | None = None
    trend: TrendDirection | None = None
    z_score: float | None = None
    surprise: float | None = None


class IndicatorValueResponse(BaseModel):
    id: int
    indicator_id: int
    date: date
    value: float
    previous: float | None = None
    forecast: float | None = None
    surprise: float | None = None
    trend: TrendDirection | None = None
    z_score: float | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CategoryScore(BaseModel):
    category: IndicatorCategory
    score: float
    trend: TrendDirection
    indicator_count: int
    color: str  # green / yellow / red
