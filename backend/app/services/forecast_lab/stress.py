"""Market stress / anomaly (IsolationForest + z-score fallback; new code, not ml2)."""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.market_data import MarketData

logger = logging.getLogger("forecast_lab.stress")

DEFAULT_SYMBOLS = ["SPY", "IWM", "GLD", "TLT", "HYG", "EEM"]


@dataclass
class StressComputeResult:
    score: float
    band: str
    drivers: list[str]
    universe_symbols: list[str]
    insufficient_history: bool
    top_z_contributors: list[tuple[str, float]]


async def _monthly_returns(
    db: AsyncSession,
    as_of: date,
    symbols: list[str],
    lookback_months: int = 36,
) -> np.ndarray | None:
    """Rows = time (oldest first), cols = symbol returns (approx monthly from last obs per month)."""
    start = as_of - timedelta(days=40 * lookback_months)
    series: dict[str, list[tuple[date, float]]] = {s: [] for s in symbols}
    for sym in symbols:
        q = (
            select(MarketData.date, MarketData.value)
            .where(MarketData.symbol == sym, MarketData.date <= as_of, MarketData.date >= start)
            .order_by(MarketData.date)
        )
        result = await db.execute(q)
        for d, v in result.all():
            series[sym].append((d, float(v)))

    if any(len(series[s]) < 6 for s in symbols):
        return None

    # Align on month-end buckets: take last price per calendar month

    def monthly_last(prices: list[tuple[date, float]]) -> list[float]:
        by_m: dict[tuple[int, int], float] = {}
        for d, v in prices:
            by_m[(d.year, d.month)] = v
        keys = sorted(by_m.keys())
        vals = [by_m[k] for k in keys]
        if len(vals) < 3:
            return []
        rets = []
        for i in range(1, len(vals)):
            if vals[i - 1] != 0:
                rets.append((vals[i] / vals[i - 1]) - 1.0)
            else:
                rets.append(0.0)
        return rets

    rets_per = {s: monthly_last(series[s]) for s in symbols}
    min_len = min(len(rets_per[s]) for s in symbols)
    if min_len < 6:
        return None
    mat = np.column_stack([np.array(rets_per[s][-min_len:]) for s in symbols])
    return mat


def _band_from_score(raw: float) -> str:
    if raw < 0.35:
        return "low"
    if raw < 0.65:
        return "medium"
    return "high"


async def compute_stress(
    db: AsyncSession,
    as_of: date,
    symbols: list[str] | None = None,
) -> StressComputeResult:
    syms = list(symbols or DEFAULT_SYMBOLS)
    mat = await _monthly_returns(db, as_of, syms)
    drivers: list[str] = []

    if mat is None or mat.shape[0] < 8:
        return StressComputeResult(
            score=0.25,
            band="low",
            drivers=["insufficient_market_history"],
            universe_symbols=syms,
            insufficient_history=True,
            top_z_contributors=[],
        )

    # Latest row (most recent month) vs historical distribution per column
    mat = np.nan_to_num(mat, nan=0.0, posinf=0.0, neginf=0.0)
    last = mat[-1]
    hist = mat[:-1]
    z_cols: list[float] = []
    for j in range(mat.shape[1]):
        col = hist[:, j]
        mu, sd = col.mean(), col.std() or 1e-9
        z_cols.append(float(abs((last[j] - mu) / sd)))
    z_pairs = sorted(zip(syms, z_cols), key=lambda x: -x[1])[:3]
    top_z = [(str(s), float(z)) for s, z in z_pairs]
    z_mean = float(np.nanmean(z_cols)) if z_cols else 0.0
    if not math.isfinite(z_mean):
        z_mean = 0.0
    z_score_norm = float(min(1.0, z_mean / 3.0))

    if_out = 0.0
    try:
        from sklearn.ensemble import IsolationForest

        clf = IsolationForest(random_state=42, contamination=0.1)
        clf.fit(hist)
        pred = clf.decision_function([last])[0]
        # more negative = more anomalous; map to [0,1]
        if_out = float(1.0 / (1.0 + np.exp(pred * 2)))
        if not math.isfinite(if_out):
            if_out = 0.0
        drivers.append("isolation_forest")
    except Exception as e:
        logger.debug("IsolationForest skipped: %s", e)

    combined = 0.6 * if_out + 0.4 * z_score_norm if if_out > 0 else z_score_norm
    combined = max(0.0, min(1.0, combined))
    if not math.isfinite(combined):
        combined = 0.25
    if z_score_norm > 0.5:
        drivers.append("return_z_spike")
    return StressComputeResult(
        score=combined,
        band=_band_from_score(combined),
        drivers=drivers,
        universe_symbols=syms,
        insufficient_history=False,
        top_z_contributors=top_z,
    )
