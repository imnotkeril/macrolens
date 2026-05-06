"""
FedRate table introspection — support DBs deployed before `fomc_signal_phrase` was added.

ORM `select(FedRate)` loads all mapped columns and fails if a column is missing in PostgreSQL.
We use `load_only(...)` with a column set that matches the live schema.
"""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only

from app.models.fed_policy import FedRate

logger = logging.getLogger(__name__)

_lock = asyncio.Lock()
_has_fomc_signal_phrase: bool | None = None


async def fed_rates_has_signal_phrase_column(db: AsyncSession) -> bool:
    """True if `public.fed_rates.fomc_signal_phrase` exists (cached per process)."""
    global _has_fomc_signal_phrase
    if _has_fomc_signal_phrase is not None:
        return _has_fomc_signal_phrase
    async with _lock:
        if _has_fomc_signal_phrase is not None:
            return _has_fomc_signal_phrase
        try:
            r = await db.execute(
                text(
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_schema = 'public' AND table_name = 'fed_rates' "
                    "AND column_name = 'fomc_signal_phrase' LIMIT 1"
                )
            )
            _has_fomc_signal_phrase = r.scalar_one_or_none() is not None
        except Exception:
            logger.exception("Could not introspect fed_rates.fomc_signal_phrase; assuming absent")
            _has_fomc_signal_phrase = False
        return _has_fomc_signal_phrase


async def apply_fed_rate_load_columns(db: AsyncSession, stmt):
    """Attach `load_only` so SELECT omits `fomc_signal_phrase` when the column is absent."""
    if await fed_rates_has_signal_phrase_column(db):
        return stmt.options(
            load_only(
                FedRate.id,
                FedRate.date,
                FedRate.target_upper,
                FedRate.target_lower,
                FedRate.effr,
                FedRate.fomc_signal_phrase,
                FedRate.created_at,
            )
        )
    return stmt.options(
        load_only(
            FedRate.id,
            FedRate.date,
            FedRate.target_upper,
            FedRate.target_lower,
            FedRate.effr,
            FedRate.created_at,
        )
    )
