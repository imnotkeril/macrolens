from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.yield_curve import (
    CurveDynamics,
    SpreadPercentileRow,
    YieldCurveSnapshot,
    YieldSpread,
)
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


@router.get("/spread-percentiles", response_model=list[SpreadPercentileRow])
async def get_spread_percentiles(db: AsyncSession = Depends(get_db)):
    """Percentile ranks (1y / 5y / 10y windows) and full-sample mean for key Treasury spreads."""
    analyzer = YieldAnalyzer(db)
    return await analyzer.get_spread_percentile_table()


@router.get("/dynamics", response_model=CurveDynamics)
async def get_dynamics(db: AsyncSession = Depends(get_db)):
    analyzer = YieldAnalyzer(db)
    return await analyzer.get_dynamics()


@router.get("/dynamics-at", response_model=CurveDynamics)
async def get_dynamics_at(
    as_of: date = Query(..., description="Point-in-time date (no future leak)."),
    db: AsyncSession = Depends(get_db),
):
    """PIT curve dynamics vs ~30d / ~90d earlier (same classifier as /dynamics)."""
    analyzer = YieldAnalyzer(db)
    return await analyzer.get_dynamics_at_date(as_of)


@router.get("/spread-history/{name}")
async def get_spread_history(name: str, days: int = Query(730), db: AsyncSession = Depends(get_db)):
    analyzer = YieldAnalyzer(db)
    return await analyzer.get_spread_history(name, days)


@router.get("/real-yield-history/{maturity}")
async def get_real_yield_history(
    maturity: str, days: int = Query(730), db: AsyncSession = Depends(get_db)
):
    analyzer = YieldAnalyzer(db)
    return await analyzer.get_real_yield_history(maturity, days)


@router.get("/breakeven-history/{maturity}")
async def get_breakeven_history(
    maturity: str, days: int = Query(730), db: AsyncSession = Depends(get_db)
):
    analyzer = YieldAnalyzer(db)
    return await analyzer.get_breakeven_history(maturity, days)
