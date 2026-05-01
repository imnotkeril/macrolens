"""Add market data quality fields and calendar canary tables.

Revision ID: data_layer_qc_001
Revises: reg_hist_fwd_001
Create Date: 2026-04-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "data_layer_qc_001"
down_revision = "reg_hist_fwd_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    market_cols = {col["name"] for col in inspector.get_columns("market_data")}
    if "source" not in market_cols:
        op.add_column(
            "market_data",
            sa.Column(
                "source",
                sa.String(length=50),
                nullable=False,
                server_default="unknown",
            ),
        )
        op.alter_column("market_data", "source", server_default=None)
    if "as_of" not in market_cols:
        op.add_column(
            "market_data",
            sa.Column("as_of", sa.DateTime(), nullable=True),
        )
    if "quality_status" not in market_cols:
        op.add_column(
            "market_data",
            sa.Column(
                "quality_status",
                sa.String(length=20),
                nullable=False,
                server_default="ok",
            ),
        )
        op.alter_column("market_data", "quality_status", server_default=None)

    tables = set(inspector.get_table_names())
    if "economic_calendar_events" not in tables:
        op.create_table(
            "economic_calendar_events",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("source", sa.String(length=50), nullable=False),
            sa.Column("event_name", sa.String(length=200), nullable=False),
            sa.Column("event_date", sa.Date(), nullable=False),
            sa.Column("country", sa.String(length=30), nullable=True),
            sa.Column("frequency", sa.String(length=30), nullable=True),
            sa.Column("importance", sa.Integer(), nullable=True),
            sa.Column("actual", sa.Float(), nullable=True),
            sa.Column("previous", sa.Float(), nullable=True),
            sa.Column("forecast", sa.Float(), nullable=True),
            sa.Column("quality_status", sa.String(length=20), nullable=False),
            sa.Column("published_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "source",
                "event_name",
                "event_date",
                name="uq_economic_calendar_event",
            ),
        )
    econ_indexes = {idx["name"] for idx in inspector.get_indexes("economic_calendar_events")}
    if "ix_economic_calendar_event_date" not in econ_indexes:
        op.create_index(
            "ix_economic_calendar_event_date",
            "economic_calendar_events",
            ["event_date"],
            unique=False,
        )
    if "ix_economic_calendar_event_source" not in econ_indexes:
        op.create_index(
            "ix_economic_calendar_event_source",
            "economic_calendar_events",
            ["source"],
            unique=False,
        )

    if "source_health_metrics" not in tables:
        op.create_table(
            "source_health_metrics",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("source", sa.String(length=50), nullable=False),
            sa.Column("metric_name", sa.String(length=80), nullable=False),
            sa.Column("metric_value", sa.Float(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("note", sa.String(length=500), nullable=True),
            sa.Column("measured_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
    health_indexes = {idx["name"] for idx in inspector.get_indexes("source_health_metrics")}
    if "ix_source_health_metric" not in health_indexes:
        op.create_index(
            "ix_source_health_metric",
            "source_health_metrics",
            ["metric_name"],
            unique=False,
        )
    if "ix_source_health_source" not in health_indexes:
        op.create_index(
            "ix_source_health_source",
            "source_health_metrics",
            ["source"],
            unique=False,
        )


def downgrade() -> None:
    op.drop_index("ix_source_health_source", table_name="source_health_metrics")
    op.drop_index("ix_source_health_metric", table_name="source_health_metrics")
    op.drop_table("source_health_metrics")

    op.drop_index(
        "ix_economic_calendar_event_source",
        table_name="economic_calendar_events",
    )
    op.drop_index(
        "ix_economic_calendar_event_date",
        table_name="economic_calendar_events",
    )
    op.drop_table("economic_calendar_events")

    op.drop_column("market_data", "quality_status")
    op.drop_column("market_data", "as_of")
    op.drop_column("market_data", "source")
