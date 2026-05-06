"""
FOMC monetary policy press material via Federal Reserve RSS.

We store a short plain-text excerpt on `fed_rates.fomc_signal_phrase` for decision dates.
"""

from __future__ import annotations

import html
import logging
import re
import xml.etree.ElementTree as ET
from datetime import date

import httpx
from sqlalchemy import select, desc, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fed_policy import FedRate
from app.services.fed_rate_schema import apply_fed_rate_load_columns, fed_rates_has_signal_phrase_column

logger = logging.getLogger(__name__)

FED_MONETARY_RSS = "https://www.federalreserve.gov/feeds/press_monetary.xml"


def _strip_html(s: str) -> str:
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:560]


async def _fetch_rss_items() -> list[tuple[date, str, str]]:
    """Return (approx decision date, title, excerpt)."""
    try:
        async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
            r = await client.get(
                FED_MONETARY_RSS,
                headers={"User-Agent": "macrolens/1.0 (research; contact: dev)"},
            )
            r.raise_for_status()
            text = r.text
    except Exception:
        logger.info("Fed monetary RSS fetch failed", exc_info=True)
        return []

    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        logger.warning("Fed RSS parse error")
        return []

    ns = {"atom": "http://www.w3.org/2005/Atom"}
    items: list[tuple[date, str, str]] = []
    for item in root.findall(".//item"):
        title_el = item.find("title")
        desc_el = item.find("description")
        pub_el = item.find("pubDate")
        title = (title_el.text or "").strip() if title_el is not None else ""
        desc = _strip_html(desc_el.text or "") if desc_el is not None else ""
        pub_raw = (pub_el.text or "").strip() if pub_el is not None else ""
        # RFC822 dates — parse loosely via first token
        try:
            from email.utils import parsedate_to_datetime

            dt = parsedate_to_datetime(pub_raw).date()
        except Exception:
            dt = date.today()
        items.append((dt, title, desc or title))
    return items


def _match_excerpt_for_rate_date(rate_date: date, rss: list[tuple[date, str, str]]) -> str | None:
    best: tuple[int, str] | None = None
    for pub_dt, title, excerpt in rss:
        delta = abs((pub_dt - rate_date).days)
        if delta > 6:
            continue
        score = delta * 10 + (0 if "statement" in title.lower() or "release" in title.lower() else 3)
        if best is None or score < best[0]:
            best = (score, excerpt)
    return best[1] if best else None


async def backfill_fomc_signal_phrases(db: AsyncSession, *, max_updates: int = 8) -> int:
    """
    Fill `fomc_signal_phrase` for recent `FedRate` rows where target changed vs previous row.
    """
    if not await fed_rates_has_signal_phrase_column(db):
        return 0

    rss = await _fetch_rss_items()
    if not rss:
        return 0

    q = await apply_fed_rate_load_columns(
        db, select(FedRate).order_by(desc(FedRate.date)).limit(400)
    )
    res = await db.execute(q)
    rows = list(res.scalars().all())
    if len(rows) < 2:
        return 0

    updates = 0
    for i in range(len(rows) - 1):
        if updates >= max_updates:
            break
        cur = rows[i]
        prev = rows[i + 1]
        if cur.target_upper == prev.target_upper and cur.target_lower == prev.target_lower:
            continue
        if cur.fomc_signal_phrase:
            continue
        excerpt = _match_excerpt_for_rate_date(cur.date, rss)
        if not excerpt:
            continue
        await db.execute(
            update(FedRate)
            .where(FedRate.id == cur.id)
            .values(fomc_signal_phrase=excerpt)
        )
        updates += 1
    return updates
