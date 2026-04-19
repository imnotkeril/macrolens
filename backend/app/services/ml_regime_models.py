"""
ML Regime Models: Markov transition matrix, XGBoost classifier, Rule baseline, ensemble.

Quadrant order: Q1=0, Q2=1, Q3=2, Q4=3 (GOLDILOCKS, REFLATION, OVERHEATING, STAGFLATION).
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    log_loss,
    confusion_matrix,
)

from app.services.ml_dataset_builder import (
    QUADRANT_TO_ID,
    ID_TO_QUADRANT,
    FEATURE_COLUMNS,
    _determine_quadrant,
)
from app.services.progress_store import set_train_progress

logger = logging.getLogger(__name__)

N_CLASSES = 4
QUADRANT_ORDER = ["Q1_GOLDILOCKS", "Q2_REFLATION", "Q3_OVERHEATING", "Q4_STAGFLATION"]


def rule_predict(growth: float, fed: float) -> list[float]:
    """Rule baseline: P=1 for quadrant from growth/fed, 0 elsewhere."""
    q = _determine_quadrant(growth, fed)
    idx = QUADRANT_TO_ID[q]
    probs = [0.0] * N_CLASSES
    probs[idx] = 1.0
    return probs


class MarkovModel:
    """4x4 transition matrix by quadrant; Laplace smoothing."""

    def __init__(self, alpha: float = 0.1):
        self.alpha = alpha
        # (4, 4) row = from, col = to
        self.transition_: np.ndarray | None = None

    def fit(self, y: np.ndarray) -> "MarkovModel":
        # y: 1d array of quadrant_id (0..3)
        counts = np.zeros((N_CLASSES, N_CLASSES))
        for i in range(len(y) - 1):
            a, b = int(y[i]), int(y[i + 1])
            if 0 <= a < N_CLASSES and 0 <= b < N_CLASSES:
                counts[a, b] += 1
        # Laplace smoothing
        counts = counts + self.alpha
        row_sum = counts.sum(axis=1, keepdims=True)
        self.transition_ = counts / np.maximum(row_sum, 1e-9)
        return self

    def predict_proba_one(self, last_quadrant_id: int) -> list[float]:
        """P(next quadrant) given last observed quadrant."""
        if self.transition_ is None:
            return [0.25] * N_CLASSES
        p = self.transition_[last_quadrant_id, :].tolist()
        return [float(x) for x in p]

    def predict_proba_sequence(self, y_history: list[int]) -> list[float]:
        """P(next) using last observed quadrant in history."""
        if not y_history:
            return [0.25] * N_CLASSES
        return self.predict_proba_one(int(y_history[-1]))


class XGBoostModel:
    """Multi-class classifier for quadrant (0..3)."""

    def __init__(self, random_state: int = 42, **kwargs):
        self.params = {
            "objective": "multi:softprob",
            "num_class": N_CLASSES,
            "eval_metric": "mlogloss",
            "random_state": random_state,
            "max_depth": 4,
            "learning_rate": 0.05,
            "n_estimators": 200,
            "early_stopping_rounds": 20,
        }
        self.params.update(kwargs)
        self.model_: xgb.XGBClassifier | None = None
        self.feature_cols_ = FEATURE_COLUMNS

    def fit(
        self,
        X: pd.DataFrame,
        y: np.ndarray,
        X_val: pd.DataFrame | None = None,
        y_val: np.ndarray | None = None,
    ) -> "XGBoostModel":
        for c in self.feature_cols_:
            if c not in X.columns:
                X = X.copy()
                X[c] = 0.0
        X_f = X[self.feature_cols_].fillna(0)
        fit_params = {}
        if X_val is not None and y_val is not None:
            for c in self.feature_cols_:
                if c not in X_val.columns:
                    X_val = X_val.copy()
                    X_val[c] = 0.0
            X_val_f = X_val[self.feature_cols_].fillna(0)
            fit_params["eval_set"] = [(X_val_f, y_val)]
        self.model_ = xgb.XGBClassifier(**self.params)
        self.model_.fit(X_f, y, **fit_params)
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        if self.model_ is None:
            return np.full((len(X), N_CLASSES), 0.25)
        for c in self.feature_cols_:
            if c not in X.columns:
                X = X.copy()
                X[c] = 0.0
        return self.model_.predict_proba(X[self.feature_cols_].fillna(0))


def train_val_test_split(
    df: pd.DataFrame,
    train_end: str,
    val_end: str,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Temporal split. train_end/val_end are inclusive (YYYY-MM)."""
    df = df.sort_values("date").reset_index(drop=True)
    train = df[df["date"] <= train_end].copy()
    val = df[(df["date"] > train_end) & (df["date"] <= val_end)].copy()
    test = df[df["date"] > val_end].copy()
    return train, val, test


