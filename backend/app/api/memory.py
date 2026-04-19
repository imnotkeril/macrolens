from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.intelligence import MemoryDocument, MemoryPipelineRun
from app.schemas.intelligence import MemorySearchResponse
from app.services.memory_service import MemoryService
from app.services.memory_ingestion_service import MemoryIngestionService

router = APIRouter()


@router.post("/upsert")
async def upsert_memory(
    source: str,
    doc_key: str,
    title: str,
    content: str,
    tags: str | None = None,
    quality_score: float = 1.0,
    source_version: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    svc = MemoryService()
    tag_list = [x.strip() for x in tags.split(",")] if tags else []
    await svc.upsert_document(
        db,
        source=source,
        doc_key=doc_key,
        title=title,
        content=content,
        metadata={"quality_score": quality_score, "source_version": source_version},
        tags=tag_list,
    )
    await db.commit()
    return {"status": "ok"}


@router.get("/search", response_model=MemorySearchResponse)
async def search_memory(
    query: str = Query(..., min_length=2),
    top_k: int = Query(5, ge=1, le=20),
    domain: str | None = Query(None),
    quality_threshold: float = Query(0.0, ge=0.0, le=1.0),
    strict_mode: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    svc = MemoryService()
    hits = await svc.search(
        db,
        query=query,
        top_k=top_k,
        domain=domain,
        quality_threshold=quality_threshold,
        strict_mode=strict_mode,
    )
    await db.commit()
    return MemorySearchResponse(query=query, hits=hits)


@router.get("/stats")
async def memory_stats(db: AsyncSession = Depends(get_db)):
    svc = MemoryService()
    return await svc.stats(db)


@router.get("/health")
async def memory_health(db: AsyncSession = Depends(get_db)):
    svc = MemoryService()
    stats = await svc.stats(db)
    healthy = stats["documents"] >= 0 and stats["chunks"] >= 0 and stats["embeddings"] >= 0
    return {"status": "ok" if healthy else "degraded", "stats": stats}


@router.get("/provenance")
async def memory_provenance(
    query: str = Query(..., min_length=2),
    top_k: int = Query(5, ge=1, le=20),
    domain: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    svc = MemoryService()
    hits = await svc.search(db, query=query, top_k=top_k, domain=domain, strict_mode=False)
    await db.commit()
    return {
        "query": query,
        "domain": domain,
        "top_k": top_k,
        "trace": [
            {
                "doc_key": h["doc_key"],
                "source": h["source"],
                "score": h["score"],
                "vector_score": h.get("vector_score"),
                "keyword_score": h.get("keyword_score"),
                "recency_score": h.get("recency_score"),
                "quality_score": h.get("quality_score"),
            }
            for h in hits
        ],
    }


@router.post("/snapshot/dashboard-radar")
async def snapshot_dashboard_radar(
    source_version: str = "v1",
    db: AsyncSession = Depends(get_db),
):
    svc = MemoryIngestionService()
    result = await svc.snapshot_dashboard_radar(db, source_version=source_version)
    await db.commit()
    return {"status": "ok", **result}


@router.post("/snapshot/analysis-indicators")
async def snapshot_analysis_indicators(
    source_version: str = "v1",
    db: AsyncSession = Depends(get_db),
):
    svc = MemoryIngestionService()
    result = await svc.snapshot_analysis_indicators(db, source_version=source_version)
    await db.commit()
    return {"status": "ok", **result}


@router.post("/snapshot/domains")
async def snapshot_domains(
    source_version: str = "v1",
    db: AsyncSession = Depends(get_db),
):
    svc = MemoryIngestionService()
    result = await svc.ingest_domain_records(db, source_version=source_version)
    await db.commit()
    return {"status": "ok", **result}


@router.post("/backfill")
async def backfill_memory(
    years: int = Query(5, ge=1, le=10),
    source_version: str = "backfill-v1",
    db: AsyncSession = Depends(get_db),
):
    svc = MemoryIngestionService()
    result = await svc.backfill_last_years(db, years=years, source_version=source_version)
    await db.commit()
    return {"status": "ok", **result}


@router.get("/admin/overview")
async def memory_admin_overview(db: AsyncSession = Depends(get_db)):
    source_rows = (
        await db.execute(
            select(MemoryDocument.source, func.count(MemoryDocument.id))
            .group_by(MemoryDocument.source)
            .order_by(MemoryDocument.source.asc())
        )
    ).all()
    by_source = {src: int(cnt) for src, cnt in source_rows}

    docs = (await db.execute(select(MemoryDocument).order_by(MemoryDocument.created_at.desc()).limit(5000))).scalars().all()
    coverage: dict[str, dict[str, str]] = {}
    for d in docs:
        as_of = (d.metadata_json or {}).get("as_of_date")
        if not as_of:
            continue
        current = coverage.get(d.source)
        if current is None:
            coverage[d.source] = {"min_as_of": as_of, "max_as_of": as_of}
            continue
        coverage[d.source]["min_as_of"] = min(current["min_as_of"], as_of)
        coverage[d.source]["max_as_of"] = max(current["max_as_of"], as_of)

    runs = (await db.execute(select(MemoryPipelineRun).order_by(MemoryPipelineRun.started_at.desc()).limit(20))).scalars().all()
    recent_runs = [
        {
            "pipeline_name": r.pipeline_name,
            "run_key": r.run_key,
            "status": r.status,
            "rows_written": r.rows_written,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "error": r.error,
        }
        for r in runs
    ]
    return {"by_source": by_source, "coverage": coverage, "recent_runs": recent_runs}


@router.get("/admin/samples")
async def memory_admin_samples(
    source: str | None = Query(None),
    limit: int = Query(20, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    q = select(MemoryDocument).order_by(MemoryDocument.created_at.desc()).limit(limit)
    if source:
        q = select(MemoryDocument).where(MemoryDocument.source == source).order_by(MemoryDocument.created_at.desc()).limit(limit)
    docs = (await db.execute(q)).scalars().all()
    return {
        "items": [
            {
                "source": d.source,
                "doc_key": d.doc_key,
                "title": d.title,
                "created_at": d.created_at.isoformat() if d.created_at else None,
                "metadata": d.metadata_json or {},
                "content_preview": (d.content or "")[:300],
            }
            for d in docs
        ]
    }


@router.get("/context")
async def memory_context(
    query: str = Query(..., min_length=2),
    top_k: int = Query(8, ge=1, le=20),
    domain: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    svc = MemoryService()
    hits = await svc.search(db, query=query, top_k=top_k, domain=domain, strict_mode=False)
    await db.commit()
    return {
        "query": query,
        "domain": domain,
        "hits": hits,
    }

