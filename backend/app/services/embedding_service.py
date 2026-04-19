from __future__ import annotations

import logging
import math

from app.config import get_settings
from app.services.llm.openai_embeddings import OpenAIEmbeddingClient

logger = logging.getLogger(__name__)


class EmbeddingService:
    def __init__(self, dim: int | None = None):
        settings = get_settings()
        self.dim = dim if dim is not None else settings.memory_embedding_dim
        self._settings = settings
        self._openai_client: OpenAIEmbeddingClient | None = None

    def _client(self) -> OpenAIEmbeddingClient:
        if self._openai_client is None:
            self._openai_client = OpenAIEmbeddingClient()
        return self._openai_client

    def effective_backend(self) -> str:
        b = (self._settings.memory_embedding_backend or "auto").strip().lower()
        if b == "auto":
            return "openai" if self._client().is_configured() else "hash"
        if b == "openai" and not self._client().is_configured():
            logger.warning("memory_embedding_backend=openai but OPENAI_API_KEY missing; using hash")
            return "hash"
        return b

    def embedding_model_key(self) -> str:
        if self.effective_backend() == "openai":
            return f"openai:{self._settings.openai_embedding_model}"
        return "hash-embedding-v1"

    def tokenize(self, text: str) -> list[str]:
        return [t.strip().lower() for t in text.replace("\n", " ").split(" ") if t.strip()]

    def embed(self, text: str) -> list[float]:
        """Synchronous hash embedding (tests + deterministic fallback)."""
        vec = [0.0] * self.dim
        for tok in self.tokenize(text):
            vec[hash(tok) % self.dim] += 1.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]

    async def embed_async(self, text: str) -> list[float]:
        """Production path: OpenAI embeddings when configured, else hash."""
        if self.effective_backend() == "openai":
            return await self._client().embed_one(text[:8000])
        return self.embed(text)

    @staticmethod
    def cosine(a: list[float], b: list[float]) -> float:
        if not a or not b or len(a) != len(b):
            return 0.0
        return sum(x * y for x, y in zip(a, b))
