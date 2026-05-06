"""Fed policy: FOMC signal phrase on fed_rates for press-release excerpts.

Revision ID: fed_real_sources_001
Revises: data_layer_qc_001
Create Date: 2026-05-04
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "fed_real_sources_001"
down_revision = "data_layer_qc_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("fed_rates")}
    if "fomc_signal_phrase" not in cols:
        op.add_column(
            "fed_rates",
            sa.Column("fomc_signal_phrase", sa.String(length=600), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("fed_rates")}
    if "fomc_signal_phrase" in cols:
        op.drop_column("fed_rates", "fomc_signal_phrase")
