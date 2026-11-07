"""One-off: load the full S&P 500 breadth history into market_data.

    python -m app.backfill_breadth

Needs DATABASE_URL (the target database) in the environment. Safe to re-run: existing
rows are left untouched. Takes a few minutes (downloads ~500 tickers in chunks).
"""

import asyncio
import logging

from app.services.data_collector import DataCollector

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


async def main() -> None:
    await DataCollector()._load_historical_breadth_data()


if __name__ == "__main__":
    asyncio.run(main())
