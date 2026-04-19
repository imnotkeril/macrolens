"""Weighted ensemble of probability vectors."""

from __future__ import annotations

from typing import Any

import numpy as np
from sklearn.metrics import log_loss

from app.services.forecast_lab.rule_phase import N_CLASSES


def align_multiclass_proba_row(
    clf: Any,
    X_row: np.ndarray,
    n_classes: int = N_CLASSES,
) -> list[float]:
    """
    Map predict_proba columns onto a fixed simplex 0..n_classes-1.
    Sklearn/XGBoost may omit absent classes in y_train, yielding fewer columns than n_classes.
    """
    raw = clf.predict_proba(X_row)[0]
    classes = getattr(clf, "classes_", None)
    if classes is None:
        classes = np.arange(len(raw), dtype=int)
    out = [0.0] * n_classes
    for c, p in zip(classes, raw):
        ci = int(c)
        if 0 <= ci < n_classes:
            out[ci] += float(p)
    s = sum(out)
    if s <= 0:
        return [1.0 / n_classes] * n_classes
    return [x / s for x in out]


def normalize_weights(w: list[float]) -> list[float]:
    s = sum(w)
    if s <= 0:
        return [1.0 / len(w)] * len(w)
    return [x / s for x in w]


def ensemble_probs(
    p_rule: list[float],
    p_hmm: list[float],
    p_gbdt: list[float],
    w_rule: float,
    w_hmm: float,
    w_gbdt: float,
) -> list[float]:
    w = normalize_weights([w_rule, w_hmm, w_gbdt])
    e = (
        w[0] * np.array(p_rule)
        + w[1] * np.array(p_hmm)
        + w[2] * np.array(p_gbdt)
    )
    s = e.sum()
    if s <= 0:
        return [0.25, 0.25, 0.25, 0.25]
    return (e / s).tolist()


def ensemble_probs_four(
    p_rule: list[float],
    p_hmm: list[float],
    p_gbdt: list[float],
    p_cycle: list[float],
    w_rule: float,
    w_hmm: float,
    w_gbdt: float,
    w_cycle: float,
) -> list[float]:
    w = normalize_weights([w_rule, w_hmm, w_gbdt, w_cycle])
    e = (
        w[0] * np.array(p_rule)
        + w[1] * np.array(p_hmm)
        + w[2] * np.array(p_gbdt)
        + w[3] * np.array(p_cycle)
    )
    s = e.sum()
    if s <= 0:
        return [0.25, 0.25, 0.25, 0.25]
    return (e / s).tolist()


def inverse_logloss_weights(
    val_rule: list[list[float]],
    val_hmm: list[list[float]],
    val_gbdt: list[list[float]],
    y_val: np.ndarray,
) -> tuple[float, float, float]:
    def ll(probs: list[list[float]]) -> float:
        if not probs or len(probs) != len(y_val):
            return 1e9
        try:
            return float(log_loss(y_val, probs))
        except ValueError:
            return 1e9

    lr, lm, lx = ll(val_rule), ll(val_hmm), ll(val_gbdt)
    inv = [1.0 / max(lr, 1e-6), 1.0 / max(lm, 1e-6), 1.0 / max(lx, 1e-6)]
    w = normalize_weights(inv)
    return float(w[0]), float(w[1]), float(w[2])


def inverse_logloss_weights_four(
    val_rule: list[list[float]],
    val_hmm: list[list[float]],
    val_gbdt: list[list[float]],
    val_cycle: list[list[float]],
    y_val: np.ndarray,
) -> tuple[float, float, float, float]:
    def ll(probs: list[list[float]]) -> float:
        if not probs or len(probs) != len(y_val):
            return 1e9
        try:
            return float(log_loss(y_val, probs))
        except ValueError:
            return 1e9

    lr, lm, lx, lc = ll(val_rule), ll(val_hmm), ll(val_gbdt), ll(val_cycle)
    inv = [
        1.0 / max(lr, 1e-6),
        1.0 / max(lm, 1e-6),
        1.0 / max(lx, 1e-6),
        1.0 / max(lc, 1e-6),
    ]
    w = normalize_weights(inv)
    return float(w[0]), float(w[1]), float(w[2]), float(w[3])
