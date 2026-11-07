"""build_feature_rows must equal the per-query reference and use a handful of queries."""

from __future__ import annotations

import random
import time
from datetime import date, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base
from app.models.fed_policy import FedRate
from app.models.indicator import (
    Frequency,
    Importance,
    Indicator,
    IndicatorType,
    IndicatorValue,
)
from app.models.market_data import MarketData, YieldData
from app.services.forecast_lab import features_pit

pytest.importorskip("aiosqlite")

_TABLES = [
    Indicator.__table__,
    IndicatorValue.__table__,
    FedRate.__table__,
    YieldData.__table__,
    MarketData.__table__,
]


def _month_ends(start: date, n: int) -> list[date]:
    out = []
    y, m = start.year, start.month
    for _ in range(n):
        nxt = date(y + (m == 12), 1 if m == 12 else m + 1, 1)
        out.append(nxt - timedelta(days=1))
        y, m = nxt.year, nxt.month
    return out


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=_TABLES))
    maker = async_sessionmaker(engine, expire_on_commit=False)
    rnd = random.Random(7)
    async with maker() as db:
        cats = list(features_pit.CATEGORY_WEIGHTS)
        for i in range(12):
            db.add(
                Indicator(
                    id=i + 1,
                    name="Unemployment Rate" if i == 0 else f"Ind {i}",
                    fred_series_id=f"S{i}",
                    category=cats[i % len(cats)],
                    importance=[Importance.HIGH, Importance.MEDIUM, Importance.LOW][i % 3],
                    indicator_type=IndicatorType.LEADING,
                    frequency=Frequency.MONTHLY,
                    source="test",
                )
            )
        months = _month_ends(date(2008, 1, 1), 220)
        for i in range(12):
            v = 100.0
            for d in months:
                v += rnd.uniform(-2, 2.2)
                db.add(IndicatorValue(indicator_id=i + 1, date=d, value=v))
        rate = 2.0
        for k, d in enumerate(months):
            if k % 3 == 0:
                rate = max(0.25, rate + rnd.choice([-0.25, 0.0, 0.25]))
                db.add(FedRate(date=d, target_upper=rate + 0.25, target_lower=rate))
        d = date(2008, 1, 2)
        y2, y10 = 3.0, 4.0
        while d <= date(2026, 4, 30):
            y2 = max(0.1, y2 + rnd.uniform(-0.05, 0.05))
            y10 = max(0.5, y10 + rnd.uniform(-0.05, 0.05))
            db.add(YieldData(date=d, maturity="2Y", nominal_yield=y2))
            db.add(YieldData(date=d, maturity="10Y", nominal_yield=y10))
            d += timedelta(days=7)
        for k, d in enumerate(months):
            if k > 60:  # HY series starts later: early dates fall back to 0.0
                db.add(MarketData(date=d, symbol="HY_OAS", value=3.0 + rnd.random()))
        await db.commit()
    async with maker() as db:
        yield db
    await engine.dispose()


def _same(a: features_pit.FeatureRow, b: features_pit.FeatureRow) -> None:
    assert a.as_of_date == b.as_of_date
    assert a.growth_score == pytest.approx(b.growth_score)
    assert a.fed_policy_score == pytest.approx(b.fed_policy_score)
    assert a.yield_10y_minus_2y == pytest.approx(b.yield_10y_minus_2y)
    assert a.hy_spread_proxy == pytest.approx(b.hy_spread_proxy)
    assert a.curve_pattern == b.curve_pattern
    assert a.availability == b.availability


@pytest.mark.asyncio
async def test_bulk_matches_per_query_reference(session: AsyncSession):
    dates = [
        date(2007, 12, 31),  # before any data
        date(2009, 3, 31),
        date(2013, 6, 30),
        date(2016, 11, 30),  # before HY starts
        date(2020, 3, 31),
        date(2025, 12, 31),
    ]
    bulk = await features_pit.build_feature_rows(session, dates)
    for d, row in zip(dates, bulk, strict=True):
        _same(row, await features_pit.build_feature_row_per_query(session, d))


@pytest.mark.asyncio
async def test_bulk_uses_few_queries_and_stays_fast(session: AsyncSession):
    statements: list[str] = []

    def _count(conn, cursor, statement, *a):
        statements.append(statement)

    sync_engine = session.bind.sync_engine  # type: ignore[union-attr]
    event.listen(sync_engine, "before_cursor_execute", _count)
    try:
        dates = _month_ends(date(2022, 1, 1), 40)
        t0 = time.perf_counter()
        rows = await features_pit.build_feature_rows(session, dates)
        elapsed = time.perf_counter() - t0
    finally:
        event.remove(sync_engine, "before_cursor_execute", _count)
    assert len(rows) == 40
    assert len(statements) <= 6, statements
    assert elapsed < 2.0


@pytest.mark.asyncio
async def test_macro_frame_bulk_matches_per_query_helpers(session: AsyncSession):
    from app.services.forecast_lab import macro_data

    defs = [
        {"id": "HY_OAS", "source": "market"},
        {"id": "S3", "source": "indicator_fred_id"},
        {"id": "MISSING", "source": "market"},
    ]
    statements: list[str] = []

    def _count(conn, cursor, statement, *a):
        statements.append(statement)

    sync_engine = session.bind.sync_engine  # type: ignore[union-attr]
    event.listen(sync_engine, "before_cursor_execute", _count)
    try:
        df = await macro_data.build_macro_frame(session, date(2021, 1, 1), date(2025, 12, 31), defs)
    finally:
        event.remove(sync_engine, "before_cursor_execute", _count)
    assert len(df) == 60
    assert len(statements) <= 12, len(statements)

    for _, r in df.iloc[::9].iterrows():
        d = r["date"]
        ref = await features_pit.build_feature_row_per_query(session, d)
        assert r["growth_score"] == pytest.approx(ref.growth_score)
        assert r["fed_policy_score"] == pytest.approx(ref.fed_policy_score)
        for sid, helper in (
            ("HY_OAS", macro_data._market_month_last),
            ("S3", macro_data._indicator_month_last_by_fred),
            ("MISSING", macro_data._market_month_last),
        ):
            expected = await helper(session, sid, d)
            got = r[sid]
            if expected is None:
                assert got is None or got != got  # NaN in the frame
            else:
                assert got == pytest.approx(expected)
