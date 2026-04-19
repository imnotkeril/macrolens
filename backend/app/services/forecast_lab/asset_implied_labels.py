"""Historical phase labels from realized relative returns (YAML pairs), not from rule scores."""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.market_data import MarketData
from app.services.forecast_lab.asset_implied_labels_core import (
    _PriceSeries,
    pick_quadrant,
    quadrant_scores_from_prices,
)
from app.services.forecast_lab.dates_util import add_months
from app.services.forecast_lab.expectations import load_expectations
from app.services.forecast_lab.rule_phase import ID_TO_QUADRANT

logger = logging.getLogger("forecast_lab.asset_labels")


def _symbols_from_expectations(exp: dict[str, Any]) -> set[str]:
    out: set[str] = set()
    for qconf in (exp.get("quadrant_phases") or {}).values():
        for pair in qconf.get("pairs") or []:
            out.add(str(pair.get("asset_long", "")))
            out.add(str(pair.get("asset_short", "")))
    return {s for s in out if s}


def symbols_from_asset_expectations(exp: dict[str, Any] | None = None) -> set[str]:
    """Ticker set referenced in asset_phase_expectations.yaml (for loaders / regime history)."""
    if exp is None:
        exp = load_expectations()
    return _symbols_from_expectations(exp)


async def load_price_series(
    db: AsyncSession,
    symbols: set[str],
    date_min: date,
    date_max: date,
) -> dict[str, _PriceSeries]:
    if not symbols:
        return {}
    q = (
        select(MarketData.symbol, MarketData.date, MarketData.value)
        .where(
            MarketData.symbol.in_(symbols),
            MarketData.date >= date_min,
            MarketData.date <= date_max,
        )
        .order_by(MarketData.symbol, MarketData.date)
    )
    rows = (await db.execute(q)).all()
    raw: dict[str, list[tuple[date, float]]] = defaultdict(list)
    for sym, d, v in rows:
        raw[sym].append((d, float(v)))
    return {s: _PriceSeries([x[0] for x in raw[s]], [x[1] for x in raw[s]]) for s in symbols}


async def build_training_labels(
    db: AsyncSession,
    dates: list[date],
    X_list: list[list[float]],
    mode: str,
    auxiliary_asset_scale: float = 0.0,
) -> tuple[list[int], dict[str, Any], list[float]]:
    """
    mode: rule_v1 | asset_implied_v1
    For asset_implied_v1, y is inferred from asset_phase_expectations.yaml realized returns
    (d0 -> d1 over evaluation_horizon_months); tie-break / missing data → rule label from X.

    sample_weights: per-row weights for GBDT (1.0 baseline). When auxiliary_asset_scale > 0 and
    mode is asset_implied_v1, upweight rows by realized pair agreement score for the chosen class.
    """
    from app.services.forecast_lab.labels import rule_labels_batch

    rule_y = rule_labels_batch(X_list)
    stats: dict[str, Any] = {"mode": mode, "asset_resolved": 0, "rule_fallback_rows": 0}
    n = len(dates)
    sample_weights = [1.0] * n

    if mode == "rule_v1":
        return list(rule_y), stats, sample_weights

    exp = load_expectations()
    h = max(1, int(exp.get("evaluation_horizon_months", 1)))
    syms = _symbols_from_expectations(exp)
    if not dates:
        return [], stats, []
    date_min = add_months(min(dates), -(h + 3))
    date_max = max(dates)
    series_map = await load_price_series(db, syms, date_min, date_max)

    y_out: list[int] = []
    for i, d in enumerate(dates):
        d0 = add_months(d, -h)
        sc = quadrant_scores_from_prices(series_map, d0, d, exp)
        qid, fb = pick_quadrant(sc, int(rule_y[i]))
        y_out.append(qid)
        if fb:
            stats["rule_fallback_rows"] += 1
        else:
            stats["asset_resolved"] += 1
        if auxiliary_asset_scale > 0.0:
            qname = ID_TO_QUADRANT[qid]
            hit = sc.get(qname, -1.0)
            if hit >= 0.0:
                sample_weights[i] = 1.0 + auxiliary_asset_scale * float(hit)

    return y_out, stats, sample_weights
