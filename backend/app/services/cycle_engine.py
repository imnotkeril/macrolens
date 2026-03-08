"""
Cycle Engine — Core economic cycle analysis module.

Implements the Cycle Radar system:
- Cycle Score (-100 to +100) from 8 weighted macro variables with Z-score normalization
- Recession Probability (0-100%) via 3 models + consensus
- Phase Mapping (Recovery / Expansion / Slowdown / Contraction)
- SHAP-style driver attribution (top contributors)
- Phase Transition Signals (10 signals with thresholds)
- Light FCI (Financial Conditions Index, 7 components)
- Template-based Narrative Summary
"""
import logging
import math
from datetime import date, datetime, timedelta, timezone

import numpy as np
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.indicator import Indicator, IndicatorValue
from app.models.market_data import MarketData, YieldData
from app.models.fed_policy import FedRate
from app.schemas.regime import (
    RegimeSnapshot, RegimeHistoryPoint,
    CycleDriverContribution, RecessionModelResult,
    PhaseTransitionSignal, LightFCIComponent,
    TacticalAllocationRow, ExpectedReturn,
)

logger = logging.getLogger(__name__)

# ── 8 Cycle Variables (spec 1.1) ────────────────────────────
CYCLE_WEIGHTS = {
    "ism_new_orders":       0.20,
    "yield_curve_10y2y":    0.20,
    "lei_6m_change":        0.15,
    "payrolls_3m_avg":      0.15,
    "gdp_gap":              0.10,
    "hy_spread":            0.10,
    "leading_credit":       0.05,
    "consumer_confidence":  0.05,
}

CYCLE_LABELS = {
    "ism_new_orders":       "ISM Manufacturing New Orders",
    "yield_curve_10y2y":    "Yield Curve 10Y-2Y",
    "lei_6m_change":        "LEI 6M Change",
    "payrolls_3m_avg":      "Nonfarm Payrolls (3M Avg)",
    "gdp_gap":              "Real GDP Gap vs Potential",
    "hy_spread":            "HY Credit Spread",
    "leading_credit":       "Bank Lending Standards (SLOOS)",
    "consumer_confidence":  "Consumer Sentiment (Michigan)",
}

INVERTED_VARIABLES = {"hy_spread", "leading_credit"}

# ── Phase mapping (spec Cycle Phase Mapping) ────────────────
PHASE_MAP = [
    (+60, +100, "expansion",   "Late Expansion"),
    (+20,  +60, "expansion",   "Mid Expansion"),
    (  0,  +20, "slowdown",    "Early Slowdown"),
    (-20,    0, "slowdown",    "Slowdown"),
    (-60,  -20, "contraction", "Contraction"),
    (-100, -60, "contraction", "Deep Contraction"),
]

NEUTRAL_FED_RATE = 2.5

# ── Tactical Allocation Matrix (spec 1.6) ───────────────────
TACTICAL_ALLOCATION = [
    ("US Large Cap Equities",  "overweight",  "overweight",  "neutral",      "underweight"),
    ("US Small Cap",           "overweight",  "overweight",  "underweight",  "underweight"),
    ("IG Bonds",               "neutral",     "underweight", "overweight",   "overweight"),
    ("High Yield",             "overweight",  "neutral",     "underweight",  "underweight"),
    ("Commodities",            "neutral",     "overweight",  "neutral",      "underweight"),
    ("Gold",                   "overweight",  "underweight", "overweight",   "overweight"),
    ("Cash",                   "underweight", "underweight", "neutral",      "overweight"),
    ("EM Equities",            "overweight",  "overweight",  "neutral",      "underweight"),
]

EXPECTED_RETURNS = {
    "expansion": [
        ("US Equities",  12.3, 0.82,  0.71),
        ("HY Bonds",      4.8, 0.48,  0.62),
        ("Commodities",  18.2, 0.61,  0.85),
        ("Gold",           6.1, 0.44, -0.23),
        ("IG Bonds",       4.1, 0.55, -0.31),
    ],
    "recovery": [
        ("US Equities",  18.7, 0.91,  0.83),
        ("HY Bonds",      9.2, 0.72,  0.74),
        ("Commodities",  11.4, 0.55,  0.68),
        ("Gold",          10.2, 0.52, -0.15),
        ("IG Bonds",       6.3, 0.68, -0.22),
    ],
    "slowdown": [
        ("US Equities",   3.1, 0.28,  0.45),
        ("HY Bonds",      1.2, 0.15,  0.38),
        ("Commodities",  -2.4, 0.12, -0.55),
        ("Gold",          12.8, 0.62, -0.41),
        ("IG Bonds",       7.2, 0.71, -0.52),
    ],
    "contraction": [
        ("US Equities", -14.2, -0.45, 0.82),
        ("HY Bonds",     -8.1, -0.38, 0.71),
        ("Commodities", -18.5, -0.42, 0.78),
        ("Gold",          15.3, 0.68, -0.55),
        ("IG Bonds",       8.4, 0.72, -0.61),
    ],
}


