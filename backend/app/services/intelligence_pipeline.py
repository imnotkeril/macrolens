"""
Single entry point for daily intelligence: agents, ML1 regime, ML2, Master synthesis.

Used by both the HTTP API and the APScheduler job to avoid drift.
"""
from __future__ import annotations

import logging
import time
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.services.ml_dataset_builder import get_latest_ml_feature_row
from app.services.ml_inference_service import predict_current
from app.services.ml2_dataset_builder import build_ml2_dataset
from app.services.ml2_factor_timing import ML2FactorTimingService
from app.services.ml2_anomaly import ML2AnomalyService
from app.services.agents.fed_cb_agent import FedCBAgent
from app.services.agents.news_agent import NewsAgent
from app.services.agents.macro_data_agent import MacroDataAgent
from app.services.agents.master_agent import MasterAgent

logger = logging.getLogger(__name__)


async def run_intelligence_pipeline(db: AsyncSession, as_of: date | None = None) -> dict:
    """
    Run macro (optional) → Fed → News → ML2 → ML1 regime → Master.

    Returns a small dict for API responses and logging.
    """
    t0 = time.perf_counter()
    as_of = as_of or date.today()
    settings = get_settings()

    macro_sig = await MacroDataAgent().run(db, as_of=as_of)
    macro_summary = macro_sig.summary

    fed = FedCBAgent()
    news = NewsAgent()
    fed_sig = await fed.run(db, as_of=as_of)
    news_sig = await news.run(db, as_of=as_of)

    growth, fed_score, cycle_score, feature_row = await get_latest_ml_feature_row(db, as_of=as_of)
    regime_pred = predict_current(
        growth_score=growth,
        fed_policy_score=fed_score,
        cycle_score=cycle_score,
        feature_row=feature_row,
        artifacts_dir=settings.ml_artifacts_dir,
    )

    ds = await build_ml2_dataset(db)
    ml2 = ML2FactorTimingService(settings.ml_artifacts_dir)
    as_of_date, factor_tilts = ml2.predict(ds)
    anomaly_score, _, threshold, _ = ML2AnomalyService().compute(ds)

    master = MasterAgent()
    await master.synthesize(
        db=db,
        regime=regime_pred.get("quadrant_ensemble", "Q1_GOLDILOCKS"),
        regime_confidence=float(regime_pred.get("confidence", 0.5)),
        factor_tilts=factor_tilts,
        anomaly_score=anomaly_score,
        anomaly_threshold=threshold,
        growth_score=growth,
        fed_policy_score=fed_score,
        ml1_payload=regime_pred,
        as_of=as_of,
    )

    elapsed = time.perf_counter() - t0
    logger.info(
        "intelligence_pipeline completed in %.2fs as_of=%s regime=%s",
        elapsed,
        as_of.isoformat(),
        regime_pred.get("quadrant_ensemble"),
    )
    return {
        "status": "completed",
        "as_of": as_of.isoformat(),
        "ml2_as_of_date": as_of_date,
        "fed_cb_summary": fed_sig.summary,
        "news_summary": news_sig.summary,
        "macro_summary": macro_summary,
        "regime": regime_pred.get("quadrant_ensemble"),
        "elapsed_seconds": round(elapsed, 3),
    }
