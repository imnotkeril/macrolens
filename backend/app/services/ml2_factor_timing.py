from __future__ import annotations

from datetime import date
from pathlib import Path
import json

import numpy as np
import pandas as pd

from app.services.ml2_dataset_builder import HORIZONS


class ML2FactorTimingService:
    def __init__(self, artifacts_dir: str):
        self.artifacts_dir = Path(artifacts_dir)
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        self.metrics_path = self.artifacts_dir / "ml2_metrics.json"

    def train(self, df: pd.DataFrame) -> dict:
        if df.empty:
            return {"trained_at": None, "rows": 0, "horizons": HORIZONS, "metrics": {}}

        factor_cols = sorted({c.split("_ret_")[0] for c in df.columns if c.endswith("_ret_1m")})
        metrics: dict[str, float] = {}
        for h in HORIZONS:
            vals = []
            for f in factor_cols:
                target_col = f"{f}_rel_fwd_{h}m"
                feat_col = f"{f}_ret_3m"
                if target_col in df.columns and feat_col in df.columns:
                    corr = float(pd.Series(df[feat_col]).corr(pd.Series(df[target_col])))
                    if not np.isnan(corr):
                        vals.append(abs(corr))
            metrics[f"ic_abs_{h}m"] = float(np.mean(vals)) if vals else 0.0

        payload = {
            "trained_at": date.today().isoformat(),
            "rows": int(len(df)),
            "horizons": HORIZONS,
            "metrics": metrics,
            "model_version": "ml2-v1",
        }
        self.metrics_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return payload

    def predict(self, df: pd.DataFrame) -> tuple[str, list[dict]]:
        if df.empty:
            return date.today().isoformat(), []
        latest = df.sort_values("date").iloc[-1]
        as_of_date = str(latest["date"])
        factor_cols = sorted({c.split("_ret_")[0] for c in df.columns if c.endswith("_ret_1m")})
        out: list[dict] = []
        for f in factor_cols:
            vol = float(latest.get(f"{f}_vol_6m", 0.0) or 0.0)
            for h in HORIZONS:
                score = float(latest.get(f"{f}_ret_3m", 0.0) or 0.0) - 0.5 * vol
                out.append(
                    {
                        "factor": f,
                        "horizon_months": h,
                        "score": score,
                        "expected_relative_return": score * (h / 3.0),
                        "confidence": float(max(0.05, min(0.95, 1.0 - min(abs(vol), 1.0)))),
                    }
                )
        out.sort(key=lambda x: x["score"], reverse=True)
        return as_of_date, out

    def load_metrics(self) -> dict:
        if not self.metrics_path.exists():
            return {"trained_at": None, "rows": None, "horizons": HORIZONS, "metrics": {}, "model_version": "ml2-v1"}
        return json.loads(self.metrics_path.read_text(encoding="utf-8"))

