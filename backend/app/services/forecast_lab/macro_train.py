"""Train XGBoost regressors per macro series and horizon."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import xgboost as xgb

from app.services.forecast_lab.macro_config import load_macro_panel_config

logger = logging.getLogger("forecast_lab.macro_train")


def _build_xy(
    df: pd.DataFrame,
    target_col: str,
    horizon: int,
    min_rows: int = 30,
) -> tuple[np.ndarray, np.ndarray, pd.Series] | tuple[None, None, None]:
    """Features: 3 lags of target, growth_score, fed. Target: value at t+horizon."""
    if target_col not in df.columns:
        return None, None, None
    work = df[["date", "growth_score", "fed_policy_score", target_col]].copy()
    work = work.dropna(subset=[target_col])
    if len(work) < min_rows + horizon + 3:
        return None, None, None

    v = work[target_col].values
    g = work["growth_score"].values
    f = work["fed_policy_score"].values
    n = len(work)
    X_list = []
    y_list = []
    for i in range(3, n - horizon):
        lag1, lag2, lag3 = v[i - 1], v[i - 2], v[i - 3]
        X_list.append([lag1, lag2, lag3, g[i], f[i]])
        y_list.append(v[i + horizon])
    if len(y_list) < 12:
        return None, None, None
    return np.array(X_list, dtype=float), np.array(y_list, dtype=float), work["date"].iloc[3 : n - horizon]


def fit_and_save_macro(
    out_dir: Path,
    df: pd.DataFrame,
    cfg: dict[str, Any] | None,
    train_end: pd.Timestamp,
    val_end: pd.Timestamp,
    random_state: int,
) -> list[str]:
    cfg = cfg or load_macro_panel_config()
    horizons = [int(h) for h in cfg.get("horizons", [1, 3, 6])]
    series_defs = cfg.get("series") or []
    macro_dir = out_dir / "macro"
    macro_dir.mkdir(parents=True, exist_ok=True)
    trained: list[str] = []

    for spec in series_defs:
        sid = str(spec["id"])
        for h in horizons:
            X, y, dts = _build_xy(df, sid, h)
            if X is None:
                continue
            dts_cmp = pd.to_datetime(dts)
            mask_train = dts_cmp <= train_end
            mask_val = (dts_cmp > train_end) & (dts_cmp <= val_end)
            if mask_train.sum() < 10 or mask_val.sum() < 3:
                continue
            X_tr, y_tr = X[mask_train], y[mask_train]
            X_va, y_va = X[mask_val], y[mask_val]

            reg = xgb.XGBRegressor(
                max_depth=3,
                n_estimators=100,
                learning_rate=0.08,
                random_state=random_state,
                verbosity=0,
            )
            reg.fit(
                X_tr,
                y_tr,
                eval_set=[(X_va, y_va)],
                verbose=False,
            )
            out_path = macro_dir / f"{sid}_h{h}.json"
            reg.save_model(str(out_path))
            meta = {
                "series_id": sid,
                "horizon_months": h,
                "display_name": spec.get("display_name", sid),
                "source": spec.get("source", "market"),
            }
            (macro_dir / f"{sid}_h{h}.meta.json").write_text(json.dumps(meta), encoding="utf-8")
            trained.append(f"{sid}_h{h}")
            logger.info("macro model saved %s", out_path.name)

    (macro_dir / "trained_index.json").write_text(json.dumps(trained), encoding="utf-8")
    return trained
