from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.navigator import (
    NavigatorRecommendation, CrossAssetSignal, RecessionCheck,
)
from app.services.navigator_engine import NavigatorEngine

router = APIRouter()


@router.get("/current", response_model=NavigatorRecommendation)
async def get_current_position(db: AsyncSession = Depends(get_db)):
    engine = NavigatorEngine(db)
    return await engine.get_recommendation()


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
