"""
Alert generation service — monitors conditions and creates alerts.

Alert types:
- Quadrant transition
- Indicator surprise (significant deviation from forecast)
- Yield curve inversion
- Recession checklist threshold (5+ of 8)
- VIX spike (>30)
- Fed rate change
"""
import logging
from datetime import date

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert, AlertType, AlertSeverity
from app.models.market_data import MarketData
from app.services.navigator_engine import NavigatorEngine
from app.services.yield_analyzer import YieldAnalyzer

logger = logging.getLogger(__name__)


class AlertService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def check_all(self):
        await self.check_vix_spike()
        await self.check_yield_curve_inversion()
        await self.check_recession_threshold()

    async def check_vix_spike(self):
        query = (
            select(MarketData.value)
            .where(MarketData.symbol == "VIX")
            .order_by(desc(MarketData.date))
            .limit(1)
        )
        result = await self.db.execute(query)
        vix = result.scalar_one_or_none()

        if vix and vix > 30:
            await self._create_alert_if_new(
                AlertType.VIX_SPIKE,
                AlertSeverity.WARNING,
                f"VIX Spike: {vix:.1f}",
                f"VIX has spiked above 30 to {vix:.1f}, indicating elevated fear. "
                f"Consider defensive positioning. VIX >40 = panic/potential major bottom.",
            )

        if vix and vix > 40:
            await self._create_alert_if_new(
                AlertType.VIX_SPIKE,
                AlertSeverity.CRITICAL,
                f"VIX Panic: {vix:.1f}",
                f"VIX at {vix:.1f} — extreme panic level. Historically a major bottom signal. "
                f"Watch for capitulation and potential reversal.",
            )

    async def check_yield_curve_inversion(self):
        analyzer = YieldAnalyzer(self.db)
        is_inverted = await analyzer.is_inverted()

        if is_inverted:
            await self._create_alert_if_new(
                AlertType.YIELD_CURVE_INVERSION,
                AlertSeverity.CRITICAL,
                "Yield Curve Inverted (2Y10Y)",
                "The 2Y-10Y Treasury spread has inverted. "
                "Historically, this predicts recession within 12-18 months with near 100% accuracy. "
                "Consider shifting to defensive positioning.",
            )

    async def check_recession_threshold(self):
        engine = NavigatorEngine(self.db)
        check = await engine.get_recession_check()

        if check.score >= 5:
            await self._create_alert_if_new(
                AlertType.RECESSION_THRESHOLD,
                AlertSeverity.CRITICAL,
                f"Recession Checklist: {check.score}/{check.total}",
                f"{check.score} of {check.total} recession indicators triggered. "
                f"High confidence recession signal. Typical lead time: 6-12 months. "
                f"Shift to Q4 (Stagflation) positioning: quality, defensives, cash, gold.",
            )

    async def create_quadrant_transition_alert(self, old_quadrant: str, new_quadrant: str):
        await self._create_alert_if_new(
            AlertType.QUADRANT_TRANSITION,
            AlertSeverity.WARNING,
            f"Quadrant Transition: {old_quadrant} → {new_quadrant}",
            f"Navigator has shifted from {old_quadrant} to {new_quadrant}. "
            f"Review factor and sector allocations. Quadrant transitions represent "
            f"the biggest opportunities — position before the market reprices.",
        )

    async def create_indicator_surprise_alert(self, indicator_name: str, surprise_pct: float):
        severity = AlertSeverity.CRITICAL if abs(surprise_pct) > 10 else AlertSeverity.WARNING
        direction = "beat" if surprise_pct > 0 else "miss"
        await self._create_alert_if_new(
            AlertType.INDICATOR_SURPRISE,
            severity,
            f"Indicator Surprise: {indicator_name} ({direction})",
            f"{indicator_name} came in with a {abs(surprise_pct):.1f}% {direction} vs forecast. "
            f"Significant surprises may shift category scores and quadrant positioning.",
        )

    async def _create_alert_if_new(
        self, alert_type: AlertType, severity: AlertSeverity, title: str, message: str,
    ):
        """Avoid duplicate alerts within same day."""
        existing = await self.db.execute(
            select(Alert).where(
                Alert.alert_type == alert_type,
                Alert.title == title,
                Alert.created_at >= date.today().isoformat(),
            )
        )
        if existing.scalar_one_or_none():
            return

        alert = Alert(alert_type=alert_type, severity=severity, title=title, message=message)
        self.db.add(alert)
        await self.db.flush()
        logger.info("Alert created: [%s] %s", severity.value, title)
