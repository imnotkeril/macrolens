from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.models.indicator import Indicator, IndicatorValue, IndicatorCategory
from app.schemas.indicator import (
    IndicatorResponse, IndicatorWithLatest, IndicatorValueResponse, CategoryScore,
)
from app.services.indicator_analyzer import IndicatorAnalyzer
from app.services.inflation_service import InflationService

router = APIRouter()


@router.get("/", response_model=list[IndicatorWithLatest])
async def list_indicators(
    category: IndicatorCategory | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Indicator)
    if category:
        query = query.where(Indicator.category == category)
    query = query.order_by(Indicator.category, Indicator.importance.desc())
    result = await db.execute(query)
    indicators = result.scalars().all()

    enriched = []
    for ind in indicators:
        latest_q = (
            select(IndicatorValue)
            .where(IndicatorValue.indicator_id == ind.id)
            .order_by(desc(IndicatorValue.date))
            .limit(1)
        )
        latest_result = await db.execute(latest_q)
        latest = latest_result.scalar_one_or_none()

        enriched.append(IndicatorWithLatest(
            id=ind.id,
            name=ind.name,
            fred_series_id=ind.fred_series_id,
            category=ind.category,
            importance=ind.importance,
            indicator_type=ind.indicator_type,
            frequency=ind.frequency,
            source=ind.source,
            description=ind.description,
            unit=ind.unit,
            latest_value=latest.value if latest else None,
            latest_date=latest.date if latest else None,
            previous_value=latest.previous if latest else None,
            trend=latest.trend if latest else None,
            z_score=latest.z_score if latest else None,
            surprise=latest.surprise if latest else None,
        ))
    return enriched


@router.get("/categories", response_model=list[CategoryScore])
async def get_category_scores(db: AsyncSession = Depends(get_db)):
    analyzer = IndicatorAnalyzer(db)
    return await analyzer.compute_category_scores()


@router.get("/inflation-series/{name}")
async def get_inflation_series(
    name: str,
    transform: str = Query("yoy"),
    days: int = Query(365 * 5),
    db: AsyncSession = Depends(get_db),
):
    svc = InflationService(db)
    return await svc.get_inflation_series(name, transform, days)


@router.get("/inflation-latest")
async def get_inflation_latest(db: AsyncSession = Depends(get_db)):
    svc = InflationService(db)
    return await svc.get_all_inflation_latest()


@router.get("/inflation-dashboard")
async def get_inflation_dashboard(
    days: int = Query(365 * 5),
    db: AsyncSession = Depends(get_db),
):
    svc = InflationService(db)
    return await svc.get_inflation_dashboard(days)


@router.get("/{indicator_id}", response_model=IndicatorResponse)
async def get_indicator(
    indicator_id: int, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Indicator).where(Indicator.id == indicator_id)
    )
    indicator = result.scalar_one_or_none()
    if not indicator:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Indicator not found")
    return indicator


@router.get("/{indicator_id}/history", response_model=list[IndicatorValueResponse])
async def get_indicator_history(
    indicator_id: int,
    limit: int = Query(default=120, le=600),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(IndicatorValue)
        .where(IndicatorValue.indicator_id == indicator_id)
        .order_by(desc(IndicatorValue.date))
        .limit(limit)
    )
    result = await db.execute(query)
    return result.scalars().all()
