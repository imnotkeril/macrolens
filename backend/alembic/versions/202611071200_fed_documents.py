"""FOMC statements and minutes full text.

Revision ID: fed_documents_001
Revises: fed_real_sources_001
Create Date: 2026-11-07
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "fed_documents_001"
down_revision = "fed_real_sources_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "fed_documents" in inspector.get_table_names():
        return  # already created by Base.metadata.create_all at app startup
    op.create_table(
        "fed_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("doc_type", sa.String(length=20), nullable=False),
        sa.Column("meeting_date", sa.Date(), nullable=False),
        sa.Column("release_date", sa.Date(), nullable=True),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("text_sha256", sa.String(length=64), nullable=False),
        sa.Column("fetched_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("doc_type", "meeting_date", name="uq_fed_document_type_meeting"),
    )
    op.create_index("ix_fed_documents_meeting_date", "fed_documents", ["meeting_date"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "fed_documents" in inspector.get_table_names():
        op.drop_table("fed_documents")
