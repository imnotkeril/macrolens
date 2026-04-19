from __future__ import annotations

from datetime import date

import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.factor import FactorReturn


FACTOR_NAMES = ["VALUE", "GROWTH", "QUALITY", "SIZE", "MOMENTUM", "LOW_VOL"]
HORIZONS = [1, 3, 6]


async def build_ml2_dataset(db: AsyncSession) -> pd.DataFrame:
    q = select(FactorReturn.date, FactorReturn.factor_name, FactorReturn.value).order_by(FactorReturn.date.asc())
    rows = (await db.execute(q)).all()
    if not rows:
        return pd.DataFrame()
    raw = pd.DataFrame(rows, columns=["date", "factor_name", "value"])
    pivot = raw.pivot_table(index="date", columns="factor_name", values="value", aggfunc="last").sort_index()
    if pivot.empty:
        return pd.DataFrame()

    ret = pivot.pct_change().fillna(0.0)
    features = pd.DataFrame(index=ret.index)
    for col in ret.columns:
        features[f"{col}_ret_1m"] = ret[col]
        features[f"{col}_ret_3m"] = ret[col].rolling(3, min_periods=1).mean()
        features[f"{col}_vol_6m"] = ret[col].rolling(6, min_periods=2).std().fillna(0.0)

    target_df = pd.DataFrame(index=ret.index)
    cross_mean = ret.mean(axis=1)
    for col in ret.columns:
        for h in HORIZONS:
            fwd = ret[col].rolling(h, min_periods=h).sum().shift(-h)
            target_df[f"{col}_rel_fwd_{h}m"] = fwd - cross_mean.shift(-h)

    ds = pd.concat([features, target_df], axis=1).dropna(how="all")
    ds = ds.reset_index().rename(columns={"index": "date"})
    ds["date"] = pd.to_datetime(ds["date"]).dt.date
    return ds


def latest_available_date(df: pd.DataFrame) -> date | None:
    if df.empty or "date" not in df.columns:
        return None
    return max(df["date"])

