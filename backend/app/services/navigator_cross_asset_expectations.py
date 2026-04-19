"""Quadrant-specific cross-asset signal expectations for Navigator confidence (TZ)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from app.schemas.navigator import CrossAssetSignal

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_CONFIG_PATH = _BACKEND_ROOT / "config" / "navigator" / "quadrant_cross_asset_expectations.yaml"


@lru_cache
def load_cross_asset_expectations() -> dict[str, Any]:
    if not _CONFIG_PATH.exists():
        return {}
    with open(_CONFIG_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return dict(data) if isinstance(data, dict) else {}


def expected_signal_for(quadrant: str, signal_name: str) -> str | None:
    block = load_cross_asset_expectations().get(quadrant) or {}
    m = block.get("cross_asset") or {}
    v = m.get(signal_name)
    return str(v).lower() if v is not None else None


def confidence_from_cross_asset_signals(
    quadrant: str,
    signals: list[CrossAssetSignal],
    *,
    curve_match: bool | None,
    neutral_partial: float = 0.5,
    curve_weight: float = 0.35,
) -> float:
    """
    Average score over signals that have an expectation for this quadrant.
    neutral_partial credit when observed signal is neutral.
    Blend with curve_match when not None (curve_weight toward curve alignment).
    """
    if not signals:
        return 0.5

    scores: list[float] = []
    for s in signals:
        want = expected_signal_for(quadrant, s.name)
        if want is None:
            continue
        got = (s.signal or "neutral").lower()
        if want == "neutral":
            scores.append(1.0 if got == "neutral" else 0.75)
            continue
        if got == want:
            scores.append(1.0)
        elif got == "neutral":
            scores.append(neutral_partial)
        else:
            scores.append(0.0)

    if not scores:
        confirming = sum(1 for s in signals if s.signal != "neutral")
        base = min(1.0, confirming / len(signals))
    else:
        base = sum(scores) / len(scores)

    if curve_match is None:
        return round(min(1.0, max(0.0, base)), 2)
    curve_term = 1.0 if curve_match else 0.25
    blended = (1.0 - curve_weight) * base + curve_weight * curve_term
    return round(min(1.0, max(0.0, blended)), 2)
