import pytest
from sqlalchemy import select
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models.news import NewsItem
from app.models.tone import ToneScore
from app.services.tone_scoring import (
    _unscored,
    aggregate_fomc,
    finbert_result,
    fomc_sanity_ok,
    label_for_score,
    news_text,
    normalise_labels,
    split_sentences,
)


def test_normalise_labels_generic_names_use_fomc_order():
    assert normalise_labels({0: "LABEL_0", 1: "LABEL_1", 2: "LABEL_2"}) == {
        0: "dovish",
        1: "hawkish",
        2: "neutral",
    }
    assert normalise_labels({"0": "positive", "1": "Negative"}) == {0: "positive", 1: "negative"}


def test_split_sentences_filters_length_and_boilerplate():
    text = (
        "Return to text\n"
        "Too short.\n"
        "Participants noted that inflation remained elevated. Some participants favored holding the policy rate steady.\n"
        "Back to Top"
    )
    assert split_sentences(text) == [
        "Participants noted that inflation remained elevated.",
        "Some participants favored holding the policy rate steady.",
    ]
    assert (
        len(split_sentences("A long enough sentence is right here.\n" * 10, max_sentences=3)) == 3
    )


def test_aggregate_fomc_hand_computed():
    sentences = [
        "h one two three four five",
        "d one two three four five",
        "n one two three four five",
    ]
    probs = [
        {"hawkish": 0.8, "dovish": 0.1, "neutral": 0.1},  # +0.7
        {"hawkish": 0.1, "dovish": 0.7, "neutral": 0.2},  # -0.6
        {"hawkish": 0.1, "dovish": 0.1, "neutral": 0.8},  #  0.0
    ]
    res = aggregate_fomc(sentences, probs)
    assert res["score"] == pytest.approx(0.0333, abs=1e-4)  # (0.7 - 0.6 + 0) / 3
    assert res["label"] == "neutral"  # inside the +-0.10 band
    assert res["n_units"] == 3
    d = res["detail"]
    assert (d["hawkish"], d["dovish"], d["neutral"]) == (1, 1, 1)
    assert d["top_hawkish"] == [sentences[0]] and d["top_dovish"] == [sentences[1]]


def test_aggregate_fomc_rejects_mismatch():
    with pytest.raises(ValueError):
        aggregate_fomc(["only one sentence here ok"], [])


def test_label_thresholds():
    assert label_for_score(0.25) == "hawkish"
    assert label_for_score(-0.25) == "dovish"
    assert label_for_score(0.05) == "neutral"


def test_finbert_result_and_news_text():
    res = finbert_result({"positive": 0.7, "negative": 0.1, "neutral": 0.2})
    assert res == {"label": "positive", "score": 0.6, "n_units": 1, "detail": None}
    assert news_text("Title", None) == "Title"
    assert news_text("Title", "x" * 500) == "Title. " + "x" * 300


class FakeFomc:
    def __init__(self, flipped: bool = False) -> None:
        self.flipped = flipped

    def classify(self, texts):
        out = []
        for t in texts:
            hawk = "raise" in t
            p = {"hawkish": 0.9, "dovish": 0.05, "neutral": 0.05}
            q = {"hawkish": 0.05, "dovish": 0.9, "neutral": 0.05}
            out.append((q if hawk else p) if self.flipped else (p if hawk else q))
        return out


def test_sanity_check_catches_swapped_label_mapping():
    assert fomc_sanity_ok(FakeFomc()) is True
    assert fomc_sanity_ok(FakeFomc(flipped=True)) is False


def test_sql_shapes_for_pending_and_upsert():
    pending = select(NewsItem.id).where(_unscored("news", "finbert", NewsItem.id))
    sql = str(pending.compile(dialect=postgresql.dialect()))
    assert "NOT (EXISTS" in sql and "tone_scores" in sql
    upsert = (
        pg_insert(ToneScore)
        .values(doc_kind="news", ref_id=1, model="finbert", label="neutral", score=0.0, n_units=1)
        .on_conflict_do_nothing(constraint="uq_tone_doc_ref_model")
    )
    assert "ON CONFLICT ON CONSTRAINT uq_tone_doc_ref_model" in str(
        upsert.compile(dialect=postgresql.dialect())
    )
