"""
Yield Curve Analyzer — spreads, curve patterns, inversion detection, historical percentiles.

Patterns:
- Bear Steepening: all rates UP, long end rises MORE → growth + inflation expectations rising
- Bull Steepening: all rates DOWN, short end falls MORE → Fed cutting, recovery expected
- Bear Flattening: all rates UP, short end rises MORE → Fed hiking, slowing growth ahead
- Bull Flattening: all rates DOWN, long end falls MORE → flight to safety, recession fears
"""
import logging
from datetime import date, timedelta

import numpy as np
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.market_data import YieldData
from app.schemas.yield_curve import (
    YieldCurveSnapshot, YieldDataResponse, YieldSpread, CurveDynamics,
)

logger = logging.getLogger(__name__)

MATURITY_ORDER = ["3M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"]

KEY_SPREADS = [
    ("2Y10Y", "2Y", "10Y"),
    ("3M10Y", "3M", "10Y"),
]


class YieldAnalyzer:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_current_snapshot(self) -> YieldCurveSnapshot:
        latest_date = await self._get_latest_date()
        if not latest_date:
            return YieldCurveSnapshot(date=date.today(), points=[], spreads=[])

        query = (
            select(YieldData)
            .where(YieldData.date == latest_date)
            .order_by(YieldData.maturity)
        )
        result = await self.db.execute(query)
        rows = result.scalars().all()

        points = [YieldDataResponse.model_validate(r) for r in rows]
        # Sort by maturity order
        maturity_rank = {m: i for i, m in enumerate(MATURITY_ORDER)}
        points.sort(key=lambda p: maturity_rank.get(p.maturity, 99))

        spreads = await self.get_spreads()

        return YieldCurveSnapshot(date=latest_date, points=points, spreads=spreads)

    async def get_snapshot_at_date(self, target: date) -> YieldCurveSnapshot:
        """Yield curve snapshot closest to a given date."""
        query = (
            select(YieldData.date)
            .where(YieldData.date <= target)
            .order_by(desc(YieldData.date))
            .limit(1)
        )
        result = await self.db.execute(query)
        actual_date = result.scalar_one_or_none()
        if not actual_date:
            return YieldCurveSnapshot(date=target, points=[], spreads=[])

        q = select(YieldData).where(YieldData.date == actual_date)
        res = await self.db.execute(q)
        rows = res.scalars().all()

        points = [YieldDataResponse.model_validate(r) for r in rows]
        maturity_rank = {m: i for i, m in enumerate(MATURITY_ORDER)}
        points.sort(key=lambda p: maturity_rank.get(p.maturity, 99))

        return YieldCurveSnapshot(date=actual_date, points=points, spreads=[])

    async def get_historical_curves(self) -> list[YieldCurveSnapshot]:
        """Return snapshots for 3m, 6m, and 1y ago."""
        today = date.today()
        offsets = [
            timedelta(days=90),
            timedelta(days=180),
            timedelta(days=365),
        ]
        results = []
        for delta in offsets:
            snap = await self.get_snapshot_at_date(today - delta)
            if snap.points:
                results.append(snap)
        return results

    async def get_spreads(self) -> list[YieldSpread]:
        latest_date = await self._get_latest_date()
        if not latest_date:
            return []

        query = select(YieldData).where(YieldData.date == latest_date)
        result = await self.db.execute(query)
        rows = {r.maturity: r.nominal_yield for r in result.scalars().all()}

        spreads = []
        for spread_name, short_m, long_m in KEY_SPREADS:
            if short_m in rows and long_m in rows:
                value = (rows[long_m] - rows[short_m]) * 100  # convert to basis points
                percentile = await self._compute_spread_percentile(short_m, long_m, value)
                spreads.append(YieldSpread(
                    name=spread_name,
                    value=round(value, 1),
                    historical_percentile=percentile,
                    is_inverted=value < 0,
                ))

        # 10Y TIPS real yield (already in percent, not bp)
        tips_q = select(YieldData).where(
            YieldData.date == latest_date, YieldData.maturity == "10Y"
        )
        tips_result = await self.db.execute(tips_q)
        tips_row = tips_result.scalar_one_or_none()
        if tips_row and tips_row.tips_yield is not None:
            spreads.append(YieldSpread(
                name="10Y_REAL_YIELD",
                value=round(tips_row.tips_yield, 2),
                historical_percentile=None,
                is_inverted=tips_row.tips_yield < 0,
            ))

        # 10Y Breakeven (already in percent, not bp)
        if tips_row and tips_row.breakeven is not None:
            spreads.append(YieldSpread(
                name="10Y_BREAKEVEN",
                value=round(tips_row.breakeven, 2),
                historical_percentile=None,
                is_inverted=False,
            ))

        return spreads

    async def get_dynamics(self) -> CurveDynamics:
        """Determine current yield curve pattern (as-of today, PIT)."""
        return await self.get_dynamics_at_date(date.today())

    async def get_dynamics_at_date(self, as_of: date) -> CurveDynamics:
        """
        Point-in-time curve dynamics: compare yields on or before `as_of` vs ~30d / ~90d earlier.
        No future data after `as_of`.
        """
        one_month_ago = as_of - timedelta(days=30)
        three_months_ago = as_of - timedelta(days=90)

        short_now = await self._get_yield_on_or_before("2Y", as_of)
        long_now = await self._get_yield_on_or_before("10Y", as_of)
        short_1m = await self._get_yield_on_or_before("2Y", one_month_ago)
        long_1m = await self._get_yield_on_or_before("10Y", one_month_ago)
        short_3m = await self._get_yield_on_or_before("2Y", three_months_ago)
        long_3m = await self._get_yield_on_or_before("10Y", three_months_ago)

        sc_1m = (short_now - short_1m) if short_now is not None and short_1m is not None else 0.0
        lc_1m = (long_now - long_1m) if long_now is not None and long_1m is not None else 0.0
        sc_3m = (short_now - short_3m) if short_now is not None and short_3m is not None else 0.0
        lc_3m = (long_now - long_3m) if long_now is not None and long_3m is not None else 0.0

        pattern, description = self._classify_pattern(sc_1m, lc_1m)

        return CurveDynamics(
            pattern=pattern,
            description=description,
            short_end_change_1m=round(sc_1m * 100, 1),
            long_end_change_1m=round(lc_1m * 100, 1),
            short_end_change_3m=round(sc_3m * 100, 1),
            long_end_change_3m=round(lc_3m * 100, 1),
        )

    async def get_spread_history(self, spread_name: str, days: int = 730) -> list[dict]:
        """Time-series of a spread (e.g. 2Y10Y) in basis points."""
        mapping = {s[0]: (s[1], s[2]) for s in KEY_SPREADS}
        if spread_name not in mapping:
            return []
        short_m, long_m = mapping[spread_name]
        cutoff = date.today() - timedelta(days=days)

        short_q = (
            select(YieldData.date, YieldData.nominal_yield)
            .where(YieldData.maturity == short_m, YieldData.date >= cutoff)
        )
        long_q = (
            select(YieldData.date, YieldData.nominal_yield)
            .where(YieldData.maturity == long_m, YieldData.date >= cutoff)
        )
        short_map = {r[0]: r[1] for r in (await self.db.execute(short_q)).all()}
        long_map = {r[0]: r[1] for r in (await self.db.execute(long_q)).all()}

        common = sorted(set(short_map) & set(long_map))
        return [
            {"date": d.isoformat(), "value": round((long_map[d] - short_map[d]) * 100, 1)}
            for d in common
        ]

    async def get_real_yield_history(self, maturity: str = "10Y", days: int = 730) -> list[dict]:
        """Time-series of TIPS real yield for a given maturity."""
        cutoff = date.today() - timedelta(days=days)
        q = (
            select(YieldData.date, YieldData.tips_yield)
            .where(
                YieldData.maturity == maturity,
                YieldData.tips_yield.isnot(None),
                YieldData.date >= cutoff,
            )
            .order_by(YieldData.date)
        )
        rows = (await self.db.execute(q)).all()
        return [{"date": r[0].isoformat(), "value": round(r[1], 3)} for r in rows]

    async def get_breakeven_history(self, maturity: str = "10Y", days: int = 730) -> list[dict]:
        """Time-series of breakeven inflation rate."""
        cutoff = date.today() - timedelta(days=days)
        q = (
            select(YieldData.date, YieldData.breakeven)
            .where(
                YieldData.maturity == maturity,
                YieldData.breakeven.isnot(None),
                YieldData.date >= cutoff,
            )
            .order_by(YieldData.date)
        )
        rows = (await self.db.execute(q)).all()
        return [{"date": r[0].isoformat(), "value": round(r[1], 3)} for r in rows]

    async def is_inverted(self) -> bool:
        spreads = await self.get_spreads()
        for s in spreads:
            if s.name == "2Y10Y":
                return s.is_inverted
        return False

    async def get_10y_real_yield(self) -> float | None:
        latest_date = await self._get_latest_date()
        if not latest_date:
            return None
        query = select(YieldData).where(
            YieldData.date == latest_date, YieldData.maturity == "10Y"
        )
        result = await self.db.execute(query)
        row = result.scalar_one_or_none()
        return row.tips_yield if row else None

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _get_latest_date(self) -> date | None:
        query = select(YieldData.date).order_by(desc(YieldData.date)).limit(1)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _get_yield_near_date(self, maturity: str, target: date) -> float | None:
        """Get yield closest to target date within ±7 days."""
        query = (
            select(YieldData.nominal_yield)
            .where(
                YieldData.maturity == maturity,
                YieldData.date.between(target - timedelta(days=7), target + timedelta(days=7)),
            )
            .order_by(desc(YieldData.date))
            .limit(1)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _get_yield_on_or_before(self, maturity: str, as_of: date) -> float | None:
        """Latest nominal yield for maturity with observation date <= as_of (PIT)."""
        query = (
            select(YieldData.nominal_yield)
            .where(YieldData.maturity == maturity, YieldData.date <= as_of)
            .order_by(desc(YieldData.date))
            .limit(1)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _compute_spread_percentile(self, short_m: str, long_m: str, current_value: float) -> float | None:
        """Historical percentile of the spread over last 5 years."""
        five_years_ago = date.today() - timedelta(days=365 * 5)

        short_q = (
            select(YieldData.date, YieldData.nominal_yield)
            .where(YieldData.maturity == short_m, YieldData.date >= five_years_ago)
        )
        long_q = (
            select(YieldData.date, YieldData.nominal_yield)
            .where(YieldData.maturity == long_m, YieldData.date >= five_years_ago)
        )

        short_result = await self.db.execute(short_q)
        long_result = await self.db.execute(long_q)

        short_map = {r[0]: r[1] for r in short_result.all()}
        long_map = {r[0]: r[1] for r in long_result.all()}

        common_dates = set(short_map.keys()) & set(long_map.keys())
        if len(common_dates) < 50:
            return None

        spreads = [(long_map[d] - short_map[d]) * 100 for d in common_dates]
        spreads_arr = np.array(sorted(spreads))

        percentile = float(np.searchsorted(spreads_arr, current_value) / len(spreads_arr) * 100)
        return round(percentile, 1)

    @staticmethod
    def _classify_pattern(short_change: float, long_change: float) -> tuple[str, str]:
        both_up = short_change > 0.001 and long_change > 0.001
        both_down = short_change < -0.001 and long_change < -0.001

        if both_up and long_change > short_change:
            return "bear_steepening", "Growth + inflation expectations rising. Sell long bonds, buy commodities."
        if both_down and short_change < long_change:
            return "bull_steepening", "Fed cutting, economy weak, recovery expected. Buy long bonds, buy risk assets."
        if both_up and short_change > long_change:
            return "bear_flattening", "Fed hiking, slowing growth ahead. Defensive positioning."
        if both_down and long_change < short_change:
            return "bull_flattening", "Flight to safety, recession fears. Buy long-duration bonds, sell risk."

        if abs(short_change) < 0.001 and abs(long_change) < 0.001:
            return "stable", "Curve is stable — no significant directional move."

        return "mixed", "Mixed signals — short and long ends moving in different directions."
