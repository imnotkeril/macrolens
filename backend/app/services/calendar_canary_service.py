from __future__ import annotations

import logging
from datetime import date, datetime, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.economic_calendar import EconomicCalendarEvent, SourceHealthMetric
from app.services.fred_client import INDICATOR_SERIES

logger = logging.getLogger(__name__)


class CalendarCanaryService:
    """Pulls external release dates from FRED API as canary economic calendar feed."""

    BASE_URL = "https://api.stlouisfed.org/fred"
    SOURCE = "fred_calendar_canary"

    def __init__(self):
        self.settings = get_settings()
        self._api_key = self.settings.fred_api_key

    async def collect(self, db: AsyncSession, days_ahead: int | None = None) -> dict[str, int]:
        if not self.settings.calendar_canary_enabled:
            return {"inserted": 0, "updated": 0, "skipped": 0}
        if not self._api_key:
            await self._write_health(db, 0.0, "down", "FRED_API_KEY missing")
            return {"inserted": 0, "updated": 0, "skipped": 0}

        days = days_ahead or self.settings.calendar_canary_days_ahead
        release_ids = await self._fetch_release_ids()

        inserted = 0
        updated = 0
        skipped = 0
        horizon = date.today() + timedelta(days=days)
        now = datetime.utcnow()

        for release_id, release_name in release_ids.items():
            try:
                dates = await self._fetch_release_dates(release_id=release_id, end_date=horizon)
            except Exception:
                logger.exception("Calendar canary: failed release_id=%s", release_id)
                skipped += 1
                continue

            for event_day in dates:
                stmt = (
                    pg_insert(EconomicCalendarEvent)
                    .values(
                        source=self.SOURCE,
                        event_name=release_name,
                        event_date=event_day,
                        country="US",
                        frequency="event",
                        importance=2,
                        quality_status="ok",
                        published_at=now,
                    )
                    .on_conflict_do_update(
                        constraint="uq_economic_calendar_event",
                        set_={
                            "quality_status": "ok",
                            "published_at": now,
                        },
                    )
                )
                result = await db.execute(stmt)
                if result.rowcount and result.rowcount > 0:
                    updated += 1
                else:
                    inserted += 1

        status = "ok" if skipped == 0 else "degraded"
        note = f"events={inserted + updated}, skipped_releases={skipped}"
        await self._write_health(
            db=db,
            value=float(inserted + updated),
            status=status,
            note=note,
        )
        await db.commit()
        return {"inserted": inserted, "updated": updated, "skipped": skipped}

    async def get_upcoming(self, db: AsyncSession, days: int = 45) -> list[EconomicCalendarEvent]:
        end_day = date.today() + timedelta(days=days)
        q = (
            select(EconomicCalendarEvent)
            .where(
                EconomicCalendarEvent.source == self.SOURCE,
                EconomicCalendarEvent.event_date >= date.today(),
                EconomicCalendarEvent.event_date <= end_day,
            )
            .order_by(
                EconomicCalendarEvent.event_date.asc(), EconomicCalendarEvent.event_name.asc()
            )
            .limit(500)
        )
        res = await db.execute(q)
        return list(res.scalars().all())

    async def _fetch_release_ids(self) -> dict[int, str]:
        # Use a compact subset of major indicators to avoid excessive API calls.
        major_ids = [
            INDICATOR_SERIES["CPI"]["fred_id"],
            INDICATOR_SERIES["Core CPI"]["fred_id"],
            INDICATOR_SERIES["Unemployment Rate"]["fred_id"],
            INDICATOR_SERIES["Nonfarm Payrolls"]["fred_id"],
            INDICATOR_SERIES["Retail Sales"]["fred_id"],
            INDICATOR_SERIES["Industrial Production"]["fred_id"],
            INDICATOR_SERIES["Housing Starts"]["fred_id"],
            INDICATOR_SERIES["Building Permits"]["fred_id"],
            INDICATOR_SERIES["Core PCE"]["fred_id"],
        ]
        out: dict[int, str] = {}
        async with httpx.AsyncClient(timeout=30.0) as client:
            for sid in major_ids:
                resp = await client.get(
                    f"{self.BASE_URL}/series/release",
                    params={
                        "series_id": sid,
                        "api_key": self._api_key,
                        "file_type": "json",
                    },
                )
                resp.raise_for_status()
                payload = resp.json()
                releases = payload.get("releases", [])
                for item in releases:
                    rid = int(item["id"])
                    out[rid] = item.get("name", f"Release {rid}")
        return out

    async def _fetch_release_dates(self, release_id: int, end_date: date) -> list[date]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{self.BASE_URL}/release/dates",
                params={
                    "release_id": release_id,
                    "api_key": self._api_key,
                    "file_type": "json",
                    "realtime_start": date.today().isoformat(),
                    "realtime_end": end_date.isoformat(),
                    "include_release_dates_with_no_data": "true",
                },
            )
            resp.raise_for_status()
            payload = resp.json()
            rows = payload.get("release_dates", [])
            dates: list[date] = []
            for row in rows:
                day = row.get("date")
                if not day:
                    continue
                d = datetime.strptime(day, "%Y-%m-%d").date()
                if d >= date.today() and d <= end_date:
                    dates.append(d)
            return dates

    async def _write_health(self, db: AsyncSession, value: float, status: str, note: str) -> None:
        metric = SourceHealthMetric(
            source=self.SOURCE,
            metric_name="calendar_events_upcoming_count",
            metric_value=value,
            status=status,
            note=note,
        )
        db.add(metric)
