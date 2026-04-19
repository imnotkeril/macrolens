from __future__ import annotations


def build_risk_overlay(
    regime_confidence: float,
    ml2_confidence: float,
    anomaly_score: float,
    anomaly_threshold: float,
    data_quality_score: float = 0.85,
) -> dict:
    anomaly_penalty = min(0.5, max(0.0, anomaly_score - anomaly_threshold))
    confidence = max(0.0, min(1.0, (0.6 * regime_confidence + 0.4 * ml2_confidence) - anomaly_penalty))
    uncertainty = 1.0 - confidence
    regime_stability_score = max(0.0, min(1.0, 1.0 - anomaly_score))
    no_trade = confidence < 0.45 or anomaly_score > (anomaly_threshold * 1.2)

    reason_codes = []
    if anomaly_score >= anomaly_threshold:
        reason_codes.append("ANOMALY_BREAKDOWN")
    if confidence < 0.45:
        reason_codes.append("LOW_CONFIDENCE")
    if data_quality_score < 0.7:
        reason_codes.append("LOW_DATA_QUALITY")
    if not reason_codes:
        reason_codes.append("SIGNALS_ALIGNED")

    return {
        "confidence": confidence,
        "uncertainty": uncertainty,
        "data_quality_score": data_quality_score,
        "regime_stability_score": regime_stability_score,
        "no_trade": no_trade,
        "reason_codes": reason_codes,
        "risk_constraints": {
            "max_gross_exposure": 0.5 if no_trade else 1.0,
            "max_single_factor_tilt": 0.2 if no_trade else 0.35,
        },
    }

