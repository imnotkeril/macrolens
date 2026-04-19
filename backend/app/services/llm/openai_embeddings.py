"""OpenAI text embedding client (sync API wrapped for async callers)."""
from __future__ import annotations

import asyncio
import logging
from typing import Sequence

from app.config import get_settings

logger = logging.getLogger(__name__)


class OpenAIEmbeddingClient:
    def __init__(self) -> None:
        s = get_settings()
        self._api_key = (s.openai_api_key or "").strip()
        self._model = s.openai_embedding_model
        self._timeout = float(s.embedding_timeout_seconds)

    def is_configured(self) -> bool:
        return bool(self._api_key)

    def _blocking_embed(self, texts: Sequence[str]) -> list[list[float]]:
        from openai import OpenAI

        client = OpenAI(api_key=self._api_key, timeout=self._timeout)
        resp = client.embeddings.create(model=self._model, input=list(texts))
        out: list[list[float]] = []
        for item in sorted(resp.data, key=lambda x: x.index):
            out.append(list(item.embedding))
        return out

    async def embed_one(self, text: str) -> list[float]:
        vecs = await self.embed_batch([text])
        return vecs[0]

    async def embed_batch(self, texts: Sequence[str]) -> list[list[float]]:
        if not self.is_configured():
            raise RuntimeError("OPENAI_API_KEY is not set")
        if not texts:
            return []
        try:
            return await asyncio.to_thread(self._blocking_embed, texts)
        except Exception as e:
            logger.exception("OpenAI embedding failed: %s", e)
            raise
