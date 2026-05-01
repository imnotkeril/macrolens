from datetime import date, datetime

from pydantic import BaseModel


class CalendarCanaryEventOut(BaseModel):
    id: int
    source: str
    event_name: str
    event_date: date
    country: str | None = None
    frequency: str | None = None
    importance: int | None = None
    quality_status: str
    published_at: datetime | None = None

    class Config:
        from_attributes = True
