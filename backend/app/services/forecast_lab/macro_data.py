"""Load aligned monthly macro/market series for training and inference."""

from __future__ import annotations

import logging
from datetime import date

import pandas as pd
from sqlalchemy import select, desc
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


async def build_macro_frame(
    db: AsyncSession,
    date_from: date,
    date_to: date,
    series_defs: list[dict],
) -> pd.DataFrame:
    """Columns: date, growth_score, fed_policy_score, one column per series id."""
    dates = iter_month_ends(date_from, date_to)
    rows = []
    for d in dates:
        feat = await features_pit.build_feature_row(db, d)
        row: dict = {
            "date": d,
            "growth_score": feat.growth_score,
            "fed_policy_score": feat.fed_policy_score,
        }
        for spec in series_defs:
            sid = spec["id"]
            src = spec.get("source", "market")
            if src == "market":
                v = await _market_month_last(db, sid, d)
            elif src == "indicator_fred_id":
                v = await _indicator_month_last_by_fred(db, sid, d)
            else:
                v = None
            row[sid] = v
        rows.append(row)
    df = pd.DataFrame(rows)
    return df
