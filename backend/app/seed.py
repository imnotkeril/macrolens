"""Seed the indicators table with all 30 tracked indicators."""
import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.database import engine, Base, async_session
from app.models.indicator import (
    Indicator, IndicatorCategory, IndicatorType, Frequency, Importance,
)
from app.services.fred_client import INDICATOR_SERIES

logger = logging.getLogger(__name__)

CATEGORY_MAP = {
    "housing": IndicatorCategory.HOUSING,
    "orders": IndicatorCategory.ORDERS,
    "income_sales": IndicatorCategory.INCOME_SALES,
    "employment": IndicatorCategory.EMPLOYMENT,
    "inflation": IndicatorCategory.INFLATION,
}

TYPE_MAP = {
    "leading": IndicatorType.LEADING,
    "coincident": IndicatorType.COINCIDENT,
    "lagging": IndicatorType.LAGGING,
}

FREQ_MAP = {
    "daily": Frequency.DAILY,
    "weekly": Frequency.WEEKLY,
    "monthly": Frequency.MONTHLY,
    "quarterly": Frequency.QUARTERLY,
}

IMPORTANCE_MAP = {
    1: Importance.LOW,
    2: Importance.MEDIUM,
    3: Importance.HIGH,
}


async def seed_indicators():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        for name, meta in INDICATOR_SERIES.items():
            stmt = pg_insert(Indicator).values(
                name=name,
                fred_series_id=meta["fred_id"],
                category=CATEGORY_MAP[meta["category"]],
                importance=IMPORTANCE_MAP[meta["importance"]],
                indicator_type=TYPE_MAP[meta["type"]],
                frequency=FREQ_MAP[meta["frequency"]],
                source=meta["source"],
                unit=meta.get("unit"),
            ).on_conflict_do_update(
                index_elements=["fred_series_id"],
                set_={
                    "name": name,
                    "category": CATEGORY_MAP[meta["category"]],
                    "importance": IMPORTANCE_MAP[meta["importance"]],
                    "indicator_type": TYPE_MAP[meta["type"]],
                    "frequency": FREQ_MAP[meta["frequency"]],
                    "source": meta["source"],
                    "unit": meta.get("unit"),
                },
            )
            await db.execute(stmt)

        await db.commit()

        count = (await db.execute(select(Indicator))).scalars().all()
        logger.info("Seeded %d indicators", len(count))
        print(f"Seeded {len(count)} indicators successfully")


async def main():
    logging.basicConfig(level=logging.INFO)
    await seed_indicators()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
