"""Forward 12-month recession labels from `recession_labels` table (PIT)."""

from __future__ import annotations

from datetime import date
from typing import Any

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.forecast_lab import RecessionLabel
from app.services.forecast_lab.recession_labels_core import forward_recession_within_months


async def load_recession_timeline(db: AsyncSession) -> list[tuple[date, bool]]:
    q = select(RecessionLabel.obs_date, RecessionLabel.is_recession).order_by(
        RecessionLabel.obs_date, RecessionLabel.id
    )
    rows = (await db.execute(q)).all()
    return [(r[0], bool(r[1])) for r in rows]


async def build_recession_forward_labels(
    db: AsyncSession,
    dates: list[date],
    horizon_months: int = 12,
) -> tuple[np.ndarray, dict[str, Any]]:
    """
    For each month-end observation date d, y=1 if recession flag holds on any month-end
    in the strictly forward window of `horizon_months` calendar months (macro PIT).
    """
    timeline = await load_recession_timeline(db)
    stats: dict[str, Any] = {
        "rows": len(timeline),
        "horizon_months": horizon_months,
        "positives": 0,
    }
    if not timeline:
        return np.zeros(len(dates), dtype=np.int64), stats

    s_dates = [t[0] for t in timeline]
    s_rec = [t[1] for t in timeline]
    y: list[int] = []
    for d in dates:
        y.append(forward_recession_within_months(s_dates, s_rec, d, horizon_months))
    arr = np.array(y, dtype=np.int64)
    stats["positives"] = int(arr.sum())
    return arr, stats
