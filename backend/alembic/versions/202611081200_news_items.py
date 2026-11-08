"""News items from official feeds and aggregators.

Revision ID: news_items_001
Revises: fed_documents_001
Create Date: 2026-11-08
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "news_items_001"
down_revision = "fed_documents_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "news_items" in inspector.get_table_names():
        return  # already created by Base.metadata.create_all at app startup
    op.create_table(
        "news_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source", sa.String(length=30), nullable=False),
        sa.Column("url_hash", sa.String(length=64), nullable=False),
        sa.Column("url", sa.String(length=1000), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("published_at", sa.DateTime(), nullable=False),
        sa.Column("topic", sa.String(length=20), nullable=True),
        sa.Column("sentiment", sa.Float(), nullable=True),
        sa.Column("tickers", sa.String(length=300), nullable=True),
        sa.Column("fetched_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("url_hash", name="uq_news_url_hash"),
    )
    op.create_index("ix_news_items_published_at", "news_items", ["published_at"])
    op.create_index("ix_news_items_source", "news_items", ["source"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "news_items" in inspector.get_table_names():
        op.drop_table("news_items")
