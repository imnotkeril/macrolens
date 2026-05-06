from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.fed_policy import FedRate, BalanceSheet
from app.schemas.fed import (
    FedRateResponse,
    BalanceSheetResponse,
    FedPolicyStatus,
    FedDotPlotResponse,
)
from app.services.fed_tracker import FedTracker
from app.services.fed_dashboard import FedDashboardService
from app.services.fed_rate_schema import apply_fed_rate_load_columns, fed_rates_has_signal_phrase_column

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
    has_phrase_col = await fed_rates_has_signal_phrase_column(db)
    query = await apply_fed_rate_load_columns(
        db, select(FedRate).order_by(desc(FedRate.date)).limit(limit)
    )
    rows = (await db.execute(query)).scalars().all()
    # Avoid touching deferred `fomc_signal_phrase` when the column is absent (would lazy-load and 500).
    return [
        FedRateResponse(
            id=r.id,
            date=r.date,
            target_upper=r.target_upper,
            target_lower=r.target_lower,
            effr=r.effr,
            fomc_signal_phrase=r.fomc_signal_phrase if has_phrase_col else None,
        )
        for r in rows
    ]


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
    """FOMC meeting probabilities (CME FedWatch when available, else ZQ heuristic) and SEP dot path (FRED)."""
    svc = FedDashboardService(db)
    return await svc.get_fomc_dashboard()


@router.get("/dot-plot", response_model=FedDotPlotResponse)
async def get_fed_dot_plot(db: AsyncSession = Depends(get_db)):
    """FOMC SEP median federal funds path (FRED FEDTARMD / FEDTARMDLR) + market mid from DB."""
    svc = FedDashboardService(db)
    payload = await svc.get_dot_plot_payload()
    return FedDotPlotResponse(**payload)
