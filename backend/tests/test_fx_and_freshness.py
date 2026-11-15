from datetime import date

import pandas as pd

from app.services.fx_merge import fill_recent_from_secondary
from app.services.series_freshness import DISCONTINUED, is_stale, stale_report


def _s(values, start):
    return pd.Series(values, index=pd.date_range(start, periods=len(values), freq="D"), dtype=float)


def test_yahoo_fills_only_days_after_fred_last_observation():
    fred = _s([1.10, 1.11], "2026-11-09")  # Mon, Tue
    yahoo = _s([9.0, 9.0, 1.12, 1.13], "2026-11-09")  # Mon..Thu (older days must NOT replace FRED)
    out = fill_recent_from_secondary(fred, yahoo)
    assert list(out.index.strftime("%d")) == ["09", "10", "11", "12"]
    assert list(out.values) == [1.10, 1.11, 1.12, 1.13]


def test_fill_handles_missing_sides():
    s = _s([1.0, 2.0], "2026-11-05")
    assert fill_recent_from_secondary(s, None) is s
    assert fill_recent_from_secondary(None, s).equals(s)
    assert fill_recent_from_secondary(None, None).empty
    assert fill_recent_from_secondary(s, s.iloc[:1]) is s  # nothing newer


def test_is_stale_uses_release_frequency():
    today = date(2026, 11, 15)
    assert not is_stale("VIX", date(2026, 11, 12), today)  # daily, 3 days
    assert is_stale("VIX", date(2026, 11, 1), today)  # daily, 14 days
    assert not is_stale("TGA", date(2026, 11, 5), today)  # weekly, 10 days
    assert not is_stale("COPPER", date(2026, 10, 1), today)  # monthly, 45 days
    assert is_stale("COPPER", date(2026, 8, 1), today)  # monthly, 106 days
    assert is_stale("VIX", None, today)


def test_stale_report_excludes_discontinued_and_names_stale_series():
    today = date(2026, 11, 15)
    last = {
        "VIX": date(2026, 11, 13),
        "SP500": date(2026, 10, 1),  # stale
        "COPPER": date(2026, 10, 1),  # fine (monthly)
        "TED_SPREAD": date(2022, 1, 21),  # discontinued: ignored
        "DXY": None,  # stale
    }
    stale, total, names = stale_report(last, today)
    assert "TED_SPREAD" in DISCONTINUED
    assert (stale, total) == (2, 4)
    assert names == ["DXY", "SP500"]


def test_weekend_bars_from_secondary_are_dropped():
    fred = _s([1.10], "2026-11-12")  # Thursday
    yahoo = _s([1.11, 1.12, 1.13, 1.14], "2026-11-13")  # Fri, Sat, Sun, Mon
    out = fill_recent_from_secondary(fred, yahoo)
    assert list(out.index.strftime("%a")) == ["Thu", "Fri", "Mon"]


def test_lagged_daily_fred_series_are_not_flagged_during_the_weekly_lag():
    today = date(2026, 11, 15)  # FRED last obs 2026-11-06, updated 2026-11-09/10
    assert not is_stale("DXY", date(2026, 11, 6), today)
    assert not is_stale("TERM_PREMIUM_10Y", date(2026, 11, 6), today)
    assert is_stale("DXY", date(2026, 10, 25), today)  # three weeks: really stale
