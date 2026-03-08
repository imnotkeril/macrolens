"""
Fed FOMC Dashboard — approximate meeting probabilities and rate path.

Uses:
- Current rate from FedRate
- Latest forward rate from ZQ futures (100 - price) for market expectations
- FOMC dates (static schedule)
- Heuristic: (current - forward) implies cut probability for next meeting
  CME FedWatch uses meeting-specific contracts; we approximate from front-month ZQ.
"""
from datetime import date, timedelta

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fed_policy import FedRate
from app.models.market_data import MarketData

# FOMC meeting schedule (aligned with calendar_service)
FOMC_DATES = sorted([
    date(2025, 1, 29), date(2025, 3, 19), date(2025, 5, 7),
    date(2025, 6, 18), date(2025, 7, 30), date(2025, 9, 17),
    date(2025, 10, 29), date(2025, 12, 10),
    date(2026, 1, 28), date(2026, 3, 18), date(2026, 4, 29),
    date(2026, 6, 17), date(2026, 7, 29), date(2026, 9, 16),
    date(2026, 10, 28), date(2026, 12, 9),
])  # Update when Fed publishes new schedule


def _get_upcoming_fomc(today: date, limit: int = 5) -> list[date]:
    return [d for d in FOMC_DATES if d >= today][:limit]


def _format_date(d: date) -> str:
    months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
    return f"{months[d.month - 1]} {d.day}, {d.year}"


class FedDashboardService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_fomc_dashboard(self) -> dict:
        today = date.today()

        # Current rate
        rate_q = select(FedRate).order_by(desc(FedRate.date)).limit(1)
        rate_row = (await self.db.execute(rate_q)).scalar_one_or_none()
        current_mid = 0.0
        if rate_row:
            current_mid = (rate_row.target_upper + rate_row.target_lower) / 2

        # Latest ZQ (forward rate = 100 - price)
        zq_q = (
            select(MarketData.date, MarketData.value)
            .where(MarketData.symbol == "ZQ")
            .order_by(desc(MarketData.date))
            .limit(30)
        )
        zq_rows = (await self.db.execute(zq_q)).all()
        forward_rate = None
        if zq_rows:
            forward_rate = 100 - zq_rows[0].value

        # Heuristic: (current - forward) in bp / 25 = implied 25bp cuts for near term
        upcoming = _get_upcoming_fomc(today)
        meetings = []

        if forward_rate is not None and current_mid > 0:
            bp_diff = (current_mid - forward_rate) * 100
            implied_cuts = max(0, min(5, bp_diff / 25))
            remaining = implied_cuts

            for i, fomc_date in enumerate(upcoming):
                meet_cut_prob = min(1, remaining)
                remaining = max(0, remaining - meet_cut_prob)

                hold_pct = round((1 - meet_cut_prob) * 100)
                cut_pct = round(meet_cut_prob * 100)

                if cut_pct >= 50:
                    outcome, outcome_type = "−25bps", "cut"
                elif hold_pct >= 50:
                    outcome, outcome_type = "Hold" if hold_pct >= 60 else "Hold?", "hold"
                else:
                    outcome, outcome_type = "Hold?", "hold"

                meetings.append({
                    "date": _format_date(fomc_date),
                    "hold_pct": hold_pct,
                    "cut25_pct": cut_pct,
                    "cut50_pct": 0,
                    "hike_pct": 0,
                    "outcome": outcome,
                    "outcome_type": outcome_type,
                })
        else:
            for fomc_date in upcoming:
                meetings.append({
                    "date": _format_date(fomc_date),
                    "hold_pct": 0,
                    "cut25_pct": 0,
                    "cut50_pct": 0,
                    "hike_pct": 0,
                    "outcome": "—",
                    "outcome_type": "hold",
                })

        # Rate path: Now, Q2, Q4, 2027, LT
        # Fed SEP (Summary of Economic Projections) — last known, update when Fed publishes
        # Dec 2025 SEP approximate medians; market from forward extrapolation
        r_star = 2.5

        now_fed = current_mid
        now_market = forward_rate if forward_rate is not None else current_mid

        # Extrapolate market path: assume gradual decline toward r*
        q2_fed = round(now_fed - 0.25, 2) if now_fed > r_star else now_fed
        q2_market = round(now_market - 0.25, 2) if now_market and now_market > r_star else now_market

        q4_fed = round(q2_fed - 0.25, 2) if q2_fed > r_star else r_star
        q4_market = round(q2_market - 0.25, 2) if q2_market and q2_market > r_star else q2_market

        y27_fed = round(q4_fed - 0.25, 2) if q4_fed > r_star else r_star
        y27_market = round(q4_market - 0.125, 2) if q4_market and q4_market > r_star else q4_market

        rate_path = {
            "now": {"fed_median": round(now_fed, 2), "market": round(now_market or now_fed, 2)},
            "q2_26": {"fed_median": q2_fed, "market": round(q2_market or q2_fed, 2)},
            "q4_26": {"fed_median": q4_fed, "market": round(q4_market or q4_fed, 2)},
            "2027": {"fed_median": y27_fed, "market": round(y27_market or y27_fed, 2)},
            "lt": {"fed_median": r_star, "market": r_star},
        }

        return {
            "meetings": meetings,
            "rate_path": rate_path,
            "current_rate": current_mid,
            "forward_rate": forward_rate,
        }
