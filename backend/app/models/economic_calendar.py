from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class EconomicCalendarEvent(Base):
    """External economic calendar events used as a canary source."""

    __tablename__ = "economic_calendar_events"
    __table_args__ = (
        UniqueConstraint(
            "source",
            "event_name",
            "event_date",
            name="uq_economic_calendar_event",
        ),
        Index("ix_economic_calendar_event_date", "event_date"),
        Index("ix_economic_calendar_event_source", "source"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    event_name: Mapped[str] = mapped_column(String(200), nullable=False)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    country: Mapped[str | None] = mapped_column(String(30), nullable=True)
    frequency: Mapped[str | None] = mapped_column(String(30), nullable=True)
    importance: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actual: Mapped[float | None] = mapped_column(Float, nullable=True)
    previous: Mapped[float | None] = mapped_column(Float, nullable=True)
    forecast: Mapped[float | None] = mapped_column(Float, nullable=True)
    quality_status: Mapped[str] = mapped_column(String(20), default="ok", nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class SourceHealthMetric(Base):
    """Basic source-level ingestion quality snapshot."""

    __tablename__ = "source_health_metrics"
    __table_args__ = (
        Index("ix_source_health_source", "source"),
        Index("ix_source_health_metric", "metric_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    metric_name: Mapped[str] = mapped_column(String(80), nullable=False)
    metric_value: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="ok", nullable=False)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    measured_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
