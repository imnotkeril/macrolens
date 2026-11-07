"""Tiny in-process TTL cache with single-flight, for slow read-only endpoints."""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from typing import Any

_store: dict[str, tuple[float, Any]] = {}
_locks: dict[str, asyncio.Lock] = {}


def clear() -> None:
    _store.clear()
    _locks.clear()


async def cached(key: str, ttl: float, factory: Callable[[], Awaitable[Any]]) -> Any:
    """Return the cached value for `key`, computing it once per `ttl` seconds.

    Concurrent callers for the same key wait for one computation instead of piling up on the
    database. Exceptions are not cached.
    """
    now = time.monotonic()
    hit = _store.get(key)
    if hit and now - hit[0] < ttl:
        return hit[1]
    lock = _locks.setdefault(key, asyncio.Lock())
    async with lock:
        hit = _store.get(key)
        if hit and time.monotonic() - hit[0] < ttl:
            return hit[1]
        value = await factory()
        _store[key] = (time.monotonic(), value)
        return value


def fresh(key: str, ttl: float) -> Any | None:
    """Cached value if younger than `ttl`, else None (no computation)."""
    hit = _store.get(key)
    if hit and time.monotonic() - hit[0] < ttl:
        return hit[1]
    return None


def put(key: str, value: Any) -> None:
    _store[key] = (time.monotonic(), value)
