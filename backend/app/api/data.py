import logging
import asyncio

from fastapi import APIRouter, HTTPException

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
