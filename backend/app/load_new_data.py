"""Load historical data for newly added series.

Run after adding new Yahoo/FRED tickers to populate the database:
    python -m app.load_new_data

Loads: breadth, regime/cycle FRED (ISM, LEI, SLOOS, REAL_GDP, HY_SPREAD),
macro ETF, macro FRED series, and inflation indicators.
See macrolens/DATA_SOURCES.md for data source map and N/A fixes.
"""
import asyncio
import logging

from app.database import engine, Base
from app.seed import seed_indicators
from app.services.data_collector import DataCollector

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    logger.info("=== Step 1: Seeding indicators ===")
    await seed_indicators()

    collector = DataCollector()

    logger.info("=== Step 2: Loading breadth data (incl. NYMO, NYSI) ===")
    await collector._load_historical_breadth_data()

    logger.info("=== Step 2b: Loading regime/cycle FRED data (ISM New Orders, LEI, SLOOS, REAL_GDP, HY_SPREAD) ===")
    await collector._load_historical_regime_data()

    logger.info("=== Step 3: Loading macro ETF data (incl. HYG, IEI, LQD, HG=F, KOSPI, TAIEX) ===")
    await collector._load_historical_macro_etf_data()

    logger.info("=== Step 4: Loading macro FRED data (incl. SOFR, EFFR, MICH, Sticky CPI) ===")
    await collector._load_historical_macro_fred_data()

    logger.info("=== Step 5: Loading inflation indicator history ===")
    await collector.collect_monthly_indicators()

    logger.info("=== Done! All new data loaded. ===")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
