"""Point-in-time feature builder for Forecast Lab (no ml_dataset_builder import)."""

from __future__ import annotations

import logging
from bisect import bisect_right
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

import numpy as np
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.fed_policy import FedRate
from app.models.indicator import Importance, Indicator, IndicatorCategory, IndicatorValue
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
    spread = await yield_spread_10y_2y_or_none(db, as_of)
    return spread if spread is not None else 0.0


async def has_fed_rate_at_date(db: AsyncSession, as_of: date) -> bool:
    q = select(FedRate.date).where(FedRate.date <= as_of).limit(1)
    return (await db.execute(q)).scalar_one_or_none() is not None


async def yield_spread_10y_2y_or_none(db: AsyncSession, as_of: date) -> float | None:
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
    return None


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


def _latest_on_or_before(dates: list[date], vals: list[float], d: date) -> float | None:
    """Value at the last observation dated <= d (dates sorted ascending)."""
    i = bisect_right(dates, d)
    return vals[i - 1] if i else None


async def build_feature_rows(db: AsyncSession, as_of_dates: list[date]) -> list[FeatureRow]:
    """Point-in-time FeatureRows for many dates from a handful of bulk queries.

    Same maths as the per-date helpers (growth_score_at_date, FedTracker.get_policy_score_at_date,
    yield/HY lookups, YieldAnalyzer.get_dynamics_at_date), but the source tables are read once
    and every date is computed in memory. The per-date path needed ~50 round trips per date,
    which is minutes against a remote database when a model needs a few dozen months.
    """
    if not as_of_dates:
        return []
    max_d = max(as_of_dates)
    neutral = float(get_settings().neutral_rate_fallback)

    inds = (
        (
            await db.execute(
                select(Indicator).where(Indicator.category.in_(list(CATEGORY_WEIGHTS.keys())))
            )
        )
        .scalars()
        .all()
    )
    by_ind: dict[int, tuple[list[date], list[float]]] = {i.id: ([], []) for i in inds}
    if by_ind:
        q = (
            select(IndicatorValue.indicator_id, IndicatorValue.date, IndicatorValue.value)
            .where(IndicatorValue.indicator_id.in_(list(by_ind)), IndicatorValue.date <= max_d)
            .order_by(IndicatorValue.indicator_id, IndicatorValue.date)
        )
        for iid, d, v in (await db.execute(q)).all():
            if v is not None:
                by_ind[iid][0].append(d)
                by_ind[iid][1].append(float(v))

    fed_rows = (
        await db.execute(
            select(FedRate.date, FedRate.target_upper, FedRate.target_lower)
            .where(FedRate.date <= max_d)
            .order_by(FedRate.date)
        )
    ).all()
    fed_dates = [r[0] for r in fed_rows]
    fed_bounds = [(float(r[1]), float(r[2])) for r in fed_rows]

    y_rows = (
        await db.execute(
            select(YieldData.maturity, YieldData.date, YieldData.nominal_yield)
            .where(YieldData.maturity.in_(["2Y", "10Y"]), YieldData.date <= max_d)
            .order_by(YieldData.date)
        )
    ).all()
    ys: dict[str, tuple[list[date], list[float]]] = {"2Y": ([], []), "10Y": ([], [])}
    for mat, d, v in y_rows:
        if v is not None:
            ys[mat][0].append(d)
            ys[mat][1].append(float(v))

    hy_syms = ("HY_OAS", "HY_SPREAD", "IG_SPREAD")
    hy_rows = (
        await db.execute(
            select(MarketData.symbol, MarketData.date, MarketData.value)
            .where(MarketData.symbol.in_(hy_syms), MarketData.date <= max_d)
            .order_by(MarketData.date)
        )
    ).all()
    hy: dict[str, tuple[list[date], list[float]]] = {s: ([], []) for s in hy_syms}
    for sym, d, v in hy_rows:
        if v is not None:
            hy[sym][0].append(d)
            hy[sym][1].append(float(v))

    cat_inds: dict[IndicatorCategory, list[Indicator]] = {}
    for ind in inds:
        cat_inds.setdefault(ind.category, []).append(ind)

    def growth(d: date) -> tuple[float, dict[str, Any]]:
        avail: dict[str, Any] = {"categories_used": []}
        weighted: list[tuple[float, float]] = []
        for category in CATEGORY_WEIGHTS:
            members = cat_inds.get(category)
            if not members:
                continue
            for ind in members:
                dates, vals = by_ind[ind.id]
                hi = bisect_right(dates, d)
                window = vals[max(0, hi - 120) : hi]
                if len(window) < 12:
                    continue
                arr = np.array(window)
                std = arr.std()
                z = 0.0 if std == 0 else float((arr[-1] - arr.mean()) / std)
                if ind.name in INVERSE_INDICATORS:
                    z = -z
                weighted.append((z, IMPORTANCE_WEIGHT.get(ind.importance, 0.5)))
            avail["categories_used"].append(category.value)
        if not weighted:
            return 0.0, avail
        tw = sum(w for _, w in weighted)
        g = sum(z * w for z, w in weighted) / tw if tw else 0.0
        return max(-2.0, min(2.0, float(g))), avail

    def fed_score(d: date) -> float:
        i = bisect_right(fed_dates, d)
        if not i:
            return 0.0
        upper, lower = fed_bounds[i - 1]
        rate_component = max(-1.0, min(1.0, ((upper + lower) / 2 - neutral) / neutral))
        j = bisect_right(fed_dates, d - timedelta(days=60))
        dir_component = 0.0
        if j:
            prev_upper = fed_bounds[j - 1][0]
            if upper > prev_upper:
                dir_component = 0.5
            elif upper < prev_upper:
                dir_component = -0.5
        return max(-2.0, min(2.0, rate_component + dir_component))

    def yld(mat: str, d: date) -> float | None:
        return _latest_on_or_before(ys[mat][0], ys[mat][1], d)

    out: list[FeatureRow] = []
    for d in as_of_dates:
        g, g_avail = growth(d)
        fed = fed_score(d)
        y10, y2 = yld("10Y", d), yld("2Y", d)
        ysp_real = (y10 - y2) if y10 is not None and y2 is not None else None
        hy_val = 0.0
        for sym in hy_syms:
            v = _latest_on_or_before(hy[sym][0], hy[sym][1], d)
            if v is not None:
                hy_val = v
                break

        past = d - timedelta(days=30)
        s_p, l_p = yld("2Y", past), yld("10Y", past)
        sc_1m = (y2 - s_p) if y2 is not None and s_p is not None else 0.0
        lc_1m = (y10 - l_p) if y10 is not None and l_p is not None else 0.0
        cpat, _ = YieldAnalyzer._classify_pattern(sc_1m, lc_1m)
        avail = {
            **g_avail,
            "fed": bisect_right(fed_dates, d) > 0,
            "yield_spread": ysp_real is not None,
            "hy": hy_val != 0.0,
            "curve_pattern": cpat,
        }
        out.append(
            FeatureRow(
                as_of_date=d,
                growth_score=g,
                fed_policy_score=max(-2.0, min(2.0, fed)),
                yield_10y_minus_2y=ysp_real if ysp_real is not None else 0.0,
                hy_spread_proxy=hy_val,
                curve_pattern=cpat,
                curve_pattern_embed=curve_pattern_to_embed(cpat),
                availability=avail,
            )
        )
    return out


