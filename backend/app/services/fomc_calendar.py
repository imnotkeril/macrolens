"""FOMC meeting calendar parsed from federalreserve.gov (no key), with a static fallback."""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass
from datetime import date

import httpx

logger = logging.getLogger(__name__)

FOMC_CALENDAR_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"
_CACHE_TTL_S = 6 * 3600

_MONTHS = {
    m: i + 1
    for i, m in enumerate(
        [
            "january",
            "february",
            "march",
            "april",
            "may",
            "june",
            "july",
            "august",
            "september",
            "october",
            "november",
            "december",
        ]
    )
}


@dataclass(frozen=True)
class FomcMeeting:
    """`decision` is the last day of the meeting (statement day); `sep` = SEP/dot plot meeting."""

    start: date
    decision: date
    sep: bool


# Fallback when the Fed page is unreachable (decision days; SEP flags are unknown -> False).
_FALLBACK_DECISIONS = [
    date(2026, 12, 9),
    date(2027, 1, 27),
    date(2027, 3, 17),
    date(2027, 4, 28),
    date(2027, 6, 9),
    date(2027, 7, 28),
    date(2027, 9, 15),
    date(2027, 10, 27),
    date(2027, 12, 8),
]

_cache: tuple[float, list[FomcMeeting]] | None = None


def _month_num(name: str) -> int | None:
    name = name.strip().lower()
    for full, num in _MONTHS.items():
        if full.startswith(name[:3]) and (len(name) >= 3):
            return num
    return None


def parse_fomc_calendar(html: str) -> list[FomcMeeting]:
    """Parse the Fed calendar page. Each year panel lists month + 'D1-D2[*]' rows."""
    meetings: list[FomcMeeting] = []
    panels = re.split(r"(?=<h4><a[^>]*>\d{4} FOMC Meetings)", html)
    for panel in panels:
        m_year = re.match(r"<h4><a[^>]*>(\d{4}) FOMC Meetings", panel)
        if not m_year:
            continue
        year = int(m_year.group(1))
        rows = re.findall(
            r"fomc-meeting__month[^>]*><strong>([^<]+)</strong>.*?fomc-meeting__date[^>]*>([^<]+)<",
            panel,
            flags=re.S,
        )
        for month_txt, date_txt in rows:
            months = [_month_num(p) for p in re.split(r"[/\-]", month_txt) if p.strip()]
            months = [m for m in months if m]
            days = re.match(r"\s*(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s*(\*?)", date_txt)
            if not months or not days:
                continue
            d1 = int(days.group(1))
            d2 = int(days.group(2) or d1)
            sep = days.group(3) == "*"
            m1 = months[0]
            m2 = months[1] if len(months) > 1 else (m1 + 1 if d2 < d1 and m1 < 12 else m1)
            try:
                meetings.append(FomcMeeting(date(year, m1, d1), date(year, m2, d2), sep))
            except ValueError:
                continue
    return sorted(set(meetings), key=lambda x: x.decision)


def fallback_meetings() -> list[FomcMeeting]:
    # Imported lazily to keep this module import-light.
    from app.services.fed_dashboard import FOMC_DATES

    decisions = sorted({*FOMC_DATES, *_FALLBACK_DECISIONS})
    return [FomcMeeting(d, d, False) for d in decisions]


async def get_fomc_meetings() -> list[FomcMeeting]:
    """Meetings from the Fed page (cached 6h); falls back to the static list."""
    global _cache
    now = time.monotonic()
    if _cache and now - _cache[0] < _CACHE_TTL_S:
        return _cache[1]
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            resp = await client.get(
                FOMC_CALENDAR_URL, headers={"User-Agent": "macrolens/1.0 (research)"}
            )
        resp.raise_for_status()
        meetings = parse_fomc_calendar(resp.text)
        if len(meetings) >= 8:
            _cache = (now, meetings)
            return meetings
        logger.warning("Fed calendar parse returned %d meetings; using fallback", len(meetings))
    except Exception:
        logger.warning("Could not fetch Fed calendar; using fallback", exc_info=True)
    return fallback_meetings()
