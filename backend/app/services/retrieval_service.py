from __future__ import annotations

from datetime import datetime, timezone
import time

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.intelligence import MemoryChunk, MemoryDocument, MemoryEmbedding, RetrievalTrace
from app.services.embedding_service import EmbeddingService


class RetrievalService:
    def __init__(self):
        self.embedding = EmbeddingService()

    def _recency_weight(self, created_at: datetime | None) -> float:
        if created_at is None:
            return 0.7
        now = datetime.now(timezone.utc)
        age_days = max(0.0, (now - created_at).total_seconds() / 86400.0)
        return 1.0 / (1.0 + age_days / 30.0)

    async def search(
        self,
        db: AsyncSession,
        query: str,
        top_k: int = 5,
        domain: str | None = None,
        quality_threshold: float = 0.0,
        strict_mode: bool = False,
    ) -> list[dict]:
        t0 = time.perf_counter()
        qv = await self.embedding.embed_async(query)

        q = (
            select(MemoryChunk, MemoryDocument, MemoryEmbedding)
            .join(MemoryDocument, MemoryChunk.document_id == MemoryDocument.id)
            .join(MemoryEmbedding, MemoryEmbedding.chunk_id == MemoryChunk.id)
        )
        if domain:
            q = q.where(MemoryDocument.source == domain)
        rows = (await db.execute(q)).all()

        query_tokens = set(self.embedding.tokenize(query))
        scored: list[dict] = []
        q_dim = len(qv)
        for chunk, doc, emb in rows:
            vec = emb.vector or []
            if len(vec) != q_dim:
                continue
            vec_sim = self.embedding.cosine(qv, vec)
            text_tokens = set(self.embedding.tokenize(chunk.content[:1200]))
            keyword_overlap = len(query_tokens.intersection(text_tokens))
            keyword_score = min(1.0, keyword_overlap / max(1, len(query_tokens)))
            recency = self._recency_weight(chunk.created_at)
            quality = float((chunk.metadata_json or {}).get("quality_score", 1.0))
            if quality < quality_threshold:
                continue
            # rule-based rerank
            score = 0.55 * vec_sim + 0.25 * keyword_score + 0.12 * recency + 0.08 * quality
            if strict_mode and keyword_overlap == 0:
                continue
            scored.append(
                {
                    "score": score,
                    "vector_score": vec_sim,
                    "keyword_score": keyword_score,
                    "recency_score": recency,
                    "quality_score": quality,
                    "doc_key": doc.doc_key,
                    "title": doc.title,
                    "source": doc.source,
                    "content": chunk.content[:600],
                    "created_at": chunk.created_at.isoformat() if chunk.created_at else None,
                }
            )

        scored.sort(key=lambda x: x["score"], reverse=True)
        hits = scored[:top_k]
        latency_ms = int((time.perf_counter() - t0) * 1000)
        trace = RetrievalTrace(
            query=query,
            domain_filter=domain,
            top_k=top_k,
            latency_ms=latency_ms,
            hit_count=len(hits),
            result_json=hits,
        )
        db.add(trace)
        return hits

    async def stats(self, db: AsyncSession) -> dict:
        docs = (await db.execute(select(func.count(MemoryDocument.id)))).scalar() or 0
        chunks = (await db.execute(select(func.count(MemoryChunk.id)))).scalar() or 0
        emb = (await db.execute(select(func.count(MemoryEmbedding.id)))).scalar() or 0
        traces = (await db.execute(select(func.count(RetrievalTrace.id)))).scalar() or 0
        return {"documents": int(docs), "chunks": int(chunks), "embeddings": int(emb), "retrieval_traces": int(traces)}
