"""News ingestion into `news_items`: official RSS feeds + Finnhub + Marketaux + GDELT.

Runs in the nightly refresh only (never on a page request). Every source is isolated: one
failing source (blocked, rate-limited, missing key) never stops the others. Items are
deduplicated by normalised URL, so a story seen via two sources is stored once.
"""

from __future__ import annotations

import hashlib
import html
import logging
import re
from datetime import UTC, datetime, timedelta
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from xml.etree import ElementTree as ET

import httpx
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.news import NewsItem

logger = logging.getLogger(__name__)

_HEADERS = {"User-Agent": "macrolens/1.0 (research; news ingest)"}

# Official sources: free, no key. Treasury has no working feed; IMF blocks automated clients.
RSS_FEEDS: dict[str, str] = {
    "fed_press": "https://www.federalreserve.gov/feeds/press_all.xml",
    "fed_speeches": "https://www.federalreserve.gov/feeds/speeches.xml",
    "bls": "https://www.bls.gov/feed/bls_latest.rss",
    "bea": "https://apps.bea.gov/rss/rss.xml",
    "ecb": "https://www.ecb.europa.eu/rss/press.html",
}

MARKETAUX_URL = "https://api.marketaux.com/v1/news/all"
MARKETAUX_SEARCH = '"federal reserve" | inflation | "interest rates" | recession | "jobs report"'
MARKETAUX_MAX_REQUESTS = 5  # free plan: 100 requests/day, 3 articles each
FINNHUB_URL = "https://finnhub.io/api/v1/news"
GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
GDELT_QUERY = '("federal reserve" OR inflation OR "interest rates" OR recession) sourcelang:english'

# General-news aggregators carry lots of non-economic stories; keep only those that match a topic.
RELEVANCE_FILTERED_SOURCES = ("finnhub", "gdelt")

_TRACKING_PARAMS = ("utm_", "fbclid", "gclid", "mc_", "ref")

_TOPIC_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("inflation", ("inflation", "cpi", "pce", "price index", "prices rose", "disinflation")),
    (
        "rates",
        (
            "fomc",
            "federal reserve",
            "interest rate",
            "rate cut",
            "rate hike",
            "monetary policy",
            "central bank",
            "ecb",
            "fed funds",
            "yield",
            "treasury",
            "powell",
            "lagarde",
            "the fed",
            "rates",
            "bond yields",
        ),
    ),
    ("jobs", ("jobs", "payroll", "unemployment", "employment", "labor market", "jobless")),
    (
        "growth",
        (
            "gdp",
            "recession",
            "growth",
            "retail sales",
            "pmi",
            "manufacturing",
            "housing",
            "trade in goods",
            "trade deficit",
            "economy",
            "economic",
            "tariff",
        ),
    ),
    (
        "markets",
        (
            "stocks",
            "s&p 500",
            "nasdaq",
            "dow jones",
            "wall street",
            "oil prices",
            "crude",
            "gold",
            "dollar",
            "earnings",
            "bond",
            "shares fall",
            "shares rise",
        ),
    ),
]


def normalize_url(url: str) -> str:
    """Lowercase scheme/host, drop fragment, tracking params and trailing slash."""
    parts = urlsplit(url.strip())
    query = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if not k.lower().startswith(_TRACKING_PARAMS)
    ]
    path = parts.path.rstrip("/") or "/"
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path, urlencode(query), ""))


def url_hash(url: str) -> str:
    return hashlib.sha256(normalize_url(url).encode("utf-8")).hexdigest()


# Whole-word match (optional plural) so "rates" does not fire inside "pirates"/"operates".
_TOPIC_PATTERNS = [
    (topic, re.compile(r"\b(?:" + "|".join(re.escape(w) for w in words) + r")s?\b"))
    for topic, words in _TOPIC_RULES
]


def classify_topic(title: str, summary: str | None = None) -> str:
    """Cheap keyword topic tag; the tone model replaces this later."""
    text = f"{title} {summary or ''}".lower()
    for topic, pattern in _TOPIC_PATTERNS:
        if pattern.search(text):
            return topic
    return "other"


