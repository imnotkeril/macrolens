"""
Fed Policy Tracker — scores Fed stance from -2 (very easy) to +2 (very tight).

Components:
1. Current rate vs neutral rate (r*) — estimated ~2.5% nominal
2. Rate direction — hiking (+), paused (0), cutting (-)
3. Balance sheet direction — QE (-), stable (0), QT (+)
4. Rate level vs 10-year history
"""
import logging
from datetime import date, timedelta

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fed_policy import FedRate, BalanceSheet
from app.schemas.fed import FedPolicyStatus

logger = logging.getLogger(__name__)

NEUTRAL_RATE = 2.5  # r* estimate (nominal)


class FedTracker:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_current_status(self) -> FedPolicyStatus:
        latest_rate = await self._get_latest_rate()
        rate_direction = await self._get_rate_direction()
        bs_direction = await self._get_balance_sheet_direction()
        policy_score = await self._compute_policy_score()
        last_change = await self._get_last_rate_change_date()

        if latest_rate:
            upper = latest_rate.target_upper
            lower = latest_rate.target_lower
            effr = latest_rate.effr
        else:
            upper, lower, effr = 0, 0, None

        stance = self._score_to_stance(policy_score)

        return FedPolicyStatus(
            current_rate_upper=upper,
            current_rate_lower=lower,
            effr=effr,
            policy_score=round(policy_score, 2),
            stance=stance,
            rate_direction=rate_direction,
            balance_sheet_direction=bs_direction,
            last_change_date=last_change,
        )

    async def _get_latest_rate(self) -> FedRate | None:
        query = select(FedRate).order_by(desc(FedRate.date)).limit(1)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _get_rate_direction(self) -> str:
        query = (
            select(FedRate)
            .order_by(desc(FedRate.date))
            .limit(90)
        )
        result = await self.db.execute(query)
        rates = result.scalars().all()

        if len(rates) < 2:
            return "paused"

        current_upper = rates[0].target_upper

        # Look back for the last rate change (skip days with same rate)
        prev_upper = None
        for r in rates[1:]:
            if r.target_upper != current_upper:
                prev_upper = r.target_upper
                break

        if prev_upper is None:
            return "paused"
        if current_upper > prev_upper:
            return "hiking"
        if current_upper < prev_upper:
            return "cutting"
        return "paused"

    async def _get_balance_sheet_direction(self) -> str:
        query = (
            select(BalanceSheet)
            .order_by(desc(BalanceSheet.date))
            .limit(13)  # ~3 months of weekly data
        )
        result = await self.db.execute(query)
        rows = result.scalars().all()

        if len(rows) < 4:
            return "stable"

        recent_avg = sum(r.total_assets for r in rows[:4]) / 4
        older_avg = sum(r.total_assets for r in rows[-4:]) / 4

        change_pct = ((recent_avg - older_avg) / older_avg) * 100 if older_avg else 0

        if change_pct > 1:
            return "expanding"
        if change_pct < -1:
            return "shrinking"
        return "stable"

    async def _compute_policy_score(self) -> float:
        """
        Policy score from -2 (very easy) to +2 (very tight).
        
        Components:
        - Rate vs neutral: (midpoint - r*) / r* clamped to [-1, +1]
        - Rate direction: hiking +0.5, cutting -0.5, paused 0
        - Balance sheet: QT +0.5, QE -0.5, stable 0
        """
        latest = await self._get_latest_rate()
        if not latest:
            return 0.0

        midpoint = (latest.target_upper + latest.target_lower) / 2

        # Component 1: rate level vs neutral (max contribution ±1.0)
        rate_component = max(-1.0, min(1.0, (midpoint - NEUTRAL_RATE) / NEUTRAL_RATE))

        # Component 2: rate direction (±0.5)
        direction = await self._get_rate_direction()
        dir_component = {"hiking": 0.5, "cutting": -0.5, "paused": 0.0}.get(direction, 0.0)

        # Component 3: balance sheet (±0.5)
        bs_dir = await self._get_balance_sheet_direction()
        bs_component = {"shrinking": 0.5, "expanding": -0.5, "stable": 0.0}.get(bs_dir, 0.0)

        score = rate_component + dir_component + bs_component
        return max(-2.0, min(2.0, score))

    async def _get_last_rate_change_date(self) -> date | None:
        query = select(FedRate).order_by(desc(FedRate.date)).limit(365)
        result = await self.db.execute(query)
        rates = result.scalars().all()

        if len(rates) < 2:
            return None

        current = rates[0].target_upper
        for r in rates[1:]:
            if r.target_upper != current:
                return r.date
        return None

    @staticmethod
    def _score_to_stance(score: float) -> str:
        if score <= -1.5:
            return "very_easy"
        if score <= -0.5:
            return "easy"
        if score <= 0.5:
            return "neutral"
        if score <= 1.5:
            return "tight"
        return "very_tight"

    async def get_policy_score(self) -> float:
        """Public accessor for Navigator engine."""
        return await self._compute_policy_score()

    async def get_policy_score_at_date(self, target: date) -> float:
        """Compute policy score at a historical date (simplified)."""
        query = (
            select(FedRate)
            .where(FedRate.date <= target)
            .order_by(desc(FedRate.date))
            .limit(1)
        )
        result = await self.db.execute(query)
        rate = result.scalar_one_or_none()
        if not rate:
            return 0.0

        midpoint = (rate.target_upper + rate.target_lower) / 2
        rate_component = max(-1.0, min(1.0, (midpoint - NEUTRAL_RATE) / NEUTRAL_RATE))

        prev_query = (
            select(FedRate)
            .where(FedRate.date <= target - timedelta(days=60))
            .order_by(desc(FedRate.date))
            .limit(1)
        )
        prev_result = await self.db.execute(prev_query)
        prev_rate = prev_result.scalar_one_or_none()

        dir_component = 0.0
        if prev_rate:
            if rate.target_upper > prev_rate.target_upper:
                dir_component = 0.5
            elif rate.target_upper < prev_rate.target_upper:
                dir_component = -0.5

        return max(-2.0, min(2.0, rate_component + dir_component))
