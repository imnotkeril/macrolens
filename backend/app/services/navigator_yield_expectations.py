"""Load methodology expectations (yield curve shape per quadrant) for Navigator phase context."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
EXPECTATIONS_PATH = _BACKEND_ROOT / "config" / "navigator" / "quadrant_yield_curve_expectations.yaml"


@lru_cache
def load_quadrant_yield_curve_expectations() -> dict[str, Any]:
    if not EXPECTATIONS_PATH.exists():
        return {}
    with open(EXPECTATIONS_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return dict(data) if isinstance(data, dict) else {}


def expected_curve_patterns_for_quadrant(quadrant: str) -> list[str]:
    block = load_quadrant_yield_curve_expectations().get(quadrant) or {}
    raw = block.get("expected_curve_patterns") or []
    return [str(x) for x in raw if x]


def curve_pattern_matches_quadrant(quadrant: str, pattern: str) -> bool | None:
    expected = expected_curve_patterns_for_quadrant(quadrant)
    if not expected:
        return None
    return pattern in expected