def compute_ensemble_weights(
    val_probs_rule: list[list[float]],
    val_probs_markov: list[list[float]],
    val_probs_xgb: list[list[float]],
    y_val: np.ndarray,
) -> list[float]:
    """Inverse log-loss weights on validation; normalize to sum to 1."""
    def logloss(probs_list: list[list[float]], y: np.ndarray) -> float:
        if not probs_list or len(probs_list) != len(y):
            return 1e9
        return log_loss(y, probs_list)

    lr = logloss(val_probs_rule, y_val)
    lm = logloss(val_probs_markov, y_val)
    lx = logloss(val_probs_xgb, y_val)
    inv = [1.0 / max(lr, 1e-6), 1.0 / max(lm, 1e-6), 1.0 / max(lx, 1e-6)]
    total = sum(inv)
    return [x / total for x in inv]


def run_train_pipeline(
    df: pd.DataFrame,
    train_end: str,
    val_end: str,
    artifacts_dir: str,
    random_seed: int = 42,
) -> dict:
    """
    Train Markov, XGBoost, ensemble weights; save artifacts and metrics.
    Reports progress 50–100% via progress_store.
    """
    set_train_progress(percent=50.0, message="Splitting train/val/test…", log_line="[50%] Splitting train/val/test…")
    train, val, test = train_val_test_split(df, train_end, val_end)
    if train.empty or test.empty:
        return {"error": "Insufficient data for train or test", "trained": False}

    y_train = train["quadrant_id"].values
    y_val = val["quadrant_id"].values if not val.empty else None
    y_test = test["quadrant_id"].values

    set_train_progress(percent=55.0, message="Training Markov…", log_line="[55%] Training Markov…")
    markov = MarkovModel(alpha=0.1)
    markov.fit(y_train)

    set_train_progress(percent=65.0, message="Training XGBoost…", log_line="[65%] Training XGBoost…")
    xgb_model = XGBoostModel(random_state=random_seed)
    if not val.empty:
        xgb_model.fit(train, y_train, val, y_val)
    else:
        xgb_model.fit(train, y_train)

    set_train_progress(percent=85.0, message="Computing ensemble & metrics…", log_line="[85%] Computing ensemble & metrics…")
    # Validation probs for ensemble weights
    val_probs_rule = []
    if not val.empty:
        for _, r in val.iterrows():
            val_probs_rule.append(
                rule_predict(float(r["growth_score"]), float(r["fed_policy_score"]))
            )
    val_probs_markov = (
        [markov.predict_proba_one(int(y_val[i])) for i in range(len(y_val))]
        if y_val is not None and len(y_val) else []
    )
    if not val.empty:
        val_probs_xgb = xgb_model.predict_proba(val).tolist()
    else:
        val_probs_xgb = []

    if val_probs_rule and val_probs_markov and val_probs_xgb and len(y_val):
        weights = compute_ensemble_weights(
            val_probs_rule, val_probs_markov, val_probs_xgb, y_val
        )
    else:
        weights = [1.0 / 3.0] * 3

    # Test predictions
    test_probs_rule = [
        rule_predict(float(row["growth_score"]), float(row["fed_policy_score"]))
        for _, row in test.iterrows()
    ]
    test_probs_markov = [
        markov.predict_proba_sequence(y_test[:i].tolist())
        for i in range(len(y_test))
    ]
    test_probs_xgb = xgb_model.predict_proba(test).tolist()

    def ensemble_probs(pr: list[float], pm: list[float], px: list[float]) -> list[float]:
        e = [
            weights[0] * pr[j] + weights[1] * pm[j] + weights[2] * px[j]
            for j in range(N_CLASSES)
        ]
        s = sum(e)
        return [x / s if s > 0 else 0.25 for x in e]

    test_probs_ensemble = [
        ensemble_probs(
            test_probs_rule[i], test_probs_markov[i], test_probs_xgb[i]
        )
        for i in range(len(test_probs_rule))
    ]

    # Metrics on test only
    pred_ensemble = np.argmax(test_probs_ensemble, axis=1)
    acc = accuracy_score(y_test, pred_ensemble)
    bal_acc = balanced_accuracy_score(y_test, pred_ensemble)
    ll = log_loss(y_test, test_probs_ensemble)
    cm = confusion_matrix(y_test, pred_ensemble).tolist()
    wf_acc = _walk_forward_accuracy(test_probs_ensemble, y_test)

    set_train_progress(percent=92.0, message="Saving artifacts…", log_line="[92%] Saving artifacts…")
    # Save artifacts
    art_path = Path(artifacts_dir)
    art_path.mkdir(parents=True, exist_ok=True)
    meta = {
        "trained_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "train_end": train_end,
        "val_end": val_end,
        "train_rows": int(len(train)),
        "val_rows": int(len(val)),
        "test_rows": int(len(test)),
        "test_start": test["date"].min() if not test.empty else None,
        "test_end": test["date"].max() if not test.empty else None,
        "feature_columns": FEATURE_COLUMNS,
        "ensemble_weights": {
            "rule": weights[0], "markov": weights[1], "xgboost": weights[2],
        },
        "metrics": {
            "test_accuracy": float(acc),
            "test_balanced_accuracy": float(bal_acc),
            "test_log_loss": float(ll),
            "walk_forward_accuracy": float(wf_acc),
        },
        "confusion_matrix": cm,
    }
    with open(art_path / "meta.json", "w") as f:
        json.dump(meta, f, indent=2)
    np.save(art_path / "markov_transition.npy", markov.transition_)
    xgb_model.model_.save_model(str(art_path / "xgboost_model.json"))
    # Backtest table for API
    backtest_rows = []
    for i in range(len(test)):
        q_act = ID_TO_QUADRANT.get(int(y_test[i]), "Q1_GOLDILOCKS")
        q_ens = ID_TO_QUADRANT.get(int(pred_ensemble[i]), "Q1_GOLDILOCKS")
        backtest_rows.append({
            "date": test.iloc[i]["date"],
            "quadrant_actual": q_act,
            "quadrant_ensemble": q_ens,
            "match": bool(y_test[i] == pred_ensemble[i]),
            "p_q1": test_probs_ensemble[i][0],
            "p_q2": test_probs_ensemble[i][1],
            "p_q3": test_probs_ensemble[i][2],
            "p_q4": test_probs_ensemble[i][3],
        })
    with open(art_path / "backtest.json", "w") as f:
        json.dump(backtest_rows, f, indent=0)
    logger.info("ML artifacts saved to %s", art_path)
    set_train_progress(percent=100.0, message="Done.", log_line="[100%] Training completed.")
    return meta


def _walk_forward_accuracy(test_probs_ensemble: list[list[float]], y_test: np.ndarray) -> float:
    if len(test_probs_ensemble) == 0:
        return 0.0
    preds = np.argmax(np.array(test_probs_ensemble), axis=1)
    correct = (preds == y_test).sum()
    return float(correct / len(y_test))
