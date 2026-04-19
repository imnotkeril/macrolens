"""Date helpers (no dateutil dependency)."""

from __future__ import annotations

import calendar
from datetime import date


def month_end(year: int, month: int) -> date:
    return date(year, month, calendar.monthrange(year, month)[1])


def add_months(d: date, months: int) -> date:
    m0 = d.month - 1 + months
    y = d.year + m0 // 12
    m = m0 % 12 + 1
    last = calendar.monthrange(y, m)[1]
    return date(y, m, min(d.day, last))


def latest_month_end_on_or_before(d: date) -> date:
    """Last calendar month-end strictly on or before d (completed month bar)."""
    last_this = month_end(d.year, d.month)
    if d >= last_this:
        return last_this
    if d.month == 1:
        return month_end(d.year - 1, 12)
    return month_end(d.year, d.month - 1)


def iter_month_ends(date_from: date, date_to: date) -> list[date]:
    out: list[date] = []
    y, mo = date_from.year, date_from.month
    while True:
        d = month_end(y, mo)
        if d > date_to:
            break
        if d >= date_from:
            out.append(d)
        if mo == 12:
            y, mo = y + 1, 1
        else:
            mo += 1
        if y > date_to.year + 1:
            break
    return out
