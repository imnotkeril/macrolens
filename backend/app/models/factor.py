from datetime import date, datetime

from sqlalchemy import Float, Integer, Date, DateTime, String, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FactorReturn(Base):
    """Daily factor return tracking (Growth, Value, Quality, Size, Momentum)."""
    __tablename__ = "factor_returns"
    __table_args__ = (
        UniqueConstraint("date", "factor_name", name="uq_factor_date_name"),
        Index("ix_factor_returns_date", "date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    factor_name: Mapped[str] = mapped_column(String(50), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    daily_return: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SectorPerformance(Base):
    """Sector-level performance tracking."""
    __tablename__ = "sector_performance"
    __table_args__ = (
        UniqueConstraint("date", "sector", name="uq_sector_date"),
        Index("ix_sector_performance_date", "date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    sector: Mapped[str] = mapped_column(String(50), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    daily_return: Mapped[float | None] = mapped_column(Float, nullable=True)
    relative_strength: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
