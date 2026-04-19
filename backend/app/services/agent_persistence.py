"""Idempotent persistence for agent runs, signals, briefs, and recommendations."""
from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.intelligence import AgentRun, AgentSignal, DailyBrief, Recommendation


async def get_or_create_agent_run(
    db: AsyncSession,
    *,
    agent_name: str,
    run_key: str,
) -> AgentRun:
    q = select(AgentRun).where(AgentRun.agent_name == agent_name, AgentRun.run_key == run_key)
    existing = (await db.execute(q)).scalar_one_or_none()
    if existing:
        existing.status = "running"
        existing.error = None
        await db.flush()
        return existing
    run = AgentRun(agent_name=agent_name, run_key=run_key, status="running")
    db.add(run)
    await db.flush()
    return run


async def upsert_agent_signal(
    db: AsyncSession,
    *,
    run_id: int | None,
    agent_name: str,
    signal_date: date,
    signal_type: str,
    score: float | None,
    summary: str,
    payload: dict[str, Any] | None,
) -> AgentSignal:
    q = select(AgentSignal).where(
        AgentSignal.agent_name == agent_name,
        AgentSignal.signal_date == signal_date,
        AgentSignal.signal_type == signal_type,
    )
    existing = (await db.execute(q)).scalar_one_or_none()
    if existing:
        existing.run_id = run_id
        existing.score = score
        existing.summary = summary
        existing.payload = payload
        return existing
    sig = AgentSignal(
        run_id=run_id,
        agent_name=agent_name,
        signal_date=signal_date,
        signal_type=signal_type,
        score=score,
        summary=summary,
        payload=payload,
    )
    db.add(sig)
    return sig


async def upsert_daily_brief(
    db: AsyncSession,
    *,
    brief_date: date,
    source: str,
    title: str,
    content: str,
    tags: list[str] | None,
    importance: str,
) -> DailyBrief:
    q = select(DailyBrief).where(DailyBrief.brief_date == brief_date, DailyBrief.source == source)
    existing = (await db.execute(q)).scalar_one_or_none()
    if existing:
        existing.title = title
        existing.content = content
        existing.tags = tags
        existing.importance = importance
        return existing
    brief = DailyBrief(
        brief_date=brief_date,
        source=source,
        title=title,
        content=content,
        tags=tags,
        importance=importance,
    )
    db.add(brief)
    return brief


async def upsert_recommendation(
    db: AsyncSession,
    *,
    rec_date: date,
    regime: str,
    macro_thesis: str,
    confidence: float,
    uncertainty: float,
    no_trade: bool,
    reason_codes: list[str] | None,
    risk_constraints: dict[str, Any] | None,
    payload: dict[str, Any],
) -> Recommendation:
    q = (
        select(Recommendation)
        .where(Recommendation.rec_date == rec_date)
        .order_by(desc(Recommendation.id))
        .limit(1)
    )
    existing = (await db.execute(q)).scalar_one_or_none()
    if existing:
        existing.regime = regime
        existing.macro_thesis = macro_thesis
        existing.confidence = confidence
        existing.uncertainty = uncertainty
        existing.no_trade = no_trade
        existing.reason_codes = reason_codes
        existing.risk_constraints = risk_constraints
        existing.payload = payload
        return existing
    rec = Recommendation(
        rec_date=rec_date,
        regime=regime,
        macro_thesis=macro_thesis,
        confidence=confidence,
        uncertainty=uncertainty,
        no_trade=no_trade,
        reason_codes=reason_codes,
        risk_constraints=risk_constraints,
        payload=payload,
    )
    db.add(rec)
    return rec
