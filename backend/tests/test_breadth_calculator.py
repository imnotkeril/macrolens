import numpy as np
import pandas as pd
import pytest

from app.services.breadth_calculator import compute_breadth, rebase_summation


def _frame(n: int, **cols: list[float]) -> pd.DataFrame:
    idx = pd.bdate_range("2024-01-01", periods=n)
    return pd.DataFrame({k: v for k, v in cols.items()}, index=idx)


def test_pct_above_ma_hand_computed():
    n = 260
    up = list(np.linspace(100, 200, n))  # rising: always above its MAs
    down = list(np.linspace(200, 100, n))  # falling: always below
    up2 = list(np.linspace(50, 150, n))
    close = _frame(n, A=up, B=down, C=up2)
    out = compute_breadth(close)
    # 2 of 3 above on every date where the window is full
    assert out["MMTW"].iloc[-1] == pytest.approx(200 / 3)
    assert out["MMFI"].iloc[-1] == pytest.approx(200 / 3)
    assert out["MMTH"].iloc[-1] == pytest.approx(200 / 3)
    # MMTH needs 200 observations: first valid value is the 200th row
    assert out["MMTH"].index[0] == close.index[199]


def test_new_highs_and_lows_use_full_252_window():
    n = 260
    close = _frame(
        n,
        A=list(np.linspace(100, 200, n)),  # new high every day
        B=list(np.linspace(200, 100, n)),  # new low every day
        C=[100.0 + (i % 2) for i in range(n)],  # flat zigzag: ties max/min only at times
    )
    out = compute_breadth(close)
    assert out["NYHGH"].index[0] == close.index[251]
    last = close.index[-1]
    # A is at its high; C alternates 100/101, last i=259 -> 101 == rolling max -> also a high
    assert out["NYHGH"][last] == 2
    # B is at its low; C is at 101 (not its min of 100)
    assert out["NYLOW"][last] == 1


def test_mcclellan_from_advance_decline():
    n = 80
    # 3 tickers: A always up, B always up, C always down -> adv=2, dec=1 each day
    close = _frame(
        n,
        A=list(np.linspace(10, 20, n)),
        B=list(np.linspace(10, 20, n)),
        C=list(np.linspace(20, 10, n)),
    )
    out = compute_breadth(close)
    rana = (2 - 1) / 3 * 1000  # constant ratio-adjusted net advances
    # constant input -> both EMAs converge to it -> oscillator -> 0
    assert out["NYMO"].iloc[-1] == pytest.approx(0, abs=1.0)
    assert out["NYSI"].iloc[-1] == pytest.approx(out["NYMO"].sum())
    assert rana == pytest.approx(333.333, rel=1e-3)


def test_total_volume_is_sum_across_tickers():
    n = 30
    close = _frame(n, A=[1.0] * n, B=[2.0] * n)
    volume = _frame(n, A=[100.0] * n, B=[50.0] * n)
    out = compute_breadth(close, volume)
    assert (out["TVOL.US"] == 150.0).all()


def test_sparse_dates_are_dropped():
    n = 30
    cols = {f"T{i}": [1.0 + i] * n for i in range(10)}
    close = _frame(n, **cols)
    close.iloc[5, 2:] = np.nan  # only 2 of 10 tickers priced on this date
    out = compute_breadth(close)
    assert close.index[5] not in out["MMTW"].index


def test_empty_input():
    assert compute_breadth(pd.DataFrame()) == {}


def test_rebase_summation_continues_from_anchor():
    nymo = pd.Series([1.0, -2.0, 4.0], index=pd.bdate_range("2024-01-01", periods=3))
    assert list(rebase_summation(nymo, 100.0)) == [101.0, 99.0, 103.0]
