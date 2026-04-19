"""Offline training for Forecast Lab (HMM + XGBoost + ensemble weights)."""

from __future__ import annotations

import asyncio
import json
import logging
import shutil
import time
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sqlalchemy.ext.asyncio import AsyncSession
import xgboost as xgb

from app.config import get_settings
from app.services.forecast_lab import features_pit
from app.services.forecast_lab.artifacts import (
    compute_bundle_id,
    resolve_artifacts_dir,
    set_active_bundle,
)
from app.services.forecast_lab.asset_implied_labels import build_training_labels
from app.services.forecast_lab.progress import set_progress
from app.services.forecast_lab.rule_phase import N_CLASSES
from app.services.forecast_lab.cycle_phase_probs import cycle_quadrant_probs_at_date
from app.services.forecast_lab.recession_labels import build_recession_forward_labels
from app.services.forecast_lab.ensemble import (
    align_multiclass_proba_row,
    ensemble_probs,
    ensemble_probs_four,
    inverse_logloss_weights,
    inverse_logloss_weights_four,
)
from app.services.forecast_lab.hmm_infer import hmm_probs_at_end
from app.services.forecast_lab.macro_config import load_macro_panel_config
from app.services.forecast_lab.macro_data import build_macro_frame
from app.services.forecast_lab.macro_train import fit_and_save_macro

logger = logging.getLogger("forecast_lab.train")


