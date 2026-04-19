"""Assemble agent outputs for UI (context pack, Fed history, macro tab strips)."""
from __future__ import annotations

from datetime import date

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.intelligence import AgentSignal, Recommendation
from app.schemas.agent_outputs import ANALYSIS_TAB_KEYS
from app.schemas.intelligence import AgentSignalItem, ML2FactorItem, RecommendationResponse, RiskOverlay


def _signal_digest(row: AgentSignal) -> dict:
    return {
        "agent_name": row.agent_name,
        "signal_type": row.signal_type,
        "score": row.score,
        "summary": row.summary,
        "payload": row.payload or {},
    }


async def load_agent_signals_for_date(db: AsyncSession, as_of: date) -> list[AgentSignal]:
    q = (
        select(AgentSignal)
        .where(AgentSignal.signal_date == as_of)
        .order_by(AgentSignal.agent_name, AgentSignal.signal_type)
    )
    return list((await db.execute(q)).scalars().all())


async def load_recommendation_for_date(db: AsyncSession, as_of: date) -> Recommendation | None:
    q = (
        select(Recommendation)
        .where(Recommendation.rec_date == as_of)
        .order_by(desc(Recommendation.id))
        .limit(1)
    )
    return (await db.execute(q)).scalar_one_or_none()


def recommendation_to_response(rec: Recommendation) -> RecommendationResponse:
    p = rec.payload or {}
    risk = p.get("risk", {})
    return RecommendationResponse(
        as_of_date=rec.rec_date.isoformat(),
        regime=rec.regime,
        macro_thesis=rec.macro_thesis,
        factor_tilts=[ML2FactorItem(**x) for x in p.get("factor_tilts", [])],
        top_signals=[AgentSignalItem(**x) for x in p.get("top_signals", [])],
        historical_analogs=p.get("historical_analogs", []),
        risk=RiskOverlay(
            confidence=float(risk.get("confidence", rec.confidence)),
            uncertainty=float(risk.get("uncertainty", rec.uncertainty)),
            data_quality_score=float(risk.get("data_quality_score", 0.8)),
            regime_stability_score=float(risk.get("regime_stability_score", 0.7)),
            no_trade=bool(risk.get("no_trade", rec.no_trade)),
            reason_codes=list(risk.get("reason_codes", rec.reason_codes or [])),
            risk_constraints=dict(risk.get("risk_constraints", rec.risk_constraints or {})),
        ),
        payload=p,
    )


async def build_context_pack(db: AsyncSession, as_of: date) -> dict:
    rows = await load_agent_signals_for_date(db, as_of)
    by_agent = {r.agent_name: r for r in rows}
    macro = by_agent.get("macro_data_agent")
    fed = by_agent.get("fed_cb_agent")
    news = by_agent.get("news_agent")
    rec = await load_recommendation_for_date(db, as_of)
    master = recommendation_to_response(rec) if rec else None
    return {
        "as_of_date": as_of.isoformat(),
        "macro": _signal_digest(macro) if macro else None,
        "fed_cb": _signal_digest(fed) if fed else None,
        "news": _signal_digest(news) if news else None,
        "master": master.model_dump() if master else None,
    }


async def fed_rhetoric_history(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
) -> list[dict]:
    q = (
        select(AgentSignal)
        .where(
            AgentSignal.agent_name == "fed_cb_agent",
            AgentSignal.signal_type == "cb_rhetoric_proxy",
            AgentSignal.signal_date >= date_from,
            AgentSignal.signal_date <= date_to,
        )
        .order_by(AgentSignal.signal_date)
    )
    rows = (await db.execute(q)).scalars().all()
    out: list[dict] = []
    for r in rows:
        p = r.payload or {}
        llm = p.get("llm") if isinstance(p.get("llm"), dict) else {}
        stance = llm.get("stance") or p.get("stance")
        out.append(
            {
                "signal_date": r.signal_date.isoformat(),
                "score": r.score,
                "summary": r.summary,
                "stance": stance,
                "hawk_dovish_index": None if r.score is None else round((float(r.score) + 1.0) * 50.0, 1),
            }
        )
    return out


def macro_tab_summary_from_signal(macro_row: AgentSignal | None, tab: str) -> dict:
    tab = tab.strip().lower()
    if tab not in ANALYSIS_TAB_KEYS:
        return {"tab": tab, "summary": None, "available": False, "error": "invalid_tab"}
    if macro_row is None:
        return {"tab": tab, "summary": None, "available": False}
    p = macro_row.payload or {}
    llm = p.get("llm") if isinstance(p.get("llm"), dict) else {}
    tabs = llm.get("tab_summaries") if isinstance(llm.get("tab_summaries"), dict) else {}
    text = tabs.get(tab)
    if not text:
        return {"tab": tab, "summary": None, "available": False, "hint": "run_agents_with_claude_for_tab_summaries"}
    return {"tab": tab, "summary": text, "available": True, "as_of_date": macro_row.signal_date.isoformat()}
