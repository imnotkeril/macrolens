"""Map YieldAnalyzer curve pattern string to a numeric feature for ML (bounded, deterministic)."""

from __future__ import annotations

# Order matches yield_analyzer._classify_pattern semantic groups; stable/mixed/unknown centered near 0.
CURVE_PATTERN_ORDER = [
    "bull_steepening",
    "bull_flattening",
    "bear_steepening",
    "bear_flattening",
    "stable",
    "mixed",
]

# Bundles trained before curve feature use four inputs only.
LEGACY_FEATURE_NAMES = [
    "growth_score",
    "fed_policy_score",
    "yield_10y_minus_2y",
    "hy_spread_proxy",
]


def curve_pattern_to_embed(pattern: str) -> float:
    """Map pattern to [-1, 1]; unknown patterns → 0.0."""
    p = (pattern or "").strip().lower()
    if p not in CURVE_PATTERN_ORDER:
        return 0.0
    i = CURVE_PATTERN_ORDER.index(p)
    if len(CURVE_PATTERN_ORDER) <= 1:
        return 0.0
    return -1.0 + 2.0 * i / (len(CURVE_PATTERN_ORDER) - 1)
