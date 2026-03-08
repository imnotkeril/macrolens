import enum
from datetime import date, datetime

from sqlalchemy import (
    String, Float, Integer, Date, DateTime, Enum, ForeignKey, UniqueConstraint, Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class IndicatorCategory(str, enum.Enum):
    HOUSING = "housing"
    ORDERS = "orders"
    INCOME_SALES = "income_sales"
    EMPLOYMENT = "employment"
    INFLATION = "inflation"


class IndicatorType(str, enum.Enum):
    LEADING = "leading"
    COINCIDENT = "coincident"
    LAGGING = "lagging"


class Frequency(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"


class Importance(int, enum.Enum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3


class TrendDirection(str, enum.Enum):
    IMPROVING = "improving"
    NEUTRAL = "neutral"
    DETERIORATING = "deteriorating"


class Indicator(Base):
    __tablename__ = "indicators"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    fred_series_id: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    category: Mapped[IndicatorCategory] = mapped_column(Enum(IndicatorCategory), nullable=False)
    importance: Mapped[Importance] = mapped_column(Enum(Importance), nullable=False)
    indicator_type: Mapped[IndicatorType] = mapped_column(Enum(IndicatorType), nullable=False)
    frequency: Mapped[Frequency] = mapped_column(Enum(Frequency), nullable=False)
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)

    values: Mapped[list["IndicatorValue"]] = relationship(back_populates="indicator", cascade="all, delete-orphan")


class IndicatorValue(Base):
    __tablename__ = "indicator_values"
    __table_args__ = (
        UniqueConstraint("indicator_id", "date", name="uq_indicator_date"),
        Index("ix_indicator_values_date", "date"),
        Index("ix_indicator_values_indicator_date", "indicator_id", "date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    indicator_id: Mapped[int] = mapped_column(ForeignKey("indicators.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    previous: Mapped[float | None] = mapped_column(Float, nullable=True)
    forecast: Mapped[float | None] = mapped_column(Float, nullable=True)
    surprise: Mapped[float | None] = mapped_column(Float, nullable=True)
    trend: Mapped[TrendDirection | None] = mapped_column(Enum(TrendDirection), nullable=True)
    z_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    indicator: Mapped["Indicator"] = relationship(back_populates="values")
