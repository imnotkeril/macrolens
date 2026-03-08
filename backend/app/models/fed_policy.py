from datetime import date, datetime

from sqlalchemy import Float, Integer, Date, DateTime, String, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FedRate(Base):
    __tablename__ = "fed_rates"
    __table_args__ = (Index("ix_fed_rates_date", "date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, unique=True)
    target_upper: Mapped[float] = mapped_column(Float, nullable=False)
    target_lower: Mapped[float] = mapped_column(Float, nullable=False)
    effr: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class BalanceSheet(Base):
    __tablename__ = "balance_sheet"
    __table_args__ = (Index("ix_balance_sheet_date", "date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, unique=True)
    total_assets: Mapped[float] = mapped_column(Float, nullable=False)
    treasuries: Mapped[float | None] = mapped_column(Float, nullable=True)
    mbs: Mapped[float | None] = mapped_column(Float, nullable=True)
    reserves: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
