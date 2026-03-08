"""
Indicator analysis engine: trends, z-scores, surprise index, category scores.

Methodology:
- Trend: compare latest value to 3-month and 6-month moving averages
- Z-score: (current - mean_5y) / std_5y — how extreme the current reading is
- Surprise: (actual - forecast) / |forecast| when forecast is available
- Category score: weighted average of indicator z-scores within a category
"""
import logging
from datetime import date, timedelta

import numpy as np
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.indicator import (
    Indicator, IndicatorValue, IndicatorCategory, TrendDirection, Importance,
)
from app.schemas.indicator import CategoryScore

logger = logging.getLogger(__name__)

# Indicators where a lower value is better (inverse interpretation)
INVERSE_INDICATORS = {"Unemployment Rate", "Initial Jobless Claims"}

IMPORTANCE_WEIGHT = {
    Importance.HIGH: 1.0,
    Importance.MEDIUM: 0.6,
    Importance.LOW: 0.3,
}


class IndicatorAnalyzer:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def compute_z_score(self, indicator_id: int) -> float | None:
        """Z-score based on 5 years of data."""
        five_years_ago = date.today() - timedelta(days=365 * 5)
        query = (
            select(IndicatorValue.value)
            .where(
                IndicatorValue.indicator_id == indicator_id,
                IndicatorValue.date >= five_years_ago,
            )
            .order_by(IndicatorValue.date)
        )
        result = await self.db.execute(query)
        values = [r[0] for r in result.all()]

        if len(values) < 12:
            return None

        arr = np.array(values)
        mean = arr.mean()
        std = arr.std()
        if std == 0:
            return 0.0

        current = values[-1]
        return float((current - mean) / std)

    async def compute_trend(self, indicator_id: int) -> TrendDirection:
        """Compare latest value to 3-month MA to determine trend."""
        query = (
            select(IndicatorValue.value, IndicatorValue.date)
            .where(IndicatorValue.indicator_id == indicator_id)
            .order_by(desc(IndicatorValue.date))
            .limit(6)
        )
        result = await self.db.execute(query)
        rows = result.all()

        if len(rows) < 3:
            return TrendDirection.NEUTRAL

        latest = rows[0][0]
        ma_3 = np.mean([r[0] for r in rows[:3]])

        # Get indicator name to check if it's inverse
        ind_q = select(Indicator.name).where(Indicator.id == indicator_id)
        ind_result = await self.db.execute(ind_q)
        name = ind_result.scalar_one_or_none()

        if name in INVERSE_INDICATORS:
            # Lower is better
            if latest < ma_3 * 0.98:
                return TrendDirection.IMPROVING
            elif latest > ma_3 * 1.02:
                return TrendDirection.DETERIORATING
            return TrendDirection.NEUTRAL

        if latest > ma_3 * 1.02:
            return TrendDirection.IMPROVING
        elif latest < ma_3 * 0.98:
            return TrendDirection.DETERIORATING
        return TrendDirection.NEUTRAL

    async def update_indicator_analytics(self, indicator_id: int):
        """Update z-score and trend for the latest value of an indicator."""
        z_score = await self.compute_z_score(indicator_id)
        trend = await self.compute_trend(indicator_id)

        latest_q = (
            select(IndicatorValue)
            .where(IndicatorValue.indicator_id == indicator_id)
            .order_by(desc(IndicatorValue.date))
            .limit(1)
        )
        result = await self.db.execute(latest_q)
        latest = result.scalar_one_or_none()

        if latest:
            latest.z_score = z_score
            latest.trend = trend
            if latest.forecast and latest.forecast != 0:
                latest.surprise = (latest.value - latest.forecast) / abs(latest.forecast)
            await self.db.flush()

    async def update_all_analytics(self):
        """Recompute analytics for all indicators."""
        indicators = (await self.db.execute(select(Indicator))).scalars().all()
        for ind in indicators:
            await self.update_indicator_analytics(ind.id)
        await self.db.commit()

    async def compute_category_scores(self) -> list[CategoryScore]:
        """Aggregate indicator z-scores into category-level scores."""
        scores = []

        for category in IndicatorCategory:
            query = (
                select(Indicator)
                .where(Indicator.category == category)
            )
            result = await self.db.execute(query)
            indicators = result.scalars().all()

            if not indicators:
                scores.append(CategoryScore(
                    category=category, score=0.0,
                    trend=TrendDirection.NEUTRAL, indicator_count=0, color="yellow",
                ))
                continue

            weighted_scores = []
            trends = []
            for ind in indicators:
                latest_q = (
                    select(IndicatorValue)
                    .where(IndicatorValue.indicator_id == ind.id)
                    .order_by(desc(IndicatorValue.date))
                    .limit(1)
                )
                latest_result = await self.db.execute(latest_q)
                latest = latest_result.scalar_one_or_none()

                if latest and latest.z_score is not None:
                    weight = IMPORTANCE_WEIGHT.get(ind.importance, 0.5)
                    z = latest.z_score
                    if ind.name in INVERSE_INDICATORS:
                        z = -z
                    weighted_scores.append((z, weight))

                if latest and latest.trend:
                    trends.append(latest.trend)

            if weighted_scores:
                total_weight = sum(w for _, w in weighted_scores)
                cat_score = sum(z * w for z, w in weighted_scores) / total_weight if total_weight else 0
            else:
                cat_score = 0.0

            improving = sum(1 for t in trends if t == TrendDirection.IMPROVING)
            deteriorating = sum(1 for t in trends if t == TrendDirection.DETERIORATING)

            if improving > deteriorating:
                cat_trend = TrendDirection.IMPROVING
                color = "green"
            elif deteriorating > improving:
                cat_trend = TrendDirection.DETERIORATING
                color = "red"
            else:
                cat_trend = TrendDirection.NEUTRAL
                color = "yellow"

            scores.append(CategoryScore(
                category=category,
                score=round(cat_score, 2),
                trend=cat_trend,
                indicator_count=len(indicators),
                color=color,
            ))

        return scores

    async def get_category_score_value(self, category: IndicatorCategory) -> float:
        """Get a single numeric score for a category (used by Navigator)."""
        all_scores = await self.compute_category_scores()
        for s in all_scores:
            if s.category == category:
                return s.score
        return 0.0
