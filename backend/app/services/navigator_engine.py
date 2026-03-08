"""
Trading Navigator Engine: 2x2 matrix (Macro Sentiment x FED Policy).

Axes (display: X = Macro Sentiment, Y = FED Policy):
  Macro Sentiment score (-2 negative → +2 positive), from category z-scores (Housing, Orders, Income, Employment).
  Fed Policy Score (-2 very easy → +2 very tight).

Quadrants (Macro Sentiment × FED Policy):
  Q1 (Risk ON):    Easy Fed + Positive Sentiment
  Q2 (GROWTH):     Easy Fed + Negative Sentiment
  Q3 (VALUE):      Tight Fed + Positive Sentiment
  Q4 (Risk OFF):   Tight Fed + Negative Sentiment

Macro Sentiment is built from category scores with weights:
  Housing (0.30), Orders (0.30), Income (0.25), Employment (0.15).
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
    NavigatorPosition, NavigatorRecommendation,
    FactorAllocation, SectorAllocation, AssetAllocation,
    CrossAssetSignal, RecessionCheck, RecessionCheckItem,
    TradingRecommendation,
)

logger = logging.getLogger(__name__)

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

    async def _determine_quadrant(self, growth: float, fed: float) -> str:
        if growth >= 0 and fed <= 0:
            return "Q1_GOLDILOCKS"
        if growth < 0 and fed <= 0:
            return "Q2_REFLATION"
        if growth >= 0 and fed > 0:
            return "Q3_OVERHEATING"
        return "Q4_STAGFLATION"

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
        """Momentum-based extrapolation: 6m and 1y forward (for display as green dots)."""
        current_growth = await self._compute_growth_score()
        current_fed = await self.fed_tracker.get_policy_score()
        target_6m = date.today() - timedelta(days=30 * 6)
        target_1y = date.today() - timedelta(days=365)
        growth_6m = await self._compute_historical_growth(target_6m)
        growth_1y = await self._compute_historical_growth(target_1y)
        fed_6m = await self.fed_tracker.get_policy_score_at_date(target_6m)
        fed_1y = await self.fed_tracker.get_policy_score_at_date(target_1y)
        # Linear extrapolation: 6m fwd = current + (current - 6m_ago), 1y fwd = current + 2*(current - 1y_ago)
        growth_6m_fwd = max(-2.0, min(2.0, 2.0 * current_growth - growth_6m))
        growth_1y_fwd = max(-2.0, min(2.0, 3.0 * current_growth - 2.0 * growth_1y))
        fed_6m_fwd = max(-2.0, min(2.0, 2.0 * current_fed - fed_6m))
        fed_1y_fwd = max(-2.0, min(2.0, 3.0 * current_fed - 2.0 * fed_1y))
        positions = []
        for (g, f, label) in [(growth_6m_fwd, fed_6m_fwd, "6m forward"), (growth_1y_fwd, fed_1y_fwd, "1y forward")]:
            quadrant = await self._determine_quadrant(g, f)
            config = QUADRANT_CONFIG[quadrant]
            positions.append(NavigatorPosition(
                growth_score=round(g, 2),
                fed_policy_score=round(f, 2),
                quadrant=quadrant,
                quadrant_label=label,
                confidence=0.0,
                direction="forward",
                date=date.today(),
            ))
        return positions

    async def get_historical_positions(self) -> list[NavigatorPosition]:
        """Return navigator dots for 6 months ago and 1 year ago."""
        positions = []
        for months_ago, label in [(6, "6m ago"), (12, "1y ago")]:
            target = date.today() - timedelta(days=30 * months_ago)
            fed_score = await self.fed_tracker.get_policy_score_at_date(target)
            growth_score = await self._compute_historical_growth(target)
            quadrant = await self._determine_quadrant(growth_score, fed_score)
            config = QUADRANT_CONFIG[quadrant]
            positions.append(NavigatorPosition(
                growth_score=round(growth_score, 2),
                fed_policy_score=round(fed_score, 2),
                quadrant=quadrant,
                quadrant_label=label,
                confidence=0.0,
                direction="historical",
                date=target,
            ))
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
        growth_score = await self._compute_growth_score()
        fed_score = await self.fed_tracker.get_policy_score()
        quadrant = await self._determine_quadrant(growth_score, fed_score)
        direction = await self._compute_direction()
        confidence = await self._compute_confidence(quadrant)

        config = QUADRANT_CONFIG[quadrant]

        position = NavigatorPosition(
            growth_score=round(growth_score, 2),
            fed_policy_score=round(fed_score, 2),
            quadrant=quadrant,
            quadrant_label=config["label"],
            confidence=round(confidence, 2),
            direction=direction,
            date=date.today(),
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
        return NavigatorRecommendation(
            position=position,
            factor_tilts=factors_with_tickers,
            sector_allocations=config["sectors"],
            asset_allocation=config["allocation"],
            geographic=config["geographic"],
            trading_recommendations=trading_recs,
        )

    async def _compute_confidence(self, quadrant: str) -> float:
        """Count how many cross-asset signals confirm the current quadrant."""
        signals = await self.get_cross_asset_signals()
        if not signals:
            return 0.5

        confirming = sum(1 for s in signals if s.signal != "neutral")
        return min(1.0, confirming / len(signals))

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
        """8-point recession checklist from spec Part 13.3."""
        items = []

        # 1. 2Y10Y Curve inverted for 3+ months
        is_inv = await self.yield_analyzer.is_inverted()
        items.append(RecessionCheckItem(
            name="2Y10Y Curve Inversion",
            triggered=is_inv,
            current_value="Inverted" if is_inv else "Normal",
            threshold="<0bp for 3+ months",
            description="Yield curve inversion is historically 100% accurate recession predictor",
        ))

        # 2-8: Simplified checks based on available data
        checks = [
            ("ISM Manufacturing PMI", "< 50 for 3 consecutive months", 50, True),
            ("Unemployment Rate", "rises 0.5%+ from cycle low", None, None),
            ("Initial Jobless Claims", "4-week MA rises 30%+ from cycle low", None, None),
            ("Housing Starts", "down 20%+ from cycle high", None, None),
        ]

        for name, threshold, level, invert in checks:
            from app.models.indicator import Indicator, IndicatorValue
            ind_q = select(Indicator).where(Indicator.name == name)
            ind_result = await self.db.execute(ind_q)
            ind = ind_result.scalar_one_or_none()

            triggered = False
            current_str = "N/A"

            if ind:
                val_q = (
                    select(IndicatorValue)
                    .where(IndicatorValue.indicator_id == ind.id)
                    .order_by(desc(IndicatorValue.date))
                    .limit(3)
                )
                val_result = await self.db.execute(val_q)
                vals = val_result.scalars().all()

                if vals:
                    current_str = f"{vals[0].value:.1f}"
                    if level is not None and invert:
                        triggered = all(v.value < level for v in vals)
                    elif level is not None:
                        triggered = vals[0].value > level
            elif name == "ISM Manufacturing PMI":
                # Fallback: ISM stored in market_data as ISM_PMI (not in indicators table)
                ism_vals = await self._get_market_last_n_values("ISM_PMI", 3)
                if ism_vals:
                    current_str = f"{ism_vals[0]:.1f}"
                    triggered = all(v < 50 for v in ism_vals)

            items.append(RecessionCheckItem(
                name=name,
                triggered=triggered,
                current_value=current_str,
                threshold=threshold,
                description=f"Recession signal from {name}",
            ))

        # LEI: use market_data when not in indicators (current vs 6 months ago)
        lei_current = await self._get_latest_market("LEI")
        lei_6m_ago = await self._get_market_n_days_ago("LEI", 180)
        if lei_current is not None and lei_6m_ago is not None:
            lei_declining = lei_current < lei_6m_ago
            items.append(RecessionCheckItem(
                name="Leading Economic Index",
                triggered=lei_declining,
                current_value=f"{lei_current:.2f} (6m ago: {lei_6m_ago:.2f})",
                threshold="declining for 6+ months",
                description="Sustained decline in LEI precedes economic downturns",
            ))
        else:
            items.append(RecessionCheckItem(
                name="Leading Economic Index",
                triggered=False,
                current_value="N/A",
                threshold="declining for 6+ months",
                description="Requires additional data source for Leading Economic Index",
            ))

        # Placeholder items for data not tracked via FRED indicators
        for placeholder_name, threshold in [
            ("Corporate Profits", "declining 2 consecutive quarters"),
            ("Credit Spreads (HY)", ">500bp and rising"),
        ]:
            items.append(RecessionCheckItem(
                name=placeholder_name,
                triggered=False,
                current_value="N/A",
                threshold=threshold,
                description=f"Requires additional data source for {placeholder_name}",
            ))

        score = sum(1 for item in items if item.triggered)
        if score >= 5:
            confidence = "high"
        elif score >= 3:
            confidence = "moderate"
        else:
            confidence = "low"

        return RecessionCheck(score=score, total=len(items), confidence=confidence, items=items)

    # ------------------------------------------------------------------
    # Market data helpers
    # ------------------------------------------------------------------

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
