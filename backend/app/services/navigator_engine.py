"""
Trading Navigator — 2×2 matrix (macro sentiment × Fed policy plane).

Rule plane (same as Forecast Lab rule expert): for each as-of date,
`features_pit.build_feature_row` → growth_score, fed_policy_score →
`rule_phase.determine_quadrant` / phase_rule.yaml.

Five chart dots (now, 6m/1y back, 6m/1y forward extrapolated from PIT rule scores) use that plane.
Forecast Lab ensemble is overlay only (violet dot + API); it does not choose the quadrant for recommendations.

PIT as-of matches the Macro Dashboard Forecast Lab card: month-end on or before calendar today
(same as frontend getForecastLabSummary({ alignMonthEnd: true })), so ensemble caption and FL widget
share one snapshot date and probabilities.
"""
import logging
from datetime import date, timedelta

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.indicator import IndicatorCategory
from app.models.market_data import MarketData, YieldData
from app.services.indicator_analyzer import IndicatorAnalyzer
from app.services.fed_tracker import FedTracker
from app.services.yield_analyzer import YieldAnalyzer
from app.schemas.navigator import (
    NavigatorPosition,
    NavigatorRecommendation,
    NavigatorPhaseContext,
    NavigatorEnsembleOverlay,
    FactorAllocation,
    SectorAllocation,
    AssetAllocation,
    CrossAssetSignal,
    RecessionCheck,
    RecessionCheckItem,
    TradingRecommendation,
)
from app.services.navigator_yield_expectations import (
    curve_pattern_matches_quadrant,
    expected_curve_patterns_for_quadrant,
)
from app.services.navigator_cross_asset_expectations import confidence_from_cross_asset_signals

logger = logging.getLogger(__name__)

RECESSION_CHECKLIST_TOTAL = 8


def _dashboard_fl_pit_as_of() -> date:
    """Last month-end on or before today — aligns with dashboard FL summary (align_month_end=true)."""
    from app.services.forecast_lab.inference import _effective_as_of

    return _effective_as_of(date.today(), True)

# Factor -> representative ETFs/tickers for factor rotation
FACTOR_TICKERS: dict[str, list[str]] = {
    "Growth": ["VUG", "QQQ", "IVW", "SCHG"],
    "Value": ["VTV", "IVE", "IWD", "RPV"],
    "Quality": ["QUAL", "SPHQ", "DVY"],
    "Small Cap": ["IWM", "VB", "IJR"],
    "Large Cap": ["SPY", "IVV", "VOO"],
    "High Beta": ["SPHB", "HSPX"],
    "Low Vol": ["SPLV", "USMV", "LVOL"],
    "Cyclicals": ["XLY", "XLI", "XLB", "XLE"],
    "Defensives": ["XLP", "XLV", "XLU"],
}

# Trading ideas (spreads, pairs) by quadrant
TRADING_RECOMMENDATIONS_BY_QUADRANT: dict[str, list[tuple[str, str, str, str]]] = {
    "Q1_GOLDILOCKS": [
        ("Cyclicals vs Defensives", "pair", "Long XLY / Short XLP", "Cyclicals outperform in Risk ON; spread widens."),
        ("Small vs Large Cap", "pair", "Long IWM / Short SPY", "Small cap leverage to recovery."),
        ("High Beta vs Low Vol", "spread", "Long SPHB / Short SPLV", "Risk appetite expansion."),
        ("EM vs DM", "pair", "Long EEM / Short EFA", "EM benefits from weak dollar, risk-on."),
    ],
    "Q2_REFLATION": [
        ("Long duration bonds", "directional", "Long TLT, IEF", "Easy Fed supports long bonds."),
        ("Gold", "directional", "Long GLD, IAU", "Recession hedge, weak dollar."),
        ("Defensives overweight", "directional", "XLP, XLV, XLU", "Quality and defensives in weak growth."),
    ],
    "Q3_OVERHEATING": [
        ("Value vs Growth", "pair", "Long VTV / Short VUG", "Value outperforms in tight Fed, rising rates."),
        ("2Y-10Y steepener", "curve", "Long 10Y / Short 2Y (or steepener ETF)", "Curve steepens on growth + inflation."),
        ("XLB+XLF vs SPY", "pair", "Long (XLB+XLF)/2 / Short SPY", "Value/cyclical tilt per strategy."),
        ("Energy", "directional", "XLE, VDE", "Inflation beneficiary."),
    ],
    "Q4_STAGFLATION": [
        ("Flattener (curve)", "curve", "Long 2Y / Short 10Y (flattener)", "Fed hiking, short end up more."),
        ("Defensives", "directional", "XLP, XLV, XLU", "Only sectors that hold up."),
        ("Short cyclicals", "pair", "Short XLY / Long XLP", "Risk OFF, defensives outperform."),
        ("DXY long", "directional", "Long UUP", "Flight to safety, dollar strength."),
    ],
}

