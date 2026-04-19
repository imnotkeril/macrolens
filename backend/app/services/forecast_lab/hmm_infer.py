"""HMM posterior → quadrant probabilities (shared train/infer)."""

from __future__ import annotations

from typing import Any

import numpy as np

from app.services.forecast_lab.rule_phase import N_CLASSES


def hmm_probs_at_end(
    model: Any,
    X_seq: np.ndarray,
    state_to_quadrant: list[int],
) -> list[float]:
    _, posteriors = model.score_samples(X_seq)
    last = posteriors[-1]
    p_quad = [0.0] * N_CLASSES
    for hmm_s, post_p in enumerate(last):
        if hmm_s >= len(state_to_quadrant):
            continue
        qid = state_to_quadrant[hmm_s]
        if 0 <= qid < N_CLASSES:
            p_quad[qid] += float(post_p)
    s = sum(p_quad)
    if s <= 0:
        return [0.25] * N_CLASSES
    return [x / s for x in p_quad]


def simplex_dirichlet_smooth(p: list[float], alpha: float = 0.15) -> list[float]:
    """
    Mild Dirichlet-style smoothing so degenerate HMM quadrants (one-hot) stay readable in UI/API.
    Used only for expert breakdown display; ensemble blending should keep raw hmm_probs_at_end output.
    """
    t = [max(0.0, float(x)) + alpha for x in p]
    s = sum(t)
    if s <= 0:
        return [1.0 / N_CLASSES] * N_CLASSES
    return [x / s for x in t]
