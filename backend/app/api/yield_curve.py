from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.yield_curve import YieldCurveSnapshot, YieldSpread, CurveDynamics
from app.services.yield_analyzer import YieldAnalyzer

router = APIRouter()


@router.get("/current", response_model=YieldCurveSnapshot)
async def get_current_curve(db: AsyncSession = Depends(get_db)):
    analyzer = YieldAnalyzer(db)
    return await analyzer.get_current_snapshot()


@router.get("/history", response_model=list[YieldCurveSnapshot])
async def get_historical_curves(db: AsyncSession = Depends(get_db)):
    analyzer = YieldAnalyzer(db)
    return await analyzer.get_historical_curves()


@router.get("/spreads", response_model=list[YieldSpread])
async def get_spreads(db: AsyncSession = Depends(get_db)):
    analyzer = YieldAnalyzer(db)
    return await analyzer.get_spreads()


@router.get("/dynamics", response_model=CurveDynamics)
async def get_dynamics(db: AsyncSession = Depends(get_db)):
    analyzer = YieldAnalyzer(db)
    return await analyzer.get_dynamics()


@router.get("/spread-history/{name}")
async def get_spread_history(name: str, days: int = Query(730), db: AsyncSession = Depends(get_db)):
    analyzer = YieldAnalyzer(db)
    return await analyzer.get_spread_history(name, days)


@router.get("/real-yield-history/{maturity}")
async def get_real_yield_history(maturity: str, days: int = Query(730), db: AsyncSession = Depends(get_db)):
    analyzer = YieldAnalyzer(db)
    return await analyzer.get_real_yield_history(maturity, days)


@router.get("/breakeven-history/{maturity}")
async def get_breakeven_history(maturity: str, days: int = Query(730), db: AsyncSession = Depends(get_db)):
    analyzer = YieldAnalyzer(db)
    return await analyzer.get_breakeven_history(maturity, days)