def _clean(text: str | None, limit: int = 2000) -> str | None:
    if not text:
        return None
    text = html.unescape(re.sub(r"<[^>]+>", " ", text))
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit] or None


def _to_naive_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(UTC).replace(tzinfo=None)


def _parse_date(raw: str | None) -> datetime | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        return _to_naive_utc(parsedate_to_datetime(raw))
    except (TypeError, ValueError, OverflowError):
        pass
    try:
        return _to_naive_utc(datetime.fromisoformat(raw.replace("Z", "+00:00")))
    except ValueError:
        return None


def _local(tag: str) -> str:
    return tag.split("}", 1)[1] if "}" in tag else tag


def _child(el: ET.Element, *names: str) -> str:
    for ch in el:
        if _local(ch.tag) in names:
            if ch.text and ch.text.strip():
                return ch.text.strip()
            href = ch.attrib.get("href")  # Atom <link href="...">
            if href:
                return href
    return ""


def parse_rss(xml_text: str, source: str) -> list[dict[str, Any]]:
    """RSS 2.0 / RDF / Atom feed -> drafts. Items without title, link or date are dropped."""
    root = ET.fromstring(xml_text.lstrip("﻿").encode("utf-8"))
    out: list[dict[str, Any]] = []
    for el in root.iter():
        if _local(el.tag) not in ("item", "entry"):
            continue
        title = _clean(_child(el, "title"), 500)
        link = _child(el, "link", "id")
        published = _parse_date(_child(el, "pubDate", "date", "published", "updated"))
        if not (title and link.startswith("http") and published):
            continue
        summary = _clean(_child(el, "description", "summary", "encoded", "content"))
        out.append(_draft(source, link, title, summary, published))
    return out


def _draft(
    source: str,
    link: str,
    title: str,
    summary: str | None,
    published: datetime,
    *,
    sentiment: float | None = None,
    tickers: str | None = None,
) -> dict[str, Any]:
    return {
        "source": source,
        "url_hash": url_hash(link),
        "url": link[:1000],
        "title": title[:500],
        "summary": summary,
        "published_at": published,
        "topic": classify_topic(title, summary),
        "sentiment": sentiment,
        "tickers": tickers[:300] if tickers else None,
    }


