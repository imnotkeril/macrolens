"""Add yield curve / alignment columns to regime_history_monthly.

Revision ID: reg_hist_yield_001
Revises:
Create Date: 2026-04-18
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "reg_hist_yield_001"
down_revision = "baseline_000"
branch_labels = None
depends_on = None


def _existing_columns(table: str) -> set[str]:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def _add_column_if_missing(table: str, column: sa.Column) -> None:
    if column.name not in _existing_columns(table):
        op.add_column(table, column)


def upgrade() -> None:
    _add_column_if_missing(
        "regime_history_monthly",
        sa.Column("yield_curve_pattern", sa.String(length=32), nullable=True),
    )
    _add_column_if_missing(
        "regime_history_monthly",
        sa.Column("yield_curve_short_chg_1m_bp", sa.Float(), nullable=True),
    )
    _add_column_if_missing(
        "regime_history_monthly",
        sa.Column("yield_curve_long_chg_1m_bp", sa.Float(), nullable=True),
    )
    _add_column_if_missing(
        "regime_history_monthly",
        sa.Column("navigator_curve_matches_expectation", sa.Boolean(), nullable=True),
    )
    _add_column_if_missing(
        "regime_history_monthly",
        sa.Column("fl_rule_curve_matches_expectation", sa.Boolean(), nullable=True),
    )
    _add_column_if_missing(
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
