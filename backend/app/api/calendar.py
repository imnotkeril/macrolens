from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.calendar import CalendarSummary, EventImpact
from app.services.calendar_service import CalendarService

router = APIRouter()


@router.get("/", response_model=CalendarSummary)
async def get_calendar(
    upcoming_days: int = Query(default=45, le=90),
    recent_days: int = Query(default=30, le=90),
    db: AsyncSession = Depends(get_db),
):
    service = CalendarService(db)
    return await service.get_calendar(upcoming_days=upcoming_days, recent_days=recent_days)


@router.get("/impact/{indicator_id}", response_model=EventImpact)
async def get_event_impact(
    indicator_id: int,
    limit: int = Query(default=12, le=48),
    db: AsyncSession = Depends(get_db),
):
    service = CalendarService(db)
    result = await service.get_event_impact(indicator_id, limit=limit)
    if not result:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Indicator not found")
    return result
