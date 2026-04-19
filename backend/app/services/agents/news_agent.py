from __future__ import annotations

import json
import logging
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.market_data import MarketData
from app.models.intelligence import AgentSignal
from app.services.agent_persistence import get_or_create_agent_run, upsert_agent_signal, upsert_daily_brief
from app.services.llm.claude_client import ClaudeClient
from app.services.llm.json_extract import extract_json_object
from app.services.memory_service import MemoryService
from app.services.telegram_news_ingestion import ingest_telegram_whitelist
from app.schemas.agent_outputs import NewsAgentLLMOutput

logger = logging.getLogger(__name__)


class NewsAgent:
    async def run(self, db: AsyncSession, as_of: date | None = None) -> AgentSignal:
        memory = MemoryService()
        as_of = as_of or date.today()
        run = await get_or_create_agent_run(db, agent_name="news_agent", run_key=as_of.isoformat())

        try:
            await ingest_telegram_whitelist(db, as_of=as_of, max_messages_per_channel=40, source_version="telegram-inline")
        except Exception as e:
            logger.debug("Inline Telegram ingest skipped: %s", e)

        ctx = await memory.search(db, query="macro news geopolitics central bank risk", top_k=8, domain="news")

        q = select(MarketData).where(MarketData.symbol.in_(["VIXCLS", "DTWEXBGS"])).order_by(MarketData.date.desc())
        rows = (await db.execute(q)).scalars().all()
        vix = next((r.value for r in rows if r.symbol == "VIXCLS"), None)
        dxy = next((r.value for r in rows if r.symbol == "DTWEXBGS"), None)
        stress_tags: list[str] = []
        stress_score = 0.0
        if vix is not None and vix > 22:
            stress_score -= 0.35
            stress_tags.append("RiskOff")
        if dxy is not None and dxy > 125:
            stress_score -= 0.25
            stress_tags.append("DollarTightness")
        if not stress_tags:
            stress_tags.append("BalancedFlow")
            stress_score = 0.15

        claude = ClaudeClient()
        if not claude.is_configured():
            summary = f"News risk proxy: {', '.join(stress_tags)}."
            await upsert_daily_brief(
                db,
                brief_date=as_of,
                source="news_agent",
                title="Daily Macro Brief",
                content=summary,
                tags=stress_tags,
                importance="high" if stress_score < 0 else "medium",
            )
            signal = await upsert_agent_signal(
                db,
                run_id=run.id,
                agent_name="news_agent",
                signal_date=as_of,
                signal_type="news_risk_proxy",
                score=stress_score,
                summary=summary,
                payload={
                    "vix": vix,
                    "dxy": dxy,
                    "tags": stress_tags,
                    "memory_context": ctx,
                    "prompt_version": "news-v1",
                    "model_version": "rule-proxy-v1",
                },
            )
        else:
            system = (
                "You are a macro news analyst. Output a single JSON object only, no markdown. "
                "Fields: summary (one paragraph), aggregate_score (-1 risk-off to +1 risk-on), "
                "events (array, at most 5 items, most market-moving first; each: headline, impact risk_off|risk_on|mixed|local, "
                "horizon hours|days|weeks, confidence 0..1, themes string[]). "
                "Base headlines on MEMORY_CONTEXT snippets; if sparse, use fewer events and lower confidence."
            )
            user = (
                f"As-of: {as_of.isoformat()}.\n"
                f"MARKET_STRESS: vix={vix}, dxy={dxy}, tags={stress_tags}, heuristic_score={stress_score:.2f}\n\n"
                f"MEMORY_CONTEXT: {json.dumps(ctx, ensure_ascii=False, default=str)[:14000]}"
            )
            raw = await claude.complete(system=system, user=user, max_tokens=1600)
            try:
                data = extract_json_object(raw)
                out = NewsAgentLLMOutput.model_validate(data)
                summary = out.summary
                agg = float(out.aggregate_score)
                llm_dump = out.model_dump()
                model_version = f"claude:{claude.model}"
            except Exception as e:
                logger.warning("News LLM parse failed, using stress proxy: %s", e)
                summary = f"News risk proxy: {', '.join(stress_tags)}. ({e})"
                agg = stress_score
                llm_dump = {"parse_error": str(e), "raw": raw[:2000]}
                model_version = "claude-parse-fallback"

            themes: list[str] = []
            for ev in llm_dump.get("events") or []:
                if isinstance(ev, dict):
                    themes.extend(ev.get("themes") or [])
            await upsert_daily_brief(
                db,
                brief_date=as_of,
                source="news_agent",
                title="Daily Macro Brief",
                content=summary,
                tags=list({*stress_tags, *[t for t in themes if isinstance(t, str)][:8]}),
                importance="high" if agg < -0.2 else "medium",
            )
            signal = await upsert_agent_signal(
                db,
                run_id=run.id,
                agent_name="news_agent",
                signal_date=as_of,
                signal_type="news_risk_proxy",
                score=agg,
                summary=summary,
                payload={
                    "vix": vix,
                    "dxy": dxy,
                    "tags": stress_tags,
                    "memory_context": ctx,
                    "llm": llm_dump,
                    "prompt_version": "news-v2",
                    "model_version": model_version,
                },
            )

        await memory.upsert_document(
            db,
            source="news",
            doc_key=f"news-agent:{as_of.isoformat()}",
            title="News agent output",
            content=signal.summary,
            metadata={"quality_score": 0.85, "source_version": "news-v2"},
            tags=["agent", "news"],
        )
        run.status = "completed"
        return signal
