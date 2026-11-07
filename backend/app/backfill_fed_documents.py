"""One-off: load all FOMC statements and minutes (2021+) into fed_documents.

    python -m app.backfill_fed_documents

Needs DATABASE_URL (the target database). Safe to re-run: stored documents are skipped.
Takes a few minutes (~100 pages, polite delay between requests).
"""

import asyncio
import logging

from app.database import Base, async_session, engine
from app.services.fed_documents import ingest_fed_documents

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


async def main() -> None:
    import app.models  # noqa: F401 - register tables

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    total = 0
    while True:
        async with async_session() as db:
            n = await ingest_fed_documents(db, max_new=25)
            await db.commit()
        total += n
        logging.info("batch wrote %s (total %s)", n, total)
        if n == 0:
            break


if __name__ == "__main__":
    asyncio.run(main())
