"""Merge helpers for daily FX: FRED (H.10 noon rates, ~1 week lag) stays authoritative, and
Yahoo daily closes fill only the days after FRED's last observation."""

from __future__ import annotations

import pandas as pd


def fill_recent_from_secondary(primary: pd.Series | None, secondary: pd.Series | None) -> pd.Series:
    """`primary` plus the `secondary` points dated after the last `primary` date.

    Once the primary source catches up, the next run overwrites those days with its own values.
    """
    if primary is None or primary.empty:
        return secondary.copy() if secondary is not None else pd.Series(dtype=float)
    if secondary is None or secondary.empty:
        return primary
    # Yahoo FX sometimes carries a Sunday-evening bar; FRED never has weekend rows.
    secondary = secondary[secondary.index.dayofweek < 5]
    extra = secondary[secondary.index > primary.index.max()]
    if extra.empty:
        return primary
    return pd.concat([primary, extra]).sort_index()
