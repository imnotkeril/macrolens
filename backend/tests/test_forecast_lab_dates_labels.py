"""Forecast Lab: month-end alignment and asset-implied label scoring (no DB)."""

from datetime import date

from app.services.forecast_lab.asset_implied_labels_core import (
    _PriceSeries,
    forward_pair_hit_rate_for_quadrant,
    pick_quadrant,
    quadrant_scores_from_prices,
)
from app.services.forecast_lab.dates_util import latest_month_end_on_or_before
from app.services.forecast_lab.curve_pattern_features import curve_pattern_to_embed
from app.services.forecast_lab.rule_phase import QUADRANT_TO_ID


def test_latest_month_end_mid_month():
    assert latest_month_end_on_or_before(date(2024, 6, 15)) == date(2024, 5, 31)


def test_latest_month_end_on_month_end():
    assert latest_month_end_on_or_before(date(2024, 6, 30)) == date(2024, 6, 30)


def test_asset_implied_pick_uses_rule_on_tie():
    """When rule quadrant is among tied best scores, keep rule id."""
    scores = {
        "Q1_GOLDILOCKS": 0.5,
        "Q2_REFLATION": 0.5,
        "Q3_OVERHEATING": 0.2,
        "Q4_STAGFLATION": 0.1,
    }
    rule_id = QUADRANT_TO_ID["Q2_REFLATION"]
    qid, fb = pick_quadrant(scores, rule_id)
    assert qid == rule_id
    assert fb is False


def test_quadrant_scores_empty_pairs():
    exp = {"quadrant_phases": {}}
    m = {"SPY": _PriceSeries([date(2024, 1, 31), date(2024, 2, 29)], [100.0, 102.0])}
    sc = quadrant_scores_from_prices(m, date(2024, 1, 31), date(2024, 2, 29), exp)
    assert sc == {}


def test_curve_pattern_embed_bounds():
    assert -1.0 <= curve_pattern_to_embed("bull_steepening") <= 1.0
    assert curve_pattern_to_embed("unknown_pattern_xyz") == 0.0


def test_forward_pair_hit_rate_positive_spread():
    """Forward window: long outperforms short → hit for expected_sign positive."""
    exp = {
        "quadrant_phases": {
            "Q1_GOLDILOCKS": {
                "pairs": [
                    {"asset_long": "IWM", "asset_short": "SPY", "expected_sign": "positive"},
                ]
            }
        }
    }
    m = {
        "IWM": _PriceSeries([date(2024, 1, 31), date(2024, 2, 29)], [100.0, 110.0]),
        "SPY": _PriceSeries([date(2024, 1, 31), date(2024, 2, 29)], [100.0, 105.0]),
    }
    hr = forward_pair_hit_rate_for_quadrant(
        m, date(2024, 1, 31), date(2024, 2, 29), "Q1_GOLDILOCKS", exp
    )
    assert hr == 1.0
