"""Baseline: create the full schema if it does not exist yet.

The app historically created tables with ``Base.metadata.create_all`` at startup, so the
incremental revisions only ever contained ALTERs. This root revision makes ``alembic upgrade
head`` work on an empty database and is a no-op (``checkfirst``) on an existing one.

Revision ID: baseline_000
Revises:
Create Date: 2026-04-01
"""

from __future__ import annotations

from alembic import op
from sqlalchemy import text

from app.database import Base
from app.models import *  # noqa: F401,F403 - register all ORM tables
from app.services.memory_bootstrap import MEMORY_SCHEMAS

revision = "baseline_000"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    # pgvector is optional (may lack permission / not installed); memory falls back to hashes.
    try:
        with bind.begin_nested():
            bind.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    except Exception:
        pass
    for schema in MEMORY_SCHEMAS:
        bind.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
    Base.metadata.create_all(bind=bind, checkfirst=True)


def downgrade() -> None:
    # Dropping the whole schema is destructive; intentionally unsupported.
    pass
