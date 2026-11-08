from datetime import datetime

from sqlalchemy import DateTime, Float, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ToneScore(Base):
    """Tone of one text unit (news item or FOMC document) from one model."""

    __tablename__ = "tone_scores"
    __table_args__ = (
        UniqueConstraint("doc_kind", "ref_id", "model", name="uq_tone_doc_ref_model"),
        Index("ix_tone_scores_ref", "doc_kind", "ref_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    #: "news" (news_items.id) | "fed_document" (fed_documents.id)
    doc_kind: Mapped[str] = mapped_column(String(20), nullable=False)
    ref_id: Mapped[int] = mapped_column(Integer, nullable=False)
    #: "finbert" (positive/negative/neutral) | "fomc-roberta" (hawkish/dovish/neutral)
    model: Mapped[str] = mapped_column(String(40), nullable=False)
    label: Mapped[str] = mapped_column(String(20), nullable=False)
    #: [-1, 1]. finbert: p(positive) - p(negative). fomc-roberta: mean p(hawkish) - p(dovish).
    score: Mapped[float] = mapped_column(Float, nullable=False)
    #: Number of sentences/units the score aggregates (1 for a headline).
    n_units: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    #: JSON: sentence counts and the most hawkish/dovish sentences (fed documents only).
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    scored_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
