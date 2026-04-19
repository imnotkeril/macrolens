from __future__ import annotations

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.intelligence import (
    MemoryDocument,
    MemoryChunk,
    MemoryEmbedding,
    MemoryTag,
    MemorySourceRegistry,
)
from app.services.embedding_service import EmbeddingService
from app.services.retrieval_service import RetrievalService


class MemoryService:
    def __init__(self):
        self.embedding = EmbeddingService()
        self.retrieval = RetrievalService()

    async def upsert_document(
        self,
        db: AsyncSession,
        source: str,
        doc_key: str,
        title: str,
        content: str,
        metadata: dict | None = None,
        tags: list[str] | None = None,
    ) -> None:
        metadata = metadata or {}
        q = select(MemoryDocument).where(MemoryDocument.doc_key == doc_key)
        existing = (await db.execute(q)).scalar_one_or_none()
        if existing is None:
            existing = MemoryDocument(source=source, doc_key=doc_key, title=title, content=content, metadata_json=metadata)
            db.add(existing)
            await db.flush()
        else:
            existing.title = title
            existing.content = content
            existing.metadata_json = metadata

        # one-chunk strategy
        cq = select(MemoryChunk).where(MemoryChunk.document_id == existing.id, MemoryChunk.chunk_index == 0)
        chunk = (await db.execute(cq)).scalar_one_or_none()
        if chunk is None:
            chunk = MemoryChunk(document_id=existing.id, chunk_index=0, content=content, metadata_json=metadata)
            db.add(chunk)
            await db.flush()
        else:
            chunk.content = content
            chunk.metadata_json = metadata

        emb_vec = await self.embedding.embed_async(content)
        model_key = self.embedding.embedding_model_key()
        eq = select(MemoryEmbedding).where(MemoryEmbedding.chunk_id == chunk.id)
        emb = (await db.execute(eq)).scalar_one_or_none()
        if emb is None:
            emb = MemoryEmbedding(chunk_id=chunk.id, model=model_key, vector=emb_vec, norm=1.0)
            db.add(emb)
        else:
            emb.model = model_key
            emb.vector = emb_vec
            emb.norm = 1.0

        await db.execute(delete(MemoryTag).where(MemoryTag.doc_id == existing.id))
        for tag in tags or []:
            db.add(MemoryTag(doc_id=existing.id, tag=tag.lower()))

        src = (
            await db.execute(
                select(MemorySourceRegistry).where(
                    MemorySourceRegistry.source_name == source,
                    MemorySourceRegistry.source_key == doc_key,
                )
            )
        ).scalar_one_or_none()
        quality = float(metadata.get("quality_score", 1.0)) if metadata else 1.0
        if src is None:
            db.add(
                MemorySourceRegistry(
                    source_name=source,
                    source_key=doc_key,
                    source_version=str(metadata.get("source_version")) if metadata.get("source_version") else None,
                    quality_score=quality,
                    metadata_json=metadata,
                )
            )
        else:
            src.source_version = str(metadata.get("source_version")) if metadata.get("source_version") else src.source_version
            src.quality_score = quality
            src.metadata_json = metadata

    async def search(
        self,
        db: AsyncSession,
        query: str,
        top_k: int = 5,
        domain: str | None = None,
        quality_threshold: float = 0.0,
        strict_mode: bool = False,
    ) -> list[dict]:
        return await self.retrieval.search(
            db=db,
            query=query,
            top_k=top_k,
            domain=domain,
            quality_threshold=quality_threshold,
            strict_mode=strict_mode,
        )

    async def stats(self, db: AsyncSession) -> dict:
        return await self.retrieval.stats(db)

