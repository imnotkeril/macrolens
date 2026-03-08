import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.services.data_collector import DataCollector

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def run_alert_checks():
    """Run all alert checks after data collection."""
    from app.database import async_session
    from app.services.alert_service import AlertService
    from app.services.indicator_analyzer import IndicatorAnalyzer

    async with async_session() as db:
        analyzer = IndicatorAnalyzer(db)
        await analyzer.update_all_analytics()

        alert_service = AlertService(db)
        await alert_service.check_all()
        await db.commit()

    logger.info("Alert checks complete")


def start_scheduler():
    collector = DataCollector()

    # Daily: market data (yields, commodities, FX) at 18:00 UTC (after US market close)
    scheduler.add_job(collector.collect_daily_market_data, "cron", hour=18, minute=0, id="daily_market")

    # Daily: yield curve data
    scheduler.add_job(collector.collect_yield_data, "cron", hour=18, minute=5, id="daily_yields")

    # Daily: Fed funds rate
    scheduler.add_job(collector.collect_fed_data, "cron", hour=18, minute=10, id="daily_fed")

    # Weekly on Wednesday: MBA mortgage data
    scheduler.add_job(collector.collect_weekly_indicators, "cron", day_of_week="wed", hour=12, id="weekly_mba")

    # Weekly on Thursday: Initial Claims
    scheduler.add_job(collector.collect_weekly_indicators, "cron", day_of_week="thu", hour=12, id="weekly_claims")

    # Monthly on 1st & 15th: macro indicators (covers most release windows)
    scheduler.add_job(collector.collect_monthly_indicators, "cron", day="1,15", hour=14, id="monthly_macro")

    # Weekly: balance sheet data
    scheduler.add_job(collector.collect_balance_sheet, "cron", day_of_week="thu", hour=18, minute=15, id="weekly_bs")

    # Daily: alert checks after all data collection (18:30 UTC)
    scheduler.add_job(run_alert_checks, "cron", hour=18, minute=30, id="daily_alerts")

    scheduler.start()
    logger.info("Scheduler started with %d jobs", len(scheduler.get_jobs()))


def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler shut down")
