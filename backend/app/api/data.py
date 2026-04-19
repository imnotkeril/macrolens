import logging
import asyncio

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, func

from app.config import get_settings
from app.database import async_session
from app.models.indicator import Indicator
from app.services.data_collector import DataCollector
from app.services.progress_store import (
    init_refresh_progress,
    set_refresh_progress,
    get_refresh_progress,
)
from app.tasks.scheduler import run_alert_checks

logger = logging.getLogger(__name__)

router = APIRouter()

_refresh_lock = asyncio.Lock()


@router.get("/refresh-progress")
async def get_refresh_progress_endpoint():
    """Current data refresh progress: percent, phase, logs. Poll from frontend."""
    return get_refresh_progress()


@router.post("/backfill-history")
async def backfill_history(
    years: int | None = Query(
        None,
        ge=1,
        le=80,
        description="Rolling window in years from today; omit to use HISTORICAL_YEARS from settings.",
    ),
):
    """One-shot bulk load for the rolling window: all seeded indicators, yields, Fed, FX, market/regime/macro (FRED + Yahoo)."""
    if _refresh_lock.locked():
        raise HTTPException(status_code=409, detail="Another data job is already in progress")
    if not get_settings().fred_api_key:
        raise HTTPException(
            status_code=400,
            detail="FRED_API_KEY is not set; cannot run historical backfill.",
        )

    resolved = years if years is not None else get_settings().historical_years
    init_refresh_progress()

    async with _refresh_lock:
        collector = DataCollector(historical_years=resolved)
        errors: list[str] = []

        set_refresh_progress(
            phase="backfill_start",
            percent=0.0,
            message=f"Backfill: {resolved} years to today",
            log_line=f"[0%] Window = {resolved} years (rolling from today)",
        )

        try:
            async with async_session() as db:
                r = await db.execute(select(func.count(Indicator.id)))
                indicator_count = r.scalar() or 0
            if indicator_count == 0:
                set_refresh_progress(
                    phase="seed",
                    percent=2.0,
                    message="Seeding indicators…",
                    log_line="[2%] Seeding indicators…",
                )
                from app.seed import seed_indicators

                await seed_indicators()
                set_refresh_progress(log_line="[2%] Indicators seeded.")
        except Exception as e:
            logger.exception("Backfill seed failed")
            errors.append(f"seed: {str(e)}")
            set_refresh_progress(log_line=f"[2%] Seed failed: {e}", error=str(e))

        try:
            set_refresh_progress(
                phase="historical_bulk",
                percent=5.0,
                message="Bulk historical load (FRED + Yahoo)…",
                log_line="[5%] load_historical_data…",
            )
            await collector.load_historical_data()
            set_refresh_progress(
                percent=95.0,
                message="Bulk historical load finished.",
                log_line="[95%] load_historical_data done.",
            )
        except Exception as e:
            logger.exception("Backfill load_historical_data failed")
            errors.append(f"historical: {str(e)}")
            set_refresh_progress(log_line=f"[5%] Historical load failed: {e}", error=str(e))

        set_refresh_progress(
            percent=100.0,
            message="Backfill completed." if not errors else "Backfill completed with errors.",
            log_line="[100%] Done." if not errors else "[100%] Done with errors.",
            done=True,
            error="; ".join(errors) if errors else None,
        )

    return {
        "status": "completed" if not errors else "completed_with_errors",
        "historical_years": resolved,
        "errors": errors,
    }


