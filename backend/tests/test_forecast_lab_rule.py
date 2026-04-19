"""Forecast Lab rule phase (no DB)."""

import numpy as np

from app.services.forecast_lab.rule_phase import (
    QUADRANT_ORDER,
    determine_quadrant,
    rule_probs,
    scores_from_phase_probs,
    scores_modal_phase,
)


def test_quadrant_q1():
    assert determine_quadrant(1.0, -0.5) == "Q1_GOLDILOCKS"


def test_rule_probs_soft_simplex_and_argmax_matches_hard_quadrant():
    g, f = 1.0, -0.5
    p = rule_probs(g, f)
    assert len(p) == 4
    assert abs(sum(p) - 1.0) < 1e-9
    q = determine_quadrant(g, f)
    assert QUADRANT_ORDER[int(np.argmax(p))] == q


def test_scores_from_phase_probs_corners():
    g, f = scores_from_phase_probs([1.0, 0.0, 0.0, 0.0])
    assert abs(g - 1.0) < 1e-9 and abs(f - (-1.0)) < 1e-9


def test_scores_modal_phase_matches_one_hot_vector():
    g, f = scores_modal_phase("Q3_OVERHEATING")
    g2, f2 = scores_from_phase_probs([0.0, 0.0, 1.0, 0.0])
    assert abs(g - g2) < 1e-9 and abs(f - f2) < 1e-9
