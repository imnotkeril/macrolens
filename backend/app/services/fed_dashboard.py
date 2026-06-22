"""
Fed FOMC dashboard — CME FedWatch (when available) + SEP dot path from FRED + ZQ market path.

Falls back to legacy ZQ heuristic for meeting probabilities if CME is unreachable.
"""

from __future__ import annotations

import logging
from datetime import date

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.fed_policy import FedRate
from app.models.market_data import MarketData
from app.services.cme_fedwatch_client import fetch_fedwatch_meetings_cme
from app.services.fed_rate_schema import apply_fed_rate_load_columns
from app.services.fed_sep_fred import build_sep_rate_path_from_fred

logger = logging.getLogger(__name__)

# FOMC meeting schedule fallback (calendar_service alignment) when CME does not return dates
FOMC_DATES = sorted(
    [
        date(2025, 1, 29),
        date(2025, 3, 19),
        date(2025, 5, 7),
        date(2025, 6, 18),
        date(2025, 7, 30),
        date(2025, 9, 17),
        date(2025, 10, 29),
        date(2025, 12, 10),
        date(2026, 1, 28),
        date(2026, 3, 18),
        date(2026, 4, 29),
        date(2026, 6, 17),
        date(2026, 7, 29),
        date(2026, 9, 16),
        date(2026, 10, 28),
        date(2026, 12, 9),
    ]
)


def _get_upcoming_fomc(today: date, limit: int = 5) -> list[date]:
    return [d for d in FOMC_DATES if d >= today][:limit]


def _format_date(d: date) -> str:
    months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
    return f"{months[d.month - 1]} {d.day}, {d.year}"


def _heuristic_meetings(
    upcoming: list[date], current_mid: float, forward_rate: float | None
) -> list[dict]:
    meetings = []
    if forward_rate is not None and current_mid > 0:
        bp_diff = (current_mid - forward_rate) * 100
        implied_cuts = max(0, min(5, bp_diff / 25))
        remaining = implied_cuts

        for fomc_date in upcoming:
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

            meetings.append(
                {
                    "date": _format_date(fomc_date),
                    "hold_pct": hold_pct,
                    "cut25_pct": cut_pct,
                    "cut50_pct": 0,
                    "hike_pct": 0,
                    "outcome": outcome,
                    "outcome_type": outcome_type,
                }
            )
    else:
        for fomc_date in upcoming:
            meetings.append(
                {
                    "date": _format_date(fomc_date),
                    "hold_pct": 0,
                    "cut25_pct": 0,
                    "cut50_pct": 0,
                    "hike_pct": 0,
                    "outcome": "—",
                    "outcome_type": "hold",
                }
            )
    return meetings


def _extrapolated_rate_path(current_mid: float, forward_rate: float | None, neutral: float) -> dict:
    """Legacy straight-line extrapolation (only used if FRED SEP build fails)."""
    r_star = neutral
    now_fed = current_mid
    now_market = forward_rate if forward_rate is not None else current_mid

    q2_fed = round(now_fed - 0.25, 2) if now_fed > r_star else now_fed
    q2_market = round(now_market - 0.25, 2) if now_market and now_market > r_star else now_market

    q4_fed = round(q2_fed - 0.25, 2) if q2_fed > r_star else r_star
    q4_market = round(q2_market - 0.25, 2) if q2_market and q2_market > r_star else q2_market

    y27_fed = round(q4_fed - 0.25, 2) if q4_fed > r_star else r_star
    y27_market = round(q4_market - 0.125, 2) if q4_market and q4_market > r_star else q4_market

    return {
        "now": {"fed_median": round(now_fed, 2), "market": round(now_market or now_fed, 2)},
        "q2_26": {"fed_median": q2_fed, "market": round(q2_market or q2_fed, 2)},
        "q4_26": {"fed_median": q4_fed, "market": round(q4_market or q4_fed, 2)},
        "2027": {"fed_median": y27_fed, "market": round(y27_market or y27_fed, 2)},
        "lt": {"fed_median": r_star, "market": r_star},
    }


class FedDashboardService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _neutral_from_db(self) -> float:
        q = (
            select(MarketData.value)
            .where(MarketData.symbol == "FEDTARMDLR")
            .order_by(desc(MarketData.date))
            .limit(1)
        )
        v = (await self.db.execute(q)).scalar_one_or_none()
        if v is not None:
            return float(v)
        return float(get_settings().neutral_rate_fallback)

    async def get_fomc_dashboard(self) -> dict:
        try:
            return await self._get_fomc_dashboard_inner()
        except Exception:
            logger.exception("FOMC dashboard failed; returning static heuristic fallback")
            today = date.today()
            upcoming = _get_upcoming_fomc(today)
            neutral = float(get_settings().neutral_rate_fallback)
            meetings = _heuristic_meetings(upcoming, 0.0, None)
            rate_path = _extrapolated_rate_path(0.0, None, neutral)
            return {
                "meetings": meetings,
                "rate_path": rate_path,
                "current_rate": 0.0,
                "forward_rate": None,
                "meetings_source": "zq_heuristic",
                "rate_path_source": "extrapolation",
            }

    async def _get_fomc_dashboard_inner(self) -> dict:
        today = date.today()

        rate_q = await apply_fed_rate_load_columns(
            self.db, select(FedRate).order_by(desc(FedRate.date)).limit(1)
        )
        rate_row = (await self.db.execute(rate_q)).scalar_one_or_none()
        current_mid = 0.0
        if rate_row:
            current_mid = (rate_row.target_upper + rate_row.target_lower) / 2

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

        upcoming = _get_upcoming_fomc(today)
        meetings_source = "zq_heuristic"
        cme = await fetch_fedwatch_meetings_cme(current_mid if current_mid > 0 else None)
        if cme:
            meetings = cme
            meetings_source = "cme_fedwatch"
        else:
            meetings = _heuristic_meetings(upcoming, current_mid, forward_rate)

        neutral = await self._neutral_from_db()
        settings = get_settings()
        rate_path_source = "extrapolation"
        rate_path = _extrapolated_rate_path(current_mid, forward_rate, neutral)
        if settings.fred_api_key:
            sep_path, meta = await build_sep_rate_path_from_fred(
                api_key=settings.fred_api_key,
                current_mid=current_mid,
                market_now=forward_rate,
            )
            if sep_path:
                rate_path = sep_path
                rate_path_source = str(meta.get("source") or "fred_sep")

        return {
            "meetings": meetings,
            "rate_path": rate_path,
            "current_rate": current_mid,
            "forward_rate": forward_rate,
            "meetings_source": meetings_source,
            "rate_path_source": rate_path_source,
        }

    async def get_dot_plot_payload(self) -> dict:
        """Thin wrapper for GET /api/fed/dot-plot (same SEP logic as dashboard)."""
        dash = await self.get_fomc_dashboard()
        return {
            "rate_path": dash["rate_path"],
            "current_rate": dash["current_rate"],
            "forward_rate": dash["forward_rate"],
            "source": dash.get("rate_path_source") or "unknown",
            "meta": {"meetings_source": dash.get("meetings_source")},
        }
