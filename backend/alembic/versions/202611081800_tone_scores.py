"""Tone scores for news and FOMC documents.

Revision ID: tone_scores_001
Revises: news_items_001
Create Date: 2026-11-08
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "tone_scores_001"
down_revision = "news_items_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "tone_scores" in inspector.get_table_names():
        return  # already created by Base.metadata.create_all at app startup
    op.create_table(
        "tone_scores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("doc_kind", sa.String(length=20), nullable=False),
        sa.Column("ref_id", sa.Integer(), nullable=False),
        sa.Column("model", sa.String(length=40), nullable=False),
        sa.Column("label", sa.String(length=20), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("n_units", sa.Integer(), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("scored_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("doc_kind", "ref_id", "model", name="uq_tone_doc_ref_model"),
    )
    op.create_index("ix_tone_scores_ref", "tone_scores", ["doc_kind", "ref_id"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "tone_scores" in inspector.get_table_names():
        op.drop_table("tone_scores")
