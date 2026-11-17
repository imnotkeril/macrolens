"""In-process cache of GET responses for read-only dashboard endpoints.

The data behind these endpoints changes once a day (nightly refresh), yet every page view
recomputed it with many sequential queries to a remote database. Responses are cached for a
few minutes and dropped when a refresh finishes (`ttl_cache.clear()`), so a page never shows
data older than the last refresh.
"""

from __future__ import annotations

import asyncio

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.services import ttl_cache

# Read-only API groups that only change when the data refresh runs.
CACHEABLE_PREFIXES = (
    "/api/market/",
    "/api/regime/",
    "/api/fed/",
    "/api/indicators",
    "/api/yield-curve/",
    "/api/navigator/",
    "/api/calendar",
    "/api/news",
    "/api/tone/",
)
TTL_SECONDS = 600.0
MAX_BODY_BYTES = 4_000_000
MAX_ENTRIES = 400  # bounds memory if clients vary query strings
_KEY_PREFIX = "http:"

_locks: dict[str, asyncio.Lock] = {}


# Have their own cache with a fallback for failures; caching their payload again would pin
# a degraded response for the whole TTL.
EXCLUDED_PATHS = frozenset({"/api/navigator/current"})


def is_cacheable(method: str, path: str) -> bool:
    return method == "GET" and path.startswith(CACHEABLE_PREFIXES) and path not in EXCLUDED_PATHS


class ResponseCacheMiddleware:
    def __init__(self, app: ASGIApp, ttl: float = TTL_SECONDS) -> None:
        self.app = app
        self.ttl = ttl

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not is_cacheable(scope["method"], scope["path"]):
            await self.app(scope, receive, send)
            return

        key = f"{_KEY_PREFIX}{scope['path']}?{scope.get('query_string', b'').decode('latin-1')}"
        hit = ttl_cache.fresh(key, self.ttl)
        if hit is None:
            # One computation per key; concurrent identical requests wait and reuse it.
            lock = _locks.setdefault(key, asyncio.Lock())
            async with lock:
                hit = ttl_cache.fresh(key, self.ttl)
                if hit is None:
                    await self._compute(scope, receive, send, key)
                    return
        await _replay(send, hit, "HIT")

    async def _compute(self, scope: Scope, receive: Receive, send: Send, key: str) -> None:
        start: Message | None = None
        chunks: list[bytes] = []
        size = 0

        async def capture(message: Message) -> None:
            nonlocal start, size
            if message["type"] == "http.response.start":
                start = message
            elif message["type"] == "http.response.body":
                body = message.get("body", b"")
                chunks.append(body)
                size += len(body)
            # Nothing is forwarded yet: the buffered response is sent once, below.

        await self.app(scope, receive, capture)
        if start is None:
            return
        entry = (start["status"], list(start.get("headers", [])), b"".join(chunks))
        if entry[0] == 200 and size <= MAX_BODY_BYTES and ttl_cache.size() < MAX_ENTRIES:
            ttl_cache.put(key, entry)
        await _replay(send, entry, "MISS")


async def _replay(send: Send, entry: tuple[int, list, bytes], state: str) -> None:
    status, headers, body = entry
    out = [(k, v) for k, v in headers if k.lower() not in (b"content-length", b"x-cache")]
    out.append((b"content-length", str(len(body)).encode()))
    out.append((b"x-cache", state.encode()))
    await send({"type": "http.response.start", "status": status, "headers": out})
    await send({"type": "http.response.body", "body": body})
