from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.models.intelligence import (
    SCHEMA_CORE,
    SCHEMA_MACRO,
    SCHEMA_REGIMES,
    SCHEMA_FED,
    SCHEMA_YIELD,
    SCHEMA_NAV,
    SCHEMA_DECISIONS,
    SCHEMA_ML,
    SCHEMA_NEWS,
    SCHEMA_OBS,
)

MEMORY_SCHEMAS = [
    SCHEMA_CORE,
    SCHEMA_MACRO,
    SCHEMA_REGIMES,
    SCHEMA_FED,
    SCHEMA_YIELD,
    SCHEMA_NAV,
    SCHEMA_DECISIONS,
    SCHEMA_ML,
    SCHEMA_NEWS,
    SCHEMA_OBS,
]


async def bootstrap_memory_schemas(engine: AsyncEngine) -> None:
    # Run extension bootstrap in an isolated transaction so permission errors
    # do not poison the schema-creation transaction.
    async with engine.begin() as conn:
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        except Exception:
            pass
    async with engine.begin() as conn:
        for schema in MEMORY_SCHEMAS:
            await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
