"""Add yield curve / alignment columns to regime_history_monthly.

Revision ID: reg_hist_yield_001
Revises:
Create Date: 2026-04-18
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "reg_hist_yield_001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "regime_history_monthly",
        sa.Column("yield_curve_pattern", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "regime_history_monthly",
        sa.Column("yield_curve_short_chg_1m_bp", sa.Float(), nullable=True),
    )
    op.add_column(
        "regime_history_monthly",
        sa.Column("yield_curve_long_chg_1m_bp", sa.Float(), nullable=True),
    )
    op.add_column(
        "regime_history_monthly",
        sa.Column("navigator_curve_matches_expectation", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "regime_history_monthly",
        sa.Column("fl_rule_curve_matches_expectation", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "regime_history_monthly",
        sa.Column("fl_curve_pattern_embed", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("regime_history_monthly", "fl_curve_pattern_embed")
    op.drop_column("regime_history_monthly", "fl_rule_curve_matches_expectation")
    op.drop_column("regime_history_monthly", "navigator_curve_matches_expectation")
    op.drop_column("regime_history_monthly", "yield_curve_long_chg_1m_bp")
    op.drop_column("regime_history_monthly", "yield_curve_short_chg_1m_bp")
    op.drop_column("regime_history_monthly", "yield_curve_pattern")