@router.post("/refresh")
async def refresh_all_data():
    """Trigger a full data refresh (all collectors) on demand."""
    if _refresh_lock.locked():
        raise HTTPException(status_code=409, detail="Refresh already in progress")

    init_refresh_progress()
    total_steps = 8  # 7 collectors + alert_checks

    async with _refresh_lock:
        collector = DataCollector()
        errors: list[str] = []

        # Ensure indicators table is seeded (Economic Indicators + inflation data)
        try:
            async with async_session() as db:
                r = await db.execute(select(func.count(Indicator.id)))
                indicator_count = r.scalar() or 0
            if indicator_count == 0:
                set_refresh_progress(
                    phase="seed",
                    percent=0.0,
                    message="Seeding 30 indicators (first run)…",
                    log_line="[0%] Seeding indicators…",
                )
                from app.seed import seed_indicators
                await seed_indicators()
                set_refresh_progress(log_line="[0%] Indicators seeded.")
                logger.info("Seeded indicators (was 0)")
        except Exception as e:
            logger.exception("Indicator seed failed")
            errors.append(f"seed: {str(e)}")
            set_refresh_progress(log_line="[0%] Seed failed.", error=str(e))

        # If indicators have very little history, backfill from FRED so charts show full range
        try:
            if await collector.need_indicators_historical():
                set_refresh_progress(
                    phase="indicators_historical",
                    percent=0.0,
                    message="Backfilling indicator history from FRED…",
                    log_line="[0%] Backfilling indicators…",
                )
                await collector.load_historical_indicators_only()
                set_refresh_progress(log_line="[0%] Indicator backfill done.")
        except Exception as e:
            logger.exception("Indicator backfill failed")
            errors.append(f"indicators_historical: {str(e)}")
            set_refresh_progress(log_line="[0%] Indicator backfill failed.", error=str(e))

        # If DB has little history (regime/yield/fed), load historical data first so ML dataset can be built
        try:
            if await collector.needs_historical_load():
                set_refresh_progress(
                    phase="historical",
                    percent=0.0,
                    message="Loading historical data (first time or empty DB)…",
                    log_line="[0%] Loading historical data…",
                )
                await collector.load_historical_data()
                set_refresh_progress(log_line="[0%] Historical data loaded.")
        except Exception as e:
            logger.exception("Historical data load failed")
            errors.append(f"historical: {str(e)}")
            set_refresh_progress(log_line=f"[0%] Historical load failed: {e}", error=str(e))

        steps = [
            ("daily_market", collector.collect_daily_market_data),
            ("yield_data", collector.collect_yield_data),
            ("fed_data", collector.collect_fed_data),
            ("weekly_indicators", collector.collect_weekly_indicators),
            ("monthly_indicators", collector.collect_monthly_indicators),
            ("balance_sheet", collector.collect_balance_sheet),
            ("regime", collector.collect_regime_data),
        ]

        for i, (name, fn) in enumerate(steps):
            pct = (i / total_steps) * 100.0
            set_refresh_progress(
                phase=name,
                percent=pct,
                message=f"Loading {name}…",
                log_line=f"[{pct:.0f}%] Starting {name}…",
            )
            try:
                await fn()
                logger.info("Refresh step '%s' completed", name)
                set_refresh_progress(log_line=f"[{pct:.0f}%] {name} completed.")
            except Exception as e:
                logger.exception("Refresh step '%s' failed", name)
                errors.append(f"{name}: {str(e)}")
                set_refresh_progress(log_line=f"[{pct:.0f}%] {name} failed: {e}")

        # Alert checks
        set_refresh_progress(
            phase="alert_checks",
            percent=(7 / total_steps) * 100.0,
            message="Running alert checks…",
            log_line="[87%] Starting alert_checks…",
        )
        try:
            await run_alert_checks()
            set_refresh_progress(log_line="[87%] alert_checks completed.")
        except Exception as e:
            logger.exception("Alert checks failed during refresh")
            errors.append(f"alert_checks: {str(e)}")
            set_refresh_progress(log_line=f"[87%] alert_checks failed: {e}")

        set_refresh_progress(
            percent=100.0,
            message="Refresh completed." if not errors else "Refresh completed with errors.",
            log_line="[100%] Done." if not errors else "[100%] Done with errors.",
            done=True,
            error="; ".join(errors) if errors else None,
        )

    return {
        "status": "completed" if not errors else "completed_with_errors",
        "errors": errors,
    }
