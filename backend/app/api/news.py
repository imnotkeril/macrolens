from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.news import NewsItem
from app.models.tone import ToneScore

router = APIRouter()

_TOPICS = {"inflation", "rates", "jobs", "growth", "markets", "other"}


@router.get("")
async def list_news(
    limit: int = Query(50, ge=1, le=200),
    days: int = Query(7, ge=1, le=90),
    source: str | None = Query(None, max_length=30),
    topic: str | None = Query(None, max_length=20),
    db: AsyncSession = Depends(get_db),
):
    """Latest stored news, newest first, with FinBERT tone when scored. Optional filters."""
    q = (
        select(NewsItem, ToneScore.label, ToneScore.score)
        .outerjoin(
            ToneScore,
            and_(
                ToneScore.doc_kind == "news",
                ToneScore.ref_id == NewsItem.id,
                ToneScore.model == "finbert",
            ),
        )
        .where(NewsItem.published_at >= datetime.utcnow() - timedelta(days=days))
    )
    if source:
        q = q.where(NewsItem.source == source)
    if topic and topic in _TOPICS:
        q = q.where(NewsItem.topic == topic)
    rows = (await db.execute(q.order_by(desc(NewsItem.published_at)).limit(limit))).all()
    return [
        {
            "id": r.id,
            "source": r.source,
            "title": r.title,
            "summary": r.summary,
            "url": r.url,
            "published_at": r.published_at.isoformat() + "Z",
            "topic": r.topic,
            "sentiment": r.sentiment,
            "tickers": r.tickers.split(",") if r.tickers else [],
            "tone": {"label": label, "score": score} if label is not None else None,
        }
        for r, label, score in rows
    ]
