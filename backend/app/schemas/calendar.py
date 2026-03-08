from datetime import date
from pydantic import BaseModel


class CalendarEvent(BaseModel):
    date: date
    name: str
    event_type: str  # "indicator_release", "fomc_decision", "fomc_minutes"
    importance: int  # 1-3
    category: str | None = None
    frequency: str | None = None

    actual: float | None = None
    previous: float | None = None
    forecast: float | None = None
    surprise_pct: float | None = None

    market_reaction_1d: float | None = None

    is_upcoming: bool = False


class CalendarSummary(BaseModel):
    upcoming: list[CalendarEvent]
    recent: list[CalendarEvent]
    next_fomc: CalendarEvent | None = None


class EventImpact(BaseModel):
    indicator_name: str
    release_count: int
    avg_market_reaction: float | None = None
    avg_surprise_pct: float | None = None
    beat_count: int = 0
    miss_count: int = 0
    inline_count: int = 0
    history: list[CalendarEvent] = []
