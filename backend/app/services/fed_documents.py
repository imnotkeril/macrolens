"""FOMC statements and minutes: fetch full text from federalreserve.gov into `fed_documents`.

URLs follow fixed patterns keyed by the decision day (YYYYMMDD):
  statement  /newsevents/pressreleases/monetary{d}a.htm
  minutes    /monetarypolicy/fomcminutes{d}.htm   (published ~3 weeks after the meeting)
The meeting list and minutes release dates come from the Fed calendar page. Runs in the
nightly job only; never on a page request.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
from datetime import date, datetime, timedelta
from html.parser import HTMLParser

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fed_policy import FedDocument
from app.services.fomc_calendar import FOMC_CALENDAR_URL, parse_fomc_calendar

logger = logging.getLogger(__name__)

FED_BASE = "https://www.federalreserve.gov"
_HEADERS = {"User-Agent": "macrolens/1.0 (research)"}
_MINUTES_LAG_DAYS = 21  # minutes appear ~3 weeks after the decision
# Shorter than this means an error/stub page (statements are short, minutes are long).
_MIN_TEXT_CHARS = {"statement": 500, "minutes": 5000}
_NOISE_LINES = {"Share", "Back to Top", "Print"}


def statement_url(decision: date) -> str:
    return f"{FED_BASE}/newsevents/pressreleases/monetary{decision:%Y%m%d}a.htm"


def minutes_url(decision: date) -> str:
    return f"{FED_BASE}/monetarypolicy/fomcminutes{decision:%Y%m%d}.htm"


class _TextExtractor(HTMLParser):
    _SKIP = {"script", "style", "noscript"}
    _BLOCK = {"p", "div", "br", "li", "h1", "h2", "h3", "h4", "h5", "tr", "ul", "ol"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):  # type: ignore[no-untyped-def]
        if tag in self._SKIP:
            self._skip_depth += 1
        elif tag in self._BLOCK:
            self.parts.append("\n")

    def handle_endtag(self, tag):  # type: ignore[no-untyped-def]
        if tag in self._SKIP and self._skip_depth:
            self._skip_depth -= 1
        elif tag in self._BLOCK:
            self.parts.append("\n")

    def handle_data(self, data):  # type: ignore[no-untyped-def]
        if not self._skip_depth:
            self.parts.append(data)


def extract_article_text(page_html: str) -> str:
    """Main article text of a Fed page (from id="article" up to the 'Last Update' footer)."""
    start = page_html.find('id="article"')
    if start < 0:
        return ""
    body = page_html[start:]
    body = body[body.find(">") + 1 :]  # drop the rest of the opening <div id="article" ...> tag
    ends = [i for i in (body.find("Last Update"), body.find('class="lastUpdate"')) if i > 0]
    if ends:
        body = body[: min(ends)]
    parser = _TextExtractor()
    parser.feed(body)
    text = "".join(parser.parts).replace("\xa0", " ")
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in text.split("\n")]
    lines = [ln.removesuffix(" Return to text").strip() for ln in lines]
    return "\n".join(ln for ln in lines if ln and ln not in _NOISE_LINES)


def parse_release_dates(calendar_html: str) -> dict[date, date]:
    """Minutes release date per decision day, from '(Released Month D, YYYY)' next to the link."""
    out: dict[date, date] = {}
    for m in re.finditer(
        r"fomcminutes(\d{8})\.htm.{0,400}?\(Released ([A-Za-z]+ \d{1,2}, \d{4})\)",
        calendar_html,
        flags=re.S,
    ):
        try:
            out[datetime.strptime(m.group(1), "%Y%m%d").date()] = datetime.strptime(
                m.group(2), "%B %d, %Y"
            ).date()
        except ValueError:
            continue
    return out


async def _get(client: httpx.AsyncClient, url: str) -> str | None:
    try:
        resp = await client.get(url, headers=_HEADERS)
    except Exception:
        logger.warning("Fed document fetch failed: %s", url, exc_info=True)
        return None
    if resp.status_code != 200:
        return None
    # Fed pages are UTF-8 but httpx may guess otherwise (breaks en dashes).
    return resp.content.decode("utf-8", errors="replace")


async def ingest_fed_documents(
    db: AsyncSession, *, max_new: int = 12, today: date | None = None, pause_s: float = 0.4
) -> int:
    """Fetch statements/minutes not yet stored (newest meetings first). Returns rows written."""
    today = today or date.today()
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        cal = await _get(client, FOMC_CALENDAR_URL)
        if not cal:
            logger.warning("Fed calendar unavailable; skipping document ingest")
            return 0
        meetings = [m for m in parse_fomc_calendar(cal) if m.decision <= today]
        releases = parse_release_dates(cal)

        have = {
            (r.doc_type, r.meeting_date)
            for r in (
                await db.execute(select(FedDocument.doc_type, FedDocument.meeting_date))
            ).all()
        }
        written = 0
        for m in sorted(meetings, key=lambda x: x.decision, reverse=True):
            todo: list[tuple[str, str, date]] = []
            if ("statement", m.decision) not in have:
                todo.append(("statement", statement_url(m.decision), m.decision))
            minutes_due = releases.get(m.decision) or m.decision + timedelta(days=_MINUTES_LAG_DAYS)
            if ("minutes", m.decision) not in have and minutes_due <= today:
                todo.append(("minutes", minutes_url(m.decision), minutes_due))
            for doc_type, url, release in todo:
                if written >= max_new:
                    return written
                page = await _get(client, url)
                await asyncio.sleep(pause_s)
                text = extract_article_text(page) if page else ""
                if len(text) < _MIN_TEXT_CHARS[doc_type]:
                    continue  # not published yet, or unexpected page shape: retry next run
                await db.execute(
                    pg_insert(FedDocument)
                    .values(
                        doc_type=doc_type,
                        meeting_date=m.decision,
                        release_date=release,
                        url=url,
                        title=f"FOMC {doc_type} {m.decision.isoformat()}",
                        text=text,
                        text_sha256=hashlib.sha256(text.encode("utf-8")).hexdigest(),
                    )
                    .on_conflict_do_nothing(constraint="uq_fed_document_type_meeting")
                )
                written += 1
        return written
