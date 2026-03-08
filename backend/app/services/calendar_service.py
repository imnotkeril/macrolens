"""
Economic Calendar Service.

Generates calendar events from:
1. Indicator release history (IndicatorValue dates in DB)
2. Estimated next releases based on frequency
3. FOMC meeting schedule (static, publicly available)
4. Market reaction computation (S&P 500 change around events)
"""
import logging
from datetime import date, timedelta

from sqlalchemy import select, desc, asc, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.indicator import Indicator, IndicatorValue
from app.models.market_data import MarketData
from app.schemas.calendar import CalendarEvent, CalendarSummary, EventImpact

logger = logging.getLogger(__name__)

FOMC_DATES_2025 = [
    date(2025, 1, 29),
    date(2025, 3, 19),
    date(2025, 5, 7),
    date(2025, 6, 18),
    date(2025, 7, 30),
    date(2025, 9, 17),
    date(2025, 10, 29),
    date(2025, 12, 10),
]

FOMC_DATES_2026 = [
    date(2026, 1, 28),
    date(2026, 3, 18),
    date(2026, 4, 29),
    date(2026, 6, 17),
    date(2026, 7, 29),
    date(2026, 9, 16),
    date(2026, 10, 28),
    date(2026, 12, 9),
]

ALL_FOMC_DATES = sorted(FOMC_DATES_2025 + FOMC_DATES_2026)

FREQUENCY_DELTA = {
    "daily": timedelta(days=1),
    "weekly": timedelta(days=7),
    "monthly": timedelta(days=32),
    "quarterly": timedelta(days=95),
}


