"""Historical phase vs asset-pair sign alignment (YAML §6)."""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.forecast_lab.asset_implied_labels import (
    load_price_series,
    symbols_from_asset_expectations,
)
from app.services.forecast_lab.asset_implied_labels_core import forward_pair_hit_rate_for_quadrant
from app.services.forecast_lab.dates_util import add_months, iter_month_ends
from app.services.forecast_lab.expectations import load_expectations
from app.services.forecast_lab.features_pit import build_feature_row
from app.services.forecast_lab.rule_phase import QUADRANT_ORDER, determine_quadrant

logger = logging.getLogger("forecast_lab.phase_alignment")


async def compute_phase_asset_alignment(
    db: AsyncSession,
    date_from: date,
    date_to: date,
    max_pairs_per_step: int = 8,
) -> dict[str, Any]:
    exp = load_expectations()
    h = int(exp.get("evaluation_horizon_months", 1))

    month_ends = iter_month_ends(date_from, date_to)
    if not month_ends:
        return {
            "horizon_months": h,
            "overall_hit_rate": None,
            "by_quadrant": {q: None for q in QUADRANT_ORDER},
            "sample_size": 0,
            "note": "no_evaluable_steps (check market symbols and date range)",
        }

    syms = symbols_from_asset_expectations(exp)
    date_min = add_months(min(month_ends), -3)
    date_max = add_months(max(month_ends), h)
    series_map = await load_price_series(db, syms, date_min, date_max)

    hits: list[float] = []
    by_q: dict[str, list[float]] = defaultdict(list)

    for d in month_ends:
        d_end = add_months(d, h)
        if d_end > date_to:
            break
        try:
            row = await build_feature_row(db, d)
            phase = determine_quadrant(row.growth_score, row.fed_policy_score)
        except Exception:
            continue

        avg_hit = forward_pair_hit_rate_for_quadrant(
            series_map, d, d_end, phase, exp, max_pairs=max_pairs_per_step
        )
        if avg_hit < 0:
            continue
        hits.append(avg_hit)
        by_q[phase].append(avg_hit)

    def _mean(xs: list[float]) -> float | None:
        return float(sum(xs) / len(xs)) if xs else None

    overall = _mean(hits)
    by_quadrant_f = {k: _mean(v) for k, v in by_q.items() if v}
    # Always emit all four quadrants so clients can align columns; null = no months in that regime in range.
    by_quadrant_full: dict[str, float | None] = {q: by_quadrant_f.get(q) for q in QUADRANT_ORDER}

    return {
        "horizon_months": h,
        "overall_hit_rate": overall,
        "by_quadrant": by_quadrant_full,
        "sample_size": len(hits),
        "note": None if hits else "no_evaluable_steps (check market symbols and date range)",
    }
