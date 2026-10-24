"""ASGI guard: admin API key, per-IP rate limit, request body size limit."""

from __future__ import annotations

import hmac
import json
import re
import time
from collections import defaultdict, deque

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import Settings, get_settings

_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
# Mutations that are harmless for any visitor (mark an alert as read).
_OPEN_WRITE_PATHS = (re.compile(r"^/api/alerts/(\d+/read|read-all)/?$"),)
_RATE_EXEMPT = {"/api/health"}


def is_admin_request(method: str, path: str) -> bool:
    """True for state-changing calls that train models, refresh data or run LLM agents."""
    if method in _SAFE_METHODS or not path.startswith("/api/"):
        return False
    return not any(p.match(path) for p in _OPEN_WRITE_PATHS)


class _SlidingWindow:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, limit: int, now: float, window: float = 60.0) -> bool:
        q = self._hits[key]
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= limit:
            return False
        q.append(now)
        if len(self._hits) > 10_000:  # bound memory under many distinct clients
            for k in [k for k, v in self._hits.items() if not v or now - v[-1] > window]:
                self._hits.pop(k, None)
        return True


class _BodyTooLargeError(Exception):
    pass


class SecurityMiddleware:
    def __init__(self, app: ASGIApp, settings: Settings | None = None) -> None:
        self.app = app
        self._settings = settings
        self._window = _SlidingWindow()

    @property
    def settings(self) -> Settings:
        return self._settings or get_settings()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        cfg = self.settings
        method = scope["method"]
        path = scope["path"]
        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope["headers"]}
        admin = is_admin_request(method, path)

        if method != "OPTIONS" and path.startswith("/api/"):
            if cfg.rate_limit_per_minute > 0 and path not in _RATE_EXEMPT:
                client = (scope.get("client") or ("unknown", 0))[0]
                if cfg.rate_limit_trust_proxy and headers.get("x-forwarded-for"):
                    client = headers["x-forwarded-for"].split(",")[0].strip()
                now = time.monotonic()
                limit = cfg.rate_limit_admin_per_minute if admin else cfg.rate_limit_per_minute
                bucket = f"{'a' if admin else 'g'}:{client}"
                if not self._window.allow(bucket, limit, now):
                    await _json(send, 429, "Too many requests", {"retry-after": "60"})
                    return
            if admin and not cfg.allow_unauthenticated_admin:
                if not cfg.admin_api_key:
                    await _json(
                        send, 503, "Admin endpoints are disabled: ADMIN_API_KEY is not configured"
                    )
                    return
                supplied = headers.get("x-api-key", "")
                if not hmac.compare_digest(supplied.encode(), cfg.admin_api_key.encode()):
                    await _json(send, 401, "Missing or invalid API key")
                    return

        max_bytes = cfg.max_request_body_bytes
        if max_bytes > 0 and method not in _SAFE_METHODS:
            declared = headers.get("content-length")
            if declared and declared.isdigit() and int(declared) > max_bytes:
                await _json(send, 413, "Request body too large")
                return
            received = 0

            async def limited_receive() -> Message:
                nonlocal received
                message = await receive()
                if message["type"] == "http.request":
                    received += len(message.get("body", b""))
                    if received > max_bytes:
                        raise _BodyTooLargeError
                return message

            try:
                await self.app(scope, limited_receive, send)
            except _BodyTooLargeError:
                await _json(send, 413, "Request body too large")
            return

        await self.app(scope, receive, send)


async def _json(send: Send, status: int, detail: str, extra: dict[str, str] | None = None) -> None:
    body = json.dumps({"detail": detail}).encode()
    headers = [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]
    for k, v in (extra or {}).items():
        headers.append((k.encode(), v.encode()))
    await send({"type": "http.response.start", "status": status, "headers": headers})
    await send({"type": "http.response.body", "body": body})
