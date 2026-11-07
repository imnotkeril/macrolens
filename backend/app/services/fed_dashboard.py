"""
Fed FOMC dashboard — CME FedWatch (when available) + SEP dot path from FRED + ZQ market path.

Falls back to legacy ZQ heuristic for meeting probabilities if CME is unreachable.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.fed_policy import FedRate
from app.models.market_data import MarketData
from app.services.cme_fedwatch_client import fetch_fedwatch_meetings_cme
from app.services.fed_futures import meeting_probabilities
from app.services.fed_rate_schema import apply_fed_rate_load_columns
from app.services.fed_sep_fred import build_sep_rate_path_from_fred
from app.services.fomc_calendar import get_fomc_meetings

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
    """Minimal fallback when FRED SEP is unavailable: current policy rate and longer-run anchor."""
    return {
        "now": {
            "label": "Now",
            "fed_median": round(current_mid, 2),
            "market": round(forward_rate, 2) if forward_rate is not None else None,
        },
        "lt": {"label": "Longer run", "fed_median": round(neutral, 2), "market": None},
    }


def _meeting_row(m: dict, decision: date) -> dict:
    hold, c25, c50, hike = m["hold_pct"], m["cut25_pct"], m["cut50_pct"], m["hike_pct"]
    if hike >= c25 + c50 and hike >= hold:
        outcome, otype = "+25bps", "hike"
    elif c25 + c50 > hold:
        outcome, otype = ("−50bps" if c50 > c25 else "−25bps"), "cut"
    else:
        outcome, otype = "Hold", "hold"
    return {
        "date": _format_date(decision),
        "hold_pct": hold,
        "cut25_pct": c25,
        "cut50_pct": c50,
        "hike_pct": hike,
        "outcome": outcome,
        "outcome_type": otype,
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

        # Monthly ZQ contracts stored by the nightly refresh: latest implied rate per month.
        curve: dict[tuple[int, int], float] = {}
        zq_month_q = (
            select(MarketData.symbol, MarketData.date, MarketData.value)
            .where(MarketData.symbol.like("ZQ\\_2%", escape="\\"))
            .where(MarketData.date >= today - timedelta(days=14))
            .order_by(MarketData.symbol, desc(MarketData.date))
        )
        seen: set[str] = set()
        for sym, _d, val in (await self.db.execute(zq_month_q)).all():
            if sym in seen:
                continue
            seen.add(sym)
            try:
                curve[(int(sym[3:7]), int(sym[7:9]))] = 100.0 - float(val)
            except ValueError:
                continue

        effr_now = rate_row.effr if rate_row and rate_row.effr is not None else None
        front = curve.get((today.year, today.month))
        pre_rate = (
            effr_now if effr_now is not None else (front if front is not None else current_mid)
        )
        # Put market-implied rates on the target-range midpoint scale used by the Fed median.
        offset = (current_mid - effr_now) if effr_now is not None and current_mid > 0 else 0.0

        all_meetings = await get_fomc_meetings()
        upcoming = [m.decision for m in all_meetings if m.decision >= today][:6]
        meetings_source = "zq_heuristic"
        meetings: list[dict] = []
        cme = await fetch_fedwatch_meetings_cme(current_mid if current_mid > 0 else None)
        if cme:
            meetings, meetings_source = cme, "cme_fedwatch"
        elif curve and current_mid > 0:
            chain = meeting_probabilities(upcoming, curve, pre_rate)
            meetings = [_meeting_row(c, c["date"]) for c in chain]
            meetings_source = "zq_futures"
        if not meetings:
            meetings = _heuristic_meetings(upcoming[:5], current_mid, forward_rate)

        neutral = await self._neutral_from_db()
        settings = get_settings()
        rate_path_source = "extrapolation"
        market_now = front + offset if front is not None else forward_rate
        rate_path = _extrapolated_rate_path(current_mid, market_now, neutral)
        if settings.fred_api_key:
            market_year_end = {y: v + offset for (y, mth), v in curve.items() if mth == 12}
            sep_path, meta = await build_sep_rate_path_from_fred(
                api_key=settings.fred_api_key,
                current_mid=current_mid,
                market_now=market_now,
                market_year_end=market_year_end,
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
