"""FOMC Summary of Economic Projections (SEP) from FRED (public series).

All series are annual, observation date = projection year (latest release vintage):
median, central tendency (ct) and full range (range) of the year-end federal funds rate.
FRED has no per-participant dots, so the dot plot shows these ranges instead.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

from app.services.fred_http import fred_observations

logger = logging.getLogger(__name__)

FEDTARMD = "FEDTARMD"  # median, year-end
FEDTARMDLR = "FEDTARMDLR"  # longer-run median
SEP_SERIES = {
    "median": FEDTARMD,
    "ct_high": "FEDTARCTH",
    "ct_low": "FEDTARCTL",
    "range_high": "FEDTARRH",
    "range_low": "FEDTARRL",
}


def _by_year(rows: list[dict[str, Any]]) -> dict[int, float]:
    out: dict[int, float] = {}
    for row in rows:
        try:
            year = int(str(row.get("date") or "")[:4])
            out.setdefault(year, float(row["value"]))
        except (KeyError, TypeError, ValueError):
            continue
    return out


def assemble_rate_path(
    *,
    sep: dict[str, dict[int, float]],
    longer_run: float | None,
    current_mid: float,
    market_now: float | None,
    market_year_end: dict[int, float],
    this_year: int,
) -> dict[str, dict[str, Any]]:
    """Dot-plot points: now, y0..y2 (year-end SEP vs market) and longer-run.

    A point is omitted when its Fed number does not exist; `market` is None when the futures
    curve does not reach that date (never filled with the Fed number).
    """

    def r(v: float | None) -> float | None:
        return None if v is None else round(float(v), 2)

    path: dict[str, dict[str, Any]] = {
        "now": {"label": "Now", "fed_median": r(current_mid), "market": r(market_now)}
    }
    median = sep.get("median", {})
    for k in range(3):
        year = this_year + k
        if year not in median:
            continue
        path[f"y{k}"] = {
            "label": f"Dec {year % 100:02d}",
            "fed_median": r(median[year]),
            "market": r(market_year_end.get(year)),
            "ct_low": r(sep.get("ct_low", {}).get(year)),
            "ct_high": r(sep.get("ct_high", {}).get(year)),
            "range_low": r(sep.get("range_low", {}).get(year)),
            "range_high": r(sep.get("range_high", {}).get(year)),
        }
    if longer_run is not None:
        path["lt"] = {"label": "Longer run", "fed_median": r(longer_run), "market": None}
    return path


async def build_sep_rate_path_from_fred(
    *,
    api_key: str,
    current_mid: float,
    market_now: float | None,
    market_year_end: dict[int, float] | None = None,
) -> tuple[dict[str, dict[str, Any]], dict[str, str | float | None]]:
    """Returns (rate_path, meta). Empty path when FRED is unavailable."""
    meta: dict[str, str | float | None] = {"source": "fred_sep", "fedtarmd_lr": None}
    if not api_key:
        return {}, {**meta, "source": "missing_fred_key"}

    sep: dict[str, dict[int, float]] = {}
    for key, series_id in SEP_SERIES.items():
        rows = await fred_observations(series_id, api_key=api_key, limit=12, sort_order="desc")
        sep[key] = _by_year(rows)
    if not sep["median"]:
        return {}, {**meta, "source": "fred_sep_unavailable"}

    lr_rows = await fred_observations(FEDTARMDLR, api_key=api_key, limit=4, sort_order="desc")
    lt_val: float | None = None
    if lr_rows:
        try:
            lt_val = float(lr_rows[0]["value"])
            meta["fedtarmd_lr_obs_date"] = lr_rows[0].get("date")
        except (KeyError, TypeError, ValueError):
            lt_val = None
    meta["fedtarmd_lr"] = lt_val

    path = assemble_rate_path(
        sep=sep,
        longer_run=lt_val,
        current_mid=current_mid,
        market_now=market_now,
        market_year_end=market_year_end or {},
        this_year=date.today().year,
    )
    return path, meta
