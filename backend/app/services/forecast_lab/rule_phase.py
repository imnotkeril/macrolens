"""Rule-based quadrant — thresholds from config/forecast_lab/phase_rule.yaml."""

from __future__ import annotations

import math

from app.services.forecast_lab.rule_loader import match_quadrant

QUADRANT_ORDER = ["Q1_GOLDILOCKS", "Q2_REFLATION", "Q3_OVERHEATING", "Q4_STAGFLATION"]
QUADRANT_TO_ID = {q: i for i, q in enumerate(QUADRANT_ORDER)}
ID_TO_QUADRANT = {i: q for q, i in QUADRANT_TO_ID.items()}
N_CLASSES = 4

# Soft partition matching phase_rule.yaml (sign split at 0). Higher gamma → closer to one-hot.
_DEFAULT_RULE_SOFT_GAMMA = 4.0

# Barycenter anchors in (growth_score, fed_policy_score) space for QUADRANT_ORDER indices.
# Q1: g>=0 f<=0 → (+, -); Q2: (-, -); Q3: (+, +); Q4: (-, +)
_QUADRANT_ANCHOR_GF: list[tuple[float, float]] = [
    (1.0, -1.0),
    (-1.0, -1.0),
    (1.0, 1.0),
    (-1.0, 1.0),
]


def determine_quadrant(growth_score: float, fed_policy_score: float) -> str:
    return match_quadrant(growth_score, fed_policy_score)


def rule_probs_soft(
    growth_score: float,
    fed_policy_score: float,
    *,
    gamma: float = _DEFAULT_RULE_SOFT_GAMMA,
) -> list[float]:
    """
    Differentiable relaxation of the YAML rule partition: product of sigmoids on growth and fed sides.
    Recovers hard quadrant as gamma → ∞; matches determine_quadrant at moderate gamma.
    """
    g, f = growth_score, fed_policy_score
    gg = max(gamma, 1e-6)
    # Positive growth mass σ(γg); easy Fed (fed<=0) mass σ(-γf)
    s_pos = 1.0 / (1.0 + math.exp(-gg * g))
    s_easy = 1.0 / (1.0 + math.exp(gg * f))
    s_neg = 1.0 - s_pos
    s_tight = 1.0 - s_easy
    raw = [
        s_pos * s_easy,   # Q1
        s_neg * s_easy,   # Q2
        s_pos * s_tight,  # Q3
        s_neg * s_tight,  # Q4
    ]
    ssum = sum(raw)
    if ssum <= 0:
        return [0.25, 0.25, 0.25, 0.25]
    return [x / ssum for x in raw]


def rule_probs(growth_score: float, fed_policy_score: float) -> list[float]:
    """Soft rule probabilities (ensemble L1 expert)."""
    return rule_probs_soft(growth_score, fed_policy_score)


def scores_from_phase_probs(p: list[float], *, clamp: float = 2.0) -> tuple[float, float]:
    """Map quadrant probability vector to (growth, fed) barycenter using fixed corner anchors."""
    if len(p) != N_CLASSES:
        return 0.0, 0.0
    g = sum(pi * ai[0] for pi, ai in zip(p, _QUADRANT_ANCHOR_GF, strict=True))
    ff = sum(pi * ai[1] for pi, ai in zip(p, _QUADRANT_ANCHOR_GF, strict=True))
    return max(-clamp, min(clamp, g)), max(-clamp, min(clamp, ff))


def scores_modal_phase(phase_class: str, *, clamp: float = 2.0) -> tuple[float, float]:
    """
    Corner anchor for the named quadrant — matches ensemble headline (argmax class).
    Use for navigator dots so the plotted phase matches the text label; use scores_from_phase_probs
    for the probability-mass center (mix), which can fall in a different visual quadrant.
    """
    idx = QUADRANT_TO_ID.get(phase_class)
    if idx is None:
        return 0.0, 0.0
    p = [0.0] * N_CLASSES
    p[idx] = 1.0
    return scores_from_phase_probs(p, clamp=clamp)
