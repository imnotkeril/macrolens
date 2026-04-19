"""Ingest Federal Reserve press releases from the public RSS feed into memory_core (fed_cb domain)."""
from __future__ import annotations

import hashlib
import logging
import re
from datetime import date, datetime, time, timezone
from email.utils import parsedate_to_datetime
from typing import Any
from xml.etree import ElementTree as ET

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.memory_service import MemoryService

logger = logging.getLogger(__name__)

FED_PRESS_RSS_URL = "https://www.federalreserve.gov/feeds/press_all.xml"


def _strip_ns(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def _child_text(parent: ET.Element, name: str) -> str:
    for ch in parent:
        if _strip_ns(ch.tag) == name:
            t = (ch.text or "").strip()
            if t:
                return t
    return ""


def _parse_pub_date(s: str) -> datetime | None:
    s = (s or "").strip()
    if not s:
        return None
    try:
        dt = parsedate_to_datetime(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (TypeError, ValueError, OverflowError):
        pass
    for fmt in ("%a, %d %b %Y %H:%M:%S %z", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(s[:32], fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    return None


async def ingest_fed_press_rss(
    db: AsyncSession,
    *,
    as_of: date,
    max_items: int = 40,
    source_version: str = "fed-rss-v1",
) -> int:
    """
    Fetch RSS and upsert recent items with ``published_at <= end of as_of`` (PIT-friendly).
    Returns number of documents written/updated.
    """
    memory = MemoryService()
    as_of_end = datetime.combine(as_of, time(23, 59, 59), tzinfo=timezone.utc)
    headers = {"User-Agent": "MacroLens/1.0 (+https://github.com) research bot"}
    try:
        async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client:
            resp = await client.get(FED_PRESS_RSS_URL, headers=headers)
            resp.raise_for_status()
            xml_text = resp.text
    except Exception as e:
        logger.warning("Fed RSS fetch failed: %s", e)
        return 0

    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        logger.warning("Fed RSS parse error: %s", e)
        return 0

    channel = root
    if _strip_ns(root.tag) == "rss":
        for ch in root:
            if _strip_ns(ch.tag) == "channel":
                channel = ch
                break

    items: list[dict[str, Any]] = []
    for el in channel:
        if _strip_ns(el.tag) != "item":
            continue
        title = _child_text(el, "title")
        link = _child_text(el, "link")
        pub = _child_text(el, "pubDate")
        desc = _child_text(el, "description")
        if not title or not link:
            continue
        pdt = _parse_pub_date(pub)
        if pdt and pdt > as_of_end:
            continue
        items.append(
            {
                "title": title,
                "link": link,
                "pubDate": pub,
                "description": desc[:4000] if desc else "",
                "published_at": pdt.isoformat() if pdt else None,
            }
        )

    items.sort(key=lambda x: x.get("published_at") or "", reverse=True)
    written = 0
    for it in items[:max_items]:
        link = it["link"]
        h = hashlib.sha256(link.encode("utf-8")).hexdigest()[:20]
        doc_key = f"fed-press:{h}"
        body = f"{it['title']}\nURL: {link}\nDate: {it.get('pubDate','')}\n\n{it.get('description','')}"
        body = re.sub(r"\s+", " ", body).strip()[:12000]
        await memory.upsert_document(
            db,
            source="fed_cb",
            doc_key=doc_key,
            title=it["title"][:240],
            content=body,
            metadata={
                "quality_score": 0.95,
                "source_version": source_version,
                "source_url": link,
                "published_at": it.get("published_at"),
                "as_of_date": as_of.isoformat(),
            },
            tags=["fed", "press", "rss"],
        )
        written += 1
    if written:
        logger.info("Fed press RSS ingested %s documents (as_of=%s)", written, as_of)
    return written
