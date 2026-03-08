from datetime import date, datetime

from sqlalchemy import Float, Integer, Date, DateTime, String, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class YieldData(Base):
    """Treasury yield curve data points."""
    __tablename__ = "yield_data"
    __table_args__ = (
        UniqueConstraint("date", "maturity", name="uq_yield_date_maturity"),
        Index("ix_yield_data_date", "date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    maturity: Mapped[str] = mapped_column(String(10), nullable=False)  # 3M, 2Y, 5Y, 10Y, 30Y
    nominal_yield: Mapped[float] = mapped_column(Float, nullable=False)
    tips_yield: Mapped[float | None] = mapped_column(Float, nullable=True)
    breakeven: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class MarketData(Base):
    """Cross-asset market data (DXY, Gold, Copper, VIX, etc.)."""
    __tablename__ = "market_data"
    __table_args__ = (
        UniqueConstraint("date", "symbol", name="uq_market_date_symbol"),
        Index("ix_market_data_date", "date"),
        Index("ix_market_data_symbol", "symbol"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    symbol: Mapped[str] = mapped_column(String(30), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    change_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
