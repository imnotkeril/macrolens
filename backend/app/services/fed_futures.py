"""Market-implied Fed path from 30-day fed funds futures (ZQ), pure functions.

ZQ settles at 100 - (average daily EFFR over the contract month). Chaining the monthly
contracts through the meeting calendar gives the expected policy change per meeting,
which is the same idea CME FedWatch uses (simplified: expected-value split between the two
nearest 25bp outcomes).
"""

from __future__ import annotations

import calendar
import math
from datetime import date

MONTH_CODES = "FGHJKMNQUVXZ"
# Meetings this close to month end are read from the next month's contract instead.
_MIN_POST_DAYS = 7


def zq_symbol(year: int, month: int) -> str:
    """Yahoo symbol of the ZQ contract for a calendar month, e.g. ZQZ26.CBT."""
    return f"ZQ{MONTH_CODES[month - 1]}{year % 100:02d}.CBT"


def db_symbol(year: int, month: int) -> str:
    """market_data symbol we store a monthly contract under, e.g. ZQ_202612."""
    return f"ZQ_{year}{month:02d}"


def implied_rate(price: float) -> float:
    return 100.0 - price


def _step_probabilities(delta: float) -> dict[str, float]:
    """Split an expected change (in %) into hold / cut25 / cut50 / hike probabilities."""
    u = max(-4.0, min(4.0, delta / 0.25))
    lo = math.floor(u)
    frac = u - lo
    probs = {"hold": 0.0, "cut25": 0.0, "cut50": 0.0, "hike": 0.0}
    for steps, p in ((lo, 1 - frac), (lo + 1, frac)):
        if p <= 0:
            continue
        if steps == 0:
            probs["hold"] += p
        elif steps == -1:
            probs["cut25"] += p
        elif steps <= -2:
            probs["cut50"] += p
        else:
            probs["hike"] += p
    return probs


def meeting_probabilities(
    decisions: list[date],
    curve: dict[tuple[int, int], float],
    effr_now: float,
) -> list[dict]:
    """Per-meeting expected change and outcome probabilities.

    `curve` maps (year, month) -> implied rate (100 - price). Meetings whose month has no
    contract are skipped (the chain stops there). Returns dicts with date, expected_change,
    rate_after, and hold/cut25/cut50/hike percentages (summing to 100).
    """
    out: list[dict] = []
    r_pre = effr_now
    for d in decisions:
        n = calendar.monthrange(d.year, d.month)[1]
        post_days = n - d.day
        if post_days >= _MIN_POST_DAYS and (d.year, d.month) in curve:
            r_post = (curve[(d.year, d.month)] - d.day / n * r_pre) / (post_days / n)
        else:
            ny, nm = (d.year + 1, 1) if d.month == 12 else (d.year, d.month + 1)
            if (ny, nm) not in curve:
                break
            r_post = curve[(ny, nm)]
        delta = max(-1.0, min(1.0, r_post - r_pre))
        probs = _step_probabilities(delta)
        pct = {k: round(v * 100) for k, v in probs.items()}
        pct["hold"] += 100 - sum(pct.values())  # fix rounding drift
        out.append(
            {
                "date": d,
                "expected_change": round(delta, 4),
                "rate_after": round(r_pre + delta, 4),
                **{f"{k}_pct": v for k, v in pct.items()},
            }
        )
        r_pre += delta
    return out