CATEGORY_WEIGHTS = {
    IndicatorCategory.HOUSING: 0.30,
    IndicatorCategory.ORDERS: 0.30,
    IndicatorCategory.INCOME_SALES: 0.25,
    IndicatorCategory.EMPLOYMENT: 0.15,
}

# Quadrant definitions per macro_strategy_full.md (Macro Sentiment × FED Policy)
# Q1 = Easy Fed + Positive Sentiment = Risk ON; Q2 = Easy Fed + Negative = GROWTH;
# Q3 = Tight Fed + Positive = VALUE; Q4 = Tight Fed + Negative = Risk OFF
QUADRANT_CONFIG = {
    "Q1_GOLDILOCKS": {
        "label": "Risk ON (Easy Fed + Positive Macro Sentiment)",
        "factors": [
            FactorAllocation(factor="Growth", weight="overweight", description="Tech, innovation — low rates support high-duration equities"),
            FactorAllocation(factor="Small Cap", weight="overweight", description="Domestic economy exposure, higher beta, 2x market moves"),
            FactorAllocation(factor="High Beta", weight="overweight", description="Amplified market participation in risk-on"),
            FactorAllocation(factor="Cyclicals", weight="overweight", description="Max exposure — recovery beneficiaries"),
            FactorAllocation(factor="Value", weight="neutral", description="Balanced — not rate-driven yet"),
            FactorAllocation(factor="Quality", weight="underweight", description="Too defensive for this environment"),
            FactorAllocation(factor="Defensives", weight="underweight", description="Minimize — no need for safety"),
            FactorAllocation(factor="Low Vol", weight="underweight", description="Underperforms in bull markets"),
        ],
        "sectors": [
            SectorAllocation(sector="Technology", weight="overweight", rationale="Innovation cycle, low rates"),
            SectorAllocation(sector="Consumer Discretionary", weight="overweight", rationale="Strong consumer spending"),
            SectorAllocation(sector="Industrials", weight="overweight", rationale="Manufacturing recovery"),
            SectorAllocation(sector="Financials", weight="overweight", rationale="Credit growth, steepening curve"),
            SectorAllocation(sector="Materials", weight="overweight", rationale="Commodity rebound"),
            SectorAllocation(sector="Healthcare", weight="neutral", rationale="Defensive growth"),
            SectorAllocation(sector="Consumer Staples", weight="underweight", rationale="Defensive — not needed"),
            SectorAllocation(sector="Utilities", weight="underweight", rationale="Bond proxy — rates may rise"),
        ],
        "allocation": AssetAllocation(equities_pct=70, bonds_pct=15, commodities_pct=10, cash_pct=5, gold_pct=0),
        "geographic": {"DM": "neutral", "EM": "overweight"},
    },
    "Q2_REFLATION": {
        "label": "GROWTH (Easy Fed + Negative Macro Sentiment)",
        "factors": [
            FactorAllocation(factor="Quality", weight="overweight", description="Safety + stability in weak growth"),
            FactorAllocation(factor="Large Cap", weight="overweight", description="Defensive positioning, global exposure"),
            FactorAllocation(factor="Low Vol", weight="overweight", description="Dampened market moves"),
            FactorAllocation(factor="Defensives", weight="overweight", description="Staples, healthcare, utilities"),
            FactorAllocation(factor="Growth", weight="neutral", description="Low rates help but weak growth hurts"),
            FactorAllocation(factor="Small Cap", weight="underweight", description="Economically sensitive — risky"),
            FactorAllocation(factor="High Beta", weight="underweight", description="Amplifies weakness"),
            FactorAllocation(factor="Cyclicals", weight="underweight", description="No growth to leverage"),
        ],
        "sectors": [
            SectorAllocation(sector="Healthcare", weight="overweight", rationale="Recession-resistant, pricing power"),
            SectorAllocation(sector="Consumer Staples", weight="overweight", rationale="Recession-resistant demand"),
            SectorAllocation(sector="Utilities", weight="overweight", rationale="Bond proxy, high dividends"),
            SectorAllocation(sector="Technology", weight="neutral", rationale="Low rates help but weak demand"),
            SectorAllocation(sector="Financials", weight="underweight", rationale="Credit risk, flat curve"),
            SectorAllocation(sector="Energy", weight="underweight", rationale="Weak demand"),
            SectorAllocation(sector="Consumer Discretionary", weight="underweight", rationale="Weak consumer"),
            SectorAllocation(sector="Materials", weight="underweight", rationale="Commodity weakness"),
        ],
        "allocation": AssetAllocation(equities_pct=45, bonds_pct=30, commodities_pct=5, cash_pct=10, gold_pct=10),
        "geographic": {"DM": "overweight", "EM": "underweight"},
    },
    "Q3_OVERHEATING": {
        "label": "VALUE (Tight Fed + Positive Macro Sentiment)",
        "factors": [
            FactorAllocation(factor="Value", weight="overweight", description="Rising rates help financials, energy"),
            FactorAllocation(factor="Cyclicals", weight="overweight", description="Strong economy supports earnings"),
            FactorAllocation(factor="Large Cap", weight="neutral", description="Benchmark weight"),
            FactorAllocation(factor="Quality", weight="neutral", description="Balanced approach"),
            FactorAllocation(factor="Growth", weight="underweight", description="Hurt by high rates — long duration"),
            FactorAllocation(factor="High Beta", weight="underweight", description="Fed tightening creates volatility"),
            FactorAllocation(factor="Small Cap", weight="underweight", description="Rate-sensitive, more leveraged"),
            FactorAllocation(factor="Low Vol", weight="neutral", description="Moderate protection"),
        ],
        "sectors": [
            SectorAllocation(sector="Financials", weight="overweight", rationale="Steepening curve, credit growth"),
            SectorAllocation(sector="Energy", weight="overweight", rationale="Inflation beneficiary"),
            SectorAllocation(sector="Industrials", weight="overweight", rationale="Strong demand"),
            SectorAllocation(sector="Materials", weight="overweight", rationale="Commodity demand"),
            SectorAllocation(sector="Healthcare", weight="neutral", rationale="Defensive growth"),
            SectorAllocation(sector="Technology", weight="underweight", rationale="Rate-sensitive, high valuation"),
            SectorAllocation(sector="Utilities", weight="underweight", rationale="Hurt by rising rates"),
            SectorAllocation(sector="Consumer Discretionary", weight="neutral", rationale="Strong consumer but rate pressure"),
        ],
        "allocation": AssetAllocation(equities_pct=60, bonds_pct=15, commodities_pct=15, cash_pct=5, gold_pct=5),
        "geographic": {"DM": "neutral", "EM": "neutral"},
    },
    "Q4_STAGFLATION": {
        "label": "Risk OFF (Tight Fed + Negative Macro Sentiment)",
        "factors": [
            FactorAllocation(factor="Quality", weight="overweight", description="Survival mode — strong balance sheets"),
            FactorAllocation(factor="Defensives", weight="overweight", description="Only sectors that stay green"),
            FactorAllocation(factor="Low Vol", weight="overweight", description="Essential dampening"),
            FactorAllocation(factor="Large Cap", weight="overweight", description="Flight to safety and liquidity"),
            FactorAllocation(factor="Value", weight="underweight", description="Earnings collapse"),
            FactorAllocation(factor="Growth", weight="underweight", description="High rates + weak growth"),
            FactorAllocation(factor="Small Cap", weight="underweight", description="High risk, low liquidity"),
            FactorAllocation(factor="High Beta", weight="underweight", description="Amplifies losses"),
            FactorAllocation(factor="Cyclicals", weight="underweight", description="Earnings collapse"),
        ],
        "sectors": [
            SectorAllocation(sector="Healthcare", weight="overweight", rationale="Recession-resistant"),
            SectorAllocation(sector="Consumer Staples", weight="overweight", rationale="Recession-resistant"),
            SectorAllocation(sector="Utilities", weight="overweight", rationale="Defensive, dividend"),
            SectorAllocation(sector="Technology", weight="underweight", rationale="Rate + growth headwind"),
            SectorAllocation(sector="Consumer Discretionary", weight="underweight", rationale="Consumer weakness"),
            SectorAllocation(sector="Financials", weight="underweight", rationale="Credit defaults"),
            SectorAllocation(sector="Industrials", weight="underweight", rationale="Manufacturing contraction"),
            SectorAllocation(sector="Energy", weight="underweight", rationale="Demand destruction"),
            SectorAllocation(sector="Materials", weight="underweight", rationale="Commodity weakness"),
        ],
        "allocation": AssetAllocation(equities_pct=35, bonds_pct=30, commodities_pct=5, cash_pct=20, gold_pct=10),
        "geographic": {"DM": "overweight", "EM": "underweight"},
    },
}


