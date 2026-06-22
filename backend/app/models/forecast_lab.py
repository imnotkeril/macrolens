"""Forecast Lab persistence — isolated from legacy ML tables."""

from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ForecastLabPredictionLog(Base):
    __tablename__ = "forecast_lab_prediction_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    bundle_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    payload_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RecessionLabel(Base):
    __tablename__ = "recession_labels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obs_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False)  # nber, internal_rule_v1
    is_recession: Mapped[bool] = mapped_column(Boolean, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class RegimeHistoryMonthly(Base):
    """
    One row per calendar month-end: rule plane vs asset-implied label vs forward validation.

    * navigator_quadrant and fl_rule_quadrant are materialized to the same value (PIT growth×fed rule plane);
      UI shows a single "rule plane" column. Ensemble phase history is not stored here yet.
    * Asset columns (lookback): implied quadrant from realized returns ending at obs_date (train-label window);
      asset_confirmation_score is the hit rate for that implied quadrant — independent of forward OK.
    * Forward confirmation: validates fl_rule_quadrant only — mean hit rate of YAML asset pairs over
      obs_date→obs_date+H (same semantics as phase_alignment). Not "rule vs asset_implied" comparison.
    * Yield curve: PIT pattern at obs_date (YieldAnalyzer) vs quadrant YAML expectations.
    """

    __tablename__ = "regime_history_monthly"
    __table_args__ = (UniqueConstraint("obs_date", name="uq_regime_history_monthly_obs_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obs_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    navigator_growth_score: Mapped[float] = mapped_column(Float, nullable=False)
    navigator_fed_score: Mapped[float] = mapped_column(Float, nullable=False)
    navigator_quadrant: Mapped[str] = mapped_column(String(32), nullable=False)

    fl_growth_score: Mapped[float] = mapped_column(Float, nullable=False)
    fl_fed_policy_score: Mapped[float] = mapped_column(Float, nullable=False)
    fl_yield_10y_minus_2y: Mapped[float] = mapped_column(Float, nullable=False)
    fl_hy_spread_proxy: Mapped[float] = mapped_column(Float, nullable=False)
    fl_rule_quadrant: Mapped[str] = mapped_column(String(32), nullable=False)

    asset_implied_quadrant: Mapped[str] = mapped_column(String(32), nullable=False)
    asset_confirmation_score: Mapped[float] = mapped_column(Float, nullable=False)  # -1 if no pairs
    asset_confirmed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    asset_used_rule_fallback: Mapped[bool] = mapped_column(Boolean, nullable=False)

    # Forward confirmation of fl_rule_quadrant over evaluation_horizon_months (YAML / phase_alignment).
    forward_confirmation_score: Mapped[float] = mapped_column(
        Float, nullable=False
    )  # -1 if not evaluable
    forward_regime_confirmed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    confirmed_regime_quadrant: Mapped[str | None] = mapped_column(String(32), nullable=True)

    # PIT yield curve dynamics (YieldAnalyzer) + methodology YAML alignment (TZ §5–§6).
    yield_curve_pattern: Mapped[str | None] = mapped_column(String(32), nullable=True)
    yield_curve_short_chg_1m_bp: Mapped[float | None] = mapped_column(Float, nullable=True)
    yield_curve_long_chg_1m_bp: Mapped[float | None] = mapped_column(Float, nullable=True)
    navigator_curve_matches_expectation: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    fl_rule_curve_matches_expectation: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    fl_curve_pattern_embed: Mapped[float | None] = mapped_column(Float, nullable=True)

    materialization_batch_id: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    materialized_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
