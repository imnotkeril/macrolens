"""Add forward confirmation columns to regime_history_monthly.

Revision ID: reg_hist_fwd_001
Revises: reg_hist_yield_001
Create Date: 2026-04-19
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "reg_hist_fwd_001"
down_revision = "reg_hist_yield_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "regime_history_monthly",
        sa.Column(
            "forward_confirmation_score",
            sa.Float(),
            nullable=False,
            server_default="-1",
        ),
    )
    op.add_column(
        "regime_history_monthly",
        sa.Column(
            "forward_regime_confirmed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "regime_history_monthly",
        sa.Column("confirmed_regime_quadrant", sa.String(length=32), nullable=True),
    )
    op.alter_column(
        "regime_history_monthly",
        "forward_confirmation_score",
        server_default=None,
    )
    op.alter_column(
        "regime_history_monthly",
        "forward_regime_confirmed",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column("regime_history_monthly", "confirmed_regime_quadrant")
    op.drop_column("regime_history_monthly", "forward_regime_confirmed")
    op.drop_column("regime_history_monthly", "forward_confirmation_score")
