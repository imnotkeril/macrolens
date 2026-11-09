"""Tone scoring of news and FOMC documents with small pretrained classifiers (no training).

  finbert        ProsusAI/finbert (CC BY-NC-SA 4.0): positive/negative/neutral, for headlines.
  fomc-roberta   gtfintechlab/FOMC-RoBERTa (CC BY-NC 4.0, gated): hawkish/dovish/neutral, for
                 FOMC statements and minutes, scored per sentence and averaged.

Both licences are non-commercial: fine for a personal project, not for a paid product.
Runs in the nightly refresh only, behind a time budget, newest items first, so a backlog drains
over several nights and a missing/gated model never blocks the rest. `torch`/`transformers`
are imported lazily (not installed in CI); tests inject fake classifiers.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from collections.abc import Callable
from typing import Any, Protocol

from sqlalchemy import exists, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.fed_policy import FedDocument
from app.models.news import NewsItem
from app.models.tone import ToneScore

logger = logging.getLogger(__name__)

FINBERT_ID = "ProsusAI/finbert"
FOMC_ID = "gtfintechlab/FOMC-RoBERTa"
FINBERT = "finbert"
FOMC = "fomc-roberta"

# FOMC-RoBERTa config uses generic LABEL_n names; documented order of the model card.
_FOMC_ID2LABEL = {0: "dovish", 1: "hawkish", 2: "neutral"}
_LABEL_THRESHOLD = 0.10
_MAX_SENTENCES_PER_DOC = 500
_BATCH = 16

_SANITY_HAWKISH = (
    "The Committee decided to raise the target range to curb persistent inflation pressures."
)
_SANITY_DOVISH = (
    "The Committee decided to lower the target range to support a weakening labor market."
)


class Classifier(Protocol):
    def classify(self, texts: list[str]) -> list[dict[str, float]]:
        """One {label: probability} dict per text."""
        ...


class HfClassifier:
    """Sequence-classification model on CPU; loaded on first use."""

    def __init__(self, model_id: str, *, max_length: int, token: str | None = None) -> None:
        self.model_id = model_id
        self.max_length = max_length
        self.token = token or None
        self._tok: Any = None
        self._model: Any = None
        self._labels: dict[int, str] = {}

    def _load(self) -> None:
        if self._model is not None:
            return
        import torch  # noqa: F401 - lazy: heavy, not installed in CI
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        self._tok = AutoTokenizer.from_pretrained(self.model_id, token=self.token)
        self._model = AutoModelForSequenceClassification.from_pretrained(
            self.model_id, token=self.token
        )
        self._model.eval()
        self._labels = normalise_labels(self._model.config.id2label)

    def classify(self, texts: list[str]) -> list[dict[str, float]]:
        import torch

        self._load()
        out: list[dict[str, float]] = []
        for i in range(0, len(texts), _BATCH):
            batch = texts[i : i + _BATCH]
            enc = self._tok(
                batch,
                padding=True,
                truncation=True,
                max_length=self.max_length,
                return_tensors="pt",
            )
            with torch.no_grad():
                probs = torch.softmax(self._model(**enc).logits, dim=-1).tolist()
            out.extend({self._labels[j]: p for j, p in enumerate(row)} for row in probs)
        return out


def normalise_labels(id2label: dict[Any, str]) -> dict[int, str]:
    """Lower-case label names; generic LABEL_n names fall back to the FOMC-RoBERTa order."""
    labels: dict[int, str] = {}
    for k, v in id2label.items():
        idx = int(k)
        name = str(v).strip().lower()
        labels[idx] = _FOMC_ID2LABEL.get(idx, name) if name.startswith("label_") else name
    return labels


# --------------------------------------------------------------------------- pure helpers


def split_sentences(text: str, *, max_sentences: int = _MAX_SENTENCES_PER_DOC) -> list[str]:
    """Sentences of 6-70 words from a plain-text document (boilerplate lines dropped)."""
    sentences: list[str] = []
    for line in text.split("\n"):
        line = line.strip()
        if not line or line.lower() in {"return to text", "back to top"}:
            continue
        for s in re.split(r"(?<=[.!?])\s+(?=[A-Z])", line):
            if 6 <= len(s.split()) <= 70:
                sentences.append(s.strip())
                if len(sentences) >= max_sentences:
                    return sentences
    return sentences


def label_for_score(score: float) -> str:
    if score > _LABEL_THRESHOLD:
        return "hawkish"
    if score < -_LABEL_THRESHOLD:
        return "dovish"
    return "neutral"


def aggregate_fomc(sentences: list[str], probs: list[dict[str, float]]) -> dict[str, Any]:
    """Mean (p_hawkish - p_dovish) over sentences, with counts and the strongest sentences."""
    if not sentences or len(sentences) != len(probs):
        raise ValueError("sentences and probabilities must be non-empty and the same length")
    diffs = [p.get("hawkish", 0.0) - p.get("dovish", 0.0) for p in probs]
    counts = {"hawkish": 0, "dovish": 0, "neutral": 0}
    for p in probs:
        counts[max(counts, key=lambda k: p.get(k, 0.0))] += 1
    ranked = sorted(range(len(diffs)), key=lambda i: diffs[i])
    score = sum(diffs) / len(diffs)
    return {
        "label": label_for_score(score),
        "score": round(score, 4),
        "n_units": len(sentences),
        "detail": {
            **counts,
            "top_hawkish": [sentences[i][:300] for i in ranked[::-1][:3] if diffs[i] > 0],
            "top_dovish": [sentences[i][:300] for i in ranked[:3] if diffs[i] < 0],
        },
    }


def finbert_result(probs: dict[str, float]) -> dict[str, Any]:
    score = probs.get("positive", 0.0) - probs.get("negative", 0.0)
    return {
        "label": max(("positive", "negative", "neutral"), key=lambda k: probs.get(k, 0.0)),
        "score": round(score, 4),
        "n_units": 1,
        "detail": None,
    }


def news_text(title: str, summary: str | None) -> str:
    return f"{title}. {summary[:300]}" if summary else title


def fomc_sanity_ok(clf: Classifier) -> bool:
    """The model must call a clear tightening sentence hawkish and an easing one dovish."""
    hawk, dove = clf.classify([_SANITY_HAWKISH, _SANITY_DOVISH])
    return hawk.get("hawkish", 0) > hawk.get("dovish", 0) and dove.get("dovish", 0) > dove.get(
        "hawkish", 0
    )


# --------------------------------------------------------------------------- persistence


async def _save(db: AsyncSession, kind: str, ref_id: int, model: str, res: dict[str, Any]) -> None:
    await db.execute(
        pg_insert(ToneScore)
        .values(
            doc_kind=kind,
            ref_id=ref_id,
            model=model,
            label=res["label"],
            score=res["score"],
            n_units=res["n_units"],
            detail=json.dumps(res["detail"]) if res["detail"] else None,
        )
        .on_conflict_do_nothing(constraint="uq_tone_doc_ref_model")
    )


def _unscored(kind: str, model: str, id_col: Any) -> Any:
    return ~exists().where(
        ToneScore.doc_kind == kind, ToneScore.model == model, ToneScore.ref_id == id_col
    )


async def score_pending(
    db: AsyncSession,
    *,
    finbert: Classifier | None = None,
    fomc: Classifier | None = None,
    budget_s: float | None = None,
    max_news: int = 200,
    max_docs: int = 12,
    clock: Callable[[], float] = time.monotonic,
) -> dict[str, int]:
    """Score unscored news (FinBERT) and FOMC documents (FOMC-RoBERTa), newest first.

    Stops when the time budget is spent. A classifier that cannot load is skipped.
    """
    settings = get_settings()
    budget = settings.tone_budget_seconds if budget_s is None else budget_s
    deadline = clock() + budget
    done = {"news": 0, "fed_documents": 0}
    token = settings.hf_token or None

    # --- news headlines
    try:
        finbert = finbert or HfClassifier(FINBERT_ID, max_length=128, token=token)
        rows = (
            await db.execute(
                select(NewsItem.id, NewsItem.title, NewsItem.summary)
                .where(_unscored("news", FINBERT, NewsItem.id))
                .order_by(NewsItem.published_at.desc())
                .limit(max_news)
            )
        ).all()
        for i in range(0, len(rows), 32):
            if clock() > deadline:
                break
            chunk = rows[i : i + 32]
            probs = await asyncio.to_thread(
                finbert.classify, [news_text(r.title, r.summary) for r in chunk]
            )
            for r, p in zip(chunk, probs, strict=True):
                await _save(db, "news", r.id, FINBERT, finbert_result(p))
            await db.commit()
            done["news"] += len(chunk)
    except Exception:
        await db.rollback()
        logger.exception("FinBERT news scoring failed")

    # --- FOMC statements and minutes
    try:
        fomc = fomc or HfClassifier(FOMC_ID, max_length=160, token=token)
        docs = (
            await db.execute(
                select(FedDocument.id, FedDocument.text, FedDocument.meeting_date)
                .where(_unscored("fed_document", FOMC, FedDocument.id))
                .order_by(FedDocument.meeting_date.desc(), FedDocument.doc_type.desc())
                .limit(max_docs)
            )
        ).all()
        if docs and not await asyncio.to_thread(fomc_sanity_ok, fomc):
            logger.error("FOMC-RoBERTa sanity check failed; label mapping may be wrong: skipping")
            docs = []
        for d in docs:
            if clock() > deadline:
                break
            sentences = split_sentences(d.text)
            if not sentences:
                continue
            probs = await asyncio.to_thread(fomc.classify, sentences)
            await _save(db, "fed_document", d.id, FOMC, aggregate_fomc(sentences, probs))
            await db.commit()
            done["fed_documents"] += 1
    except Exception:
        await db.rollback()
        logger.exception("FOMC-RoBERTa scoring failed (gated model access or missing HF_TOKEN?)")

    return done
