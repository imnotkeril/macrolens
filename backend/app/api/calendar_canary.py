from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.calendar_canary import CalendarCanaryEventOut
from app.services.calendar_canary_service import CalendarCanaryService

router = APIRouter()


@router.post("/refresh")
async def refresh_calendar_canary(
    days_ahead: int = Query(default=45, ge=1, le=180),
    db: AsyncSession = Depends(get_db),
):
    svc = CalendarCanaryService()
    return await svc.collect(db=db, days_ahead=days_ahead)


@router.get("/upcoming", response_model=list[CalendarCanaryEventOut])
async def get_upcoming_calendar_canary(
    days: int = Query(default=45, ge=1, le=180),
    db: AsyncSession = Depends(get_db),
):
    svc = CalendarCanaryService()
    return await svc.get_upcoming(db=db, days=days)
