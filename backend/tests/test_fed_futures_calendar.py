from datetime import date

import pytest

from app.services.fed_futures import (
    db_symbol,
    implied_rate,
    meeting_probabilities,
    zq_symbol,
)
from app.services.fed_sep_fred import assemble_rate_path
from app.services.fomc_calendar import parse_fomc_calendar


def test_symbols():
    assert zq_symbol(2026, 12) == "ZQZ26.CBT"
    assert zq_symbol(2027, 1) == "ZQF27.CBT"
    assert db_symbol(2027, 3) == "ZQ_202703"
    assert implied_rate(96.0) == pytest.approx(4.0)


def test_full_cut_priced_mid_month():
    # Dec 9 meeting (31-day month). r_pre 4.00, post 3.75 -> contract average:
    avg = 9 / 31 * 4.00 + 22 / 31 * 3.75
    out = meeting_probabilities([date(2026, 12, 9)], {(2026, 12): avg}, 4.00)
    assert out[0]["expected_change"] == pytest.approx(-0.25, abs=1e-4)
    assert out[0]["cut25_pct"] == 100 and out[0]["hold_pct"] == 0


def test_half_cut_probability():
    avg = 9 / 31 * 4.00 + 22 / 31 * 3.875
    m = meeting_probabilities([date(2026, 12, 9)], {(2026, 12): avg}, 4.00)[0]
    assert (m["hold_pct"], m["cut25_pct"], m["cut50_pct"], m["hike_pct"]) == (50, 50, 0, 0)


def test_late_month_meeting_reads_next_contract():
    curve = {(2026, 10): 4.0, (2026, 11): 3.75}
    m = meeting_probabilities([date(2026, 10, 28)], curve, 4.00)[0]
    assert m["cut25_pct"] == 100


def test_hike_and_double_cut_buckets():
    hike = meeting_probabilities([date(2026, 11, 4)], {(2026, 11): 4.0 + 26 / 30 * 0.25}, 4.0)[0]
    assert hike["hike_pct"] == 100
    cut2 = meeting_probabilities([date(2026, 11, 4)], {(2026, 11): 4.0 - 26 / 30 * 0.5}, 4.0)[0]
    assert cut2["cut50_pct"] == 100


def test_chain_updates_pre_rate_and_stops_without_contract():
    # Meeting 1 (Oct 28 -> Nov contract 3.75), meeting 2 (Dec 9) priced flat vs 3.75.
    avg_dec = 9 / 31 * 3.75 + 22 / 31 * 3.75
    curve = {(2026, 11): 3.75, (2026, 12): avg_dec}
    out = meeting_probabilities(
        [date(2026, 10, 28), date(2026, 12, 9), date(2027, 1, 27)], curve, 4.0
    )
    assert [o["cut25_pct"] for o in out] == [100, 0]  # third meeting has no Jan/Feb contract
    assert out[1]["hold_pct"] == 100


CAL_HTML = """
<div class="panel"><div class="panel-heading"><h4><a id="1">2027 FOMC Meetings</a></h4></div>
<div class="row fomc-meeting"><div class="fomc-meeting__month col"><strong>January</strong></div>
<div class="fomc-meeting__date col">26-27</div></div>
<div class="row fomc-meeting"><div class="fomc-meeting__month col"><strong>March</strong></div>
<div class="fomc-meeting__date col">16-17*</div></div>
<div class="row fomc-meeting"><div class="fomc-meeting__month col"><strong>Oct/Nov</strong></div>
<div class="fomc-meeting__date col">31-1</div></div></div>
"""


def test_parse_calendar_dates_and_sep_flag():
    ms = parse_fomc_calendar(CAL_HTML)
    assert [(m.start, m.decision, m.sep) for m in ms] == [
        (date(2027, 1, 26), date(2027, 1, 27), False),
        (date(2027, 3, 16), date(2027, 3, 17), True),
        (date(2027, 10, 31), date(2027, 11, 1), False),
    ]


def test_rate_path_market_not_faked():
    sep = {
        "median": {2026: 4.1, 2027: 3.9},
        "ct_low": {2026: 4.0},
        "ct_high": {2026: 4.3},
        "range_low": {2026: 3.8},
        "range_high": {2026: 4.5},
    }
    p = assemble_rate_path(
        sep=sep,
        longer_run=3.0,
        current_mid=3.9,
        market_now=3.95,
        market_year_end={2026: 4.05},
        this_year=2026,
    )
    assert list(p) == ["now", "y0", "y1", "lt"]  # no y2: no SEP median for 2028 in this fixture
    assert p["y0"]["market"] == 4.05 and p["y0"]["ct_high"] == 4.3
    assert p["y1"]["market"] is None  # curve does not reach Dec 27: never filled with Fed median
    assert p["now"]["fed_median"] == 3.9 and p["lt"]["market"] is None
    assert p["y0"]["label"] == "Dec 26"
