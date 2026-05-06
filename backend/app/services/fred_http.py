"""Async FRED v2 series/observations helper (avoids blocking FredClient in request paths)."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

FRED_OBS_URL = "https://api.stlouisfed.org/fred/series/observations"


async def fred_observations(
    series_id: str,
    *,
    api_key: str,
    limit: int = 24,
    sort_order: str = "desc",
    observation_start: str | None = None,
    timeout: float = 25.0,
) -> list[dict[str, Any]]:
    if not api_key:
        return []
    params: dict[str, str | int] = {
        "series_id": series_id,
        "api_key": api_key,
        "file_type": "json",
        "sort_order": sort_order,
        "limit": limit,
    }
    if observation_start:
        params["observation_start"] = observation_start
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(FRED_OBS_URL, params=params)
            if r.status_code == 429:
                await asyncio.sleep(2.5)
                r = await client.get(FRED_OBS_URL, params=params)
            r.raise_for_status()
            data = r.json()
    except Exception:
        logger.exception("FRED observations fetch failed for %s", series_id)
        return []
    obs = data.get("observations") or []
    out: list[dict[str, Any]] = []
    for row in obs:
        v = row.get("value")
        if v in (".", None, ""):
            continue
        try:
            float(v)
        except (TypeError, ValueError):
            continue
        out.append(row)
    return out


async def fred_latest_value(
    series_id: str,
    *,
    api_key: str,
) -> tuple[str, float] | None:
    rows = await fred_observations(series_id, api_key=api_key, limit=5, sort_order="desc")
    if not rows:
        return None
    d = rows[0].get("date")
    v = rows[0].get("value")
    if not d or v in (".", None):
        return None
    return str(d), float(v)
