"""Anthropic Claude client (sync API wrapped for async callers)."""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)


class ClaudeClient:
    def __init__(self) -> None:
        s = get_settings()
        self._api_key = (s.anthropic_api_key or "").strip()
        self._model = s.anthropic_model
        self._timeout = float(s.llm_timeout_seconds)
        self._max_retries = max(0, int(s.llm_max_retries))

    def is_configured(self) -> bool:
        return bool(self._api_key)

    @property
    def model(self) -> str:
        return self._model

    def _create_client(self) -> Any:
        from anthropic import Anthropic

        return Anthropic(api_key=self._api_key, timeout=self._timeout)

    def _blocking_complete(self, *, system: str, user: str, max_tokens: int) -> str:
        client = self._create_client()
        msg = client.messages.create(
            model=self._model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        parts: list[str] = []
        for block in msg.content:
            if hasattr(block, "text"):
                parts.append(block.text)
        return "".join(parts).strip()

    async def complete(
        self,
        *,
        system: str,
        user: str,
        max_tokens: int = 4096,
    ) -> str:
        if not self.is_configured():
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        last_err: Exception | None = None
        for attempt in range(self._max_retries + 1):
            try:
                return await asyncio.to_thread(
                    self._blocking_complete,
                    system=system,
                    user=user,
                    max_tokens=max_tokens,
                )
            except Exception as e:
                last_err = e
                logger.warning("Claude request failed attempt %s: %s", attempt + 1, e)
                if attempt < self._max_retries:
                    await asyncio.sleep(1.5 * (attempt + 1))
        raise last_err  # type: ignore[misc]
