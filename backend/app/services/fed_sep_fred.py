"""FOMC Summary of Economic Projections (SEP) median paths from FRED (public series)."""

from __future__ import annotations

import logging
from datetime import date

from app.services.fred_http import fred_observations

logger = logging.getLogger(__name__)

# Median projection for end of calendar year; annual observations (release vintage on observation_date).
FEDTARMD = "FEDTARMD"
# Longer-run median federal funds rate projection.
FEDTARMDLR = "FEDTARMDLR"


def _year_from_obs_date(obs_date: str) -> int | None:
    try:
        return int(str(obs_date)[:4])
    except Exception:
        return None


async def build_sep_rate_path_from_fred(
    *,
    api_key: str,
    current_mid: float,
    market_now: float | None,
) -> tuple[dict[str, dict[str, float]], dict[str, str | float | None]]:
    """
    Returns (rate_path compatible with Fed dashboard, meta).

    rate_path keys: now, q2_26, q4_26, 2027, lt — aligned with existing frontend dot plot.
    """
    meta: dict[str, str | float | None] = {"source": "fred_sep", "fedtarmd_lr": None}
    if not api_key:
        return {}, {**meta, "source": "missing_fred_key"}

    tar_rows = await fred_observations(FEDTARMD, api_key=api_key, limit=40, sort_order="desc")
    lr = await fred_observations(FEDTARMDLR, api_key=api_key, limit=8, sort_order="desc")

    by_year: dict[int, float] = {}
    for row in tar_rows:
        y = _year_from_obs_date(str(row.get("date") or ""))
        if y is None:
            continue
        try:
            v = float(row["value"])
        except (KeyError, TypeError, ValueError):
            continue
        if y not in by_year:
            by_year[y] = v

    lt_val = None
    if lr:
        try:
            lt_val = float(lr[0]["value"])
            meta["fedtarmd_lr_obs_date"] = lr[0].get("date")
        except (KeyError, TypeError, ValueError, IndexError):
            lt_val = None
    meta["fedtarmd_lr"] = lt_val

    y0 = date.today().year
    y_med = lambda yy: by_year.get(yy)

    fed_y0 = y_med(y0) or current_mid
    fed_y1 = y_med(y0 + 1) or fed_y0
    fed_y2 = y_med(y0 + 2) or fed_y1
    lt_fed = lt_val if lt_val is not None else (fed_y2 if fed_y2 is not None else 2.5)

    m_now = market_now if market_now is not None else current_mid
    m_y1 = y_med(y0 + 1) or m_now
    m_y2 = y_med(y0 + 2) or m_y1
    m_lt = lt_val if lt_val is not None else m_y2

    rate_path = {
        "now": {"fed_median": round(float(fed_y0), 2), "market": round(float(m_now), 2)},
        "q2_26": {"fed_median": round(float(fed_y0), 2), "market": round(float(m_now), 2)},
        "q4_26": {"fed_median": round(float(fed_y1), 2), "market": round(float(m_y1), 2)},
        "2027": {"fed_median": round(float(fed_y2), 2), "market": round(float(m_y2), 2)},
        "lt": {"fed_median": round(float(lt_fed), 2), "market": round(float(m_lt), 2)},
    }
    return rate_path, meta
