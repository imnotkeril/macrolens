"""Pure helpers for recession forward-window labels (no SQLAlchemy)."""

from __future__ import annotations

from bisect import bisect_right
from datetime import date

from app.services.forecast_lab.dates_util import add_months, month_end


def state_on_or_before(sorted_dates: list[date], sorted_recess: list[bool], d: date) -> bool | None:
    """Last known is_recession for obs_date <= d."""
    if not sorted_dates:
        return None
    i = bisect_right(sorted_dates, d) - 1
    if i < 0:
        return None
    return sorted_recess[i]


def forward_recession_within_months(
    sorted_dates: list[date],
    sorted_recess: list[bool],
    anchor: date,
    horizon_months: int,
) -> int:
    """1 if any month-end strictly after anchor's month through +horizon_months is in recession."""
    if not sorted_dates:
        return 0
    for k in range(1, horizon_months + 1):
        dm = add_months(anchor, k)
        ld = month_end(dm.year, dm.month)
        st = state_on_or_before(sorted_dates, sorted_recess, ld)
        if st is True:
            return 1
    return 0
