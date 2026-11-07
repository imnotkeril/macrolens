"""Load aligned monthly macro/market series for training and inference."""

from __future__ import annotations

import logging
from bisect import bisect_right
from datetime import date

import pandas as pd
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.indicator import Indicator, IndicatorValue
from app.models.market_data import MarketData
from app.services.forecast_lab import features_pit
from app.services.forecast_lab.dates_util import iter_month_ends

logger = logging.getLogger("forecast_lab.macro_data")


async def _market_month_last(db: AsyncSession, symbol: str, d: date) -> float | None:
    q = (
        select(MarketData.value)
        .where(MarketData.symbol == symbol, MarketData.date <= d)
        .order_by(desc(MarketData.date))
        .limit(1)
    )
    r = await db.execute(q)
    v = r.scalar_one_or_none()
    return float(v) if v is not None else None


async def _indicator_month_last_by_fred(db: AsyncSession, fred_id: str, d: date) -> float | None:
    iq = select(Indicator.id).where(Indicator.fred_series_id == fred_id)
    ir = await db.execute(iq)
    iid = ir.scalar_one_or_none()
    if iid is None:
        return None
    q = (
        select(IndicatorValue.value)
        .where(IndicatorValue.indicator_id == iid, IndicatorValue.date <= d)
        .order_by(desc(IndicatorValue.date))
        .limit(1)
    )
    r2 = await db.execute(q)
    v = r2.scalar_one_or_none()
    return float(v) if v is not None else None


async def _series_points(db: AsyncSession, spec: dict, date_to: date):
    """(dates, values) ascending for one series spec, read with a single query."""
    sid = spec["id"]
    src = spec.get("source", "market")
    if src == "market":
        q = (
            select(MarketData.date, MarketData.value)
            .where(MarketData.symbol == sid, MarketData.date <= date_to)
            .order_by(MarketData.date)
        )
    elif src == "indicator_fred_id":
        iid = (
            await db.execute(select(Indicator.id).where(Indicator.fred_series_id == sid))
        ).scalar_one_or_none()
        if iid is None:
            return [], []
        q = (
            select(IndicatorValue.date, IndicatorValue.value)
            .where(IndicatorValue.indicator_id == iid, IndicatorValue.date <= date_to)
            .order_by(IndicatorValue.date)
        )
    else:
        return None
    rows = [(d, float(v)) for d, v in (await db.execute(q)).all() if v is not None]
    return [r[0] for r in rows], [r[1] for r in rows]


async def build_macro_frame(
    db: AsyncSession,
    date_from: date,
    date_to: date,
    series_defs: list[dict],
) -> pd.DataFrame:
    """Columns: date, growth_score, fed_policy_score, one column per series id.

    Bulk version: one read per table/series instead of one query per series per month.
    """
    dates = list(iter_month_ends(date_from, date_to))
    feats = await features_pit.build_feature_rows(db, dates)
    points = {spec["id"]: await _series_points(db, spec, date_to) for spec in series_defs}
    rows = []
    for d, feat in zip(dates, feats, strict=True):
        row: dict = {
            "date": d,
            "growth_score": feat.growth_score,
            "fed_policy_score": feat.fed_policy_score,
        }
        for spec in series_defs:
            sid = spec["id"]
            pts = points[sid]
            if pts is None:
                row[sid] = None
                continue
            i = bisect_right(pts[0], d)
            row[sid] = pts[1][i - 1] if i else None
        rows.append(row)
    return pd.DataFrame(rows)
