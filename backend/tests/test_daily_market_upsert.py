import asyncio

import pandas as pd

from app.services.data_collector import DataCollector


class _FakeDB:
    def __init__(self) -> None:
        self.rows: list[dict] = []

    async def execute(self, stmt):
        params = stmt.compile().params
        self.rows.append({k: params[k] for k in ("date", "symbol", "value", "change_pct")})


def test_upsert_market_series_writes_value_and_change():
    idx = pd.to_datetime(["2026-11-12", "2026-11-13"])
    series = {"GOLD": pd.Series([100.0, 110.0], index=idx)}
    db = _FakeDB()
    asyncio.run(DataCollector()._upsert_market_series(db, series))
    assert [r["symbol"] for r in db.rows] == ["GOLD", "GOLD"]
    assert db.rows[0]["change_pct"] is None
    assert db.rows[1]["value"] == 110.0
    assert abs(db.rows[1]["change_pct"] - 10.0) < 1e-9
    assert str(db.rows[1]["date"]) == "2026-11-13"
