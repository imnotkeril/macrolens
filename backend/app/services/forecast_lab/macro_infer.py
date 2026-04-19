"""Load macro regressors and produce forecast rows for summary."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import numpy as np
import xgboost as xgb
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.forecast_lab import MacroForecastRow
from app.services.forecast_lab.macro_config import load_macro_panel_config
from app.services.forecast_lab.macro_data import build_macro_frame

logger = logging.getLogger("forecast_lab.macro_infer")


def _load_trained_index(macro_dir: Path) -> list[str]:
    p = macro_dir / "trained_index.json"
    if not p.exists():
        return []
    return json.loads(p.read_text(encoding="utf-8"))


async def predict_macro_panel(
    db: AsyncSession,
    bundle_path: Path,
    as_of,
) -> list[MacroForecastRow]:
    macro_dir = bundle_path / "macro"
    if not macro_dir.exists():
        return []

    cfg = load_macro_panel_config()
    series_defs = cfg.get("series") or []
    horizons = [int(h) for h in cfg.get("horizons", [1, 3, 6])]

    from datetime import date, timedelta

    if hasattr(as_of, "date"):
        as_of_d = as_of.date() if callable(getattr(as_of, "date", None)) else as_of
    else:
        as_of_d = as_of
    d0 = as_of_d - timedelta(days=400 * 3)
    df = await build_macro_frame(db, d0, as_of_d, series_defs)
    if df.empty or len(df) < 4:
        return []

    last_idx = len(df) - 1
    rows_out: list[MacroForecastRow] = []

    for spec in series_defs:
        sid = str(spec["id"])
        disp = str(spec.get("display_name", sid))
        if sid not in df.columns:
            continue
        v = df[sid].values
        g = df["growth_score"].values
        f = df["fed_policy_score"].values
        if last_idx < 3:
            continue
        lag1, lag2, lag3 = v[last_idx - 1], v[last_idx - 2], v[last_idx - 3]
        if np.any(np.isnan([lag1, lag2, lag3])):
            continue
        xrow = np.array([[lag1, lag2, lag3, g[last_idx], f[last_idx]]], dtype=float)

        for h in horizons:
            mp = macro_dir / f"{sid}_h{h}.json"
            if not mp.exists():
                rows_out.append(
                    MacroForecastRow(
                        series_id=sid,
                        display_name=disp,
                        horizon_months=h,
                        value=None,
                        trained=False,
                    )
                )
                continue
            try:
                reg = xgb.XGBRegressor()
                reg.load_model(str(mp))
                pred = float(reg.predict(xrow)[0])
                rows_out.append(
                    MacroForecastRow(
                        series_id=sid,
                        display_name=disp,
                        horizon_months=h,
                        value=pred,
                        trained=True,
                    )
                )
            except Exception as e:
                logger.debug("macro predict fail %s h=%s: %s", sid, h, e)
                rows_out.append(
                    MacroForecastRow(
                        series_id=sid,
                        display_name=disp,
                        horizon_months=h,
                        value=None,
                        trained=False,
                    )
                )

    return rows_out
