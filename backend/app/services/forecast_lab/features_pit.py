"""Point-in-time feature builder for Forecast Lab (no ml_dataset_builder import)."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date
from typing import Any

import numpy as np
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.indicator import Indicator, IndicatorValue, IndicatorCategory, Importance
from app.models.market_data import MarketData, YieldData
from app.services.fed_tracker import FedTracker
from app.services.forecast_lab.curve_pattern_features import (
    LEGACY_FEATURE_NAMES,
    curve_pattern_to_embed,
)
from app.services.yield_analyzer import YieldAnalyzer

logger = logging.getLogger("forecast_lab.features_pit")

INVERSE_INDICATORS = {"Unemployment Rate", "Initial Jobless Claims"}

IMPORTANCE_WEIGHT = {
    Importance.HIGH: 1.0,
    Importance.MEDIUM: 0.6,
    Importance.LOW: 0.3,
}

CATEGORY_WEIGHTS = {
    IndicatorCategory.HOUSING: 0.30,
    IndicatorCategory.ORDERS: 0.30,
    IndicatorCategory.INCOME_SALES: 0.25,
    IndicatorCategory.EMPLOYMENT: 0.15,
}

FEATURE_NAMES = [
    "growth_score",
    "fed_policy_score",
    "yield_10y_minus_2y",
    "hy_spread_proxy",
    "curve_pattern_embed",
]


@dataclass
class FeatureRow:
    as_of_date: date
    growth_score: float
    fed_policy_score: float
    yield_10y_minus_2y: float
    hy_spread_proxy: float
    curve_pattern: str
    curve_pattern_embed: float
    availability: dict[str, Any] = field(default_factory=dict)

    def vector(self) -> list[float]:
        return self.vector_for_names(FEATURE_NAMES)

    def vector_for_names(self, names: list[str]) -> list[float]:
        m: dict[str, float] = {
            "growth_score": self.growth_score,
            "fed_policy_score": self.fed_policy_score,
            "yield_10y_minus_2y": self.yield_10y_minus_2y,
            "hy_spread_proxy": self.hy_spread_proxy,
            "curve_pattern_embed": self.curve_pattern_embed,
        }
        return [float(m[n]) for n in names]


async def _indicator_z_at_date(db: AsyncSession, indicator_id: int, as_of: date) -> float | None:
    q = (
        select(IndicatorValue.value)
        .where(
            IndicatorValue.indicator_id == indicator_id,
            IndicatorValue.date <= as_of,
        )
        .order_by(desc(IndicatorValue.date))
        .limit(120)
    )
    result = await db.execute(q)
    values = [r[0] for r in result.all()]
    if len(values) < 12:
        return None
    arr = np.array(values[::-1])  # chronological
    current = arr[-1]
    mean = arr.mean()
    std = arr.std()
    if std == 0:
        return 0.0
    return float((current - mean) / std)


async def growth_score_at_date(db: AsyncSession, as_of: date) -> tuple[float, dict[str, Any]]:
    avail: dict[str, Any] = {"categories_used": []}
    weighted: list[tuple[float, float]] = []

    for category, cat_w in CATEGORY_WEIGHTS.items():
        q = select(Indicator).where(Indicator.category == category)
        indicators = (await db.execute(q)).scalars().all()
        if not indicators:
            continue
        for ind in indicators:
            z = await _indicator_z_at_date(db, ind.id, as_of)
            if z is None:
                continue
            if ind.name in INVERSE_INDICATORS:
                z = -z
            w = IMPORTANCE_WEIGHT.get(ind.importance, 0.5)
            weighted.append((z, w))
        avail["categories_used"].append(category.value)

    if not weighted:
        return 0.0, avail

    tw = sum(w for _, w in weighted)
    g = sum(z * w for z, w in weighted) / tw if tw else 0.0
    g = max(-2.0, min(2.0, float(g)))
    return g, avail


async def yield_spread_10y_2y_at_date(db: AsyncSession, as_of: date) -> float:
    async def _yield_val(maturity: str) -> float | None:
        q = (
            select(YieldData.nominal_yield)
            .where(YieldData.date <= as_of, YieldData.maturity == maturity)
            .order_by(desc(YieldData.date))
            .limit(1)
        )
        r = await db.execute(q)
        v = r.scalar_one_or_none()
        return float(v) if v is not None else None

    y10 = await _yield_val("10Y")
    y2 = await _yield_val("2Y")
    if y10 is not None and y2 is not None:
        return y10 - y2
    return 0.0


async def hy_spread_proxy_at_date(db: AsyncSession, as_of: date) -> float:
    """Use HY OAS or IG spread from market_data if present; else 0."""
    for sym in ("HY_OAS", "HY_SPREAD", "IG_SPREAD"):
        q = (
            select(MarketData.value)
            .where(MarketData.date <= as_of, MarketData.symbol == sym)
            .order_by(desc(MarketData.date))
            .limit(1)
        )
        r = await db.execute(q)
        v = r.scalar_one_or_none()
        if v is not None:
            return float(v)
    return 0.0


async def build_feature_row(db: AsyncSession, as_of: date) -> FeatureRow:
    g, g_avail = await growth_score_at_date(db, as_of)
    ft = FedTracker(db)
    fed = await ft.get_policy_score_at_date(as_of)
    ysp = await yield_spread_10y_2y_at_date(db, as_of)
    hy = await hy_spread_proxy_at_date(db, as_of)
    dyn = await YieldAnalyzer(db).get_dynamics_at_date(as_of)
    cpat = dyn.pattern
    cemb = curve_pattern_to_embed(cpat)
    avail = {
        **g_avail,
        "fed": True,
        "yield_spread": ysp != 0.0 or True,
        "hy": hy != 0.0,
        "curve_pattern": cpat,
    }
    return FeatureRow(
        as_of_date=as_of,
        growth_score=g,
        fed_policy_score=max(-2.0, min(2.0, fed)),
        yield_10y_minus_2y=ysp,
        hy_spread_proxy=hy,
        curve_pattern=cpat,
        curve_pattern_embed=cemb,
        availability=avail,
    )


def resolve_feature_names_from_meta(meta: dict[str, Any] | None) -> list[str]:
    """Backward-compatible feature order for inference (older bundles = 4 features)."""
    if meta and isinstance(meta.get("feature_names"), list) and meta["feature_names"]:
        return [str(x) for x in meta["feature_names"]]
    return list(LEGACY_FEATURE_NAMES)


async def build_monthly_feature_rows(
    db: AsyncSession,
    date_from: date,
    date_to: date,
) -> tuple[list[date], list[FeatureRow]]:
    """Month-end FeatureRow objects between bounds (PIT)."""
    import calendar

    dates_out: list[date] = []
    rows_out: list[FeatureRow] = []
    y, mo = date_from.year, date_from.month

    while True:
        _, last = calendar.monthrange(y, mo)
        d = date(y, mo, last)
        if d > date_to:
            break
        if d >= date_from:
            row = await build_feature_row(db, d)
            dates_out.append(d)
            rows_out.append(row)
        if mo == 12:
            y, mo = y + 1, 1
        else:
            mo += 1
        if y > date_to.year + 2:
            break

    return dates_out, rows_out


async def build_monthly_feature_frame(
    db: AsyncSession,
    date_from: date,
    date_to: date,
) -> tuple[list[date], list[list[float]]]:
    """Month-end dates with vectors using current FEATURE_NAMES order."""
    dates_out, rows = await build_monthly_feature_rows(db, date_from, date_to)
    X = [r.vector_for_names(FEATURE_NAMES) for r in rows]
    return dates_out, X
