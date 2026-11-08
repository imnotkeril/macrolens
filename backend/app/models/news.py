from datetime import datetime

from sqlalchemy import DateTime, Float, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class NewsItem(Base):
    """One news/press item from an official feed or an aggregator (deduplicated by URL)."""

    __tablename__ = "news_items"
    __table_args__ = (
        UniqueConstraint("url_hash", name="uq_news_url_hash"),
        Index("ix_news_items_published_at", "published_at"),
        Index("ix_news_items_source", "source"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    #: fed_press | fed_speeches | bls | bea | ecb | finnhub | marketaux | gdelt
    source: Mapped[str] = mapped_column(String(30), nullable=False)
    #: sha256 of the normalised URL (dedup key across sources).
    url_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: UTC, naive.
    published_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    #: inflation | rates | jobs | growth | markets | other (keyword rule, replaced by the model later).
    topic: Mapped[str | None] = mapped_column(String(20), nullable=True)
    #: Provider-supplied sentiment in [-1, 1] (Marketaux), else None.
    sentiment: Mapped[float | None] = mapped_column(Float, nullable=True)
    #: Comma-separated related tickers (aggregators), else None.
    tickers: Mapped[str | None] = mapped_column(String(300), nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
