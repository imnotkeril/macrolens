"""
CME FedWatch Tool REST (see CME Group Client Systems Wiki).

Intraday: `https://markets.api.cmegroup.com/fedwatch_rt/v1`
Optional Bearer: `CME_FEDWATCH_BEARER_TOKEN` (end-of-day API may require OAuth).

`current_mid` (effective fed funds mid, %) is required to bucket `rateRange[]` rows
into hold / 25bp cut / 50bp+ cut / hike for our FomcMeetingProb schema.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

CME_HEADERS_BASE = {
    "Accept": "application/json",
    "User-Agent": "macrolens-fedwatch/1.0",
    "CME-Application-Name": "macrolens",
    "CME-Application-Vendor": "macrolens",
    "CME-Application-Version": "1",
}


def _cme_meta_headers(token: str | None) -> dict[str, str]:
    h = {
        **CME_HEADERS_BASE,
        "CME-Request-ID": str(uuid.uuid4()),
        "CME-Transact-Time": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def _coalesce_blocks(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        for k in ("elements", "data", "forecasts"):
            v = payload.get(k)
            if isinstance(v, list):
                return [x for x in v if isinstance(x, dict)]
        return [payload]
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    return []


def _format_fomc_label(meeting_dt: str) -> str:
    try:
        y, m, d = meeting_dt.split("-")[:3]
        from datetime import date as ddate

        dt = ddate(int(y), int(m), int(d))
    except Exception:
        return meeting_dt
    months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
    return f"{months[dt.month - 1]} {dt.day}, {dt.year}"


def cme_element_to_meeting_row(el: dict[str, Any], current_mid: float) -> dict[str, Any] | None:
    mdt = (
        el.get("meetingDt")
        or el.get("meetingDate")
        or el.get("fomcMeetingDate")
        or el.get("meeting_dt")
    )
    if not mdt:
        return None
    ranges = el.get("rateRange") or el.get("rateRanges") or []
    if isinstance(ranges, dict):
        ranges = [ranges]
    if not isinstance(ranges, list) or not ranges:
        return None

    hold = cut25 = cut50 = hike = 0.0
    for rr in ranges:
        if not isinstance(rr, dict):
            continue
        lo_raw = rr.get("lowerRt") if "lowerRt" in rr else rr.get("lower")
        hi_raw = rr.get("upperRt") if "upperRt" in rr else rr.get("upper")
        praw = rr.get("probability") if "probability" in rr else rr.get("prob")
        if lo_raw is None or hi_raw is None:
            continue
        try:
            lo_bp = float(lo_raw)
            hi_bp = float(hi_raw)
            p = float(praw or 0)
        except (TypeError, ValueError):
            continue
        if p <= 0:
            continue
        # CME docs: basis points of the target band (e.g. 350–375 for 3.50–3.75%).
        lo = lo_bp / 100.0
        hi = hi_bp / 100.0
        mid = (lo + hi) / 2.0
        width = hi - lo

        if mid > current_mid + 0.02:
            hike += p
        elif mid < current_mid - 0.02:
            if width >= 0.45:
                cut50 += p
            else:
                cut25 += p
        else:
            hold += p

    total = hold + cut25 + cut50 + hike
    if total <= 0:
        return None
    hold_i = int(round(hold * 100 / total))
    c25_i = int(round(cut25 * 100 / total))
    c50_i = int(round(cut50 * 100 / total))
    hk_i = int(round(hike * 100 / total))
    diff = 100 - (hold_i + c25_i + c50_i + hk_i)
    hold_i = max(0, min(100, hold_i + diff))

    outcome, ot = "Hold", "hold"
    if hk_i >= c25_i + c50_i and hk_i >= hold_i:
        outcome, ot = "+25bps", "hike"
    elif c25_i + c50_i >= hold_i and (c25_i + c50_i) > 0:
        outcome, ot = "−25bps", "cut"

    return {
        "date": _format_fomc_label(str(mdt)),
        "hold_pct": hold_i,
        "cut25_pct": c25_i,
        "cut50_pct": c50_i,
        "hike_pct": hk_i,
        "outcome": outcome,
        "outcome_type": ot,
    }


async def fetch_fedwatch_meetings_cme(current_mid: float | None) -> list[dict[str, Any]] | None:
    if current_mid is None or current_mid <= 0:
        return None

    settings = get_settings()
    base = settings.cme_fedwatch_rt_base.rstrip("/")
    token = (settings.cme_fedwatch_bearer_token or "").strip() or None
    headers = _cme_meta_headers(token)

    for path in ("/forecasts/latest", "/forecasts?limit=8"):
        url = f"{base}{path}"
        try:
            async with httpx.AsyncClient(timeout=22.0) as client:
                r = await client.get(url, headers=headers)
            if r.status_code in (401, 403, 404):
                continue
            r.raise_for_status()
            payload = r.json()
        except Exception:
            logger.info("CME FedWatch request failed url=%s", url, exc_info=True)
            continue

        rows: list[dict[str, Any]] = []
        for el in _coalesce_blocks(payload):
            row = cme_element_to_meeting_row(el, float(current_mid))
            if row:
                rows.append(row)
        if rows:
            return rows[:8]

    return None
