from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.regime import RegimeSnapshot, RegimeHistoryPoint
from app.services.cycle_engine import CycleEngine

router = APIRouter()


@router.get("/current", response_model=RegimeSnapshot)
async def get_current_regime(db: AsyncSession = Depends(get_db)):
    engine = CycleEngine(db)
    return await engine.get_current_snapshot()


@router.get("/history", response_model=list[RegimeHistoryPoint])
async def get_regime_history(
    months: int = Query(60, ge=6, le=120),
    db: AsyncSession = Depends(get_db),
):
    engine = CycleEngine(db)
    return await engine.get_history(months)
