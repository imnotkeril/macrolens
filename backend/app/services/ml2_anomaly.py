from __future__ import annotations

import pandas as pd


class ML2AnomalyService:
    def compute(self, df: pd.DataFrame) -> tuple[float, bool, float, dict]:
        if df.empty:
            return 0.0, False, 0.0, {"reason": "empty_dataset"}

        ret_cols = [c for c in df.columns if c.endswith("_ret_1m")]
        if len(ret_cols) < 3:
            return 0.0, False, 0.0, {"reason": "not_enough_factors"}

        base = df[ret_cols].tail(24)
        if len(base) < 6:
            return 0.0, False, 0.0, {"reason": "not_enough_history"}

        corr = base.corr().fillna(0.0)
        # Simple breakdown score: average off-diagonal absolute correlation drop on latest window
        latest_window = df[ret_cols].tail(6)
        latest_corr = latest_window.corr().fillna(0.0)
        delta = (corr - latest_corr).abs()
        score = float(delta.values.mean())
        threshold = float(max(0.15, corr.abs().values.mean() * 0.35))
        return score, score >= threshold, threshold, {"baseline_corr_mean": float(corr.abs().values.mean())}

