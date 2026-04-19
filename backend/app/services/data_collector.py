import logging
from datetime import date, timedelta

import pandas as pd
from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.database import async_session
from app.models.indicator import Indicator, IndicatorValue
from app.models.fed_policy import FedRate, BalanceSheet
from app.models.market_data import YieldData, MarketData
from app.models.factor import FactorReturn, SectorPerformance
from app.config import get_settings
from app.services.fred_client import (
    FredClient, INDICATOR_SERIES, YIELD_SERIES, TIPS_SERIES, BREAKEVEN_SERIES,
)
from app.services.yahoo_client import YahooClient

logger = logging.getLogger(__name__)


class DataCollector:
    """Collects data from FRED and Yahoo Finance, persists to database."""

    def __init__(self, historical_years: int | None = None):
        years = (
            int(historical_years)
            if historical_years is not None
            else get_settings().historical_years
        )
        self.fred = FredClient(historical_years=years)
        self.yahoo = YahooClient(historical_years=years)

    # ------------------------------------------------------------------
    # Indicator data
    # ------------------------------------------------------------------

    async def collect_monthly_indicators(self):
        """Fetch latest values for all monthly indicators."""
        if not self.fred.is_configured:
            logger.warning("FRED not configured, skipping monthly collection")
            return

        async with async_session() as db:
            result = await db.execute(
                select(Indicator).where(Indicator.frequency.in_(["monthly", "quarterly"]))
            )
            indicators = result.scalars().all()

            for ind in indicators:
                await self._collect_indicator(db, ind)

            await db.commit()
        logger.info("Monthly indicator collection complete")

    async def collect_weekly_indicators(self):
        """Fetch latest values for weekly indicators (Claims, MBA)."""
        if not self.fred.is_configured:
            return

        async with async_session() as db:
            result = await db.execute(
                select(Indicator).where(Indicator.frequency == "weekly")
            )
            indicators = result.scalars().all()

            for ind in indicators:
                await self._collect_indicator(db, ind)

            await db.commit()
        logger.info("Weekly indicator collection complete")

    async def _collect_indicator(self, db, indicator: Indicator):
        try:
            # Request ~14 months so we never miss a month between Refresh runs
            recent_start = (date.today() - timedelta(days=430)).isoformat()
            series = self.fred.get_series(indicator.fred_series_id, start=recent_start)
            if series.empty:
                return

            for ts, value in series.items():
                obs_date = ts.date() if hasattr(ts, "date") else ts
                prev_val = None
                idx = series.index.get_loc(ts)
                if idx > 0:
                    prev_val = float(series.iloc[idx - 1])

                stmt = pg_insert(IndicatorValue).values(
                    indicator_id=indicator.id,
                    date=obs_date,
                    value=float(value),
                    previous=prev_val,
                ).on_conflict_do_update(
                    constraint="uq_indicator_date",
                    set_={"value": float(value), "previous": prev_val},
                )
                await db.execute(stmt)

        except Exception:
            logger.exception("Error collecting indicator %s", indicator.name)

    # ------------------------------------------------------------------
    # Initial historical load
    # ------------------------------------------------------------------

    async def needs_historical_load(self) -> bool:
        """True if DB has too little regime/yield/fed data for ML dataset (need at least 24 months)."""
        async with async_session() as db:
            regime_count = (
                await db.execute(
                    select(func.count(MarketData.date)).where(MarketData.symbol == "ISM_NEW_ORDERS")
                )
            ).scalar() or 0
            if regime_count < 24:
                logger.info("Historical load needed: regime data points=%s", regime_count)
                return True
            yield_count = (await db.execute(select(func.count(YieldData.date)))).scalar() or 0
            if yield_count < 24:
                logger.info("Historical load needed: yield data points=%s", yield_count)
                return True
            fed_count = (await db.execute(select(func.count(FedRate.date)))).scalar() or 0
            if fed_count < 24:
                logger.info("Historical load needed: Fed data points=%s", fed_count)
                return True
        return False

    async def need_indicators_historical(self) -> bool:
        """True if indicator_values have too little history (< ~1 year across all indicators)."""
        async with async_session() as db:
            total = (
                await db.execute(select(func.count(IndicatorValue.id)))
            ).scalar() or 0
            # ~12 months * 30 indicators = 360; if less, backfill
            if total < 360:
                logger.info(
                    "Indicators historical load needed: value count=%s",
                    total,
                )
                return True
        return False

    async def load_historical_indicators_only(self):
        """Backfill full history for all indicators (no fed/yield/market)."""
        if not self.fred.is_configured:
            logger.error("FRED API key not configured — cannot load indicator history")
            return
        async with async_session() as db:
            result = await db.execute(select(Indicator))
            indicators = result.scalars().all()
            for ind in indicators:
                logger.info("Loading history for %s (%s)", ind.name, ind.fred_series_id)
                try:
                    series = self.fred.get_series(ind.fred_series_id)
                    if series.empty:
                        continue
                    await self._bulk_insert_values(db, ind.id, series)
                except Exception:
                    logger.exception("Failed to load history for %s", ind.name)
            await db.commit()
        logger.info("Indicator historical backfill complete")

    async def load_historical_data(self):
        """One-time bulk load of historical data for all indicators."""
        if not self.fred.is_configured:
            logger.error("FRED API key not configured — cannot load historical data")
            return

        async with async_session() as db:
            result = await db.execute(select(Indicator))
            indicators = result.scalars().all()

            for ind in indicators:
                logger.info("Loading history for %s (%s)", ind.name, ind.fred_series_id)
                try:
                    series = self.fred.get_series(ind.fred_series_id)
                    if series.empty:
                        continue
                    await self._bulk_insert_values(db, ind.id, series)
                except Exception:
                    logger.exception("Failed to load history for %s", ind.name)

            await db.commit()

        await self._load_historical_fed_data()
        await self._load_historical_balance_sheet()
        await self._load_historical_yield_data()
        await self._load_historical_market_data()
        await self._load_historical_fx_data()
        await self._load_historical_sector_data()
        await self._load_historical_factor_data()
        await self._load_historical_index_data()
        await self._load_historical_extra_market_data()
        await self._load_historical_breadth_data()
        await self._load_historical_macro_etf_data()
        await self._load_historical_macro_fred_data()
        await self._load_historical_regime_data()
        logger.info("Historical data load complete")

    async def _bulk_insert_values(self, db, indicator_id: int, series: pd.Series):
        for i, (ts, value) in enumerate(series.items()):
            obs_date = ts.date() if hasattr(ts, "date") else ts
            prev_val = float(series.iloc[i - 1]) if i > 0 else None
            stmt = pg_insert(IndicatorValue).values(
                indicator_id=indicator_id,
                date=obs_date,
                value=float(value),
                previous=prev_val,
            ).on_conflict_do_nothing(constraint="uq_indicator_date")
            await db.execute(stmt)

    # ------------------------------------------------------------------
    # Fed data
    # ------------------------------------------------------------------

    async def collect_fed_data(self):
        if not self.fred.is_configured:
            return

        async with async_session() as db:
            rates = self.fred.get_fed_rates(start=(date.today() - timedelta(days=90)).isoformat())
            upper = rates.get("fed_funds_upper", pd.Series(dtype=float))
            lower = rates.get("fed_funds_lower", pd.Series(dtype=float))
            effr = rates.get("effr", pd.Series(dtype=float))

            all_dates = sorted(set(
                [d.date() for d in upper.index] +
                [d.date() for d in lower.index] +
                [d.date() for d in effr.index]
            ))

            for d in all_dates:
                ts = pd.Timestamp(d)
                stmt = pg_insert(FedRate).values(
                    date=d,
                    target_upper=float(upper.get(ts, 0)) if ts in upper.index else 0,
                    target_lower=float(lower.get(ts, 0)) if ts in lower.index else 0,
                    effr=float(effr.get(ts)) if ts in effr.index else None,
                ).on_conflict_do_update(
                    constraint="fed_rates_date_key",
                    set_={"target_upper": float(upper.get(ts, 0)) if ts in upper.index else 0},
                )
                await db.execute(stmt)
            await db.commit()
        logger.info("Fed rate collection complete")

    async def _load_historical_fed_data(self):
        async with async_session() as db:
            rates = self.fred.get_fed_rates()
            upper = rates.get("fed_funds_upper", pd.Series(dtype=float))
            lower = rates.get("fed_funds_lower", pd.Series(dtype=float))
            effr = rates.get("effr", pd.Series(dtype=float))

            all_dates = sorted(set(
                [d.date() for d in upper.index] +
                [d.date() for d in lower.index] +
                [d.date() for d in effr.index]
            ))

            for d in all_dates:
                ts = pd.Timestamp(d)
                stmt = pg_insert(FedRate).values(
                    date=d,
                    target_upper=float(upper.get(ts, 0)) if ts in upper.index else 0,
                    target_lower=float(lower.get(ts, 0)) if ts in lower.index else 0,
                    effr=float(effr.get(ts)) if ts in effr.index else None,
                ).on_conflict_do_nothing(constraint="fed_rates_date_key")
                await db.execute(stmt)
            await db.commit()
        logger.info("Historical Fed rate data loaded")

    async def _load_historical_balance_sheet(self):
        if not self.fred.is_configured:
            return
        async with async_session() as db:
            bs_data = self.fred.get_balance_sheet()
            total = bs_data.get("balance_total", pd.Series(dtype=float))
            treasuries = bs_data.get("balance_treasuries", pd.Series(dtype=float))
            mbs = bs_data.get("balance_mbs", pd.Series(dtype=float))
            reserves = bs_data.get("balance_reserves", pd.Series(dtype=float))
            for ts, val in total.items():
                d = ts.date() if hasattr(ts, "date") else ts
                stmt = pg_insert(BalanceSheet).values(
                    date=d,
                    total_assets=float(val),
                    treasuries=float(treasuries.get(ts)) if ts in treasuries.index else None,
                    mbs=float(mbs.get(ts)) if ts in mbs.index else None,
                    reserves=float(reserves.get(ts)) if ts in reserves.index else None,
                ).on_conflict_do_nothing(constraint="balance_sheet_date_key")
                await db.execute(stmt)
            await db.commit()
        logger.info("Historical balance sheet data loaded")

    async def collect_balance_sheet(self):
        if not self.fred.is_configured:
            return

        async with async_session() as db:
            bs_data = self.fred.get_balance_sheet(start=(date.today() - timedelta(days=90)).isoformat())
            total = bs_data.get("balance_total", pd.Series(dtype=float))
            treasuries = bs_data.get("balance_treasuries", pd.Series(dtype=float))
            mbs = bs_data.get("balance_mbs", pd.Series(dtype=float))
            reserves = bs_data.get("balance_reserves", pd.Series(dtype=float))

            for ts, val in total.items():
                d = ts.date() if hasattr(ts, "date") else ts
                stmt = pg_insert(BalanceSheet).values(
                    date=d,
                    total_assets=float(val),
                    treasuries=float(treasuries.get(ts)) if ts in treasuries.index else None,
                    mbs=float(mbs.get(ts)) if ts in mbs.index else None,
                    reserves=float(reserves.get(ts)) if ts in reserves.index else None,
                ).on_conflict_do_update(
                    constraint="balance_sheet_date_key",
                    set_={"total_assets": float(val)},
                )
                await db.execute(stmt)
            await db.commit()
        logger.info("Balance sheet collection complete")

    # ------------------------------------------------------------------
    # Yield curve data
    # ------------------------------------------------------------------

    async def collect_yield_data(self):
        if not self.fred.is_configured:
            return

        async with async_session() as db:
            start = (date.today() - timedelta(days=14)).isoformat()
            nominal = self.fred.get_yield_curve_data(start=start)
            tips = self.fred.get_tips_data(start=start)
            breakevens = self.fred.get_breakeven_data(start=start)

            for maturity, series in nominal.items():
                tips_series = tips.get(maturity, pd.Series(dtype=float))
                be_series = breakevens.get(maturity, pd.Series(dtype=float))

                for ts, val in series.items():
                    d = ts.date() if hasattr(ts, "date") else ts
                    stmt = pg_insert(YieldData).values(
                        date=d,
                        maturity=maturity,
                        nominal_yield=float(val),
                        tips_yield=float(tips_series.get(ts)) if ts in tips_series.index else None,
                        breakeven=float(be_series.get(ts)) if ts in be_series.index else None,
                    ).on_conflict_do_update(
                        constraint="uq_yield_date_maturity",
                        set_={"nominal_yield": float(val)},
                    )
                    await db.execute(stmt)
            await db.commit()
        logger.info("Yield data collection complete")

    async def _load_historical_yield_data(self):
        async with async_session() as db:
            nominal = self.fred.get_yield_curve_data()
            tips = self.fred.get_tips_data()
            breakevens = self.fred.get_breakeven_data()

            for maturity, series in nominal.items():
                tips_series = tips.get(maturity, pd.Series(dtype=float))
                be_series = breakevens.get(maturity, pd.Series(dtype=float))

                for ts, val in series.items():
                    d = ts.date() if hasattr(ts, "date") else ts
                    stmt = pg_insert(YieldData).values(
                        date=d,
                        maturity=maturity,
                        nominal_yield=float(val),
                        tips_yield=float(tips_series.get(ts)) if ts in tips_series.index else None,
                        breakeven=float(be_series.get(ts)) if ts in be_series.index else None,
                    ).on_conflict_do_nothing(constraint="uq_yield_date_maturity")
                    await db.execute(stmt)
            await db.commit()
        logger.info("Historical yield data loaded")

    # ------------------------------------------------------------------
    # Market / cross-asset data
    # ------------------------------------------------------------------

    async def collect_regime_data(self):
        """Fetch latest regime/cycle series into market_data table."""
        if not self.fred.is_configured:
            return

        async with async_session() as db:
            start = (date.today() - timedelta(days=120)).isoformat()
            regime = self.fred.get_regime_data(start=start)
            for symbol, series in regime.items():
                for i, (ts, val) in enumerate(series.items()):
                    d = ts.date() if hasattr(ts, "date") else ts
                    change = None
                    if i > 0:
                        prev = float(series.iloc[i - 1])
                        change = ((float(val) - prev) / prev) * 100 if prev != 0 else None
                    stmt = pg_insert(MarketData).values(
                        date=d, symbol=symbol, value=float(val), change_pct=change,
                    ).on_conflict_do_update(
                        constraint="uq_market_date_symbol",
                        set_={"value": float(val), "change_pct": change},
                    )
                    await db.execute(stmt)
            await db.commit()
        logger.info("Regime data collection complete")

    async def collect_daily_market_data(self):
        if not self.fred.is_configured:
            return

        async with async_session() as db:
            start = (date.today() - timedelta(days=14)).isoformat()
            market = self.fred.get_market_data(start=start)
            fx = self.fred.get_fx_data(start=start)
            market.update(fx)

            for symbol, series in market.items():
                for i, (ts, val) in enumerate(series.items()):
                    d = ts.date() if hasattr(ts, "date") else ts
                    change = None
                    if i > 0:
                        prev = float(series.iloc[i - 1])
                        change = ((float(val) - prev) / prev) * 100 if prev != 0 else None

                    stmt = pg_insert(MarketData).values(
                        date=d, symbol=symbol, value=float(val), change_pct=change,
                    ).on_conflict_do_update(
                        constraint="uq_market_date_symbol",
                        set_={"value": float(val), "change_pct": change},
                    )
                    await db.execute(stmt)

            # Yahoo sector & factor daily refresh
            yahoo_start = (date.today() - timedelta(days=14)).isoformat()
            sectors = self.yahoo.get_sector_data(start=yahoo_start)
            for symbol, series in sectors.items():
                for i, (ts, val) in enumerate(series.items()):
                    d = ts.date() if hasattr(ts, "date") else ts
                    daily_ret = None
                    if i > 0:
                        prev = float(series.iloc[i - 1])
                        daily_ret = ((float(val) - prev) / prev) * 100 if prev != 0 else None
                    stmt = pg_insert(SectorPerformance).values(
                        date=d, sector=symbol, value=float(val), daily_return=daily_ret,
                    ).on_conflict_do_update(
                        constraint="uq_sector_date",
                        set_={"value": float(val), "daily_return": daily_ret},
                    )
                    await db.execute(stmt)

            factors = self.yahoo.get_factor_data(start=yahoo_start)
            for symbol, series in factors.items():
                for i, (ts, val) in enumerate(series.items()):
                    d = ts.date() if hasattr(ts, "date") else ts
                    daily_ret = None
                    if i > 0:
                        prev = float(series.iloc[i - 1])
                        daily_ret = ((float(val) - prev) / prev) * 100 if prev != 0 else None
                    stmt = pg_insert(FactorReturn).values(
                        date=d, factor_name=symbol, value=float(val), daily_return=daily_ret,
                    ).on_conflict_do_update(
                        constraint="uq_factor_date_name",
                        set_={"value": float(val), "daily_return": daily_ret},
                    )
                    await db.execute(stmt)

            # Breadth indicators (MMTW, MMFI, MMTH, PCC, NYHGH, NYLOW)
            breadth = self.yahoo.get_breadth_data(start=yahoo_start)
            for symbol, series in breadth.items():
                for i, (ts, val) in enumerate(series.items()):
                    d = ts.date() if hasattr(ts, "date") else ts
                    change = None
                    if i > 0:
                        prev = float(series.iloc[i - 1])
                        change = ((float(val) - prev) / prev) * 100 if prev != 0 else None
                    stmt = pg_insert(MarketData).values(
                        date=d, symbol=symbol, value=float(val), change_pct=change,
                    ).on_conflict_do_update(
                        constraint="uq_market_date_symbol",
                        set_={"value": float(val), "change_pct": change},
                    )
                    await db.execute(stmt)

            # Macro ETFs (TIP, IEF, IVV, IJR, VEA, IPO, Lumber, ZQ)
            macro_etfs = self.yahoo.get_macro_etf_data(start=yahoo_start)
            for symbol, series in macro_etfs.items():
                for i, (ts, val) in enumerate(series.items()):
                    d = ts.date() if hasattr(ts, "date") else ts
                    change = None
                    if i > 0:
                        prev = float(series.iloc[i - 1])
                        change = ((float(val) - prev) / prev) * 100 if prev != 0 else None
                    stmt = pg_insert(MarketData).values(
                        date=d, symbol=symbol, value=float(val), change_pct=change,
                    ).on_conflict_do_update(
                        constraint="uq_market_date_symbol",
                        set_={"value": float(val), "change_pct": change},
                    )
                    await db.execute(stmt)

            # FRED macro overview series (CNLEI, ECBBS)
            if self.fred.is_configured:
                macro_fred = self.fred.get_macro_overview_data(
                    start=(date.today() - timedelta(days=120)).isoformat()
                )
                for symbol, series in macro_fred.items():
                    for i, (ts, val) in enumerate(series.items()):
                        d = ts.date() if hasattr(ts, "date") else ts
                        change = None
                        if i > 0:
                            prev = float(series.iloc[i - 1])
                            if prev != 0:
                                change = ((float(val) - prev) / prev) * 100
                        stmt = pg_insert(MarketData).values(
                            date=d, symbol=symbol,
                            value=float(val), change_pct=change,
                        ).on_conflict_do_update(
                            constraint="uq_market_date_symbol",
                            set_={"value": float(val), "change_pct": change},
                        )
                        await db.execute(stmt)

            await db.commit()
        logger.info("Daily market data collection complete")

    async def _load_historical_market_data(self):
        async with async_session() as db:
            market = self.fred.get_market_data()
            yahoo_market = self.yahoo.get_market_data()
            market.update(yahoo_market)

            for symbol, series in market.items():
                for i, (ts, val) in enumerate(series.items()):
                    d = ts.date() if hasattr(ts, "date") else ts
                    change = None
                    if i > 0:
                        prev = float(series.iloc[i - 1])
                        change = ((float(val) - prev) / prev) * 100 if prev != 0 else None
                    stmt = pg_insert(MarketData).values(
                        date=d, symbol=symbol, value=float(val), change_pct=change,
                    ).on_conflict_do_nothing(constraint="uq_market_date_symbol")
                    await db.execute(stmt)
            await db.commit()
        logger.info("Historical market data loaded (FRED + Yahoo)")

    async def _load_historical_fx_data(self):
        async with async_session() as db:
            fx = self.fred.get_fx_data()
            for symbol, series in fx.items():
                for i, (ts, val) in enumerate(series.items()):
                    d = ts.date() if hasattr(ts, "date") else ts
                    change = None
                    if i > 0:
                        prev = float(series.iloc[i - 1])
                        change = ((float(val) - prev) / prev) * 100 if prev != 0 else None
                    stmt = pg_insert(MarketData).values(
                        date=d, symbol=symbol, value=float(val), change_pct=change,
                    ).on_conflict_do_nothing(constraint="uq_market_date_symbol")
                    await db.execute(stmt)
            await db.commit()
        logger.info("Historical FX data loaded")

    async def _load_historical_sector_data(self):
        async with async_session() as db:
            sectors = self.yahoo.get_sector_data()
            for symbol, series in sectors.items():
                for i, (ts, val) in enumerate(series.items()):
                    d = ts.date() if hasattr(ts, "date") else ts
                    daily_ret = None
                    if i > 0:
                        prev = float(series.iloc[i - 1])
                        daily_ret = ((float(val) - prev) / prev) * 100 if prev != 0 else None
                    stmt = pg_insert(SectorPerformance).values(
                        date=d, sector=symbol, value=float(val), daily_return=daily_ret,
                    ).on_conflict_do_nothing(constraint="uq_sector_date")
                    await db.execute(stmt)
            await db.commit()
        logger.info("Historical sector data loaded")

    async def _load_historical_factor_data(self):
        async with async_session() as db:
            factors = self.yahoo.get_factor_data()
            for symbol, series in factors.items():
                for i, (ts, val) in enumerate(series.items()):
                    d = ts.date() if hasattr(ts, "date") else ts
                    daily_ret = None
                    if i > 0:
                        prev = float(series.iloc[i - 1])
                        daily_ret = ((float(val) - prev) / prev) * 100 if prev != 0 else None
                    stmt = pg_insert(FactorReturn).values(
                        date=d, factor_name=symbol, value=float(val), daily_return=daily_ret,
                    ).on_conflict_do_nothing(constraint="uq_factor_date_name")
                    await db.execute(stmt)
            await db.commit()
        logger.info("Historical factor data loaded")

    async def _load_historical_index_data(self):
        async with async_session() as db:
            indices = self.yahoo.get_index_data()
            for symbol, series in indices.items():
                for i, (ts, val) in enumerate(series.items()):
                    d = ts.date() if hasattr(ts, "date") else ts
                    change = None
                    if i > 0:
                        prev = float(series.iloc[i - 1])
                        change = ((float(val) - prev) / prev) * 100 if prev != 0 else None
                    stmt = pg_insert(MarketData).values(
                        date=d, symbol=symbol, value=float(val), change_pct=change,
                    ).on_conflict_do_nothing(constraint="uq_market_date_symbol")
                    await db.execute(stmt)
            await db.commit()
        logger.info("Historical index data loaded")

    async def _load_historical_extra_market_data(self):
        async with async_session() as db:
            extra = self.yahoo.get_extra_data()
            for symbol, series in extra.items():
                for i, (ts, val) in enumerate(series.items()):
                    d = ts.date() if hasattr(ts, "date") else ts
                    change = None
                    if i > 0:
                        prev = float(series.iloc[i - 1])
                        change = ((float(val) - prev) / prev) * 100 if prev != 0 else None
                    stmt = pg_insert(MarketData).values(
                        date=d, symbol=symbol, value=float(val), change_pct=change,
                    ).on_conflict_do_nothing(constraint="uq_market_date_symbol")
                    await db.execute(stmt)
            await db.commit()
        logger.info("Historical extra market data loaded (MOVE)")

    async def _load_historical_breadth_data(self):
        async with async_session() as db:
            breadth = self.yahoo.get_breadth_data()
            for symbol, series in breadth.items():
                for i, (ts, val) in enumerate(series.items()):
                    d = ts.date() if hasattr(ts, "date") else ts
                    change = None
                    if i > 0:
                        prev = float(series.iloc[i - 1])
                        change = ((float(val) - prev) / prev) * 100 if prev != 0 else None
                    stmt = pg_insert(MarketData).values(
                        date=d, symbol=symbol, value=float(val), change_pct=change,
                    ).on_conflict_do_nothing(constraint="uq_market_date_symbol")
                    await db.execute(stmt)
            await db.commit()
        logger.info("Historical breadth data loaded (MMTW, MMFI, MMTH, PCC, NYHGH, NYLOW)")

    async def _load_historical_macro_etf_data(self):
        async with async_session() as db:
            macro_etfs = self.yahoo.get_macro_etf_data()
            for symbol, series in macro_etfs.items():
                for i, (ts, val) in enumerate(series.items()):
                    d = ts.date() if hasattr(ts, "date") else ts
                    change = None
                    if i > 0:
                        prev = float(series.iloc[i - 1])
                        change = ((float(val) - prev) / prev) * 100 if prev != 0 else None
                    stmt = pg_insert(MarketData).values(
                        date=d, symbol=symbol, value=float(val), change_pct=change,
                    ).on_conflict_do_nothing(constraint="uq_market_date_symbol")
                    await db.execute(stmt)
            await db.commit()
        logger.info("Historical macro ETF data loaded")

    async def _load_historical_macro_fred_data(self):
        if not self.fred.is_configured:
            return
        async with async_session() as db:
            macro = self.fred.get_macro_overview_data()
            for symbol, series in macro.items():
                for i, (ts, val) in enumerate(series.items()):
                    d = ts.date() if hasattr(ts, "date") else ts
                    change = None
                    if i > 0:
                        prev = float(series.iloc[i - 1])
                        change = ((float(val) - prev) / prev) * 100 if prev != 0 else None
                    stmt = pg_insert(MarketData).values(
                        date=d, symbol=symbol, value=float(val), change_pct=change,
                    ).on_conflict_do_nothing(constraint="uq_market_date_symbol")
                    await db.execute(stmt)
            await db.commit()
        logger.info("Historical macro FRED data loaded (CNLEI, ECBBS)")

    async def _load_historical_regime_data(self):
        async with async_session() as db:
            regime = self.fred.get_regime_data()
            for symbol, series in regime.items():
                for i, (ts, val) in enumerate(series.items()):
                    d = ts.date() if hasattr(ts, "date") else ts
                    change = None
                    if i > 0:
                        prev = float(series.iloc[i - 1])
                        change = ((float(val) - prev) / prev) * 100 if prev != 0 else None
                    stmt = pg_insert(MarketData).values(
                        date=d, symbol=symbol, value=float(val), change_pct=change,
                    ).on_conflict_do_nothing(constraint="uq_market_date_symbol")
                    await db.execute(stmt)
            await db.commit()
        logger.info("Historical regime data loaded")