class CalendarService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_calendar(self, upcoming_days: int = 45, recent_days: int = 30) -> CalendarSummary:
        today = date.today()
        upcoming: list[CalendarEvent] = []
        recent: list[CalendarEvent] = []

        indicators = await self._get_indicators()

        for ind in indicators:
            last_values = await self._get_recent_values(ind.id, limit=2)
            if not last_values:
                continue

            latest = last_values[0]
            prev = last_values[1] if len(last_values) > 1 else None

            reaction = await self._market_reaction(latest.date)

            surprise_pct = None
            if latest.previous and latest.previous != 0:
                surprise_pct = round(((latest.value - latest.previous) / abs(latest.previous)) * 100, 2)

            if latest.date >= today - timedelta(days=recent_days):
                recent.append(CalendarEvent(
                    date=latest.date,
                    name=ind.name,
                    event_type="indicator_release",
                    importance=ind.importance.value if hasattr(ind.importance, "value") else int(ind.importance),
                    category=ind.category.value if hasattr(ind.category, "value") else str(ind.category),
                    frequency=ind.frequency.value if hasattr(ind.frequency, "value") else str(ind.frequency),
                    actual=round(latest.value, 2),
                    previous=round(prev.value, 2) if prev else None,
                    surprise_pct=surprise_pct,
                    market_reaction_1d=reaction,
                    is_upcoming=False,
                ))

            next_date = self._estimate_next_release(latest.date, ind.frequency.value if hasattr(ind.frequency, "value") else str(ind.frequency))
            if next_date and today <= next_date <= today + timedelta(days=upcoming_days):
                upcoming.append(CalendarEvent(
                    date=next_date,
                    name=ind.name,
                    event_type="indicator_release",
                    importance=ind.importance.value if hasattr(ind.importance, "value") else int(ind.importance),
                    category=ind.category.value if hasattr(ind.category, "value") else str(ind.category),
                    frequency=ind.frequency.value if hasattr(ind.frequency, "value") else str(ind.frequency),
                    previous=round(latest.value, 2),
                    is_upcoming=True,
                ))

        for fd in ALL_FOMC_DATES:
            if today <= fd <= today + timedelta(days=upcoming_days):
                upcoming.append(CalendarEvent(
                    date=fd,
                    name="FOMC Rate Decision",
                    event_type="fomc_decision",
                    importance=3,
                    is_upcoming=True,
                ))
            elif today - timedelta(days=recent_days) <= fd < today:
                recent.append(CalendarEvent(
                    date=fd,
                    name="FOMC Rate Decision",
                    event_type="fomc_decision",
                    importance=3,
                    is_upcoming=False,
                ))

        upcoming.sort(key=lambda e: e.date)
        recent.sort(key=lambda e: e.date, reverse=True)

        next_fomc = None
        for fd in ALL_FOMC_DATES:
            if fd >= today:
                next_fomc = CalendarEvent(
                    date=fd,
                    name="FOMC Rate Decision",
                    event_type="fomc_decision",
                    importance=3,
                    is_upcoming=True,
                )
                break

        return CalendarSummary(upcoming=upcoming, recent=recent, next_fomc=next_fomc)

    async def get_event_impact(self, indicator_id: int, limit: int = 12) -> EventImpact | None:
        ind_q = select(Indicator).where(Indicator.id == indicator_id)
        ind_res = await self.db.execute(ind_q)
        ind = ind_res.scalar_one_or_none()
        if not ind:
            return None

        val_q = (
            select(IndicatorValue)
            .where(IndicatorValue.indicator_id == indicator_id)
            .order_by(desc(IndicatorValue.date))
            .limit(limit)
        )
        val_res = await self.db.execute(val_q)
        values = val_res.scalars().all()

        events = []
        reactions = []
        surprises = []
        beat = miss = inline = 0

        for val in values:
            reaction = await self._market_reaction(val.date)
            surprise_pct = None
            if val.previous and val.previous != 0:
                surprise_pct = round(((val.value - val.previous) / abs(val.previous)) * 100, 2)

            if surprise_pct is not None:
                surprises.append(surprise_pct)
                if surprise_pct > 0.5:
                    beat += 1
                elif surprise_pct < -0.5:
                    miss += 1
                else:
                    inline += 1

            if reaction is not None:
                reactions.append(reaction)

            events.append(CalendarEvent(
                date=val.date,
                name=ind.name,
                event_type="indicator_release",
                importance=ind.importance.value if hasattr(ind.importance, "value") else int(ind.importance),
                category=ind.category.value if hasattr(ind.category, "value") else str(ind.category),
                actual=round(val.value, 2),
                previous=round(val.previous, 2) if val.previous else None,
                surprise_pct=surprise_pct,
                market_reaction_1d=reaction,
                is_upcoming=False,
            ))

        return EventImpact(
            indicator_name=ind.name,
            release_count=len(values),
            avg_market_reaction=round(sum(reactions) / len(reactions), 3) if reactions else None,
            avg_surprise_pct=round(sum(surprises) / len(surprises), 2) if surprises else None,
            beat_count=beat,
            miss_count=miss,
            inline_count=inline,
            history=events,
        )

    async def _get_indicators(self) -> list[Indicator]:
        q = select(Indicator).order_by(Indicator.category, Indicator.importance.desc())
        res = await self.db.execute(q)
        return list(res.scalars().all())

    async def _get_recent_values(self, indicator_id: int, limit: int = 2) -> list[IndicatorValue]:
        q = (
            select(IndicatorValue)
            .where(IndicatorValue.indicator_id == indicator_id)
            .order_by(desc(IndicatorValue.date))
            .limit(limit)
        )
        res = await self.db.execute(q)
        return list(res.scalars().all())

    async def _market_reaction(self, event_date: date) -> float | None:
        """S&P 500 1-day change around the event date."""
        before_q = (
            select(MarketData.value)
            .where(and_(MarketData.symbol == "SP500", MarketData.date <= event_date))
            .order_by(desc(MarketData.date))
            .limit(1)
        )
        after_q = (
            select(MarketData.value)
            .where(and_(
                MarketData.symbol == "SP500",
                MarketData.date > event_date,
                MarketData.date <= event_date + timedelta(days=5),
            ))
            .order_by(asc(MarketData.date))
            .limit(1)
        )

        before_res = await self.db.execute(before_q)
        after_res = await self.db.execute(after_q)

        before_val = before_res.scalar_one_or_none()
        after_val = after_res.scalar_one_or_none()

        if before_val and after_val and before_val != 0:
            return round(((after_val - before_val) / before_val) * 100, 3)
        return None

    @staticmethod
    def _estimate_next_release(last_date: date, frequency: str) -> date | None:
        delta = FREQUENCY_DELTA.get(frequency)
        if not delta:
            return None
        return last_date + delta
