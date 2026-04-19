"""Map Cycle Radar coarse phase (+ score) to QuadrantPhase probability priors for ensemble."""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("forecast_lab.cycle_phase")

# Heuristic: cycle buckets → macro quadrant mix (sums to 1).
_BUCKET_TO_QUAD_PROBS: dict[str, tuple[float, float, float, float]] = {
    "expansion": (0.48, 0.36, 0.10, 0.06),
    "slowdown": (0.10, 0.14, 0.38, 0.38),
    "contraction": (0.04, 0.06, 0.16, 0.74),
}


def bucket_score_to_quadrant_probs(bucket: str, score: float | None) -> list[float]:
    """Return 4 probabilities aligned with QUADRANT_ORDER (Q1..Q4)."""
    base = _BUCKET_TO_QUAD_PROBS.get(bucket, (0.25, 0.25, 0.25, 0.25))
    p = list(base)
    if score is None:
        return p
    # Nudge toward Q3/Q4 when score slides negative within bucket (±0.02 scale).
    t = max(-1.0, min(1.0, -score / 80.0))
    p[0] = max(0.02, p[0] - 0.06 * t)
    p[1] = max(0.02, p[1] - 0.04 * t)
    p[2] = min(0.55, p[2] + 0.05 * t)
    p[3] = min(0.75, p[3] + 0.05 * t)
    s = sum(p)
    return [x / s for x in p]


async def cycle_quadrant_probs_at_date(db: AsyncSession, as_of: date) -> list[float]:
    """PIT cycle features at as_of → soft quadrant distribution."""
    try:
        from app.services.cycle_engine import CycleEngine

        ce = CycleEngine(db)
        cf = await ce.get_features_at_date(as_of, lookback_days=730)
        score = float(cf.get("cycle_score") or 0.0)
        bucket, _ = ce._map_phase(score)
        return bucket_score_to_quadrant_probs(bucket, score)
    except Exception:
        logger.debug("cycle_quadrant_probs_at_date failed", exc_info=True)
        return [0.25, 0.25, 0.25, 0.25]
