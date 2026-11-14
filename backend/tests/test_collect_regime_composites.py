import asyncio

import numpy as np
import pandas as pd

from app.services import data_collector
from app.services.data_collector import REGIME_COMPOSITE_INPUTS, DataCollector


class _FakeFred:
    is_configured = True

    def __init__(self) -> None:
        self.requested: list[str] = []

    def get_series(self, series_id: str, start: str | None = None) -> pd.Series:
        self.requested.append(series_id)
        rng = np.random.default_rng(abs(hash(series_id)) % 1000)
        if series_id in ("T10Y3M", "BAMLH0A0HYM2", "SP500"):
            idx = pd.bdate_range("2012-01-02", "2020-12-31")
            return pd.Series(100 + rng.normal(0, 1, len(idx)).cumsum(), index=idx)
        if series_id == "ICSA":
            idx = pd.date_range("2012-01-07", "2020-12-26", freq="7D")
            return pd.Series(250000 + rng.normal(0, 8000, len(idx)), index=idx)
        idx = pd.date_range("2012-01-01", "2020-12-01", freq="MS")
        return pd.Series(50 + rng.normal(0, 5, len(idx)), index=idx)


class _FakeSession:
    def __init__(self, store: list) -> None:
        self.store = store

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def execute(self, stmt):
        p = stmt.compile().params
        self.store.append((p["symbol"], p["value"], p["source"]))

    async def commit(self):
        pass


def test_collect_regime_composites_fetches_inputs_and_stores_three_symbols(monkeypatch):
    rows: list = []
    monkeypatch.setattr(data_collector, "async_session", lambda: _FakeSession(rows))
    collector = DataCollector()
    collector.fred = _FakeFred()

    asyncio.run(collector.collect_regime_composites())

    assert set(collector.fred.requested) == set(REGIME_COMPOSITE_INPUTS.values())
    symbols = {r[0] for r in rows}
    assert symbols == {"MFG_SURVEY", "MFG_NEW_ORDERS", "LEI_PROXY"}
    assert all(r[2] == "macrolens_composite" for r in rows)
    assert all(np.isfinite(r[1]) for r in rows)
