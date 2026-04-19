"""
Macro Data Agent: coverage snapshot + optional LLM narrative from latest indicator values.
"""
from __future__ import annotations

import json
import logging
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.indicator import Indicator, IndicatorValue
from app.models.intelligence import AgentSignal
from app.services.agent_persistence import get_or_create_agent_run, upsert_agent_signal
from app.services.llm.claude_client import ClaudeClient
from app.services.llm.json_extract import extract_json_object
from app.schemas.agent_outputs import MacroDataAgentLLMOutput

logger = logging.getLogger(__name__)


class MacroDataAgent:
    async def run(self, db: AsyncSession, as_of: date | None = None) -> AgentSignal:
        as_of = as_of or date.today()
        run = await get_or_create_agent_run(db, agent_name="macro_data_agent", run_key=as_of.isoformat())

        cnt = (
            await db.execute(
                select(func.count(IndicatorValue.id)).where(IndicatorValue.date <= as_of)
            )
        ).scalar() or 0
        latest_iv = (
            await db.execute(select(func.max(IndicatorValue.date)).where(IndicatorValue.date <= as_of))
        ).scalar()

        sample_rows = (
            (
                await db.execute(
                    select(Indicator.name, IndicatorValue.date, IndicatorValue.value)
                    .join(Indicator, Indicator.id == IndicatorValue.indicator_id)
                    .where(IndicatorValue.date <= as_of)
                    .order_by(IndicatorValue.date.desc())
                    .limit(24)
                )
            )
            .all()
        )
        sample = [{"name": r[0], "date": r[1].isoformat(), "value": float(r[2]) if r[2] is not None else None} for r in sample_rows]

        rule_summary = (
            f"Macro data coverage: {int(cnt)} indicator values on/before {as_of.isoformat()}; "
            f"latest value date {latest_iv}."
        )
        score = min(1.0, max(0.0, float(cnt) / 5000.0)) if cnt else 0.0
        base_payload = {
            "indicator_value_count": int(cnt),
            "latest_indicator_value_date": latest_iv.isoformat() if latest_iv else None,
            "sample": sample,
            "prompt_version": "macro-v1",
        }

        claude = ClaudeClient()
        if not claude.is_configured():
            signal = await upsert_agent_signal(
                db,
                run_id=run.id,
                agent_name="macro_data_agent",
                signal_date=as_of,
                signal_type="macro_data_summary",
                score=score,
                summary=rule_summary,
                payload={**base_payload, "model_version": "rule-snapshot-v0"},
            )
        else:
            system = (
                "You are a macro data analyst. Output a single JSON object only, no markdown. "
                "Fields: summary (one paragraph), score (0..1 data richness / impulse readability), "
                "bullets (string array, max 6 short points), reason_codes (string array, e.g. NO_CONSENSUS, SPARSE_DATA), "
                "tab_summaries (object): exactly these string keys, each value ONE short sentence for that app tab: "
                "indices, sectors, rates, breadth, macro, inflation, fed. "
                "If data is insufficient for a tab, write a cautious neutral sentence and mention uncertainty."
            )
            user = (
                f"As-of: {as_of.isoformat()}.\n"
                f"COVERAGE_COUNT: {cnt}\n"
                f"LATEST_VALUE_DATE: {latest_iv}\n"
                f"RECENT_VALUES_JSON: {json.dumps(sample, ensure_ascii=False, default=str)[:10000]}"
            )
            raw = await claude.complete(system=system, user=user, max_tokens=900)
            try:
                data = extract_json_object(raw)
                out = MacroDataAgentLLMOutput.model_validate(data)
                signal = await upsert_agent_signal(
                    db,
                    run_id=run.id,
                    agent_name="macro_data_agent",
                    signal_date=as_of,
                    signal_type="macro_data_summary",
                    score=float(out.score),
                    summary=out.summary,
                    payload={
                        **base_payload,
                        "llm": out.model_dump(),
                        "model_version": f"claude:{claude.model}",
                    },
                )
            except Exception as e:
                logger.warning("Macro LLM parse failed: %s", e)
                signal = await upsert_agent_signal(
                    db,
                    run_id=run.id,
                    agent_name="macro_data_agent",
                    signal_date=as_of,
                    signal_type="macro_data_summary",
                    score=score,
                    summary=rule_summary,
                    payload={**base_payload, "model_version": "claude-parse-fallback", "parse_error": str(e)},
                )

        run.status = "completed"
        return signal
