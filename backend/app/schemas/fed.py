from datetime import date, datetime
from typing import Any

from pydantic import BaseModel


class FedRateResponse(BaseModel):
    id: int
    date: date
    target_upper: float
    target_lower: float
    effr: float | None = None
    fomc_signal_phrase: str | None = None

    model_config = {"from_attributes": True}


class BalanceSheetResponse(BaseModel):
    id: int
    date: date
    total_assets: float
    treasuries: float | None = None
    mbs: float | None = None
    reserves: float | None = None

    model_config = {"from_attributes": True}


class FedPolicyStatus(BaseModel):
    current_rate_upper: float
    current_rate_lower: float
    effr: float | None
    policy_score: float  # -2 (very easy) to +2 (very tight)
    stance: str  # "very_easy", "easy", "neutral", "tight", "very_tight"
    rate_direction: str  # "hiking", "paused", "cutting"
    balance_sheet_direction: str  # "expanding" (QE), "stable", "shrinking" (QT)
    last_change_date: date | None
    #: FOMC SEP longer-run median (FRED FEDTARMDLR) or configured fallback — nominal % policy anchor.
    neutral_rate_nominal: float
    #: Latest Fed/CB agent rhetoric score (−1 dovish … +1 hawkish), when intelligence pipeline has run.
    rhetoric_score: float | None = None
    #: Midpoint of target range minus neutral, in percentage points (not percent of neutral).
    rate_vs_neutral_pp: float


class FomcMeetingProb(BaseModel):
    date: str
    hold_pct: int
    cut25_pct: int
    cut50_pct: int
    hike_pct: int
    outcome: str
    outcome_type: str  # "hold" | "cut" | "hike"


class RatePathPoint(BaseModel):
    fed_median: float
    market: float


class FomcDashboardResponse(BaseModel):
    meetings: list[FomcMeetingProb]
    rate_path: dict[str, RatePathPoint]
    current_rate: float
    forward_rate: float | None
    meetings_source: str | None = None  # "cme_fedwatch" | "zq_heuristic"
    rate_path_source: str | None = None  # "fred_sep" | "extrapolation"


class FedDotPlotResponse(BaseModel):
    """FOMC SEP median path (FRED) + optional live market mid from DB."""

    rate_path: dict[str, RatePathPoint]
    current_rate: float
    forward_rate: float | None
    source: str
    meta: dict[str, Any] = {}
