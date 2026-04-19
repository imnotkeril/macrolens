"""HMM display smoothing (no model fit)."""

from app.services.forecast_lab.hmm_infer import simplex_dirichlet_smooth


def test_simplex_dirichlet_smooth_removes_exact_one_hot():
    p = [0.0, 1.0, 0.0, 0.0]
    s = simplex_dirichlet_smooth(p, alpha=0.15)
    assert len(s) == 4
    assert abs(sum(s) - 1.0) < 1e-9
    assert max(s) < 0.99
    assert min(s) > 0.01
