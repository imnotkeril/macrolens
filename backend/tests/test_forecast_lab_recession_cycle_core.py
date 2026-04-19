"""Pure helpers: forward recession labels and cycle→quadrant priors (no DB)."""

from datetime import date

import numpy as np

from app.services.forecast_lab.cycle_phase_probs import bucket_score_to_quadrant_probs
from app.services.forecast_lab.recession_labels_core import forward_recession_within_months


def test_forward_recession_detects_month_within_horizon():
    s_dates = [date(2007, 12, 1), date(2008, 3, 1)]
    s_rec = [False, True]
    assert forward_recession_within_months(s_dates, s_rec, date(2007, 12, 31), 12) == 1


def test_forward_recession_negative_when_no_future_recession():
    s_dates = [date(2015, 1, 1), date(2015, 2, 1)]
    s_rec = [False, False]
    assert forward_recession_within_months(s_dates, s_rec, date(2015, 1, 31), 12) == 0


def test_cycle_bucket_probs_sum_to_one():
    p = bucket_score_to_quadrant_probs("expansion", 40.0)
    assert len(p) == 4
    assert abs(sum(p) - 1.0) < 1e-6
    assert min(p) >= 0.02


def test_inverse_logloss_four_normalizes():
    from app.services.forecast_lab.ensemble import inverse_logloss_weights_four

    y = np.array([0, 1, 0, 1])
    u = [[0.25] * 4 for _ in range(len(y))]
    w0, w1, w2, w3 = inverse_logloss_weights_four(u, u, u, u, y)
    assert abs(w0 + w1 + w2 + w3 - 1.0) < 1e-5
