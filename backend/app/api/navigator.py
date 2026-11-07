import asyncio
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session, get_db
from app.schemas.navigator import (
    CrossAssetSignal,
    NavigatorRecommendation,
    RecessionCheck,
)
from app.services import ttl_cache
from app.services.navigator_engine import NavigatorEngine, _dashboard_fl_pit_as_of

logger = logging.getLogger(__name__)

router = APIRouter()

# The recommendation reads many tables; against a remote database it must never hang the page.
_CURRENT_TTL_S = 300.0
_CURRENT_BUDGET_S = 25.0
_CURRENT_FAIL_TTL_S = 30.0


async def _compute_current() -> NavigatorRecommendation:
    # Own session: cancelling on timeout must not leave the request session mid-query.
    async with async_session() as db:
        return await asyncio.wait_for(
            NavigatorEngine(db).get_recommendation(), timeout=_CURRENT_BUDGET_S
        )


@router.get("/current", response_model=NavigatorRecommendation)
async def get_current_position():
    key = f"navigator:current:{_dashboard_fl_pit_as_of().isoformat()}"
    failed = ttl_cache.fresh(key + ":fail", _CURRENT_FAIL_TTL_S)
    if failed is not None:
        return failed
    try:
        return await ttl_cache.cached(key, _CURRENT_TTL_S, _compute_current)
    except TimeoutError:
        logger.warning("navigator/current exceeded %.0fs; returning empty state", _CURRENT_BUDGET_S)
        empty = NavigatorEngine._empty_recommendation()
        ttl_cache.put(key + ":fail", empty)
        return empty


@router.get("/history")
async def get_historical_positions(db: AsyncSession = Depends(get_db)):
    engine = NavigatorEngine(db)
    return await engine.get_historical_positions()


@router.get("/forward")
async def get_forward_positions(db: AsyncSession = Depends(get_db)):
    """Momentum-based 6m and 1y forward positions for navigator dots (green)."""
    engine = NavigatorEngine(db)
    return await engine.get_forward_positions()


@router.get("/signals", response_model=list[CrossAssetSignal])
async def get_confirmation_signals(db: AsyncSession = Depends(get_db)):
    engine = NavigatorEngine(db)
    return await engine.get_cross_asset_signals()


@router.get("/recession-check", response_model=RecessionCheck)
async def get_recession_check(db: AsyncSession = Depends(get_db)):
    engine = NavigatorEngine(db)
    return await engine.get_recession_check()
