"""Frequency-aware staleness of market series (replaces one fixed 5-day cut-off).

A monthly series is not "stale" 40 days after its observation date, and a discontinued series
should not keep the source in a permanent "degraded" state. Tolerances are generous on purpose:
the goal is to catch a source that stopped delivering, not normal release lags.
"""

from __future__ import annotations

from datetime import date

# Max age (days since last observation) before a series counts as stale, by release frequency.
MAX_AGE_DAYS = {"daily": 8, "weekly": 14, "monthly": 75}

# Frequency of the series collected by the daily market job (symbol -> frequency).
SERIES_FREQUENCY = {
    "WTI_OIL": "daily",
    # Daily series that FRED publishes about a week late (updated Mon/Tue): weekly tolerance.
    "DXY": "weekly",
    "VIX": "daily",
    "SP500": "daily",
    "RRP": "daily",
    "TERM_PREMIUM_10Y": "weekly",
    "TGA": "weekly",
    "COPPER": "monthly",
    "USREC": "monthly",
    "EURUSD": "daily",
    "USDJPY": "daily",
    "GBPUSD": "daily",
    "USDCAD": "daily",
    "AUDUSD": "daily",
    "USDCHF": "daily",
}

# Series the publisher stopped: excluded from the ratio (history is still stored).
DISCONTINUED = frozenset({"TED_SPREAD"})


def is_stale(symbol: str, last_obs: date | None, today: date) -> bool:
    """True when `symbol` has no data or its last observation is older than its tolerance."""
    if last_obs is None:
        return True
    limit = MAX_AGE_DAYS[SERIES_FREQUENCY.get(symbol, "daily")]
    return (today - last_obs).days > limit


def stale_report(
    last_obs_by_symbol: dict[str, date | None], today: date
) -> tuple[int, int, list[str]]:
    """(stale_count, active_total, stale_symbols) over series that are not discontinued."""
    active = {s: d for s, d in last_obs_by_symbol.items() if s not in DISCONTINUED}
    stale = sorted(s for s, d in active.items() if is_stale(s, d, today))
    return len(stale), len(active), stale
