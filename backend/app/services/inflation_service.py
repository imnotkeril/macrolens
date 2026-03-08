import logging
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.indicator import Indicator, IndicatorValue
from app.models.market_data import MarketData, YieldData

logger = logging.getLogger(__name__)

INFLATION_INDICATORS = {
    "CPI": "CPI",
    "Core CPI": "Core CPI",
    "PCE": "PCE",
    "Core PCE": "Core PCE",
    "PPI": "PPI",
    "Core PPI": "Core PPI",
}


class InflationService:
    """MoM/YoY transforms for inflation indicators."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_inflation_series(
        self, indicator_name: str, transform: str = "yoy", days: int = 365 * 5
    ) -> list[dict]:
        """Return transformed inflation series.

        transform: 'raw', 'mom' (month-over-month %), 'yoy' (year-over-year %)
        """
        # Exact match first, fallback to partial
        result = await self.db.execute(
            select(Indicator).where(Indicator.name == indicator_name)
        )
        indicator = result.scalar_one_or_none()
        if not indicator:
            result = await self.db.execute(
                select(Indicator)
                .where(Indicator.name.ilike(f"%{indicator_name}%"))
                .order_by(Indicator.name)
                .limit(1)
            )
            indicator = result.scalar_one_or_none()
        if not indicator:
            return []

        cutoff = date.today() - timedelta(days=days + 400)
        val_q = (
            select(IndicatorValue.date, IndicatorValue.value)
            .where(IndicatorValue.indicator_id == indicator.id, IndicatorValue.date >= cutoff)
            .order_by(IndicatorValue.date)
        )
        rows = (await self.db.execute(val_q)).all()
        if not rows:
            return []

        if transform == "raw":
            final_cutoff = date.today() - timedelta(days=days)
            return [
                {"date": r.date.isoformat(), "value": r.value}
                for r in rows if r.date >= final_cutoff
            ]

        values = [(r.date, r.value) for r in rows]
        series = []
        final_cutoff = date.today() - timedelta(days=days)

        if transform == "mom":
            for i in range(1, len(values)):
                d, v = values[i]
                prev_v = values[i - 1][1]
                if d < final_cutoff:
                    continue
                if prev_v != 0:
                    change = ((v - prev_v) / prev_v) * 100
                    series.append({"date": d.isoformat(), "value": round(change, 3)})
        elif transform == "yoy":
            date_val_map = {v[0]: v[1] for v in values}
            for d, v in values:
                if d < final_cutoff:
                    continue
                year_ago = d.replace(year=d.year - 1) if d.month != 2 or d.day != 29 else d.replace(year=d.year - 1, day=28)
                # Find closest date within 45 days of year_ago
                best_match = None
                best_diff = timedelta(days=46)
                for candidate_d, candidate_v in date_val_map.items():
                    diff = abs(candidate_d - year_ago)
                    if diff < best_diff:
                        best_diff = diff
                        best_match = (candidate_d, candidate_v)
                if best_match and best_match[1] != 0:
                    change = ((v - best_match[1]) / best_match[1]) * 100
                    series.append({"date": d.isoformat(), "value": round(change, 2)})

        return series

    async def get_all_inflation_latest(self) -> list[dict]:
        """Return latest YoY for all tracked inflation indicators."""
        result = []
        for short_name, full_name in INFLATION_INDICATORS.items():
            series = await self.get_inflation_series(short_name, "yoy", 365)
            if series:
                latest = series[-1]
                result.append({
                    "name": short_name,
                    "full_name": full_name,
                    "yoy": latest["value"],
                    "date": latest["date"],
                })
        return result

    async def get_inflation_dashboard(
        self, days: int = 365 * 5
    ) -> dict:
        """All 9 inflation series + SPX for the dashboard."""
        cutoff = date.today() - timedelta(days=days)
        spx_q = (
            select(MarketData.date, MarketData.value)
            .where(
                MarketData.symbol == "SP500",
                MarketData.date >= cutoff,
            )
            .order_by(MarketData.date)
        )
        spx_rows = (await self.db.execute(spx_q)).all()
        spx = [
            {"date": r.date.isoformat(), "value": r.value}
            for r in spx_rows
        ]

        # Breakeven inflation rates from YieldData table
        be5_q = (
            select(YieldData.date, YieldData.breakeven)
            .where(
                YieldData.maturity == "5Y",
                YieldData.date >= cutoff,
                YieldData.breakeven.isnot(None),
            )
            .order_by(YieldData.date)
        )
        be10_q = (
            select(YieldData.date, YieldData.breakeven)
            .where(
                YieldData.maturity == "10Y",
                YieldData.date >= cutoff,
                YieldData.breakeven.isnot(None),
            )
            .order_by(YieldData.date)
        )
        t5yie = [
            {"date": r.date.isoformat(), "value": r.breakeven}
            for r in (await self.db.execute(be5_q)).all()
        ]
        t10yie = [
            {"date": r.date.isoformat(), "value": r.breakeven}
            for r in (await self.db.execute(be10_q)).all()
        ]

        # MICH (Michigan 5Y Inflation Expectations) from MarketData
        mich_q = (
            select(MarketData.date, MarketData.value)
            .where(
                MarketData.symbol == "MICH",
                MarketData.date >= cutoff,
            )
            .order_by(MarketData.date)
        )
        mich = [
            {"date": r.date.isoformat(), "value": r.value}
            for r in (await self.db.execute(mich_q)).all()
        ]

        # Sticky CPI ex F&E (Atlanta Fed, already YoY %)
        sticky_q = (
            select(MarketData.date, MarketData.value)
            .where(
                MarketData.symbol == "STICKY_CPI",
                MarketData.date >= cutoff,
            )
            .order_by(MarketData.date)
        )
        sticky_cpi = [
            {"date": r.date.isoformat(), "value": r.value}
            for r in (await self.db.execute(sticky_q)).all()
        ]

        return {
            "spx": spx,
            "cpi_yoy": await self.get_inflation_series(
                "CPI", "yoy", days),
            "cpi_core_yoy": await self.get_inflation_series(
                "Core CPI", "yoy", days),
            "cpi_mom": await self.get_inflation_series(
                "CPI", "mom", days),
            "pce_yoy": await self.get_inflation_series(
                "PCE", "yoy", days),
            "pce_core_yoy": await self.get_inflation_series(
                "Core PCE", "yoy", days),
            "pce_mom": await self.get_inflation_series(
                "PCE", "mom", days),
            "ppi_yoy": await self.get_inflation_series(
                "PPI", "yoy", days),
            "ppi_core_yoy": await self.get_inflation_series(
                "Core PPI", "yoy", days),
            "ppi_mom": await self.get_inflation_series(
                "PPI", "mom", days),
            # Inflation expectations & sticky
            "mich": mich,
            "t5yie": t5yie,
            "t10yie": t10yie,
            "sticky_cpi": sticky_cpi,
        }
