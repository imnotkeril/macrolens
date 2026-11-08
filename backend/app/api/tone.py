import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.fed_policy import FedDocument
from app.models.tone import ToneScore

router = APIRouter()


@router.get("/fed")
async def fed_tone(
    limit: int = Query(40, ge=1, le=200),
    doc_type: str | None = Query(None, pattern="^(statement|minutes)$"),
    db: AsyncSession = Depends(get_db),
):
    """Hawkish/dovish tone of FOMC statements and minutes (FOMC-RoBERTa), newest meeting first.

    `score` is the mean per-sentence p(hawkish) - p(dovish) in [-1, 1].
    """
    q = (
        select(FedDocument, ToneScore)
        .join(
            ToneScore,
            and_(
                ToneScore.doc_kind == "fed_document",
                ToneScore.ref_id == FedDocument.id,
                ToneScore.model == "fomc-roberta",
            ),
        )
        .order_by(desc(FedDocument.meeting_date), desc(FedDocument.doc_type))
        .limit(limit)
    )
    if doc_type:
        q = q.where(FedDocument.doc_type == doc_type)
    rows = (await db.execute(q)).all()
    return [
        {
            "meeting_date": doc.meeting_date.isoformat(),
            "doc_type": doc.doc_type,
            "url": doc.url,
            "label": tone.label,
            "score": tone.score,
            "n_sentences": tone.n_units,
            "detail": json.loads(tone.detail) if tone.detail else None,
        }
        for doc, tone in rows
    ]
