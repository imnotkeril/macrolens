"""Materialize monthly regime timeline: Navigator vs Forecast Lab rule vs asset-implied (YAML)."""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timezone
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.forecast_lab import RegimeHistoryMonthly
from app.services.forecast_lab import features_pit
from app.services.forecast_lab.asset_implied_labels import load_price_series, symbols_from_asset_expectations
from app.services.forecast_lab.asset_implied_labels_core import (
    forward_pair_hit_rate_for_quadrant,
    pick_quadrant,
    quadrant_scores_from_prices,
)
from app.services.forecast_lab.dates_util import add_months, iter_month_ends
from app.services.forecast_lab.expectations import load_expectations
from app.services.forecast_lab.labels import rule_label_from_features
from app.services.forecast_lab.rule_loader import match_quadrant
from app.services.forecast_lab.rule_phase import ID_TO_QUADRANT
from app.services.navigator_yield_expectations import curve_pattern_matches_quadrant
from app.services.yield_analyzer import YieldAnalyzer

logger = logging.getLogger("forecast_lab.regime_history")


async def _upsert_regime_history_row(db: AsyncSession, values: dict[str, Any]) -> None:
    """
    Portable upsert (no PG-only ON CONFLICT) so materialize works with any backend and surfaces fewer silent failures.
    """
    obs = values["obs_date"]
    res = await db.execute(select(RegimeHistoryMonthly).where(RegimeHistoryMonthly.obs_date == obs))
    existing = res.scalar_one_or_none()
    if existing is None:
        db.add(RegimeHistoryMonthly(**values))
    else:
        for k, v in values.items():
            setattr(existing, k, v)


async def materialize_regime_history_monthly(
    db: AsyncSession,
    date_from: date,
    date_to: date,
    *,
    asset_confirm_threshold: float = 0.5,
) -> dict[str, Any]:
    """
    Upsert one row per month-end in [date_from, date_to].
    Navigator columns match the Trading Navigator rule plane: same features_pit PIT row as FL rule.
    Asset-implied (lookback) uses realized pair returns ending at obs_date (train-label window).
    Forward confirmation of FL rule uses obs_date -> obs_date+H (same as phase_alignment diagnostics).
    Yield curve: PIT dynamics at obs_date vs methodology YAML (navigator_yield_expectations).
    """
    batch_id = str(uuid.uuid4())
    exp = load_expectations()
    h = max(1, int(exp.get("evaluation_horizon_months", 1)))
    syms = symbols_from_asset_expectations(exp)

    month_ends = iter_month_ends(date_from, date_to)
    if not month_ends:
        return {"rows": 0, "batch_id": batch_id, "horizon_months": h, "message": "no month ends in range", "errors": 0}

    date_min_global = add_months(min(month_ends), -(h + 3))
    date_max_global = add_months(max(month_ends), h)
    series_map = await load_price_series(db, syms, date_min_global, date_max_global)

    n_ok = 0
    n_err = 0
    first_err: str | None = None
    today = date.today()
    for d in month_ends:
        try:
            row = await features_pit.build_feature_row(db, d)
            ng = float(row.growth_score)
            nf = float(row.fed_policy_score)
            fl_rule = match_quadrant(ng, nf)
            nq = fl_rule
            rule_id = rule_label_from_features(row.growth_score, row.fed_policy_score)

            dyn = await YieldAnalyzer(db).get_dynamics_at_date(d)

            d0 = add_months(d, -h)
            sc = quadrant_scores_from_prices(series_map, d0, d, exp)
            qid, fb = pick_quadrant(sc, rule_id)
            asset_quad = ID_TO_QUADRANT[qid]
            conf_score = float(sc.get(asset_quad, -1.0))
            confirmed_lookback = conf_score >= asset_confirm_threshold if conf_score >= 0.0 else False

            d_fwd = add_months(d, h)
            fw_score = -1.0
            fw_confirmed = False
            if d_fwd <= today:
                fw_score = float(
                    forward_pair_hit_rate_for_quadrant(series_map, d, d_fwd, fl_rule, exp)
                )
                fw_confirmed = fw_score >= asset_confirm_threshold if fw_score >= 0.0 else False
            confirmed_regime = fl_rule if fw_confirmed else None

            values = {
                "obs_date": d,
                "navigator_growth_score": float(ng),
                "navigator_fed_score": float(nf),
                "navigator_quadrant": nq,
                "fl_growth_score": float(row.growth_score),
                "fl_fed_policy_score": float(row.fed_policy_score),
                "fl_yield_10y_minus_2y": float(row.yield_10y_minus_2y),
                "fl_hy_spread_proxy": float(row.hy_spread_proxy),
                "fl_rule_quadrant": fl_rule,
                "asset_implied_quadrant": asset_quad,
                "asset_confirmation_score": conf_score,
                "asset_confirmed": bool(confirmed_lookback),
                "asset_used_rule_fallback": bool(fb),
                "forward_confirmation_score": fw_score,
                "forward_regime_confirmed": bool(fw_confirmed),
                "confirmed_regime_quadrant": confirmed_regime,
                "yield_curve_pattern": dyn.pattern,
                "yield_curve_short_chg_1m_bp": float(dyn.short_end_change_1m),
                "yield_curve_long_chg_1m_bp": float(dyn.long_end_change_1m),
                "navigator_curve_matches_expectation": curve_pattern_matches_quadrant(nq, dyn.pattern),
                "fl_rule_curve_matches_expectation": curve_pattern_matches_quadrant(fl_rule, dyn.pattern),
                "fl_curve_pattern_embed": float(row.curve_pattern_embed),
                "materialization_batch_id": batch_id,
                "materialized_at": datetime.now(timezone.utc).replace(tzinfo=None),
            }
            await _upsert_regime_history_row(db, values)
            n_ok += 1
        except Exception as e:
            n_err += 1
            if first_err is None:
                first_err = f"{type(e).__name__}: {e}"
            logger.exception("regime_history skip obs_date=%s", d)
    await db.commit()
    logger.info(
        "regime_history materialized rows=%s errors=%s batch=%s",
        n_ok,
        n_err,
        batch_id,
    )
    msg = None
    if n_ok == 0 and month_ends:
        msg = first_err or "all months failed; check backend logs"
    elif n_err:
        msg = f"{n_err} month(s) skipped; first_error={first_err}"
    return {"rows": n_ok, "batch_id": batch_id, "horizon_months": h, "message": msg, "errors": n_err}


async def fetch_regime_history(
    db: AsyncSession,
    date_from: date,
    date_to: date,
) -> list[RegimeHistoryMonthly]:
    q = (
        select(RegimeHistoryMonthly)
        .where(RegimeHistoryMonthly.obs_date >= date_from, RegimeHistoryMonthly.obs_date <= date_to)
        .order_by(RegimeHistoryMonthly.obs_date)
    )
    r = await db.execute(q)
    return list(r.scalars().all())
