from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, Index, Integer, String, Text, UniqueConstraint
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
    #: Short excerpt from FOMC monetary policy press release (Fed RSS / HTML), when backfilled.
    fomc_signal_phrase: Mapped[str | None] = mapped_column(String(600), nullable=True)
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


class FedDocument(Base):
    """Full text of an FOMC statement or minutes (federalreserve.gov), one row per meeting+type."""

    __tablename__ = "fed_documents"
    __table_args__ = (
        UniqueConstraint("doc_type", "meeting_date", name="uq_fed_document_type_meeting"),
        Index("ix_fed_documents_meeting_date", "meeting_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    #: "statement" | "minutes"
    doc_type: Mapped[str] = mapped_column(String(20), nullable=False)
    #: Decision day (last day of the meeting).
    meeting_date: Mapped[date] = mapped_column(Date, nullable=False)
    #: Publication date (statements: decision day; minutes: ~3 weeks later).
    release_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    text_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
