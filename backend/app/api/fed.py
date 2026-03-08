from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.models.fed_policy import FedRate, BalanceSheet
from app.schemas.fed import FedRateResponse, BalanceSheetResponse, FedPolicyStatus
from app.services.fed_tracker import FedTracker
from app.services.fed_dashboard import FedDashboardService

router = APIRouter()


@router.get("/current", response_model=FedPolicyStatus)
async def get_fed_status(db: AsyncSession = Depends(get_db)):
    tracker = FedTracker(db)
    return await tracker.get_current_status()


@router.get("/rate-history", response_model=list[FedRateResponse])
async def get_rate_history(
    limit: int = Query(default=120, le=5000),
    db: AsyncSession = Depends(get_db),
):
    query = select(FedRate).order_by(desc(FedRate.date)).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/balance-sheet", response_model=list[BalanceSheetResponse])
async def get_balance_sheet_history(
    limit: int = Query(default=120, le=5000),
    db: AsyncSession = Depends(get_db),
):
    query = select(BalanceSheet).order_by(desc(BalanceSheet.date)).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/fomc-dashboard")
async def get_fomc_dashboard(db: AsyncSession = Depends(get_db)):
    """FOMC meeting probabilities (approximate from ZQ) and rate path."""
    svc = FedDashboardService(db)
    return await svc.get_fomc_dashboard()
