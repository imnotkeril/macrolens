"""Phase labels from rule baseline (L1)."""

from __future__ import annotations

from app.services.forecast_lab.rule_phase import QUADRANT_TO_ID, determine_quadrant


def rule_label_from_features(growth: float, fed: float) -> int:
    q = determine_quadrant(growth, fed)
    return QUADRANT_TO_ID[q]


def rule_labels_batch(X: list[list[float]]) -> list[int]:
    return [rule_label_from_features(row[0], row[1]) for row in X]
