"""Navigator confidence: quadrant-aware cross-asset expectations."""

from app.schemas.navigator import CrossAssetSignal
from app.services.navigator_cross_asset_expectations import confidence_from_cross_asset_signals


def _signals_q1_aligned() -> list[CrossAssetSignal]:
    return [
        CrossAssetSignal(name="Gold", signal="bullish", value=1.0, description=""),
        CrossAssetSignal(name="Dollar (DXY)", signal="bullish", value=0.0, description=""),
        CrossAssetSignal(name="Copper", signal="bullish", value=0.0, description=""),
        CrossAssetSignal(name="VIX", signal="bullish", value=12.0, description=""),
        CrossAssetSignal(name="Yield Curve (2Y10Y)", signal="bullish", value=None, description=""),
        CrossAssetSignal(name="10Y Real Yield", signal="bullish", value=-0.5, description=""),
    ]


def test_confidence_q1_all_match_and_curve():
    c = confidence_from_cross_asset_signals(
        "Q1_GOLDILOCKS", _signals_q1_aligned(), curve_match=True
    )
    assert c == 1.0


def test_confidence_curve_mismatch_lowers_score():
    c_ok = confidence_from_cross_asset_signals(
        "Q1_GOLDILOCKS", _signals_q1_aligned(), curve_match=True
    )
    c_bad = confidence_from_cross_asset_signals(
        "Q1_GOLDILOCKS", _signals_q1_aligned(), curve_match=False
    )
    assert c_bad < c_ok
