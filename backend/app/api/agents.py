from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.intelligence import AgentSignal, Recommendation
from app.schemas.intelligence import AgentRunResponse, RecommendationResponse, AgentSignalItem, RiskOverlay, ML2FactorItem
from app.services.agent_context_pack import (
    build_context_pack,
    fed_rhetoric_history,
    macro_tab_summary_from_signal,
)
from app.services.intelligence_pipeline import run_intelligence_pipeline

router = APIRouter()


@router.post("/run", response_model=AgentRunResponse)
async def run_agents(db: AsyncSession = Depends(get_db)):
    result = await run_intelligence_pipeline(db)
    await db.commit()
    as_of_ml2 = result.get("ml2_as_of_date")
    return AgentRunResponse(
        status=result["status"],
        runs={
            "fed_cb_agent": result["fed_cb_summary"],
            "news_agent": result["news_summary"],
            "macro_data_agent": result.get("macro_summary") or "",
            "as_of_date": as_of_ml2 if isinstance(as_of_ml2, str) else (as_of_ml2.isoformat() if as_of_ml2 else ""),
            "regime": str(result.get("regime") or ""),
        },
    )


@router.get("/context-pack")
async def get_context_pack(
    as_of: date | None = Query(None, description="Signals and recommendation for this calendar date"),
    db: AsyncSession = Depends(get_db),
):
    """Single payload for Dashboard / Analysis: specialist signals + Master recommendation."""
    return await build_context_pack(db, as_of or date.today())


@router.get("/fed-rhetoric/history")
async def get_fed_rhetoric_history(
    date_from: date | None = Query(None, description="Inclusive start; default 365d before date_to"),
    date_to: date | None = Query(None, description="Inclusive end; default today"),
    db: AsyncSession = Depends(get_db),
):
    end = date_to or date.today()
    start = date_from or (end - timedelta(days=365))
    if start > end:
        start, end = end, start
    return await fed_rhetoric_history(db, date_from=start, date_to=end)


@router.get("/macro/tab-summary")
async def get_macro_tab_summary(
    tab: str = Query(..., description="Analysis tab id: indices, sectors, rates, breadth, macro, inflation, fed"),
    as_of: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    target = as_of or date.today()
    q = (
        select(AgentSignal)
        .where(
            AgentSignal.signal_date == target,
            AgentSignal.agent_name == "macro_data_agent",
            AgentSignal.signal_type == "macro_data_summary",
        )
        .order_by(desc(AgentSignal.id))
        .limit(1)
    )
    row = (await db.execute(q)).scalar_one_or_none()
    return macro_tab_summary_from_signal(row, tab)


@router.get("/signals")
async def latest_signals(
    as_of: date | None = Query(None, description="Defaults to today"),
    db: AsyncSession = Depends(get_db),
):
    target = as_of or date.today()
    q = select(AgentSignal).where(AgentSignal.signal_date == target).order_by(AgentSignal.created_at.desc())
    rows = (await db.execute(q)).scalars().all()
    return [
        AgentSignalItem(
            agent_name=r.agent_name,
            signal_type=r.signal_type,
            score=r.score,
            summary=r.summary,
            payload=r.payload,
        )
        for r in rows
    ]


@router.get("/recommendation", response_model=RecommendationResponse)
async def latest_recommendation(db: AsyncSession = Depends(get_db)):
    q = select(Recommendation).order_by(Recommendation.created_at.desc()).limit(1)
    rec = (await db.execute(q)).scalar_one_or_none()
    if rec is None:
        return RecommendationResponse(
            as_of_date=date.today().isoformat(),
            regime="UNKNOWN",
            macro_thesis="No recommendation yet.",
            factor_tilts=[],
            top_signals=[],
            historical_analogs=[],
            risk=RiskOverlay(
                confidence=0.0,
                uncertainty=1.0,
                data_quality_score=0.0,
                regime_stability_score=0.0,
                no_trade=True,
                reason_codes=["NO_DATA"],
                risk_constraints={},
            ),
            payload={},
        )

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

