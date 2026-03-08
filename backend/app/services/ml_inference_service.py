"""
ML Inference Service: load trained artifacts and return current regime predict + backtest.

Uses Rule + Markov + XGBoost ensemble. No DB dependency for inference; features
for "now" must be provided by the caller (from Navigator + Regime/Market APIs).
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import xgboost as xgb

from app.config import get_settings
from app.services.ml_dataset_builder import (
    QUADRANT_TO_ID,
    ID_TO_QUADRANT,
    FEATURE_COLUMNS,
    _determine_quadrant,
)
from app.services.ml_regime_models import (
    N_CLASSES,
    rule_predict,
    MarkovModel,
    XGBoostModel,
)

logger = logging.getLogger(__name__)


def _load_artifacts(artifacts_dir: str | None = None) -> tuple[dict, np.ndarray, xgb.XGBClassifier | None]:
    settings = get_settings()
    art_path = Path(artifacts_dir or settings.ml_artifacts_dir)
    meta_path = art_path / "meta.json"
    if not meta_path.exists():
        return {}, np.zeros((N_CLASSES, N_CLASSES)), None
    with open(meta_path) as f:
        meta = json.load(f)
    trans = np.load(art_path / "markov_transition.npy")
    xgb_path = art_path / "xgboost_model.json"
    xgb_model = None
    if xgb_path.exists():
        xgb_model = xgb.XGBClassifier()
        xgb_model.load_model(str(xgb_path))
    return meta, trans, xgb_model


def predict_current(
    growth_score: float,
    fed_policy_score: float,
    cycle_score: float | None = None,
    feature_row: dict[str, float] | None = None,
    artifacts_dir: str | None = None,
) -> dict[str, Any]:
    """
    Current (nowcast) prediction: ensemble P(Q1..Q4), predicted quadrant, per-model probs.
    feature_row can contain cycle_score and optional extra features for XGBoost; if None,
    only growth_score and fed_policy_score are used (Rule + Markov with last quadrant from rule).
    """
    meta, trans, xgb_model = _load_artifacts(artifacts_dir)
    if not meta:
        # No model: return rule only
        probs_rule = rule_predict(growth_score, fed_policy_score)
        q_rule = _determine_quadrant(growth_score, fed_policy_score)
        return {
            "ensemble_weights": None,
            "quadrant_rule": q_rule,
            "quadrant_ensemble": q_rule,
            "confidence": float(max(probs_rule)),
            "p_q1": probs_rule[0],
            "p_q2": probs_rule[1],
            "p_q3": probs_rule[2],
            "p_q4": probs_rule[3],
            "by_model": {
                "rule": {"quadrant": q_rule, "p_q1": probs_rule[0], "p_q2": probs_rule[1], "p_q3": probs_rule[2], "p_q4": probs_rule[3]},
                "markov": {"quadrant": None, "p_q1": None, "p_q2": None, "p_q3": None, "p_q4": None},
                "xgboost": {"quadrant": None, "p_q1": None, "p_q2": None, "p_q3": None, "p_q4": None},
            },
            "trained": False,
        }

    weights = meta.get("ensemble_weights", {})
    w_rule = weights.get("rule", 1.0 / 3)
    w_markov = weights.get("markov", 1.0 / 3)
    w_xgb = weights.get("xgboost", 1.0 / 3)

    probs_rule = rule_predict(growth_score, fed_policy_score)
    q_rule = _determine_quadrant(growth_score, fed_policy_score)
    last_qid = QUADRANT_TO_ID[q_rule]
    markov = MarkovModel()
    markov.transition_ = trans
    probs_markov = markov.predict_proba_one(last_qid)

    probs_xgb = [0.25] * N_CLASSES
    if xgb_model and feature_row is not None:
        row = {k: feature_row.get(k, 0.0) for k in FEATURE_COLUMNS}
        df = pd.DataFrame([row])
        for c in FEATURE_COLUMNS:
            if c not in df.columns:
                df[c] = 0.0
        probs_xgb = xgb_model.predict_proba(df[FEATURE_COLUMNS].fillna(0))[0].tolist()

    p_ens = [
        w_rule * probs_rule[j] + w_markov * probs_markov[j] + w_xgb * probs_xgb[j]
        for j in range(N_CLASSES)
    ]
    s = sum(p_ens)
    p_ens = [x / s if s > 0 else 0.25 for x in p_ens]
    q_ens = ID_TO_QUADRANT[int(np.argmax(p_ens))]

    return {
        "ensemble_weights": weights,
        "quadrant_rule": q_rule,
        "quadrant_ensemble": q_ens,
        "confidence": float(max(p_ens)),
        "p_q1": p_ens[0],
        "p_q2": p_ens[1],
        "p_q3": p_ens[2],
        "p_q4": p_ens[3],
        "by_model": {
            "rule": {"quadrant": q_rule, "p_q1": probs_rule[0], "p_q2": probs_rule[1], "p_q3": probs_rule[2], "p_q4": probs_rule[3]},
            "markov": {"quadrant": ID_TO_QUADRANT[int(np.argmax(probs_markov))], "p_q1": probs_markov[0], "p_q2": probs_markov[1], "p_q3": probs_markov[2], "p_q4": probs_markov[3]},
            "xgboost": {"quadrant": ID_TO_QUADRANT[int(np.argmax(probs_xgb))], "p_q1": probs_xgb[0], "p_q2": probs_xgb[1], "p_q3": probs_xgb[2], "p_q4": probs_xgb[3]},
        },
        "trained": True,
    }


def get_backtest(artifacts_dir: str | None = None) -> list[dict]:
    """Load saved backtest rows (test period predictions)."""
    settings = get_settings()
    art_path = Path(artifacts_dir or settings.ml_artifacts_dir)
    bt_path = art_path / "backtest.json"
    if not bt_path.exists():
        return []
    with open(bt_path) as f:
        return json.load(f)


def get_metrics(artifacts_dir: str | None = None) -> dict | None:
    """Load meta.json and return metrics + split info."""
    meta, _, _ = _load_artifacts(artifacts_dir)
    if not meta:
        return None
    return {
        "trained_at": meta.get("trained_at"),
        "train_end": meta.get("train_end"),
        "val_end": meta.get("val_end"),
        "test_start": meta.get("test_start"),
        "test_end": meta.get("test_end"),
        "train_rows": meta.get("train_rows"),
        "val_rows": meta.get("val_rows"),
        "test_rows": meta.get("test_rows"),
        "metrics": meta.get("metrics", {}),
        "confusion_matrix": meta.get("confusion_matrix"),
    }
