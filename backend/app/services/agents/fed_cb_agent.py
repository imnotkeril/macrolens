from __future__ import annotations

import json
import logging
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fed_policy import FedRate
from app.models.intelligence import AgentSignal
from app.services.agent_persistence import get_or_create_agent_run, upsert_agent_signal
from app.services.fed_press_ingestion import ingest_fed_press_rss
from app.services.llm.claude_client import ClaudeClient
from app.services.llm.json_extract import extract_json_object
from app.services.memory_service import MemoryService
from app.schemas.agent_outputs import FedCBAgentLLMOutput

logger = logging.getLogger(__name__)


class FedCBAgent:
    async def run(self, db: AsyncSession, as_of: date | None = None) -> AgentSignal:
        memory = MemoryService()
        as_of = as_of or date.today()
        run = await get_or_create_agent_run(db, agent_name="fed_cb_agent", run_key=as_of.isoformat())

        try:
            await ingest_fed_press_rss(db, as_of=as_of, max_items=20, source_version="fed-rss-inline")
        except Exception as e:
            logger.debug("Inline Fed RSS skipped: %s", e)

        ctx = await memory.search(db, query="fed policy stance fomc inflation labor", top_k=6, domain="fed_cb")

        q = select(FedRate).order_by(FedRate.date.desc()).limit(2)
        rows = (await db.execute(q)).scalars().all()
        rate_payload: dict = {}
        score = 0.0
        rule_summary = "No Fed rate data."
        if rows:
            latest = rows[0]
            prev = rows[1] if len(rows) > 1 else rows[0]
            delta = (latest.target_upper or 0.0) - (prev.target_upper or 0.0)
            score = max(-1.0, min(1.0, delta / 0.5))
            stance = "hawkish" if score > 0 else "dovish" if score < 0 else "neutral"
            rule_summary = f"Fed/CB stance appears {stance}; policy delta {delta:.2f}."
            rate_payload = {
                "latest_upper": latest.target_upper,
                "prev_upper": prev.target_upper,
                "delta": delta,
                "stance": stance,
                "latest_date": latest.date.isoformat() if latest.date else None,
            }

        claude = ClaudeClient()
        if not claude.is_configured():
            signal = await upsert_agent_signal(
                db,
                run_id=run.id,
                agent_name="fed_cb_agent",
                signal_date=as_of,
                signal_type="cb_rhetoric_proxy",
                score=score,
                summary=rule_summary,
                payload={
                    **rate_payload,
                    "memory_context": ctx,
                    "prompt_version": "fed-v1",
                    "model_version": "rule-proxy-v1",
                },
            )
        else:
            system = (
                "You are a macro policy analyst. Output a single JSON object only, no markdown. "
                "Fields: stance (hawkish|dovish|neutral), score (-1..1), summary (one paragraph), "
                "drivers (string array up to 5), forward_guidance (string|null), uncertainty (string|null), "
                "citations (array of {doc_key, quote}) using only doc_keys from MEMORY_CONTEXT."
            )
            user = (
                f"As-of date: {as_of.isoformat()}.\n"
                f"RATE_FACTS_JSON: {json.dumps(rate_payload, default=str)}\n\n"
                f"MEMORY_CONTEXT: {json.dumps(ctx, ensure_ascii=False, default=str)[:12000]}\n\n"
                "Synthesize Fed communication stance vs rate facts. Citations must reference doc_key from MEMORY_CONTEXT only."
            )
            raw = await claude.complete(system=system, user=user, max_tokens=1200)
            try:
                data = extract_json_object(raw)
                llm_out = FedCBAgentLLMOutput.model_validate(data)
                summary = llm_out.summary
                score = float(llm_out.score)
                llm_payload = llm_out.model_dump()
                model_version = f"claude:{claude.model}"
            except Exception as e:
                logger.warning("Fed CB LLM parse failed, using rules: %s", e)
                summary = rule_summary
                llm_payload = {"parse_error": str(e), "raw": raw[:2000]}
                model_version = "claude-parse-fallback"

            signal = await upsert_agent_signal(
                db,
                run_id=run.id,
                agent_name="fed_cb_agent",
                signal_date=as_of,
                signal_type="cb_rhetoric_proxy",
                score=score,
                summary=summary,
                payload={
                    **rate_payload,
                    "memory_context": ctx,
                    "llm": llm_payload,
                    "prompt_version": "fed-v2",
                    "model_version": model_version,
                },
            )

        await memory.upsert_document(
            db,
            source="fed_cb",
            doc_key=f"fed-agent:{as_of.isoformat()}",
            title="Fed agent output",
            content=signal.summary,
            metadata={"quality_score": 0.9, "source_version": "fed-v2"},
            tags=["agent", "fed"],
        )
        run.status = "completed"
        return signal