class NavigatorEngine:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.indicator_analyzer = IndicatorAnalyzer(db)
        self.fed_tracker = FedTracker(db)
        self.yield_analyzer = YieldAnalyzer(db)

    async def _compute_growth_score(self) -> float:
        """Weighted average of category z-scores → clamped to [-2, +2]."""
        total = 0.0
        for category, weight in CATEGORY_WEIGHTS.items():
            score = await self.indicator_analyzer.get_category_score_value(category)
            total += score * weight

        return max(-2.0, min(2.0, total))

    async def _compute_direction(self) -> str:
        """Simplified direction of travel based on growth momentum."""
        scores = await self.indicator_analyzer.compute_category_scores()
        improving = sum(1 for s in scores if s.color == "green")
        deteriorating = sum(1 for s in scores if s.color == "red")

        if improving > deteriorating:
            return "improving"
        if deteriorating > improving:
            return "deteriorating"
        return "stable"

    async def get_forward_positions(self) -> list[NavigatorPosition]:
        """Forward dots: extrapolate PIT rule scores (features_pit), same momentum recipe as before."""
        from app.services.forecast_lab import features_pit
        from app.services.forecast_lab.rule_phase import determine_quadrant

        today = _dashboard_fl_pit_as_of()
        target_6m = today - timedelta(days=30 * 6)
        target_1y = today - timedelta(days=365)
        row_now = await features_pit.build_feature_row(self.db, today)
        row_6m = await features_pit.build_feature_row(self.db, target_6m)
        row_1y = await features_pit.build_feature_row(self.db, target_1y)
        g_now, f_now = row_now.growth_score, row_now.fed_policy_score
        g_6m, f_6m = row_6m.growth_score, row_6m.fed_policy_score
        g_1y, f_1y = row_1y.growth_score, row_1y.fed_policy_score
        growth_6m_fwd = max(-2.0, min(2.0, 2.0 * g_now - g_6m))
        growth_1y_fwd = max(-2.0, min(2.0, 3.0 * g_now - 2.0 * g_1y))
        fed_6m_fwd = max(-2.0, min(2.0, 2.0 * f_now - f_6m))
        fed_1y_fwd = max(-2.0, min(2.0, 3.0 * f_now - 2.0 * f_1y))
        positions = []
        for g, f, label in [(growth_6m_fwd, fed_6m_fwd, "6m forward"), (growth_1y_fwd, fed_1y_fwd, "1y forward")]:
            q = determine_quadrant(g, f)
            positions.append(
                NavigatorPosition(
                    growth_score=round(g, 2),
                    fed_policy_score=round(f, 2),
                    quadrant=q,
                    quadrant_label=label,
                    confidence=0.0,
                    direction="forward",
                    date=today,
                )
            )
        return positions

    async def get_historical_positions(self) -> list[NavigatorPosition]:
        """Past dots: PIT rule row at 6m / 1y ago (features_pit)."""
        from app.services.forecast_lab import features_pit
        from app.services.forecast_lab.rule_phase import determine_quadrant

        positions = []
        anchor = _dashboard_fl_pit_as_of()
        for months_ago, label in [(6, "6m ago"), (12, "1y ago")]:
            target = anchor - timedelta(days=30 * months_ago)
            row = await features_pit.build_feature_row(self.db, target)
            g, f = row.growth_score, row.fed_policy_score
            q = determine_quadrant(g, f)
            positions.append(
                NavigatorPosition(
                    growth_score=round(g, 2),
                    fed_policy_score=round(f, 2),
                    quadrant=q,
                    quadrant_label=label,
                    confidence=0.0,
                    direction="historical",
                    date=target,
                )
            )
        return positions

    async def _compute_historical_growth(self, target: date) -> float:
        """Simplified growth score at a historical date using indicator z-scores."""
        from app.models.indicator import Indicator, IndicatorValue
        import numpy as np

        total = 0.0
        for category, weight in CATEGORY_WEIGHTS.items():
            ind_q = select(Indicator.id).where(Indicator.category == category)
            ind_res = await self.db.execute(ind_q)
            ind_ids = [r[0] for r in ind_res.all()]
            if not ind_ids:
                continue

            z_scores = []
            for ind_id in ind_ids:
                val_q = (
                    select(IndicatorValue.value)
                    .where(
                        IndicatorValue.indicator_id == ind_id,
                        IndicatorValue.date <= target,
                    )
                    .order_by(desc(IndicatorValue.date))
                    .limit(60)
                )
                val_res = await self.db.execute(val_q)
                values = [r[0] for r in val_res.all()]

                if len(values) >= 6:
                    latest = values[0]
                    arr = np.array(values)
                    std = float(arr.std())
                    if std > 0:
                        z_scores.append((latest - float(arr.mean())) / std)

            if z_scores:
                total += float(np.mean(z_scores)) * weight

        return max(-2.0, min(2.0, total))

    async def get_recommendation(self) -> NavigatorRecommendation:
        from app.services.forecast_lab import features_pit
        from app.services.forecast_lab.rule_phase import determine_quadrant, scores_from_phase_probs, scores_modal_phase

        as_of = _dashboard_fl_pit_as_of()
        direction = await self._compute_direction()
        pit = await features_pit.build_feature_row(self.db, as_of)
        growth_score = pit.growth_score
        fed_score = pit.fed_policy_score
        quadrant = determine_quadrant(growth_score, fed_score)
        dyn = await YieldAnalyzer(self.db).get_dynamics_at_date(as_of)

        ensemble_overlay: NavigatorEnsembleOverlay | None = None
        try:
            from app.services.forecast_lab.inference import build_summary

            # as_of already month-end aligned; do not re-shift via settings
            fl = await build_summary(self.db, as_of, align_month_end=False)
            pp = fl.phase_probabilities
            eg_mix, ef_mix = scores_from_phase_probs(
                [pp.Q1_GOLDILOCKS, pp.Q2_REFLATION, pp.Q3_OVERHEATING, pp.Q4_STAGFLATION]
            )
            eg, ef = scores_modal_phase(fl.phase_class)
            ensemble_overlay = NavigatorEnsembleOverlay(
                as_of_date=fl.as_of_date,
                trained=fl.trained,
                phase_class=fl.phase_class,
                phase_probabilities=pp,
                confidence=fl.confidence,
                growth_score=round(eg, 2),
                fed_policy_score=round(ef, 2),
                mix_growth_score=round(eg_mix, 2),
                mix_fed_policy_score=round(ef_mix, 2),
                ensemble_weights=fl.ensemble_weights,
                experts=fl.experts,
            )
        except Exception:
            logger.debug("navigator ensemble overlay skipped", exc_info=True)

        curve_match = curve_pattern_matches_quadrant(quadrant, dyn.pattern)
        confidence = await self._compute_confidence(quadrant, curve_match)

        config = QUADRANT_CONFIG[quadrant]

        position = NavigatorPosition(
            growth_score=round(growth_score, 2),
            fed_policy_score=round(fed_score, 2),
            quadrant=quadrant,
            quadrant_label=config["label"],
            confidence=round(confidence, 2),
            direction=direction,
            date=as_of,
            matrix_quadrant=None,
            ensemble_growth_score=ensemble_overlay.growth_score if ensemble_overlay else None,
            ensemble_fed_policy_score=ensemble_overlay.fed_policy_score if ensemble_overlay else None,
        )

        factors_with_tickers = [
            FactorAllocation(
                factor=f.factor,
                weight=f.weight,
                description=f.description,
                tickers=FACTOR_TICKERS.get(f.factor, []),
            )
            for f in config["factors"]
        ]
        trading_recs = [
            TradingRecommendation(name=name, trade_type=ttype, legs=legs, description=desc, rationale=desc)
            for name, ttype, legs, desc in TRADING_RECOMMENDATIONS_BY_QUADRANT.get(quadrant, [])
        ]
        expected = expected_curve_patterns_for_quadrant(quadrant)
        phase_ctx = NavigatorPhaseContext(
            as_of_date=as_of,
            curve_pattern=dyn.pattern,
            curve_description=dyn.description,
            short_end_change_1m_bp=dyn.short_end_change_1m,
            long_end_change_1m_bp=dyn.long_end_change_1m,
            short_end_change_3m_bp=dyn.short_end_change_3m,
            long_end_change_3m_bp=dyn.long_end_change_3m,
            methodology_expected_curve_patterns=expected,
            curve_matches_methodology=curve_match,
        )

        return NavigatorRecommendation(
            position=position,
            factor_tilts=factors_with_tickers,
            sector_allocations=config["sectors"],
            asset_allocation=config["allocation"],
            geographic=config["geographic"],
            trading_recommendations=trading_recs,
            phase_context=phase_ctx,
            ensemble=ensemble_overlay,
        )

    async def _compute_confidence(self, quadrant: str, curve_match: bool | None) -> float:
        """Cross-asset alignment vs quadrant expectations + optional yield-curve methodology blend (TZ)."""
        signals = await self.get_cross_asset_signals()
        return confidence_from_cross_asset_signals(
            quadrant, signals, curve_match=curve_match
        )

    async def get_cross_asset_signals(self) -> list[CrossAssetSignal]:
        """Cross-asset signals from spec Part 8.3."""
        signals = []

        # Gold signal (inverse dollar / inverse real yields)
        gold = await self._get_latest_market("GOLD")
        gold_prev = await self._get_market_n_days_ago("GOLD", 30)
        if gold and gold_prev:
            change = ((gold - gold_prev) / gold_prev) * 100
            signal = "bullish" if change > 2 else ("bearish" if change < -2 else "neutral")
            signals.append(CrossAssetSignal(
                name="Gold", signal=signal, value=round(change, 1),
                description=f"Gold {'rising' if change > 0 else 'falling'} {abs(change):.1f}% (30d) — "
                           f"{'easy Fed signal' if change > 0 else 'tight Fed signal'}",
            ))

        # Dollar signal
        dxy = await self._get_latest_market("DXY")
        dxy_prev = await self._get_market_n_days_ago("DXY", 30)
        if dxy and dxy_prev:
            change = ((dxy - dxy_prev) / dxy_prev) * 100
            signal = "bearish" if change > 2 else ("bullish" if change < -2 else "neutral")
            signals.append(CrossAssetSignal(
                name="Dollar (DXY)", signal=signal, value=round(change, 1),
                description=f"DXY {'strengthening' if change > 0 else 'weakening'} {abs(change):.1f}% (30d)",
            ))

        # Copper signal (growth proxy)
        copper = await self._get_latest_market("COPPER")
        copper_prev = await self._get_market_n_days_ago("COPPER", 30)
        if copper and copper_prev:
            change = ((copper - copper_prev) / copper_prev) * 100
            signal = "bullish" if change > 3 else ("bearish" if change < -3 else "neutral")
            signals.append(CrossAssetSignal(
                name="Copper", signal=signal, value=round(change, 1),
                description=f"Dr. Copper {'rising' if change > 0 else 'falling'} — "
                           f"{'strong industrial demand' if change > 0 else 'weak demand'}",
            ))

        # VIX signal
        vix = await self._get_latest_market("VIX")
        if vix:
            signal = "bullish" if vix < 15 else ("bearish" if vix > 30 else "neutral")
            signals.append(CrossAssetSignal(
                name="VIX", signal=signal, value=round(vix, 1),
                description=f"VIX at {vix:.1f} — "
                           f"{'complacency' if vix < 15 else 'fear' if vix > 30 else 'normal range'}",
            ))

        # Yield curve signal
        is_inverted = await self.yield_analyzer.is_inverted()
        signals.append(CrossAssetSignal(
            name="Yield Curve (2Y10Y)",
            signal="bearish" if is_inverted else "bullish",
            value=None,
            description="INVERTED — recession signal" if is_inverted else "Normal — no recession signal",
        ))

        # Real yields signal
        real_yield = await self.yield_analyzer.get_10y_real_yield()
        if real_yield is not None:
            signal = "bearish" if real_yield > 1.5 else ("bullish" if real_yield < 0 else "neutral")
            signals.append(CrossAssetSignal(
                name="10Y Real Yield",
                signal=signal,
                value=round(real_yield, 2),
                description=f"Real yield at {real_yield:.2f}% — "
                           f"{'tight conditions' if real_yield > 1.5 else 'financial repression' if real_yield < 0 else 'moderate'}",
            ))

        return signals

    async def get_recession_check(self) -> RecessionCheck:
        """Eight-slot recession checklist: rows always returned; use N/A when data is missing."""
        from app.models.indicator import Indicator, IndicatorValue

        items: list[RecessionCheckItem] = []

        # 1. 2Y10Y curve
        snap = await self.yield_analyzer.get_current_snapshot()
        y_as_of = snap.date.isoformat() if snap.points else None
        is_inv = await self.yield_analyzer.is_inverted()
        items.append(
            RecessionCheckItem(
                name="2Y10Y Curve Inversion",
                triggered=is_inv,
                current_value="Inverted" if is_inv else "Normal",
                threshold="<0bp for 3+ months",
                description="Yield curve inversion is historically 100% accurate recession predictor",
                data_as_of=y_as_of,
            )
        )

        # 2. ISM Manufacturing PMI (3 consecutive < 50)
        ism_triggered = False
        ism_str = "N/A"
        ism_as_of: str | None = None
        ind_q = select(Indicator).where(Indicator.name == "ISM Manufacturing PMI")
        ind = (await self.db.execute(ind_q)).scalar_one_or_none()
        if ind:
            val_q = (
                select(IndicatorValue)
                .where(IndicatorValue.indicator_id == ind.id)
                .order_by(desc(IndicatorValue.date))
                .limit(3)
            )
            vals = (await self.db.execute(val_q)).scalars().all()
            if vals:
                ism_str = f"{vals[0].value:.1f}"
                ism_as_of = vals[0].date.isoformat()
                ism_triggered = all(v.value < 50 for v in vals)
        else:
            ism_row_q = (
                select(MarketData.value, MarketData.date)
                .where(MarketData.symbol == "ISM_PMI")
                .order_by(desc(MarketData.date))
                .limit(3)
            )
            ism_rows = (await self.db.execute(ism_row_q)).all()
            if len(ism_rows) >= 3:
                ism_str = f"{float(ism_rows[0][0]):.1f}"
                ism_as_of = ism_rows[0][1].isoformat()
                ism_triggered = all(float(r[0]) < 50 for r in ism_rows)
            elif ism_rows:
                ism_str = f"{float(ism_rows[0][0]):.1f}"
                ism_as_of = ism_rows[0][1].isoformat()
        items.append(
            RecessionCheckItem(
                name="ISM Manufacturing PMI",
                triggered=ism_triggered,
                current_value=ism_str,
                threshold="< 50 for 3 consecutive months",
                description="Recession signal from ISM Manufacturing PMI",
                data_as_of=ism_as_of,
            )
        )

        # 3. LEI (level vs ~6 months ago)
        lei_cur, lei_d = await self._latest_market_row("LEI")
        lei_prev = await self._get_market_n_days_ago("LEI", 180)
        if lei_cur is not None and lei_prev is not None:
            lei_declining = lei_cur < lei_prev
            lei_note = f"{lei_cur:.2f} (vs 6m ago: {lei_prev:.2f})"
            lei_as_of = lei_d.isoformat() if lei_d else None
        else:
            lei_declining = False
            lei_note = "N/A"
            lei_as_of = lei_d.isoformat() if lei_d else None
        items.append(
            RecessionCheckItem(
                name="Leading Economic Index",
                triggered=lei_declining,
                current_value=lei_note,
                threshold="declining vs 6 months ago",
                description="Sustained decline in LEI precedes economic downturns",
                data_as_of=lei_as_of,
            )
        )

        # 4. HY spread / OAS
        hy, hy_key, hy_d = await self._latest_hy_market()
        hy_triggered = hy >= 500.0 if hy is not None else False
        items.append(
            RecessionCheckItem(
                name=f"High Yield ({hy_key})",
                triggered=hy_triggered,
                current_value=f"{hy:.1f}" if hy is not None else "N/A",
                threshold=">= 500 (proxy for stress)",
                description="Elevated HY OAS / spread indicates credit stress",
                data_as_of=hy_d.isoformat() if hy_d else None,
            )
        )

        # 5. Sahm Rule
        sahm, sahm_d = await self._latest_market_row("SAHM_RULE")
        sahm_trig = sahm >= 0.5 if sahm is not None else False
        items.append(
            RecessionCheckItem(
                name="Sahm Rule Indicator",
                triggered=sahm_trig,
                current_value=f"{sahm:.2f}" if sahm is not None else "N/A",
                threshold=">= 0.50 (3m avg U3 vs 12m low, pp)",
                description="Rapid unemployment rise from cycle low",
                data_as_of=sahm_d.isoformat() if sahm_d else None,
            )
        )

        # 6. Initial jobless claims (latest week, thousands)
        claims, claims_d = await self._indicator_latest_row("Initial Jobless Claims")
        claims_trig = claims > 300 if claims is not None else False
        items.append(
            RecessionCheckItem(
                name="Initial Jobless Claims",
                triggered=claims_trig,
                current_value=f"{claims:.0f}K" if claims is not None else "N/A",
                threshold="> 300K = deterioration",
                description="Rising claims indicate labor market weakening",
                data_as_of=claims_d.isoformat() if claims_d else None,
            )
        )

        # 7. Retail sales YoY
        retail, retail_d = await self._indicator_latest_row("Retail Sales")
        retail_prev = await self._indicator_value_at("Retail Sales", date.today() - timedelta(days=365))
        retail_trig = False
        retail_str = "N/A"
        if retail is not None and retail_prev is not None and retail_prev != 0:
            yoy = ((retail - retail_prev) / abs(retail_prev)) * 100
            retail_str = f"{yoy:+.1f}%"
            retail_trig = yoy < 0
        items.append(
            RecessionCheckItem(
                name="Retail Sales (YoY)",
                triggered=retail_trig,
                current_value=retail_str,
                threshold="< 0% = consumer contraction",
                description="Negative real retail sales growth signals consumer weakness",
                data_as_of=retail_d.isoformat() if retail_d else None,
            )
        )

        # 8. Building permits MoM
        permits, permits_d = await self._indicator_latest_row("Building Permits")
        permits_prev = await self._indicator_value_at("Building Permits", date.today() - timedelta(days=35))
        permits_trig = False
        permits_str = "N/A"
        if permits is not None and permits_prev is not None and permits_prev != 0:
            mom = ((permits - permits_prev) / abs(permits_prev)) * 100
            permits_str = f"{mom:+.1f}%"
            permits_trig = mom < -10
        items.append(
            RecessionCheckItem(
                name="Building Permits (MoM)",
                triggered=permits_trig,
                current_value=permits_str,
                threshold="< -10% = housing weakness",
                description="Sharp decline in permits signals housing downturn",
                data_as_of=permits_d.isoformat() if permits_d else None,
            )
        )

        assert len(items) == RECESSION_CHECKLIST_TOTAL
        score = sum(1 for item in items if item.triggered)
        if score >= 5:
            confidence = "high"
        elif score >= 3:
            confidence = "moderate"
        else:
            confidence = "low"

        return RecessionCheck(
            score=score, total=RECESSION_CHECKLIST_TOTAL, confidence=confidence, items=items
        )

    # ------------------------------------------------------------------
    # Market data helpers
    # ------------------------------------------------------------------

    async def _latest_market_row(self, symbol: str) -> tuple[float | None, date | None]:
        q = (
            select(MarketData.value, MarketData.date)
            .where(MarketData.symbol == symbol)
            .order_by(desc(MarketData.date))
            .limit(1)
        )
        row = (await self.db.execute(q)).one_or_none()
        if row is None:
            return None, None
        return float(row[0]), row[1]

    async def _latest_hy_market(self) -> tuple[float | None, str, date | None]:
        v, d = await self._latest_market_row("HY_OAS")
        if v is not None:
            return v, "HY_OAS", d
        v2, d2 = await self._latest_market_row("HY_SPREAD")
        return v2, "HY_SPREAD", d2

    async def _indicator_latest_row(self, name: str) -> tuple[float | None, date | None]:
        from app.models.indicator import Indicator, IndicatorValue

        q = (
            select(IndicatorValue.value, IndicatorValue.date)
            .join(Indicator)
            .where(Indicator.name == name)
            .order_by(desc(IndicatorValue.date))
            .limit(1)
        )
        row = (await self.db.execute(q)).one_or_none()
        if row is None:
            return None, None
        return float(row[0]), row[1]

    async def _indicator_value_at(self, name: str, target: date) -> float | None:
        from app.models.indicator import Indicator, IndicatorValue

        q = (
            select(IndicatorValue.value)
            .join(Indicator)
            .where(Indicator.name == name, IndicatorValue.date <= target)
            .order_by(desc(IndicatorValue.date))
            .limit(1)
        )
        return (await self.db.execute(q)).scalar_one_or_none()

    async def _get_latest_market(self, symbol: str) -> float | None:
        query = (
            select(MarketData.value)
            .where(MarketData.symbol == symbol)
            .order_by(desc(MarketData.date))
            .limit(1)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _get_market_n_days_ago(self, symbol: str, days: int) -> float | None:
        target = date.today() - timedelta(days=days)
        query = (
            select(MarketData.value)
            .where(
                MarketData.symbol == symbol,
                MarketData.date <= target,
            )
            .order_by(desc(MarketData.date))
            .limit(1)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def _get_market_last_n_values(self, symbol: str, n: int) -> list[float]:
        """Last n values (by date desc) for market symbol; used e.g. for ISM 3-month check."""
        query = (
            select(MarketData.value)
            .where(MarketData.symbol == symbol)
            .order_by(desc(MarketData.date))
            .limit(n)
        )
        result = await self.db.execute(query)
        return [r[0] for r in result.all()]
