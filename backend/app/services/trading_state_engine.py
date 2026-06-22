from __future__ import annotations

from app.schemas.navigator import CrossAssetSignal, TradingState

_STATE_EXPOSURE = {
    "risk_on": 1.0,
    "neutral": 0.7,
    "defensive": 0.4,
}


def _signal_to_score(signal: str) -> int:
    if signal == "bullish":
        return 1
    if signal == "bearish":
        return -1
    return 0


def _vol_regime(vix_value: float | None) -> str:
    if vix_value is None:
        return "normal"
    if vix_value >= 26:
        return "high"
    if vix_value <= 15:
        return "low"
    return "normal"


def build_trading_state(signals: list[CrossAssetSignal]) -> TradingState:
    by_name = {s.name: s for s in signals}
    vix = by_name.get("VIX")
    dxy = by_name.get("Dollar (DXY)")
    real_yield = by_name.get("10Y Real Yield")
    curve = by_name.get("Yield Curve (2Y10Y)")
    gold = by_name.get("Gold")

    components = [
        _signal_to_score(curve.signal) if curve else 0,
        _signal_to_score(dxy.signal) if dxy else 0,
        _signal_to_score(real_yield.signal) if real_yield else 0,
        _signal_to_score(gold.signal) if gold else 0,
    ]
    if vix:
        # VIX semantics are inverse to risk appetite:
        # bullish in our API means low fear -> risk-on, bearish means stress -> risk-off.
        components.append(_signal_to_score(vix.signal))

    valid_count = max(1, len(components))
    composite_score = max(-1.0, min(1.0, sum(components) / valid_count))
    vol_state = _vol_regime(vix.value if vix else None)

    if composite_score <= -0.35 or vol_state == "high":
        state = "defensive"
    elif composite_score >= 0.35 and vol_state != "high":
        state = "risk_on"
    else:
        state = "neutral"

    if state == "defensive":
        transition_mode = "fast_risk_off"
    elif state == "risk_on":
        transition_mode = "slow_risk_on"
    else:
        transition_mode = "hold_neutral"

    reason_codes: list[str] = []
    if vol_state == "high":
        reason_codes.append("VOLATILITY_STRESS")
    if curve and curve.signal == "bearish":
        reason_codes.append("CURVE_RECESSION_SIGNAL")
    if real_yield and real_yield.signal == "bearish":
        reason_codes.append("TIGHT_FINANCIAL_CONDITIONS")
    if dxy and dxy.signal == "bearish":
        reason_codes.append("DOLLAR_STRENGTH")
    if not reason_codes:
        reason_codes.append("BALANCED_CROSS_ASSET_SIGNALS")

    return TradingState(
        state=state,
        vol_regime=vol_state,
        target_exposure=_STATE_EXPOSURE[state],
        transition_mode=transition_mode,
        score=round(composite_score, 3),
        reason_codes=reason_codes[:3],
    )