def parse_finnhub(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for r in rows:
        title, link, ts = _clean(r.get("headline"), 500), r.get("url") or "", r.get("datetime")
        if not (title and link.startswith("http") and isinstance(ts, int | float) and ts > 0):
            continue
        published = datetime.fromtimestamp(ts, tz=UTC).replace(tzinfo=None)
        out.append(
            _draft(
                "finnhub",
                link,
                title,
                _clean(r.get("summary")),
                published,
                tickers=_clean(r.get("related"), 300),
            )
        )
    return out


def parse_marketaux(payload: dict[str, Any]) -> list[dict[str, Any]]:
    out = []
    for r in payload.get("data") or []:
        title, link = _clean(r.get("title"), 500), r.get("url") or ""
        published = _parse_date(r.get("published_at"))
        if not (title and link.startswith("http") and published):
            continue
        entities = r.get("entities") or []
        scores = [
            e["sentiment_score"]
            for e in entities
            if isinstance(e.get("sentiment_score"), int | float)
        ]
        sentiment = round(sum(scores) / len(scores), 4) if scores else None
        symbols = ",".join(sorted({e["symbol"] for e in entities if e.get("symbol")})) or None
        out.append(
            _draft(
                "marketaux",
                link,
                title,
                _clean(r.get("description") or r.get("snippet")),
                published,
                sentiment=sentiment,
                tickers=symbols,
            )
        )
    return out


def parse_gdelt(payload: dict[str, Any]) -> list[dict[str, Any]]:
    out = []
    for r in payload.get("articles") or []:
        title, link, seen = _clean(r.get("title"), 500), r.get("url") or "", r.get("seendate")
        try:
            published = datetime.strptime(str(seen), "%Y%m%dT%H%M%SZ")
        except ValueError:
            continue
        if title and link.startswith("http"):
            out.append(_draft("gdelt", link, title, None, published))
    return out


def keep_relevant(source: str, drafts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop items that matched no macro topic, for general-news sources only."""
    if source not in RELEVANCE_FILTERED_SOURCES:
        return drafts
    return [d for d in drafts if d["topic"] != "other"]


async def _fetch_rss(client: httpx.AsyncClient) -> dict[str, list[dict[str, Any]]]:
    result: dict[str, list[dict[str, Any]]] = {}
    for source, url in RSS_FEEDS.items():
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            result[source] = parse_rss(resp.content.decode("utf-8", errors="replace"), source)
        except Exception:
            logger.warning("News feed %s failed", source, exc_info=True)
    return result


async def _fetch_finnhub(client: httpx.AsyncClient, key: str) -> list[dict[str, Any]]:
    resp = await client.get(FINNHUB_URL, params={"category": "general", "token": key})
    resp.raise_for_status()
    rows = resp.json()
    return parse_finnhub(rows[:80] if isinstance(rows, list) else [])


async def _fetch_marketaux(
    client: httpx.AsyncClient, key: str, since: datetime
) -> list[dict[str, Any]]:
    drafts: list[dict[str, Any]] = []
    for page in range(1, MARKETAUX_MAX_REQUESTS + 1):
        resp = await client.get(
            MARKETAUX_URL,
            params={
                "api_token": key,
                "language": "en",
                "search": MARKETAUX_SEARCH,
                "published_after": since.strftime("%Y-%m-%dT%H:%M"),
                "limit": 3,
                "page": page,
            },
        )
        if resp.status_code in (402, 429):  # plan / daily limit reached
            logger.info("Marketaux limit reached at page %d", page)
            break
        resp.raise_for_status()
        page_items = parse_marketaux(resp.json())
        drafts.extend(page_items)
        if len(resp.json().get("data") or []) < 3:
            break
    return drafts


async def _fetch_gdelt(client: httpx.AsyncClient) -> list[dict[str, Any]]:
    resp = await client.get(
        GDELT_URL,
        params={
            "query": GDELT_QUERY,
            "mode": "artlist",
            "format": "json",
            "maxrecords": 50,
            "timespan": "1d",
        },
    )
    if resp.status_code == 429:  # GDELT allows one request per 5 s; skip rather than wait
        return []
    resp.raise_for_status()
    return parse_gdelt(resp.json())


async def collect_news(now: datetime | None = None) -> dict[str, list[dict[str, Any]]]:
    """Fetch every configured source. Returns drafts per source (failed sources are absent)."""
    settings = get_settings()
    now = now or datetime.now(UTC).replace(tzinfo=None)
    since = now - timedelta(days=2)
    result: dict[str, list[dict[str, Any]]] = {}
    async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=_HEADERS) as client:
        result.update(await _fetch_rss(client))
        if settings.finnhub_api_key:
            try:
                result["finnhub"] = await _fetch_finnhub(client, settings.finnhub_api_key)
            except Exception:
                logger.warning("Finnhub news failed", exc_info=True)
        if settings.marketaux_api_key:
            try:
                result["marketaux"] = await _fetch_marketaux(
                    client, settings.marketaux_api_key, since
                )
            except Exception:
                logger.warning("Marketaux news failed", exc_info=True)
        try:
            result["gdelt"] = await _fetch_gdelt(client)
        except Exception:
            logger.warning("GDELT news failed", exc_info=True)
    return result


async def ingest_news(db: AsyncSession, *, now: datetime | None = None) -> dict[str, int]:
    """Fetch all sources and store new items. Returns {source: newly stored count}."""
    collected = await collect_news(now)
    stored: dict[str, int] = {}
    seen: set[str] = set()
    for source, drafts in collected.items():
        drafts = keep_relevant(source, drafts)
        fresh = []
        for d in drafts:
            if d["url_hash"] in seen:
                continue
            seen.add(d["url_hash"])
            fresh.append(d)
        stored[source] = 0
        for i in range(0, len(fresh), 100):
            res = await db.execute(
                pg_insert(NewsItem)
                .values(fresh[i : i + 100])
                .on_conflict_do_nothing(constraint="uq_news_url_hash")
                .returning(NewsItem.id)
            )
            stored[source] += len(res.all())
    return stored