def _fit_hmm(X: np.ndarray, random_state: int, hmm_n_states: int) -> tuple[Any, np.ndarray] | tuple[None, None]:
    try:
        from hmmlearn.hmm import GaussianHMM
    except ImportError:
        logger.warning("hmmlearn not installed; HMM skipped")
        return None, None

    n_samples, n_features = X.shape
    if n_samples < 24:
        return None, None

    k = min(max(2, hmm_n_states), 4)
    k = min(k, max(2, n_samples // 12))
    model = GaussianHMM(
        n_components=k,
        covariance_type="diag",
        n_iter=200,
        random_state=random_state,
        verbose=False,
    )
    try:
        model.fit(X)
        states = model.predict(X)
        return model, states
    except Exception as e:
        logger.warning("HMM fit failed: %s", e)
        return None, None


def _state_to_quadrant_map(states: np.ndarray, y: np.ndarray, n_hmm: int) -> list[int]:
    """Map each HMM state index to a quadrant id (mode of y in that state)."""
    mapping: list[int] = []
    for s in range(n_hmm):
        mask = states == s
        if mask.sum() == 0:
            mapping.append(0)
            continue
        vals, counts = np.unique(y[mask], return_counts=True)
        mapping.append(int(vals[np.argmax(counts)]))
    return mapping


def _gbdt_val_probs(
    clf: xgb.XGBClassifier,
    X: np.ndarray,
) -> list[list[float]]:
    return [align_multiclass_proba_row(clf, X[i : i + 1]) for i in range(len(X))]


async def run_training(db: AsyncSession) -> dict[str, Any]:
    settings = get_settings()
    set_progress(1.0, "Loading monthly features…", "[1%] features", done=False)

    date_from = date.fromisoformat(settings.forecast_lab_date_from)
    date_to = date.today()
    dates, X_list = await features_pit.build_monthly_feature_frame(db, date_from, date_to)
    if len(dates) < 36:
        set_progress(100.0, "Not enough history", "[done] insufficient rows", done=True)
        return {"error": "insufficient_history", "rows": len(dates)}

    X = np.array(X_list, dtype=float)
    label_mode = (settings.forecast_lab_label_mode or "asset_implied_v1").strip()
    if label_mode not in ("rule_v1", "asset_implied_v1"):
        label_mode = "asset_implied_v1"
    aux_w = float(settings.forecast_lab_auxiliary_asset_weight or 0.0)
    y_list, label_stats, sample_weights = await build_training_labels(
        db, dates, X_list, label_mode, auxiliary_asset_scale=aux_w
    )
    y = np.array(y_list, dtype=int)
    sw_arr = np.array(sample_weights, dtype=float)
    label_stats["auxiliary_asset_scale"] = aux_w
    logger.info(
        "Forecast Lab labels mode=%s asset_rows=%s fallback_rows=%s aux_scale=%s",
        label_stats.get("mode"),
        label_stats.get("asset_resolved"),
        label_stats.get("rule_fallback_rows"),
        aux_w,
    )

    train_end = pd.Timestamp(settings.forecast_lab_train_end)
    val_end = pd.Timestamp(settings.forecast_lab_val_end)

    dts = pd.to_datetime([d.isoformat() for d in dates])
    train_mask = dts <= train_end
    val_mask = (dts > train_end) & (dts <= val_end)
    test_mask = dts > val_end

    X_train, y_train = X[train_mask], y[train_mask]
    X_val, y_val = X[val_mask], y[val_mask]
    X_test, y_test = X[test_mask], y[test_mask]

    if len(X_train) < 24 or len(X_val) < 6:
        set_progress(100.0, "Split too small", "[done] adjust train/val dates", done=True)
        return {"error": "split_too_small"}

    set_progress(15.0, "Scaling…", "[15%] scaler", done=False)
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_val_s = scaler.transform(X_val)
    X_test_s = scaler.transform(X_test)

    set_progress(30.0, "HMM…", "[30%] HMM", done=False)
    hmm_model, train_states = _fit_hmm(
        X_train_s, settings.forecast_lab_random_seed, settings.forecast_lab_hmm_states
    )
    state_to_quad: list[int] = [0, 1, 2, 3]
    if hmm_model is not None and train_states is not None:
        state_to_quad = _state_to_quadrant_map(
            train_states, y_train, hmm_model.n_components
        )

    set_progress(55.0, "XGBoost…", "[55%] GBDT", done=False)
    clf = xgb.XGBClassifier(
        objective="multi:softprob",
        num_class=N_CLASSES,
        max_depth=4,
        n_estimators=150,
        learning_rate=0.06,
        random_state=settings.forecast_lab_random_seed,
        verbosity=0,
    )
    clf.fit(X_train_s, y_train, sample_weight=sw_arr[train_mask])

    set_progress(75.0, "Ensemble weights…", "[75%] weights", done=False)
    from app.services.forecast_lab.rule_phase import rule_probs

    val_rule = [rule_probs(float(r[0]), float(r[1])) for r in X_val]
    val_gbdt = _gbdt_val_probs(clf, X_val_s)
    val_hmm: list[list[float]] = []
    if hmm_model is not None:
        # build cumulative val sequence from start of train for HMM posterior at val steps — simplified: marginal on val only
        for i in range(len(X_val_s)):
            # use train+val up to val index for sequence context
            seq = np.vstack([X_train_s[-min(36, len(X_train_s)) :], X_val_s[: i + 1]])
            try:
                val_hmm.append(hmm_probs_at_end(hmm_model, seq, state_to_quad))
            except Exception:
                val_hmm.append([0.25] * N_CLASSES)
    else:
        val_hmm = [[0.25] * N_CLASSES for _ in range(len(X_val))]

    inc_cycle = bool(settings.forecast_lab_ensemble_include_cycle)
    val_cycle: list[list[float]] = []
    if inc_cycle:
        val_idx = np.where(val_mask)[0]
        val_dates_list = [dates[i] for i in val_idx]
        val_cycle = await asyncio.gather(
            *[cycle_quadrant_probs_at_date(db, d) for d in val_dates_list]
        )
        w_rule, w_hmm, w_gbdt, w_cycle = inverse_logloss_weights_four(
            val_rule, val_hmm, val_gbdt, val_cycle, y_val
        )
    else:
        w_rule, w_hmm, w_gbdt = inverse_logloss_weights(val_rule, val_hmm, val_gbdt, y_val)
        w_cycle = 0.0

    test_idx = np.where(test_mask)[0]
    test_cycle: list[list[float]] | None = None
    if inc_cycle:
        test_cycle = await asyncio.gather(
            *[cycle_quadrant_probs_at_date(db, dates[i]) for i in test_idx]
        )

    test_probs = []
    for i in range(len(X_test_s)):
        pr = rule_probs(float(X_test[i, 0]), float(X_test[i, 1]))
        pg = align_multiclass_proba_row(clf, X_test_s[i : i + 1])
        if hmm_model is not None:
            seq = np.vstack([X_train_s[-min(36, len(X_train_s)) :], X_test_s[: i + 1]])
            try:
                ph = hmm_probs_at_end(hmm_model, seq, state_to_quad)
            except Exception:
                ph = [0.25] * N_CLASSES
        else:
            ph = [0.25] * N_CLASSES
        if inc_cycle and test_cycle is not None:
            pc = test_cycle[i]
            test_probs.append(
                ensemble_probs_four(pr, ph, pg, pc, w_rule, w_hmm, w_gbdt, w_cycle)
            )
        else:
            test_probs.append(ensemble_probs(pr, ph, pg, w_rule, w_hmm, w_gbdt))

    pred = [int(np.argmax(p)) for p in test_probs]
    acc = float(np.mean(np.array(pred) == y_test)) if len(y_test) else 0.0

    rec_block: dict[str, Any] = {"trained": False}
    rec_clf_fitted: xgb.XGBClassifier | None = None
    if settings.forecast_lab_train_recession_model:
        y_rec, rec_stats = await build_recession_forward_labels(db, dates, horizon_months=12)
        y_rec_train = y_rec[train_mask]
        y_rec_val = y_rec[val_mask]
        pos_tr = int(y_rec_train.sum())
        neg_tr = int(len(y_rec_train) - pos_tr)
        if pos_tr >= 4 and neg_tr >= 4:
            spw = float(neg_tr / max(pos_tr, 1))
            rec_clf_fitted = xgb.XGBClassifier(
                objective="binary:logistic",
                max_depth=3,
                n_estimators=120,
                learning_rate=0.06,
                random_state=settings.forecast_lab_random_seed,
                scale_pos_weight=spw,
                verbosity=0,
            )
            rec_clf_fitted.fit(X_train_s, y_rec_train)
            rec_auroc: float | None = None
            try:
                from sklearn.metrics import roc_auc_score

                if len(np.unique(y_rec_val)) > 1:
                    vp = rec_clf_fitted.predict_proba(X_val_s)[:, 1]
                    rec_auroc = float(roc_auc_score(y_rec_val, vp))
            except Exception:
                rec_auroc = None
            rec_block = {
                "trained": True,
                "label_stats": rec_stats,
                "val_auroc": rec_auroc,
                "horizon_months": 12,
            }
        else:
            rec_block = {
                "trained": False,
                "label_stats": rec_stats,
                "skip_reason": "insufficient_class_balance",
            }

    set_progress(88.0, "Macro panel…", "[88%] macro regressions", done=False)
    cfg_macro = load_macro_panel_config()
    mdf = await build_macro_frame(db, date_from, date_to, cfg_macro.get("series", []))

    meta_core = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "train_rows": int(len(X_train)),
        "val_rows": int(len(X_val)),
        "test_rows": int(len(X_test)),
        "feature_names": features_pit.FEATURE_NAMES,
        "train_end": str(train_end.date),
        "val_end": str(val_end.date),
        "label_mode": label_mode,
        "label_stats": label_stats,
        "metrics": {"balanced_test_acc_proxy": acc},
        "ensemble_weights": {
            "rule": w_rule,
            "hmm": w_hmm,
            "gbdt": w_gbdt,
            "cycle": w_cycle,
        },
        "hmm_states": int(hmm_model.n_components) if hmm_model else 0,
        "state_to_quadrant": state_to_quad,
        "macro_models": [],
        "recession_model": rec_block,
    }

    root = resolve_artifacts_dir()
    root.mkdir(parents=True, exist_ok=True)
    building = root / f"_building_{int(time.time())}"
    building.mkdir(parents=True)

    joblib.dump(scaler, building / "scaler.joblib")
    clf.save_model(str(building / "xgb.json"))
    if rec_clf_fitted is not None:
        rec_clf_fitted.save_model(str(building / "recession_xgb.json"))
    if hmm_model is not None:
        joblib.dump(hmm_model, building / "hmm.joblib")
    (building / "state_map.json").write_text(json.dumps(state_to_quad), encoding="utf-8")
    (building / "ensemble_weights.json").write_text(
        json.dumps(meta_core["ensemble_weights"]), encoding="utf-8"
    )

    macro_trained = fit_and_save_macro(
        building, mdf, cfg_macro, train_end, val_end, settings.forecast_lab_random_seed
    )
    meta_core["macro_models"] = macro_trained
    bundle_id = compute_bundle_id(meta_core)
    meta = {**meta_core, "bundle_id": bundle_id}
    final_dir = root / bundle_id
    if final_dir.exists():
        shutil.rmtree(final_dir)
    building.rename(final_dir)
    (final_dir / "meta.json").write_text(json.dumps(meta, indent=2, default=str), encoding="utf-8")

    set_active_bundle(bundle_id)
    set_progress(100.0, f"Done bundle {bundle_id}", "[100%] saved", done=True)
    logger.info("Forecast Lab trained bundle_id=%s", bundle_id)
    try:
        from app.services.forecast_lab.regime_history_materialize import materialize_regime_history_monthly

        rh = await materialize_regime_history_monthly(db, date_from, date_to)
        logger.info("Regime history table after train: %s rows", rh.get("rows"))
    except Exception:
        logger.exception("Regime history materialize after train failed (non-fatal)")

    return {"status": "completed", "bundle_id": bundle_id, "metrics": meta["metrics"]}
