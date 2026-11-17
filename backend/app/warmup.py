"""Prime the response caches after startup, so the first visitor does not wait for cold queries.

The free Space sleeps and restarts often; every restart empties the in-process caches.
"""

from __future__ import annotations

import asyncio
import logging

import httpx
from fastapi import FastAPI

logger = logging.getLogger(__name__)

# Heaviest first: the dashboard's Macro Navigator must never be the slow, empty widget.
WARMUP_PATHS = (
    "/api/navigator/current",
    "/api/regime/current",
    "/api/navigator/signals",
    "/api/navigator/forward",
    "/api/navigator/recession-check",
    "/api/fed/current",
    "/api/indicators/kpi-bundle",
    "/api/yield-curve/current",
    "/api/yield-curve/spreads",
    "/api/yield-curve/dynamics",
    "/api/indicators/inflation-latest",
    "/api/market/cross-asset-radar",
    "/api/market/macro-overview",
    "/api/market/breadth",
    "/api/market/rates-dashboard",
    "/api/market/sectors-dashboard",
    "/api/market/currency-dashboard",
    "/api/market/sentiment-dashboard",
    "/api/market/indices-dashboard",
    "/api/indicators/inflation-dashboard",
    "/api/fed/fomc-dashboard",
    "/api/fed/dot-plot",
    "/api/regime/history",
)


async def warm_caches(app: FastAPI, delay_s: float = 5.0) -> None:
    """Request each path in-process (through the middleware stack, so responses get cached)."""
    await asyncio.sleep(delay_s)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://warmup") as client:
        for path in WARMUP_PATHS:
            try:
                r = await client.get(path, timeout=120)
                logger.info("warmup %s -> %s", path, r.status_code)
            except Exception:
                logger.warning("warmup %s failed", path, exc_info=True)
