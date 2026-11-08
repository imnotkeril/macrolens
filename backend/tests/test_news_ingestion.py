from datetime import datetime

from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models.news import NewsItem
from app.services.news_ingestion import (
    classify_topic,
    keep_relevant,
    normalize_url,
    parse_finnhub,
    parse_gdelt,
    parse_marketaux,
    parse_rss,
    url_hash,
)

RSS = """﻿<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>Fed holds rates</title><link>https://example.org/a?utm_source=x</link>
<description>&lt;p&gt;The FOMC held the &lt;b&gt;interest rate&lt;/b&gt;.&lt;/p&gt;</description>
<pubDate>Wed, 05 Nov 2026 16:00:00 GMT</pubDate></item>
<item><title>No date</title><link>https://example.org/b</link></item>
<item><title>Bad link</title><link>not-a-url</link><pubDate>Wed, 05 Nov 2026 16:00:00 GMT</pubDate></item>
</channel></rss>"""

ATOM = """<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>CPI rises</title>
<link href="https://example.org/cpi"/><updated>2026-11-06T13:30:00-05:00</updated>
<summary>Consumer prices</summary></entry></feed>"""


def test_parse_rss_cleans_and_drops_incomplete_items():
    items = parse_rss(RSS, "fed_press")
    assert len(items) == 1
    it = items[0]
    assert it["title"] == "Fed holds rates"
    assert it["summary"] == "The FOMC held the interest rate ."
    assert it["published_at"] == datetime(2026, 11, 5, 16, 0)
    assert it["topic"] == "rates" and it["source"] == "fed_press"


def test_parse_atom_converts_timezone_to_utc():
    it = parse_rss(ATOM, "bls")[0]
    assert it["url"] == "https://example.org/cpi"
    assert it["published_at"] == datetime(2026, 11, 6, 18, 30)
    assert it["topic"] == "inflation"


def test_url_normalisation_dedups_tracking_and_case():
    a = "HTTPS://Example.org/path/?utm_source=x&id=7#frag"
    b = "https://example.org/path?id=7"
    assert normalize_url(a) == b
    assert url_hash(a) == url_hash(b)
    assert url_hash(b) != url_hash("https://example.org/path?id=8")


def test_parse_finnhub():
    rows = [
        {
            "headline": "Stocks rally",
            "url": "https://x.test/1",
            "datetime": 1793980800,
            "summary": "S&P 500 up",
            "related": "SPY",
        },
        {"headline": "", "url": "https://x.test/2", "datetime": 1793980800},
        {"headline": "No time", "url": "https://x.test/3"},
    ]
    items = parse_finnhub(rows)
    assert len(items) == 1
    assert items[0]["tickers"] == "SPY" and items[0]["topic"] == "markets"
    assert items[0]["published_at"] == datetime(2026, 11, 6, 16, 0)


def test_parse_marketaux_averages_sentiment():
    payload = {
        "data": [
            {
                "title": "Jobs report beats",
                "url": "https://x.test/m",
                "description": "Payrolls rose",
                "published_at": "2026-11-06T13:30:00.000000Z",
                "entities": [
                    {"symbol": "SPY", "sentiment_score": 0.4},
                    {"symbol": "QQQ", "sentiment_score": 0.2},
                    {"symbol": "XYZ", "sentiment_score": None},
                ],
            }
        ]
    }
    it = parse_marketaux(payload)[0]
    assert it["sentiment"] == 0.3
    assert it["tickers"] == "QQQ,SPY,XYZ"
    assert it["topic"] == "jobs"
    assert it["published_at"] == datetime(2026, 11, 6, 13, 30)


def test_parse_gdelt():
    payload = {
        "articles": [
            {"url": "https://x.test/g", "title": "Recession fears", "seendate": "20261106T133000Z"}
        ]
    }
    it = parse_gdelt(payload)[0]
    assert it["published_at"] == datetime(2026, 11, 6, 13, 30) and it["topic"] == "growth"
    assert parse_gdelt({"articles": [{"url": "u", "title": "t", "seendate": "bad"}]}) == []


def test_classify_topic_priority_and_default():
    assert classify_topic("CPI inflation cools") == "inflation"
    assert classify_topic("Powell speech") == "rates"
    assert classify_topic("Company picnic") == "other"


def test_upsert_targets_unique_url_constraint():
    stmt = (
        pg_insert(NewsItem)
        .values(
            [
                {
                    "source": "x",
                    "url_hash": "h",
                    "url": "u",
                    "title": "t",
                    "published_at": datetime(2026, 1, 1),
                }
            ]
        )
        .on_conflict_do_nothing(constraint="uq_news_url_hash")
        .returning(NewsItem.id)
    )
    sql = str(stmt.compile(dialect=postgresql.dialect()))
    assert "ON CONFLICT ON CONSTRAINT uq_news_url_hash DO NOTHING" in sql


def test_topic_uses_whole_words_not_substrings():
    assert classify_topic("Pirates attack ship near Yemen") == "other"
    assert classify_topic("Goldman Sachs names new CFO") == "other"
    assert classify_topic("Fed raises rates again") == "rates"
    assert classify_topic("Treasury yields climb") == "rates"
    assert classify_topic("Gold hits record as dollar slides") == "markets"
    assert classify_topic("Trump tariffs hit the economy") == "growth"


def test_keep_relevant_filters_only_general_news_sources():
    drafts = [{"topic": "other", "title": "a"}, {"topic": "rates", "title": "b"}]
    assert [d["title"] for d in keep_relevant("finnhub", drafts)] == ["b"]
    assert [d["title"] for d in keep_relevant("gdelt", drafts)] == ["b"]
    assert len(keep_relevant("fed_speeches", drafts)) == 2  # official sources keep everything
    assert len(keep_relevant("marketaux", drafts)) == 2
