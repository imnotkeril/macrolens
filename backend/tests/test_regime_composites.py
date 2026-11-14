import numpy as np
import pandas as pd
import pytest

from app.services.regime_composites import (
    ComponentSpec,
    build_regime_composites,
    compute_lei_proxy,
    mfg_status,
    monthly_mean,
    regional_average,
    symmetric_pct_change,
)


def _m(values, start="2020-01-01"):
    return pd.Series(
        values, index=pd.date_range(start, periods=len(values), freq="MS"), dtype=float
    )


def test_symmetric_pct_change_hand_computed():
    out = symmetric_pct_change(_m([100, 110]))
    assert out.iloc[1] == pytest.approx(200 * 10 / 210)


def test_monthly_mean_resamples_daily_and_weekly():
    daily = pd.Series(
        [1.0, 3.0, 5.0], index=pd.to_datetime(["2020-01-02", "2020-01-30", "2020-02-03"])
    )
    m = monthly_mean(daily)
    assert list(m.index) == [pd.Timestamp("2020-01-01"), pd.Timestamp("2020-02-01")]
    assert list(m.values) == [2.0, 5.0]


def test_regional_average_uses_available_series():
    a = _m([10, 20, np.nan])
    b = _m([30, np.nan, 50])
    avg = regional_average(a, b)
    assert list(avg.values) == [20.0, 20.0, 50.0]


def test_mfg_status_bands():
    assert mfg_status(-5) == "red"
    assert mfg_status(1.5) == "yellow"
    assert mfg_status(8) == "green"


def test_lei_proxy_without_usable_components_is_empty():
    assert compute_lei_proxy({}).empty
    flat = {"a": ComponentSpec(_m([5.0] * 6), "diff", 1)}  # zero variance -> skipped
    assert compute_lei_proxy(flat, min_components=1).empty


def test_lei_proxy_single_component_hand_computed():
    x = _m([0, 1, 0, 1, 0])  # diffs 1,-1,1,-1 -> std (ddof=1) = sqrt(4/3)
    idx = compute_lei_proxy({"a": ComponentSpec(x, "diff", 1)}, min_components=1)
    z = 1 / np.sqrt(4 / 3)
    assert idx.iloc[0] == pytest.approx(100.0)
    assert idx.iloc[1] == pytest.approx(100 * (200 + z) / (200 - z))
    assert idx.iloc[2] == pytest.approx(idx.iloc[1] * (200 - z) / (200 + z))  # back to 100
    assert idx.iloc[2] == pytest.approx(100.0)


def test_lei_proxy_sign_flips_direction():
    x = _m([1, 3, 4, 7, 8, 12])  # rising, non-constant steps
    up = compute_lei_proxy({"a": ComponentSpec(x, "diff", 1)}, min_components=1)
    down = compute_lei_proxy({"a": ComponentSpec(x, "diff", -1)}, min_components=1)
    assert up.iloc[-1] > 100 > down.iloc[-1]


def test_lei_proxy_requires_min_components():
    comps = {
        "a": ComponentSpec(_m([1, 3, 2, 5]), "diff", 1),  # changes Feb..Apr: 2, -1, 3
        "b": ComponentSpec(_m([1, 2, 4, np.nan]), "diff", 1),  # changes Feb, Mar: 1, 2
    }
    idx = compute_lei_proxy(comps, min_components=2)
    # April has only one component -> dropped; base point is the month before the first change
    assert list(idx.index) == [
        pd.Timestamp("2020-01-01"),
        pd.Timestamp("2020-02-01"),
        pd.Timestamp("2020-03-01"),
    ]


def test_build_regime_composites_outputs_expected_symbols():
    n = 40
    rng = np.random.default_rng(0)
    idx = pd.date_range("2018-01-01", periods=n, freq="MS")
    raw = {
        "PHILLY_MFG": pd.Series(rng.normal(5, 5, n), index=idx),
        "EMPIRE_MFG": pd.Series(rng.normal(3, 6, n), index=idx),
        "PHILLY_NO": pd.Series(rng.normal(2, 5, n), index=idx),
        "EMPIRE_NO": pd.Series(rng.normal(1, 6, n), index=idx),
        "T10Y3M": pd.Series(
            rng.normal(1, 0.5, n * 21), index=pd.bdate_range("2018-01-01", periods=n * 21)
        ),
        "ICSA": pd.Series(
            rng.normal(250000, 10000, n * 4),
            index=pd.date_range("2018-01-06", periods=n * 4, freq="7D"),
        ),
        "PERMIT": pd.Series(rng.normal(1300, 50, n), index=idx),
        "UMCSENT": pd.Series(rng.normal(90, 5, n), index=idx),
        "HY_SPREAD": pd.Series(
            rng.normal(4, 0.5, n * 21), index=pd.bdate_range("2018-01-01", periods=n * 21)
        ),
        "SP500": pd.Series(
            np.linspace(2500, 3500, n * 21), index=pd.bdate_range("2018-01-01", periods=n * 21)
        ),
    }
    out = build_regime_composites(raw)
    assert set(out) == {"MFG_SURVEY", "MFG_NEW_ORDERS", "LEI_PROXY"}
    assert out["MFG_SURVEY"].iloc[3] == pytest.approx(
        (raw["PHILLY_MFG"].iloc[3] + raw["EMPIRE_MFG"].iloc[3]) / 2
    )
    assert out["LEI_PROXY"].notna().all() and len(out["LEI_PROXY"]) > 20


def test_build_regime_composites_survives_missing_inputs():
    out = build_regime_composites(
        {"T10Y3M": pd.Series([1.0, 2.0], index=pd.to_datetime(["2020-01-01", "2020-02-01"]))}
    )
    assert "LEI_PROXY" not in out or out["LEI_PROXY"].empty
    assert "MFG_SURVEY" not in out
