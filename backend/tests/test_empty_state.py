"""D-05: with no inputs the API returns an explicit empty state, never default values as facts."""

from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.cycle_engine import CycleEngine
from app.services.fed_tracker import FedTracker
from app.services.navigator_engine import RECESSION_CHECKLIST_TOTAL, NavigatorEngine
from app.services.yield_analyzer import YieldAnalyzer


def _empty_db() -> MagicMock:
    """Async session whose every query returns no rows."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    result.one_or_none.return_value = None
    result.first.return_value = None
    result.all.return_value = []
    result.scalars.return_value.all.return_value = []
    db = MagicMock()
    db.execute = AsyncMock(return_value=result)
    return db


@pytest.mark.asyncio
async def test_regime_current_empty():
    engine = CycleEngine(_empty_db())
    engine._fetch_cycle_variables = AsyncMock(
        return_value={"ism_new_orders": None, "gdp_gap": None}
    )
    snap = await engine.get_current_snapshot()
    assert snap.insufficient_data is True
    assert snap.cycle_score is None
    assert snap.phase is None and snap.phase_label is None
    assert snap.recession_prob_12m is None
    assert snap.data_completeness == 0.0
    assert snap.recession_models == [] and snap.top_drivers == []
    assert snap.tactical_allocation == [] and snap.expected_returns == []


@pytest.mark.asyncio
async def test_navigator_current_empty():
    rec = await NavigatorEngine(_empty_db()).get_recommendation()
    assert rec.insufficient_data is True
    pos = rec.position
    assert pos.quadrant is None and pos.quadrant_label is None
    assert pos.growth_score is None and pos.fed_policy_score is None
    assert pos.confidence is None and pos.direction is None and pos.date is None
    assert rec.asset_allocation is None
    assert rec.factor_tilts == [] and rec.sector_allocations == []


@pytest.mark.asyncio
async def test_navigator_has_inputs_checks_indicator_and_fed():
    db = _empty_db()
    engine = NavigatorEngine(db)
    assert await engine._axes_have_inputs() is False
    present = MagicMock()
    present.first.return_value = (1,)
    db.execute = AsyncMock(return_value=present)
    assert await engine._axes_have_inputs() is True


@pytest.mark.asyncio
async def test_cross_asset_signals_empty_curve_is_not_a_fact():
    signals = await NavigatorEngine(_empty_db()).get_cross_asset_signals()
    curve = next(s for s in signals if s.name.startswith("Yield Curve"))
    assert curve.has_data is False
    assert curve.signal == "neutral"
    assert "INVERTED" not in curve.description.upper()
    assert "Normal" not in curve.description


@pytest.mark.asyncio
async def test_recession_check_empty():
    check = await NavigatorEngine(_empty_db()).get_recession_check()
    assert check.insufficient_data is True
    assert check.confidence == "insufficient_data"
    assert check.score == 0 and check.total == RECESSION_CHECKLIST_TOTAL
    assert all(i.has_data is False for i in check.items)
    assert all(i.current_value == "N/A" for i in check.items)


@pytest.mark.asyncio
async def test_yield_curve_current_and_dynamics_empty():
    analyzer = YieldAnalyzer(_empty_db())
    snap = await analyzer.get_current_snapshot()
    assert snap.insufficient_data is True
    assert snap.date is None and snap.points == []
    dyn = await analyzer.get_dynamics_at_date(date(2026, 1, 1))
    assert dyn.insufficient_data is True


@pytest.mark.asyncio
async def test_fed_status_empty():
    tracker = FedTracker(_empty_db())
    tracker._get_latest_rate = AsyncMock(return_value=None)
    tracker._neutral_nominal = AsyncMock(return_value=3.0)
    status = await tracker.get_current_status()
    assert status.insufficient_data is True
    assert status.current_rate_upper is None and status.current_rate_lower is None
    assert status.policy_score is None and status.stance is None
    assert status.rate_direction is None and status.rate_vs_neutral_pp is None


@pytest.mark.asyncio
async def test_fed_status_with_data_unchanged():
    tracker = FedTracker(_empty_db())
    rate = MagicMock(target_upper=4.0, target_lower=3.75, effr=3.9)
    tracker._get_latest_rate = AsyncMock(return_value=rate)
    tracker._neutral_nominal = AsyncMock(return_value=3.0)
    tracker._get_rate_direction = AsyncMock(return_value="paused")
    tracker._get_balance_sheet_direction = AsyncMock(return_value="stable")
    tracker._compute_policy_score = AsyncMock(return_value=0.5)
    tracker._get_last_rate_change_date = AsyncMock(return_value=None)
    tracker._latest_rhetoric_score = AsyncMock(return_value=None)
    status = await tracker.get_current_status()
    assert status.insufficient_data is False
    assert status.current_rate_upper == 4.0
    assert status.rate_vs_neutral_pp == pytest.approx(0.875)
    assert status.policy_score == 0.5


# ---- D-22 / D-23 -------------------------------------------------------------


@pytest.mark.asyncio
async def test_forecast_lab_summary_empty():
    from app.services.forecast_lab.inference import build_summary

    summary = await build_summary(_empty_db(), date(2026, 10, 31), align_month_end=False)
    assert summary.insufficient_data is True
    assert summary.phase_class is None
    assert summary.phase_probabilities is None
    assert summary.confidence is None
    assert summary.experts is None and summary.macro_forecasts == []
    assert summary.recession_prob_12m is None and summary.dashboard_context is None
    assert summary.data_availability["categories_used"] == []
    assert summary.data_availability["fed"] is False
    assert summary.data_availability["yield_spread"] is False
    assert summary.stress.insufficient_history is True


@pytest.mark.asyncio
async def test_feature_row_availability_from_real_rows():
    from app.services.forecast_lab import features_pit

    assert await features_pit.has_fed_rate_at_date(_empty_db(), date(2026, 10, 31)) is False
    assert await features_pit.yield_spread_10y_2y_or_none(_empty_db(), date(2026, 10, 31)) is None
    assert await features_pit.yield_spread_10y_2y_at_date(_empty_db(), date(2026, 10, 31)) == 0.0
    db = _empty_db()
    db.execute.return_value.scalar_one_or_none.return_value = date(2026, 10, 1)
    assert await features_pit.has_fed_rate_at_date(db, date(2026, 10, 31)) is True


@pytest.mark.asyncio
async def test_regime_history_empty():
    engine = CycleEngine(_empty_db())
    engine._fetch_cycle_variables_at = AsyncMock(
        return_value={"ism_new_orders": None, "gdp_gap": None}
    )
    assert await engine.get_history(12) == []


@pytest.mark.asyncio
async def test_regime_history_keeps_months_with_data():
    engine = CycleEngine(_empty_db())
    engine._fetch_cycle_variables_at = AsyncMock(
        return_value={"ism_new_orders": 50.0, "gdp_gap": None}
    )
    engine._normalize_variables_at = AsyncMock(return_value={"ism_new_orders": 0.5})
    points = await engine.get_history(6)
    assert len(points) == 7