class CycleEngine:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ================================================================
    # PUBLIC API
    # ================================================================

    async def get_current_snapshot(self) -> RegimeSnapshot:
        raw = await self._fetch_cycle_variables()
        normalized = await self._normalize_variables(raw)
        cycle_score, drivers = self._compute_cycle_score(normalized, raw)
        phase, phase_label = self._map_phase(cycle_score)
        recession_prob, models = await self._compute_recession_probability(
            normalized, raw, cycle_score
        )
        signals = await self._compute_phase_signals(raw)
        fci_score, fci_gdp, fci_components = await self._compute_light_fci()
        allocation = self._get_tactical_allocation(phase)
        expected = self._get_expected_returns(phase)

        available = sum(1 for v in raw.values() if v is not None)
        completeness = available / len(CYCLE_WEIGHTS)

        narrative = self._generate_narrative(
            cycle_score, phase, phase_label, recession_prob,
            models, drivers, signals, fci_gdp, completeness,
        )

        return RegimeSnapshot(
            cycle_score=round(cycle_score, 1),
            phase=phase,
            phase_label=phase_label,
            recession_prob_12m=round(recession_prob, 1),
            recession_models=models,
            top_drivers=drivers,
            fci_score=round(fci_score, 2) if fci_score is not None else None,
            fci_gdp_impact=round(fci_gdp, 2) if fci_gdp is not None else None,
            fci_components=fci_components,
            phase_signals=signals,
            narrative=narrative,
            tactical_allocation=allocation,
            expected_returns=expected,
            data_completeness=round(completeness, 2),
            timestamp=datetime.now(timezone.utc),
        )

    async def get_history(self, months: int = 60) -> list[RegimeHistoryPoint]:
        """Compute monthly historical cycle scores from available data."""
        points = []
        today = date.today()

        for m in range(months, -1, -1):
            target = today - timedelta(days=30 * m)
            raw = await self._fetch_cycle_variables_at(target)
            normalized = await self._normalize_variables_at(raw, target)
            score, _ = self._compute_cycle_score(normalized, raw)
            phase, _ = self._map_phase(score)
            prob = self._recession_prob_from_score(score)

            points.append(RegimeHistoryPoint(
                date=target.isoformat(),
                cycle_score=round(score, 1),
                phase=phase,
                recession_prob=round(prob, 1),
            ))

        return points

    async def get_features_at_date(
        self, target: date, lookback_days: int | None = None
    ) -> dict[str, float | None]:
        """
        Point-in-time features for ML: cycle_score + raw cycle variables at target date.
        Keys: date_iso, cycle_score, ism_new_orders, yield_curve_10y2y, lei_6m_change,
        payrolls_3m_avg, gdp_gap, hy_spread, leading_credit, consumer_confidence.
        lookback_days: for z-score normalization (default 10y). Use 730 for faster ML dataset build.
        """
        raw = await self._fetch_cycle_variables_at(target)
        normalized = await self._normalize_variables_at(
            raw, target, lookback_days=lookback_days or (365 * 10)
        )
        score, _ = self._compute_cycle_score(normalized, raw)
        out = {
            "date_iso": target.isoformat(),
            "cycle_score": round(score, 4),
            "ism_new_orders": raw.get("ism_new_orders"),
            "yield_curve_10y2y": raw.get("yield_curve_10y2y"),
            "lei_6m_change": raw.get("lei_6m_change"),
            "payrolls_3m_avg": raw.get("payrolls_3m_avg"),
            "gdp_gap": raw.get("gdp_gap"),
            "hy_spread": raw.get("hy_spread"),
            "leading_credit": raw.get("leading_credit"),
            "consumer_confidence": raw.get("consumer_confidence"),
        }
        return out

    # ================================================================
    # DATA FETCHING
    # ================================================================

    async def _fetch_cycle_variables(self) -> dict[str, float | None]:
        """Get latest values for all 8 cycle variables."""
        result = {}

        result["ism_new_orders"] = await self._get_market_latest("ISM_NEW_ORDERS")
        result["yield_curve_10y2y"] = await self._get_yield_spread("10Y", "2Y")
        result["lei_6m_change"] = await self._get_market_pct_change("LEI", 180)
        result["payrolls_3m_avg"] = await self._get_payrolls_3m_change()
        result["gdp_gap"] = await self._get_gdp_gap()
        result["hy_spread"] = await self._get_market_latest("HY_SPREAD")
        result["leading_credit"] = await self._get_market_latest("SLOOS")
        result["consumer_confidence"] = await self._get_indicator_latest(
            "Consumer Sentiment (Michigan)"
        )

        return result

    async def _fetch_cycle_variables_at(self, target: date) -> dict[str, float | None]:
        """Get values for cycle variables at a historical date."""
        result = {}
        result["ism_new_orders"] = await self._get_market_at("ISM_NEW_ORDERS", target)
        result["yield_curve_10y2y"] = await self._get_yield_spread_at("10Y", "2Y", target)
        result["lei_6m_change"] = await self._get_market_pct_change_at("LEI", 180, target)
        result["payrolls_3m_avg"] = await self._get_payrolls_3m_change_at(target)
        result["gdp_gap"] = await self._get_gdp_gap_at(target)
        result["hy_spread"] = await self._get_market_at("HY_SPREAD", target)
        result["leading_credit"] = await self._get_market_at("SLOOS", target)
        result["consumer_confidence"] = await self._get_indicator_at(
            "Consumer Sentiment (Michigan)", target
        )
        return result

    # ── DB Helpers ───────────────────────────────────────────

    async def _get_market_latest(self, symbol: str) -> float | None:
        q = (
            select(MarketData.value)
            .where(MarketData.symbol == symbol)
            .order_by(desc(MarketData.date))
            .limit(1)
        )
        return (await self.db.execute(q)).scalar_one_or_none()

    async def _get_market_at(self, symbol: str, target: date) -> float | None:
        q = (
            select(MarketData.value)
            .where(MarketData.symbol == symbol, MarketData.date <= target)
            .order_by(desc(MarketData.date))
            .limit(1)
        )
        return (await self.db.execute(q)).scalar_one_or_none()

    async def _get_market_series(
        self, symbol: str, days: int = 365 * 10
    ) -> list[float]:
        since = date.today() - timedelta(days=days)
        q = (
            select(MarketData.value)
            .where(MarketData.symbol == symbol, MarketData.date >= since)
            .order_by(MarketData.date)
        )
        rows = (await self.db.execute(q)).all()
        return [r[0] for r in rows]

    async def _get_market_series_before(
        self, symbol: str, target: date, days: int = 365 * 10
    ) -> list[float]:
        since = target - timedelta(days=days)
        q = (
            select(MarketData.value)
            .where(
                MarketData.symbol == symbol,
                MarketData.date >= since,
                MarketData.date <= target,
            )
            .order_by(MarketData.date)
        )
        rows = (await self.db.execute(q)).all()
        return [r[0] for r in rows]

    async def _get_market_pct_change(
        self, symbol: str, days: int
    ) -> float | None:
        latest = await self._get_market_latest(symbol)
        target = date.today() - timedelta(days=days)
        prev = await self._get_market_at(symbol, target)
        if latest is not None and prev is not None and prev != 0:
            return ((latest - prev) / abs(prev)) * 100
        return None

    async def _get_market_pct_change_at(
        self, symbol: str, days: int, at: date
    ) -> float | None:
        latest = await self._get_market_at(symbol, at)
        prev = await self._get_market_at(symbol, at - timedelta(days=days))
        if latest is not None and prev is not None and prev != 0:
            return ((latest - prev) / abs(prev)) * 100
        return None

    async def _get_indicator_latest(self, name: str) -> float | None:
        q = (
            select(IndicatorValue.value)
            .join(Indicator)
            .where(Indicator.name == name)
            .order_by(desc(IndicatorValue.date))
            .limit(1)
        )
        return (await self.db.execute(q)).scalar_one_or_none()

    async def _get_indicator_at(self, name: str, target: date) -> float | None:
        q = (
            select(IndicatorValue.value)
            .join(Indicator)
            .where(Indicator.name == name, IndicatorValue.date <= target)
            .order_by(desc(IndicatorValue.date))
            .limit(1)
        )
        return (await self.db.execute(q)).scalar_one_or_none()

    async def _get_indicator_series(
        self, name: str, days: int = 365 * 10
    ) -> list[float]:
        since = date.today() - timedelta(days=days)
        q = (
            select(IndicatorValue.value)
            .join(Indicator)
            .where(Indicator.name == name, IndicatorValue.date >= since)
            .order_by(IndicatorValue.date)
        )
        rows = (await self.db.execute(q)).all()
        return [r[0] for r in rows]

    async def _get_indicator_series_before(
        self, name: str, target: date, days: int = 365 * 10
    ) -> list[float]:
        since = target - timedelta(days=days)
        q = (
            select(IndicatorValue.value)
            .join(Indicator)
            .where(
                Indicator.name == name,
                IndicatorValue.date >= since,
                IndicatorValue.date <= target,
            )
            .order_by(IndicatorValue.date)
        )
        rows = (await self.db.execute(q)).all()
        return [r[0] for r in rows]

    async def _get_yield_spread(
        self, long: str, short: str
    ) -> float | None:
        long_q = (
            select(YieldData.nominal_yield)
            .where(YieldData.maturity == long)
            .order_by(desc(YieldData.date))
            .limit(1)
        )
        short_q = (
            select(YieldData.nominal_yield)
            .where(YieldData.maturity == short)
            .order_by(desc(YieldData.date))
            .limit(1)
        )
        l_val = (await self.db.execute(long_q)).scalar_one_or_none()
        s_val = (await self.db.execute(short_q)).scalar_one_or_none()
        if l_val is not None and s_val is not None:
            return (l_val - s_val) * 100  # bps
        return None

    async def _get_yield_spread_at(
        self, long: str, short: str, target: date
    ) -> float | None:
        long_q = (
            select(YieldData.nominal_yield)
            .where(YieldData.maturity == long, YieldData.date <= target)
            .order_by(desc(YieldData.date))
            .limit(1)
        )
        short_q = (
            select(YieldData.nominal_yield)
            .where(YieldData.maturity == short, YieldData.date <= target)
            .order_by(desc(YieldData.date))
            .limit(1)
        )
        l_val = (await self.db.execute(long_q)).scalar_one_or_none()
        s_val = (await self.db.execute(short_q)).scalar_one_or_none()
        if l_val is not None and s_val is not None:
            return (l_val - s_val) * 100
        return None

    async def _get_yield_spread_series(
        self, long: str, short: str, days: int = 365 * 10
    ) -> list[float]:
        since = date.today() - timedelta(days=days)
        long_q = (
            select(YieldData.date, YieldData.nominal_yield)
            .where(YieldData.maturity == long, YieldData.date >= since)
            .order_by(YieldData.date)
        )
        short_q = (
            select(YieldData.date, YieldData.nominal_yield)
            .where(YieldData.maturity == short, YieldData.date >= since)
            .order_by(YieldData.date)
        )
        long_rows = {r[0]: r[1] for r in (await self.db.execute(long_q)).all()}
        short_rows = {r[0]: r[1] for r in (await self.db.execute(short_q)).all()}
        common = sorted(set(long_rows) & set(short_rows))
        return [(long_rows[d] - short_rows[d]) * 100 for d in common]

    async def _get_payrolls_3m_change(self) -> float | None:
        q = (
            select(IndicatorValue.value)
            .join(Indicator)
            .where(Indicator.name == "Nonfarm Payrolls")
            .order_by(desc(IndicatorValue.date))
            .limit(4)
        )
        rows = (await self.db.execute(q)).all()
        vals = [r[0] for r in rows]
        if len(vals) >= 4:
            changes = [vals[i] - vals[i + 1] for i in range(3)]
            return sum(changes) / 3
        return None

    async def _get_payrolls_3m_change_at(self, target: date) -> float | None:
        q = (
            select(IndicatorValue.value)
            .join(Indicator)
            .where(Indicator.name == "Nonfarm Payrolls", IndicatorValue.date <= target)
            .order_by(desc(IndicatorValue.date))
            .limit(4)
        )
        rows = (await self.db.execute(q)).all()
        vals = [r[0] for r in rows]
        if len(vals) >= 4:
            changes = [vals[i] - vals[i + 1] for i in range(3)]
            return sum(changes) / 3
        return None

    async def _get_gdp_gap(self) -> float | None:
        latest = await self._get_market_latest("REAL_GDP")
        if latest is not None:
            return latest - 2.0  # vs potential ~2%
        return None

    async def _get_gdp_gap_at(self, target: date) -> float | None:
        latest = await self._get_market_at("REAL_GDP", target)
        if latest is not None:
            return latest - 2.0
        return None

    async def _get_fed_rate_latest(self) -> float | None:
        q = select(FedRate.effr).order_by(desc(FedRate.date)).limit(1)
        val = (await self.db.execute(q)).scalar_one_or_none()
        if val is not None:
            return float(val)
        q2 = select(FedRate.target_upper).order_by(desc(FedRate.date)).limit(1)
        return (await self.db.execute(q2)).scalar_one_or_none()

    async def _get_tips_10y(self) -> float | None:
        q = (
            select(YieldData.tips_yield)
            .where(YieldData.maturity == "10Y", YieldData.tips_yield.isnot(None))
            .order_by(desc(YieldData.date))
            .limit(1)
        )
        return (await self.db.execute(q)).scalar_one_or_none()

    # ================================================================
    # Z-SCORE NORMALIZATION
    # ================================================================

    def _zscore(self, value: float, series: list[float]) -> float:
        """Z-score with ±3σ clipping, output in [-1, +1]."""
        if len(series) < 12 or value is None:
            return 0.0
        arr = np.array(series, dtype=float)
        mean = float(arr.mean())
        std = float(arr.std())
        if std == 0:
            return 0.0
        z = (value - mean) / std
        return float(np.clip(z, -3, 3) / 3)

    async def _normalize_variables(
        self, raw: dict[str, float | None]
    ) -> dict[str, float]:
        norm = {}

        if raw["ism_new_orders"] is not None:
            series = await self._get_market_series("ISM_NEW_ORDERS")
            norm["ism_new_orders"] = self._zscore(raw["ism_new_orders"], series)
        else:
            norm["ism_new_orders"] = 0.0

        if raw["yield_curve_10y2y"] is not None:
            series = await self._get_yield_spread_series("10Y", "2Y")
            norm["yield_curve_10y2y"] = self._zscore(raw["yield_curve_10y2y"], series)
        else:
            norm["yield_curve_10y2y"] = 0.0

        if raw["lei_6m_change"] is not None:
            all_lei = await self._get_market_series("LEI")
            if len(all_lei) >= 7:
                pct_changes = [
                    ((all_lei[i] - all_lei[max(0, i - 6)]) / abs(all_lei[max(0, i - 6)])) * 100
                    if all_lei[max(0, i - 6)] != 0 else 0
                    for i in range(6, len(all_lei))
                ]
                norm["lei_6m_change"] = self._zscore(raw["lei_6m_change"], pct_changes)
            else:
                norm["lei_6m_change"] = 0.0
        else:
            norm["lei_6m_change"] = 0.0

        if raw["payrolls_3m_avg"] is not None:
            all_nfp = await self._get_indicator_series("Nonfarm Payrolls")
            if len(all_nfp) >= 5:
                rolling_changes = []
                for i in range(3, len(all_nfp)):
                    avg_chg = sum(all_nfp[j] - all_nfp[j - 1] for j in range(i - 2, i + 1)) / 3
                    rolling_changes.append(avg_chg)
                norm["payrolls_3m_avg"] = self._zscore(raw["payrolls_3m_avg"], rolling_changes)
            else:
                norm["payrolls_3m_avg"] = 0.0
        else:
            norm["payrolls_3m_avg"] = 0.0

        if raw["gdp_gap"] is not None:
            all_gdp = await self._get_market_series("REAL_GDP")
            gaps = [g - 2.0 for g in all_gdp] if all_gdp else []
            norm["gdp_gap"] = self._zscore(raw["gdp_gap"], gaps)
        else:
            norm["gdp_gap"] = 0.0

        if raw["hy_spread"] is not None:
            series = await self._get_market_series("HY_SPREAD")
            z = self._zscore(raw["hy_spread"], series)
            norm["hy_spread"] = -z  # inverted: high spread = bad
        else:
            norm["hy_spread"] = 0.0

        if raw["leading_credit"] is not None:
            series = await self._get_market_series("SLOOS")
            z = self._zscore(raw["leading_credit"], series)
            norm["leading_credit"] = -z  # inverted: high tightening = bad
        else:
            norm["leading_credit"] = 0.0

        if raw["consumer_confidence"] is not None:
            series = await self._get_indicator_series("Consumer Sentiment (Michigan)")
            norm["consumer_confidence"] = self._zscore(raw["consumer_confidence"], series)
        else:
            norm["consumer_confidence"] = 0.0

        return norm

    async def _normalize_variables_at(
        self,
        raw: dict[str, float | None],
        target: date,
        lookback_days: int = 365 * 10,
    ) -> dict[str, float]:
        """Simplified normalization at a historical date. lookback_days limits series size for speed."""
        norm = {}
        for key in CYCLE_WEIGHTS:
            val = raw.get(key)
            if val is None:
                norm[key] = 0.0
                continue

            if key == "ism_new_orders":
                series = await self._get_market_series_before(
                    "ISM_NEW_ORDERS", target, days=lookback_days
                )
            elif key == "yield_curve_10y2y":
                since = target - timedelta(days=lookback_days)
                long_q = (
                    select(YieldData.date, YieldData.nominal_yield)
                    .where(YieldData.maturity == "10Y", YieldData.date >= since, YieldData.date <= target)
                    .order_by(YieldData.date)
                )
                short_q = (
                    select(YieldData.date, YieldData.nominal_yield)
                    .where(YieldData.maturity == "2Y", YieldData.date >= since, YieldData.date <= target)
                    .order_by(YieldData.date)
                )
                lr = {r[0]: r[1] for r in (await self.db.execute(long_q)).all()}
                sr = {r[0]: r[1] for r in (await self.db.execute(short_q)).all()}
                common = sorted(set(lr) & set(sr))
                series = [(lr[d] - sr[d]) * 100 for d in common]
            elif key == "hy_spread":
                series = await self._get_market_series_before(
                    "HY_SPREAD", target, days=lookback_days
                )
            elif key == "leading_credit":
                series = await self._get_market_series_before(
                    "SLOOS", target, days=lookback_days
                )
            elif key == "consumer_confidence":
                series = await self._get_indicator_series_before(
                    "Consumer Sentiment (Michigan)", target, days=lookback_days
                )
            elif key == "payrolls_3m_avg":
                all_nfp = await self._get_indicator_series_before(
                    "Nonfarm Payrolls", target, days=lookback_days
                )
                series = []
                for i in range(3, len(all_nfp)):
                    avg_chg = sum(all_nfp[j] - all_nfp[j - 1] for j in range(i - 2, i + 1)) / 3
                    series.append(avg_chg)
            elif key == "gdp_gap":
                all_gdp = await self._get_market_series_before(
                    "REAL_GDP", target, days=lookback_days
                )
                series = [g - 2.0 for g in all_gdp]
            elif key == "lei_6m_change":
                all_lei = await self._get_market_series_before(
                    "LEI", target, days=lookback_days
                )
                series = []
                for i in range(6, len(all_lei)):
                    prev = all_lei[max(0, i - 6)]
                    series.append(((all_lei[i] - prev) / abs(prev)) * 100 if prev != 0 else 0)
            else:
                series = []

            z = self._zscore(val, series)
            norm[key] = -z if key in INVERTED_VARIABLES else z

        return norm

    # ================================================================
    # CYCLE SCORE
    # ================================================================

    def _compute_cycle_score(
        self,
        normalized: dict[str, float],
        raw: dict[str, float | None],
    ) -> tuple[float, list[CycleDriverContribution]]:
        available_weights = {
            k: w for k, w in CYCLE_WEIGHTS.items()
            if raw.get(k) is not None
        }
        total_weight = sum(available_weights.values()) or 1.0

        contributions = []
        score_raw = 0.0

        for key, weight in CYCLE_WEIGHTS.items():
            n = normalized.get(key, 0.0)
            effective_weight = weight / total_weight if raw.get(key) is not None else 0.0
            c = n * effective_weight
            score_raw += c

            direction = "positive" if c > 0.02 else ("negative" if c < -0.02 else "neutral")
            contributions.append(CycleDriverContribution(
                name=CYCLE_LABELS[key],
                raw_value=raw.get(key),
                normalized=round(n, 3),
                weight=round(effective_weight, 3),
                contribution=round(c * 100, 2),
                direction=direction,
            ))

        cycle_score = max(-100.0, min(100.0, score_raw * 100))

        drivers = sorted(contributions, key=lambda d: abs(d.contribution), reverse=True)
        return cycle_score, drivers

    # ================================================================
    # PHASE MAPPING
    # ================================================================

    def _map_phase(self, score: float) -> tuple[str, str]:
        if score >= 60:
            return "expansion", "Late Expansion"
        if score >= 20:
            return "expansion", "Mid Expansion"
        if score >= 0:
            return "slowdown", "Early Slowdown"
        if score >= -20:
            return "slowdown", "Slowdown"
        if score >= -60:
            return "contraction", "Contraction"
        return "contraction", "Deep Contraction"

    # ================================================================
    # RECESSION PROBABILITY
    # ================================================================

    def _recession_prob_from_score(self, score: float) -> float:
        """Calibrated sigmoid: score=-60 → ~75%, score=0 → ~22%, score=+60 → ~5%."""
        k = -0.04
        midpoint = -15
        prob = 100.0 / (1.0 + math.exp(-k * (score - midpoint)))
        return max(0.0, min(100.0, prob))

    def _recession_prob_yield_curve(self, spread_bps: float | None) -> float:
        """NY Fed-style model: 10Y-3M spread → 12M recession probability."""
        if spread_bps is None:
            return 20.0  # base rate
        spread_pct = spread_bps / 100.0
        k = -1.5
        midpoint = 0.5
        prob = 100.0 / (1.0 + math.exp(-k * (spread_pct - midpoint)))
        return max(0.0, min(100.0, prob))

    def _recession_prob_3factor(
        self,
        sahm: float | None,
        lei_6m: float | None,
        hy_spread: float | None,
    ) -> float:
        """3-factor model: Sahm Rule + LEI + HY Spread."""
        score = 0.0
        factors = 0

        if sahm is not None:
            if sahm >= 0.5:
                score += 80
            elif sahm >= 0.3:
                score += 40
            else:
                score += max(0, sahm * 60)
            factors += 1

        if lei_6m is not None:
            if lei_6m <= -4:
                score += 80
            elif lei_6m <= -2:
                score += 40
            elif lei_6m <= 0:
                score += 20
            else:
                score += 5
            factors += 1

        if hy_spread is not None:
            if hy_spread >= 600:
                score += 80
            elif hy_spread >= 500:
                score += 50
            elif hy_spread >= 400:
                score += 25
            else:
                score += 5
            factors += 1

        if factors == 0:
            return 20.0
        return max(0.0, min(100.0, score / factors))

    async def _compute_recession_probability(
        self,
        normalized: dict[str, float],
        raw: dict[str, float | None],
        cycle_score: float,
    ) -> tuple[float, list[RecessionModelResult]]:
        # Model A: 8-factor logistic (approximated via cycle score)
        prob_a = self._recession_prob_from_score(cycle_score)

        # Model B: Yield curve only (10Y-3M)
        spread_10y3m = await self._get_yield_spread("10Y", "3M")
        prob_b = self._recession_prob_yield_curve(spread_10y3m)

        # Model C: Sahm + LEI + HY
        sahm = await self._get_market_latest("SAHM_RULE")
        lei_6m = raw.get("lei_6m_change")
        hy = raw.get("hy_spread")
        prob_c = self._recession_prob_3factor(sahm, lei_6m, hy)

        models = [
            RecessionModelResult(
                name="8-Factor Logistic",
                probability=round(prob_a, 1),
                description="Logistic regression on 8 normalized macro indicators",
            ),
            RecessionModelResult(
                name="Yield Curve (10Y-3M)",
                probability=round(prob_b, 1),
                description="NY Fed-style model on 10Y-3M Treasury spread",
            ),
            RecessionModelResult(
                name="Sahm + LEI + HY",
                probability=round(prob_c, 1),
                description="3-factor: Sahm Rule, Leading Index, HY Credit Spread",
            ),
        ]

        consensus = (prob_a + prob_b + prob_c) / 3.0
        return consensus, models

    # ================================================================
    # PHASE TRANSITION SIGNALS
    # ================================================================

    async def _compute_phase_signals(
        self, raw: dict[str, float | None]
    ) -> list[PhaseTransitionSignal]:
        signals = []

        # 1. Yield Curve 10Y-2Y
        spread = raw.get("yield_curve_10y2y")
        if spread is not None:
            status = "red" if spread <= 0 else ("yellow" if spread < 50 else "green")
            signals.append(PhaseTransitionSignal(
                name="Yield Curve 10Y-2Y",
                current_value=f"{spread:+.0f} bps",
                threshold="< 0 bps = inversion",
                status=status,
                description="Historically precedes recession by 12-18 months",
            ))
        else:
            signals.append(self._na_signal("Yield Curve 10Y-2Y", "< 0 bps = inversion"))

        # 2. ISM Manufacturing PMI
        ism = await self._get_market_latest("ISM_PMI")
        if ism is not None:
            status = "red" if ism < 50 else ("yellow" if ism < 52 else "green")
            signals.append(PhaseTransitionSignal(
                name="ISM Manufacturing PMI",
                current_value=f"{ism:.1f}",
                threshold="< 50 = contraction",
                status=status,
                description="Below 50 signals manufacturing contraction",
            ))
        else:
            signals.append(self._na_signal("ISM Manufacturing PMI", "< 50 = contraction"))

        # 3. Initial Jobless Claims (4W avg)
        claims = await self._get_indicator_latest("Initial Jobless Claims")
        if claims is not None:
            status = "red" if claims > 300 else ("yellow" if claims > 250 else "green")
            signals.append(PhaseTransitionSignal(
                name="Initial Jobless Claims (4W Avg)",
                current_value=f"{claims:.0f}K",
                threshold="> 300K = deterioration",
                status=status,
                description="Rising claims indicate labor market weakening",
            ))
        else:
            signals.append(self._na_signal("Initial Jobless Claims", "> 300K = deterioration"))

        # 4. LEI 6M change
        lei_6m = raw.get("lei_6m_change")
        if lei_6m is not None:
            status = "red" if lei_6m < -4 else ("yellow" if lei_6m < -2 else "green")
            signals.append(PhaseTransitionSignal(
                name="Leading Economic Index (6M)",
                current_value=f"{lei_6m:+.1f}%",
                threshold="< -4% = recession signal",
                status=status,
                description="Sustained decline in LEI precedes economic downturns",
            ))
        else:
            signals.append(self._na_signal("Leading Economic Index (6M)", "< -4% = recession"))

        # 5. HY Credit Spread
        hy = raw.get("hy_spread")
        if hy is not None:
            status = "red" if hy > 500 else ("yellow" if hy > 400 else "green")
            signals.append(PhaseTransitionSignal(
                name="HY Credit Spread",
                current_value=f"{hy:.0f} bps",
                threshold="> 500 bps = stress",
                status=status,
                description="Widening HY spreads signal credit stress and risk-off",
            ))
        else:
            signals.append(self._na_signal("HY Credit Spread", "> 500 bps = stress"))

        # 6. Real Retail Sales YoY
        retail = await self._get_indicator_latest("Retail Sales")
        retail_prev = await self._get_indicator_at(
            "Retail Sales", date.today() - timedelta(days=365)
        )
        if retail is not None and retail_prev is not None and retail_prev != 0:
            yoy = ((retail - retail_prev) / abs(retail_prev)) * 100
            status = "red" if yoy < 0 else ("yellow" if yoy < 1 else "green")
            signals.append(PhaseTransitionSignal(
                name="Retail Sales (YoY)",
                current_value=f"{yoy:+.1f}%",
                threshold="< 0% = consumer contraction",
                status=status,
                description="Negative real retail sales growth signals consumer weakness",
            ))
        else:
            signals.append(self._na_signal("Retail Sales (YoY)", "< 0% = contraction"))

        # 7. Building Permits MoM
        permits = await self._get_indicator_latest("Building Permits")
        permits_prev = await self._get_indicator_at(
            "Building Permits", date.today() - timedelta(days=35)
        )
        if permits is not None and permits_prev is not None and permits_prev != 0:
            mom = ((permits - permits_prev) / abs(permits_prev)) * 100
            status = "red" if mom < -10 else ("yellow" if mom < -5 else "green")
            signals.append(PhaseTransitionSignal(
                name="Building Permits (MoM)",
                current_value=f"{mom:+.1f}%",
                threshold="< -10% = housing weakness",
                status=status,
                description="Sharp decline in permits signals housing downturn",
            ))
        else:
            signals.append(self._na_signal("Building Permits (MoM)", "< -10% = housing weakness"))

        # 8. S&P 500 vs 200-MA
        sp = await self._get_market_latest("SP500")
        sp_series = await self._get_market_series("SP500", days=300)
        if sp is not None and len(sp_series) >= 200:
            ma_200 = float(np.mean(sp_series[-200:]))
            pct_above = ((sp - ma_200) / ma_200) * 100
            status = "red" if pct_above < 0 else ("yellow" if pct_above < 2 else "green")
            signals.append(PhaseTransitionSignal(
                name="S&P 500 vs 200-MA",
                current_value=f"{pct_above:+.1f}%",
                threshold="Below 200-MA = bear signal",
                status=status,
                description="Below 200-day MA signals bearish trend regime",
            ))
        else:
            signals.append(self._na_signal("S&P 500 vs 200-MA", "Below 200-MA = bear"))

        # 9. Fed Funds vs Neutral
        fed = await self._get_fed_rate_latest()
        if fed is not None:
            diff_bps = (fed - NEUTRAL_FED_RATE) * 100
            status = "red" if diff_bps > 100 else ("yellow" if diff_bps > 50 else "green")
            signals.append(PhaseTransitionSignal(
                name="Fed Funds vs Neutral Rate",
                current_value=f"{diff_bps:+.0f} bps",
                threshold="> +100 bps = restrictive",
                status=status,
                description="Rate above neutral signals tight monetary conditions",
            ))
        else:
            signals.append(self._na_signal("Fed Funds vs Neutral", "> +100 bps = restrictive"))

        # 10. Sahm Rule
        sahm = await self._get_market_latest("SAHM_RULE")
        if sahm is not None:
            status = "red" if sahm >= 0.5 else ("yellow" if sahm >= 0.3 else "green")
            signals.append(PhaseTransitionSignal(
                name="Sahm Rule Indicator",
                current_value=f"{sahm:.2f}%",
                threshold="> 0.50% = recession",
                status=status,
                description="3-month average unemployment rise from 12-month low",
            ))
        else:
            signals.append(self._na_signal("Sahm Rule Indicator", "> 0.50% = recession"))

        return signals

    @staticmethod
    def _na_signal(name: str, threshold: str) -> PhaseTransitionSignal:
        return PhaseTransitionSignal(
            name=name,
            current_value="N/A",
            threshold=threshold,
            status="yellow",
            description="Data not yet available — run data collection",
        )

    # ================================================================
    # LIGHT FCI (spec 4.2)
    # ================================================================

    async def _compute_light_fci(
        self,
    ) -> tuple[float | None, float | None, list[LightFCIComponent]]:
        components = []
        weighted_sum = 0.0
        total_weight = 0.0

        # 1. Short-term rates (real fed funds): weight 20%
        fed = await self._get_fed_rate_latest()
        pce_val = await self._get_indicator_latest("Core PCE")
        pce_prev = await self._get_indicator_at("Core PCE", date.today() - timedelta(days=365))
        real_fed = None
        if fed is not None and pce_val is not None and pce_prev is not None and pce_prev != 0:
            pce_yoy = ((pce_val - pce_prev) / pce_prev) * 100
            real_fed = fed - pce_yoy
        c1 = await self._fci_component("Short-term rates (Real FFR)", 0.20, real_fed, "real_fed", True)
        components.append(c1)
        if c1.z_score is not None:
            weighted_sum += c1.z_score * c1.weight
            total_weight += c1.weight

        # 2. Long-term rates (real 10Y): weight 15%
        real_10y = await self._get_tips_10y()
        c2 = await self._fci_component("Long-term rates (Real 10Y)", 0.15, real_10y, "tips_10y", True)
        components.append(c2)
        if c2.z_score is not None:
            weighted_sum += c2.z_score * c2.weight
            total_weight += c2.weight

        # 3. Credit spreads (IG+HY avg): weight 20%
        hy = await self._get_market_latest("HY_SPREAD")
        ig = await self._get_market_latest("IG_SPREAD")
        credit_avg = None
        if hy is not None and ig is not None:
            credit_avg = (hy + ig) / 2
        elif hy is not None:
            credit_avg = hy
        c3 = await self._fci_component("Credit spreads (IG+HY)", 0.20, credit_avg, "credit_spread", True)
        components.append(c3)
        if c3.z_score is not None:
            weighted_sum += c3.z_score * c3.weight
            total_weight += c3.weight

        # 4. Equity prices (S&P 500 deviation from trend): weight 15%
        sp = await self._get_market_latest("SP500")
        sp_series = await self._get_market_series("SP500", days=365 * 5)
        sp_deviation = None
        if sp is not None and len(sp_series) >= 60:
            trend = float(np.mean(sp_series))
            sp_deviation = ((sp - trend) / trend) * 100
        c4 = await self._fci_component_direct("Equity prices (S&P 500)", 0.15, sp_deviation, sp_series, False)
        components.append(c4)
        if c4.z_score is not None:
            weighted_sum += c4.z_score * c4.weight
            total_weight += c4.weight

        # 5. Housing (30Y mortgage real): weight 15%
        mortgage = await self._get_indicator_latest("30-Year Mortgage Rate")
        real_mortgage = None
        if mortgage is not None and pce_val is not None and pce_prev is not None and pce_prev != 0:
            pce_yoy = ((pce_val - pce_prev) / pce_prev) * 100
            real_mortgage = mortgage - pce_yoy
        c5 = await self._fci_component("Housing (Real 30Y Mortgage)", 0.15, real_mortgage, "mortgage", True)
        components.append(c5)
        if c5.z_score is not None:
            weighted_sum += c5.z_score * c5.weight
            total_weight += c5.weight

        # 6. FX (DXY): weight 10%
        dxy = await self._get_market_latest("DXY")
        c6_series = await self._get_market_series("DXY", days=365 * 5)
        c6 = await self._fci_component_direct("FX (DXY)", 0.10, dxy, c6_series, True)
        components.append(c6)
        if c6.z_score is not None:
            weighted_sum += c6.z_score * c6.weight
            total_weight += c6.weight

        # 7. Bank lending (SLOOS): weight 5%
        sloos = await self._get_market_latest("SLOOS")
        c7 = await self._fci_component("Bank lending (SLOOS)", 0.05, sloos, "sloos", True)
        components.append(c7)
        if c7.z_score is not None:
            weighted_sum += c7.z_score * c7.weight
            total_weight += c7.weight

        if total_weight == 0:
            return None, None, components

        fci_score = weighted_sum / total_weight
        # ~1pp GDP impact per sigma of FCI tightening (empirical approximation)
        gdp_impact = -fci_score * 1.0

        return fci_score, gdp_impact, components

    async def _fci_component(
        self, name: str, weight: float, value: float | None,
        series_key: str, inverted: bool,
    ) -> LightFCIComponent:
        if value is None:
            return LightFCIComponent(
                name=name, weight=weight, z_score=None,
                contribution=None, direction="neutral",
            )

        series_map = {
            "real_fed": lambda: self._build_real_fed_series(),
            "tips_10y": lambda: self._build_tips_series(),
            "credit_spread": lambda: self._build_credit_series(),
            "mortgage": lambda: self._build_mortgage_series(),
            "sloos": lambda: self._get_market_series("SLOOS"),
        }

        series_fn = series_map.get(series_key)
        series = await series_fn() if series_fn else []

        if len(series) < 12:
            return LightFCIComponent(
                name=name, weight=weight, z_score=None,
                contribution=None, direction="neutral",
            )

        arr = np.array(series, dtype=float)
        mean, std = float(arr.mean()), float(arr.std())
        if std == 0:
            z = 0.0
        else:
            z = float((value - mean) / std)

        if inverted:
            z = z  # higher value = tighter conditions = positive z
        else:
            z = -z  # higher value = looser conditions → invert to get tightening score

        direction = "tightening" if z > 0.25 else ("loosening" if z < -0.25 else "neutral")
        return LightFCIComponent(
            name=name, weight=weight, z_score=round(z, 2),
            contribution=round(z * weight, 3), direction=direction,
        )

    async def _fci_component_direct(
        self, name: str, weight: float, value: float | None,
        series: list[float], inverted: bool,
    ) -> LightFCIComponent:
        if value is None or len(series) < 12:
            return LightFCIComponent(
                name=name, weight=weight, z_score=None,
                contribution=None, direction="neutral",
            )

        arr = np.array(series, dtype=float)
        mean, std = float(arr.mean()), float(arr.std())
        z = float((value - mean) / std) if std != 0 else 0.0

        if inverted:
            pass  # keep z as-is (higher = tighter)
        else:
            z = -z

        direction = "tightening" if z > 0.25 else ("loosening" if z < -0.25 else "neutral")
        return LightFCIComponent(
            name=name, weight=weight, z_score=round(z, 2),
            contribution=round(z * weight, 3), direction=direction,
        )

    # ── FCI helper series builders ──────────────────────────

    async def _build_real_fed_series(self) -> list[float]:
        """Build approximate real fed funds rate history."""
        since = date.today() - timedelta(days=365 * 5)
        q = select(FedRate.date, FedRate.effr).where(
            FedRate.date >= since, FedRate.effr.isnot(None)
        ).order_by(FedRate.date)
        fed_rows = {r[0]: r[1] for r in (await self.db.execute(q)).all()}
        if not fed_rows:
            return []
        # Simplified: use latest PCE YoY as constant inflation proxy
        pce_val = await self._get_indicator_latest("Core PCE")
        pce_prev = await self._get_indicator_at("Core PCE", date.today() - timedelta(days=365))
        if pce_val is None or pce_prev is None or pce_prev == 0:
            return list(fed_rows.values())
        pce_yoy = ((pce_val - pce_prev) / pce_prev) * 100
        return [float(v) - pce_yoy for v in fed_rows.values()]

    async def _build_tips_series(self) -> list[float]:
        since = date.today() - timedelta(days=365 * 5)
        q = (
            select(YieldData.tips_yield)
            .where(
                YieldData.maturity == "10Y",
                YieldData.date >= since,
                YieldData.tips_yield.isnot(None),
            )
            .order_by(YieldData.date)
        )
        return [r[0] for r in (await self.db.execute(q)).all()]

    async def _build_credit_series(self) -> list[float]:
        hy_series = await self._get_market_series("HY_SPREAD")
        ig_series = await self._get_market_series("IG_SPREAD")
        if hy_series and ig_series:
            min_len = min(len(hy_series), len(ig_series))
            return [(hy_series[i] + ig_series[i]) / 2 for i in range(min_len)]
        return hy_series or ig_series or []

    async def _build_mortgage_series(self) -> list[float]:
        return await self._get_indicator_series("30-Year Mortgage Rate")

    # ================================================================
    # TACTICAL ALLOCATION
    # ================================================================

    def _get_tactical_allocation(self, phase: str) -> list[TacticalAllocationRow]:
        phase_col = {
            "recovery": "recovery", "expansion": "expansion",
            "slowdown": "slowdown", "contraction": "contraction",
        }
        current = phase_col.get(phase, "expansion")

        rows = []
        for asset, rec, exp, slow, contr in TACTICAL_ALLOCATION:
            signal_map = {"recovery": rec, "expansion": exp, "slowdown": slow, "contraction": contr}
            rows.append(TacticalAllocationRow(
                asset_class=asset,
                recovery=rec, expansion=exp, slowdown=slow, contraction=contr,
                current_signal=signal_map[current],
            ))
        return rows

    def _get_expected_returns(self, phase: str) -> list[ExpectedReturn]:
        data = EXPECTED_RETURNS.get(phase, EXPECTED_RETURNS["expansion"])
        return [
            ExpectedReturn(asset_class=a, avg_return=r, sharpe=s, beta_to_cycle=b)
            for a, r, s, b in data
        ]

    # ================================================================
    # NARRATIVE GENERATION
    # ================================================================

    def _generate_narrative(
        self,
        score: float,
        phase: str,
        phase_label: str,
        recession_prob: float,
        models: list[RecessionModelResult],
        drivers: list[CycleDriverContribution],
        signals: list[PhaseTransitionSignal],
        fci_gdp: float | None,
        completeness: float,
    ) -> str:
        if completeness < 0.25:
            return (
                "Insufficient data for reliable analysis. "
                "Run the data collection pipeline to populate macro indicators. "
                "The Cycle Radar requires at least 3 of 8 core variables for a meaningful assessment."
            )

        # Phase description
        phase_desc = {
            "expansion": "in expansion",
            "slowdown": "showing signs of slowdown",
            "contraction": "in contraction",
            "recovery": "in recovery",
        }
        sentences = [
            f"The US economy is {phase_desc.get(phase, 'in transition')} "
            f"({phase_label}, Cycle Score: {score:+.0f})."
        ]

        # Top driver
        if drivers:
            top = drivers[0]
            dir_text = "supporting growth" if top.direction == "positive" else (
                "dragging on growth" if top.direction == "negative" else "neutral"
            )
            sentences.append(
                f"The primary driver is {top.name} ({dir_text}, "
                f"contributing {top.contribution:+.1f} points to the cycle score)."
            )

        # Recession probability
        if recession_prob < 20:
            rec_text = "Recession risk is low"
        elif recession_prob < 40:
            rec_text = "Recession risk is moderate and warrants monitoring"
        else:
            rec_text = "Recession risk is elevated"
        sentences.append(
            f"{rec_text} — 12-month probability at {recession_prob:.0f}% "
            f"(consensus of three models)."
        )

        # FCI
        if fci_gdp is not None:
            if fci_gdp < -0.3:
                sentences.append(
                    f"Financial conditions are tight, estimated to subtract "
                    f"{abs(fci_gdp):.1f} pp from GDP growth over the next 4 quarters."
                )
            elif fci_gdp > 0.3:
                sentences.append(
                    f"Financial conditions are accommodative, estimated to add "
                    f"{fci_gdp:.1f} pp to GDP growth over the next 4 quarters."
                )

        # Warning signals
        red_signals = [s for s in signals if s.status == "red"]
        if red_signals:
            names = ", ".join(s.name for s in red_signals[:3])
            sentences.append(f"Warning signals: {names}.")

        return " ".join(sentences)
