from __future__ import annotations

import json
import logging
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.intelligence import AgentSignal, Recommendation
from app.services.agent_persistence import upsert_recommendation
from app.services.llm.claude_client import ClaudeClient
from app.services.llm.json_extract import extract_json_object
from app.services.memory_service import MemoryService
from app.services.risk_overlay import build_risk_overlay
from app.schemas.agent_outputs import MasterAgentLLMOutput

logger = logging.getLogger(__name__)


class MasterAgent:
    def __init__(self):
        self.memory = MemoryService()

    async def synthesize(
        self,
        db: AsyncSession,
        regime: str,
        regime_confidence: float,
        factor_tilts: list[dict],
        anomaly_score: float,
        anomaly_threshold: float,
        *,
        growth_score: float | None = None,
        fed_policy_score: float | None = None,
        ml1_payload: dict[str, Any] | None = None,
        as_of: date | None = None,
    ) -> Recommendation:
        as_of = as_of or date.today()
        q = (
            select(AgentSignal)
            .where(AgentSignal.signal_date == as_of)
            .order_by(AgentSignal.created_at.desc())
            .limit(20)
        )
        signals = (await db.execute(q)).scalars().all()
        ml2_conf = max((float(x.get("confidence", 0.4)) for x in factor_tilts[:3]), default=0.4)
        risk = build_risk_overlay(regime_confidence, ml2_conf, anomaly_score, anomaly_threshold)

        top_signal_text = "; ".join([s.summary for s in signals[:4]]) if signals else "No agent signals."
        mem_hits = await self.memory.search(db, f"{regime} {top_signal_text}", top_k=5)
        analogs = [f"{h['title']} ({h['score']:.2f})" for h in mem_hits]

        claude = ClaudeClient()
        if not claude.is_configured():
            thesis = f"Regime {regime}. Top signal context: {top_signal_text}"
            llm_block: dict[str, Any] = {"mode": "rule"}
            model_version = "rule-synthesis-v1"
        else:
            allowed_keys = {h.get("doc_key") for h in mem_hits if h.get("doc_key")}
            system = (
                "You are the MacroLens Master agent. Output a single JSON object only, no markdown. "
                "Fields: macro_thesis (2–4 sentences), regime_comment (string|null), "
                "factor_tilt_notes (string array), monitoring (string array of checkpoints), "
                "citations_used (array of doc_key strings). "
                "citations_used MUST be a subset of ALLOWED_DOC_KEYS; if none apply, use empty array."
            )
            user = json.dumps(
                {
                    "as_of": as_of.isoformat(),
                    "regime": regime,
                    "regime_confidence": regime_confidence,
                    "growth_score": growth_score,
                    "fed_policy_score": fed_policy_score,
                    "ml1": ml1_payload,
                    "ml2_factor_tilts": factor_tilts[:10],
                    "anomaly_score": anomaly_score,
                    "anomaly_threshold": anomaly_threshold,
                    "risk_overlay": risk,
                    "agent_signals": [
                        {"agent": s.agent_name, "type": s.signal_type, "score": s.score, "summary": s.summary}
                        for s in signals[:10]
                    ],
                    "memory_hits": mem_hits,
                    "ALLOWED_DOC_KEYS": sorted(k for k in allowed_keys if k),
                },
                ensure_ascii=False,
                default=str,
            )[:24000]
            raw = await claude.complete(system=system, user=user, max_tokens=2000)
            try:
                data = extract_json_object(raw)
                out = MasterAgentLLMOutput.model_validate(data)
                used = [k for k in (out.citations_used or []) if k in allowed_keys]
                thesis = out.macro_thesis
                llm_block = {**out.model_dump(), "citations_used": used}
                model_version = f"claude:{claude.model}"
            except Exception as e:
                logger.warning("Master LLM parse failed: %s", e)
                thesis = f"Regime {regime}. Top signal context: {top_signal_text}"
                llm_block = {"parse_error": str(e), "raw": raw[:2500]}
                model_version = "claude-parse-fallback"

        payload = {
            "regime": regime,
            "factor_tilts": factor_tilts[:8],
            "top_signals": [
                {"agent_name": s.agent_name, "signal_type": s.signal_type, "score": s.score, "summary": s.summary}
                for s in signals[:8]
            ],
            "historical_analogs": analogs,
            "provenance_trace": mem_hits,
            "risk": risk,
            "prompt_version": "master-v2",
            "model_version": model_version,
            "as_of": as_of.isoformat(),
            "growth_score": growth_score,
            "fed_policy_score": fed_policy_score,
            "ml1": ml1_payload,
            "llm": llm_block,
        }
        rec = await upsert_recommendation(
            db,
            rec_date=as_of,
            regime=regime,
            macro_thesis=thesis,
            confidence=risk["confidence"],
            uncertainty=risk["uncertainty"],
            no_trade=risk["no_trade"],
            reason_codes=risk["reason_codes"],
            risk_constraints=risk["risk_constraints"],
            payload=payload,
        )
        await self.memory.upsert_document(
            db,
            source="decisions",
            doc_key=f"master-agent:{as_of.isoformat()}",
            title="Master agent recommendation",
            content=thesis,
            metadata={"quality_score": 0.95, "source_version": "master-v2"},
            tags=["agent", "master", "decision"],
        )
        return rec