async def build_feature_row(db: AsyncSession, as_of: date) -> FeatureRow:
    return (await build_feature_rows(db, [as_of]))[0]


async def build_feature_row_per_query(db: AsyncSession, as_of: date) -> FeatureRow:
    """Reference implementation (one query per lookup); kept to cross-check build_feature_rows."""
    g, g_avail = await growth_score_at_date(db, as_of)
    ft = FedTracker(db)
    fed = await ft.get_policy_score_at_date(as_of)
    ysp_real = await yield_spread_10y_2y_or_none(db, as_of)
    ysp = ysp_real if ysp_real is not None else 0.0
    has_fed = await has_fed_rate_at_date(db, as_of)
    hy = await hy_spread_proxy_at_date(db, as_of)
    dyn = await YieldAnalyzer(db).get_dynamics_at_date(as_of)
    cpat = dyn.pattern
    cemb = curve_pattern_to_embed(cpat)
    avail = {
        **g_avail,
        "fed": has_fed,
        "yield_spread": ysp_real is not None,
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
    y, mo = date_from.year, date_from.month

    while True:
        _, last = calendar.monthrange(y, mo)
        d = date(y, mo, last)
        if d > date_to:
            break
        if d >= date_from:
            dates_out.append(d)
        if mo == 12:
            y, mo = y + 1, 1
        else:
            mo += 1
        if y > date_to.year + 2:
            break

    return dates_out, await build_feature_rows(db, dates_out)


async def build_monthly_feature_frame(
    db: AsyncSession,
    date_from: date,
    date_to: date,
) -> tuple[list[date], list[list[float]]]:
    """Month-end dates with vectors using current FEATURE_NAMES order."""
    dates_out, rows = await build_monthly_feature_rows(db, date_from, date_to)
    X = [r.vector_for_names(FEATURE_NAMES) for r in rows]
    return dates_out, X
