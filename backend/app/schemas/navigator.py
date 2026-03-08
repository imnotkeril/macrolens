from datetime import date
from pydantic import BaseModel


class NavigatorPosition(BaseModel):
    growth_score: float  # -2 to +2
    fed_policy_score: float  # -2 to +2
    quadrant: str  # Q1_GOLDILOCKS, Q2_REFLATION, Q3_OVERHEATING, Q4_STAGFLATION
    quadrant_label: str
    confidence: float  # 0-1 based on cross-asset confirmation
    direction: str  # direction of travel
    date: date


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


class NavigatorRecommendation(BaseModel):
    position: NavigatorPosition
    factor_tilts: list[FactorAllocation]
    sector_allocations: list[SectorAllocation]
    asset_allocation: AssetAllocation
    geographic: dict[str, str]  # {"DM": "overweight", "EM": "underweight"}
    trading_recommendations: list[TradingRecommendation] = []


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


class RecessionCheck(BaseModel):
    score: int  # count of triggered items (need 5+ of 8 for high confidence)
    total: int
    confidence: str  # "low", "moderate", "high"
    items: list[RecessionCheckItem]
