"""Ensemble weight normalization."""

from app.services.forecast_lab.ensemble import ensemble_probs, normalize_weights


def test_normalize_weights_zero_sum_uniform():
    assert normalize_weights([0.0, 0.0, 0.0]) == [1 / 3, 1 / 3, 1 / 3]


def test_normalize_weights_positive():
    w = normalize_weights([1.0, 2.0, 3.0])
    assert abs(sum(w) - 1.0) < 1e-9
    assert w == [1 / 6, 2 / 6, 3 / 6]


def test_ensemble_probs_sums_one():
    p = ensemble_probs(
        [1.0, 0.0, 0.0, 0.0],
        [0.0, 1.0, 0.0, 0.0],
        [0.0, 0.0, 1.0, 0.0],
        1.0,
        1.0,
        1.0,
    )
    assert len(p) == 4
    assert abs(sum(p) - 1.0) < 1e-6
