from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.indicator import Indicator, IndicatorCategory, IndicatorValue
from app.schemas.indicator import (
    CategoryScore,
    IndicatorResponse,
    IndicatorValueResponse,
    IndicatorWithLatest,
    KpiIndicatorsBundle,
)
from app.services.indicator_analyzer import IndicatorAnalyzer
from app.services.inflation_service import InflationService

router = APIRouter()

_KPI_CATEGORIES: tuple[IndicatorCategory, ...] = (
    IndicatorCategory.HOUSING,
    IndicatorCategory.ORDERS,
    IndicatorCategory.INCOME_SALES,
    IndicatorCategory.EMPLOYMENT,
)


async def _latest_values_by_indicator_ids(
    db: AsyncSession, ids: list[int]
) -> dict[int, IndicatorValue]:
    if not ids:
        return {}
    latest_rows = (
        (
            await db.execute(
                select(IndicatorValue)
                .where(IndicatorValue.indicator_id.in_(ids))
                .distinct(IndicatorValue.indicator_id)
                .order_by(IndicatorValue.indicator_id, desc(IndicatorValue.date))
            )
        )
        .scalars()
        .all()
    )
    return {row.indicator_id: row for row in latest_rows}


def _indicator_rows_to_latest(
    indicators: list[Indicator], latest_by_id: dict[int, IndicatorValue]
) -> list[IndicatorWithLatest]:
    out: list[IndicatorWithLatest] = []
    for ind in indicators:
        latest = latest_by_id.get(ind.id)
        out.append(
            IndicatorWithLatest(
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
            )
        )
    return out


@router.get("", response_model=list[IndicatorWithLatest])
@router.get("/", response_model=list[IndicatorWithLatest])
async def list_indicators(
    category: IndicatorCategory | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    List indicators with latest values.

    Uses one batched query for latest `IndicatorValue` per indicator (PostgreSQL
    DISTINCT ON) instead of N+1 round-trips. Prefer `GET /kpi-bundle` for the
    macro-sentiment KPI strip (single request vs four parallel `/` calls).
    """
    query = select(Indicator)
    if category:
        query = query.where(Indicator.category == category)
    query = query.order_by(Indicator.category, Indicator.importance.desc())
    result = await db.execute(query)
    indicators = list(result.scalars().all())

    ids = [ind.id for ind in indicators]
    latest_by_id = await _latest_values_by_indicator_ids(db, ids)
    return _indicator_rows_to_latest(indicators, latest_by_id)


@router.get("/kpi-bundle", response_model=KpiIndicatorsBundle)
async def kpi_indicators_bundle(db: AsyncSession = Depends(get_db)):
    """Housing, orders, income_sales, and employment lists in one response."""
    result = await db.execute(
        select(Indicator)
        .where(Indicator.category.in_(_KPI_CATEGORIES))
        .order_by(Indicator.category, Indicator.importance.desc())
    )
    indicators = list(result.scalars().all())
    latest_by_id = await _latest_values_by_indicator_ids(db, [ind.id for ind in indicators])
    enriched = _indicator_rows_to_latest(indicators, latest_by_id)

    buckets: dict[IndicatorCategory, list[IndicatorWithLatest]] = {c: [] for c in _KPI_CATEGORIES}
    for row in enriched:
        buckets[row.category].append(row)

    return KpiIndicatorsBundle(
        housing=buckets[IndicatorCategory.HOUSING],
        orders=buckets[IndicatorCategory.ORDERS],
        income_sales=buckets[IndicatorCategory.INCOME_SALES],
        employment=buckets[IndicatorCategory.EMPLOYMENT],
    )


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
async def get_indicator(indicator_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Indicator).where(Indicator.id == indicator_id))
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
