import logging
from datetime import date, timedelta

import numpy as np
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.market_data import MarketData, YieldData
from app.models.fed_policy import BalanceSheet
from app.models.factor import FactorReturn, SectorPerformance

logger = logging.getLogger(__name__)


class MarketService:
    """Provides computed market analytics: time-series, ratios, liquidity, sectors, FX."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_time_series(self, symbol: str, days: int = 365) -> list[dict]:
        cutoff = date.today() - timedelta(days=days)
        q = (
            select(MarketData.date, MarketData.value, MarketData.change_pct)
            .where(MarketData.symbol == symbol, MarketData.date >= cutoff)
            .order_by(MarketData.date)
        )
        rows = (await self.db.execute(q)).all()
        return [{"date": r.date.isoformat(), "value": r.value, "change_pct": r.change_pct} for r in rows]

    async def get_ratio_series(self, symbol_a: str, symbol_b: str, days: int = 365) -> list[dict]:
        cutoff = date.today() - timedelta(days=days)
        a_q = (
            select(MarketData.date, MarketData.value)
            .where(MarketData.symbol == symbol_a, MarketData.date >= cutoff)
            .order_by(MarketData.date)
        )
        b_q = (
            select(MarketData.date, MarketData.value)
            .where(MarketData.symbol == symbol_b, MarketData.date >= cutoff)
            .order_by(MarketData.date)
        )
        a_rows = {r.date: r.value for r in (await self.db.execute(a_q)).all()}
        b_rows = {r.date: r.value for r in (await self.db.execute(b_q)).all()}
        common_dates = sorted(set(a_rows) & set(b_rows))
        result = []
        for d in common_dates:
            if b_rows[d] != 0:
                result.append({"date": d.isoformat(), "value": round(a_rows[d] / b_rows[d], 4)})
        return result

    async def get_net_liquidity(self, days: int = 730) -> list[dict]:
        """Net Liquidity = Fed Balance Sheet (WALCL) - TGA - RRP."""
        cutoff = date.today() - timedelta(days=days)

        bs_q = (
            select(BalanceSheet.date, BalanceSheet.total_assets)
            .where(BalanceSheet.date >= cutoff)
            .order_by(BalanceSheet.date)
        )
        bs_rows = {r.date: r.total_assets for r in (await self.db.execute(bs_q)).all()}

        tga_q = (
            select(MarketData.date, MarketData.value)
            .where(MarketData.symbol == "TGA", MarketData.date >= cutoff)
            .order_by(MarketData.date)
        )
        tga_rows = {r.date: r.value for r in (await self.db.execute(tga_q)).all()}

        rrp_q = (
            select(MarketData.date, MarketData.value)
            .where(MarketData.symbol == "RRP", MarketData.date >= cutoff)
            .order_by(MarketData.date)
        )
        rrp_rows = {r.date: r.value for r in (await self.db.execute(rrp_q)).all()}

        # Align on balance sheet dates (weekly), forward-fill TGA/RRP
        result = []
        last_tga = 0.0
        last_rrp = 0.0
        for d in sorted(bs_rows):
            if d in tga_rows:
                last_tga = tga_rows[d]
            if d in rrp_rows:
                last_rrp = rrp_rows[d]
            net = bs_rows[d] - last_tga - last_rrp
            result.append({
                "date": d.isoformat(),
                "value": round(net, 2),
                "fed_bs": round(bs_rows[d], 2),
                "tga": round(last_tga, 2),
                "rrp": round(last_rrp, 2),
            })
        return result

    async def get_recession_bands(self) -> list[dict]:
        """Return date ranges where USREC = 1."""
        q = (
            select(MarketData.date, MarketData.value)
            .where(MarketData.symbol == "USREC")
            .order_by(MarketData.date)
        )
        rows = (await self.db.execute(q)).all()
        bands = []
        start = None
        for r in rows:
            if r.value == 1 and start is None:
                start = r.date
            elif r.value == 0 and start is not None:
                bands.append({"start": start.isoformat(), "end": r.date.isoformat()})
                start = None
        if start is not None:
            bands.append({"start": start.isoformat(), "end": date.today().isoformat()})
        return bands

    async def get_sector_performance(self, period_days: int = 180) -> list[dict]:
        """Return sector ETF performance rebased to 0%."""
        cutoff = date.today() - timedelta(days=period_days)
        q = (
            select(SectorPerformance.sector, SectorPerformance.date, SectorPerformance.value)
            .where(SectorPerformance.date >= cutoff)
            .order_by(SectorPerformance.sector, SectorPerformance.date)
        )
        rows = (await self.db.execute(q)).all()

        from app.services.yahoo_client import SECTOR_LABELS, SECTOR_GROUPS

        symbol_to_group: dict[str, str] = {}
        for group_name, symbols in SECTOR_GROUPS.items():
            for sym in symbols:
                symbol_to_group[sym] = group_name

        grouped: dict[str, list] = {}
        for r in rows:
            grouped.setdefault(r.sector, []).append((r.date, r.value))

        result = []
        for sector, points in grouped.items():
            if not points:
                continue
            base = points[0][1]
            series = [
                {"date": p[0].isoformat(), "value": round(((p[1] / base) - 1) * 100, 2)}
                for p in points if base != 0
            ]
            total_return = round(((points[-1][1] / base) - 1) * 100, 2) if base != 0 else 0
            result.append({
                "symbol": sector,
                "label": SECTOR_LABELS.get(sector, sector),
                "group": symbol_to_group.get(sector, "Other"),
                "series": series,
                "total_return": total_return,
                "latest_value": points[-1][1],
            })
        result.sort(key=lambda x: x["total_return"], reverse=True)
        return result

    async def get_sector_groups(self, period_days: int = 180) -> list[dict]:
        """Aggregate sectors into 4 groups, return averaged rebased series."""
        from app.services.yahoo_client import SECTOR_GROUPS
        sector_data = await self.get_sector_performance(period_days)
        sector_map = {s["symbol"]: s["series"] for s in sector_data}

        result = []
        for group_name, symbols in SECTOR_GROUPS.items():
            all_series: dict[str, list[float]] = {}
            for sym in symbols:
                if sym in sector_map:
                    for pt in sector_map[sym]:
                        all_series.setdefault(pt["date"], []).append(pt["value"])

            avg_series = [
                {"date": d, "value": round(sum(vals) / len(vals), 2)}
                for d, vals in sorted(all_series.items()) if vals
            ]
            total = avg_series[-1]["value"] if avg_series else 0
            result.append({"group": group_name, "series": avg_series, "total_return": total})
        return result

    async def get_factor_ratios(self, period_days: int = 365) -> list[dict]:
        """Return ratio time-series for factor pairs."""
        cutoff = date.today() - timedelta(days=period_days)
        q = (
            select(FactorReturn.factor_name, FactorReturn.date, FactorReturn.value)
            .where(FactorReturn.date >= cutoff)
            .order_by(FactorReturn.factor_name, FactorReturn.date)
        )
        rows = (await self.db.execute(q)).all()
        grouped: dict[str, dict[date, float]] = {}
        for r in rows:
            grouped.setdefault(r.factor_name, {})[r.date] = r.value

        pairs = [
            ("SPHB", "SPLV", "High Beta / Low Vol"),
            ("EEM", "EFA", "EM / DM"),
        ]
        result = []
        for a, b, label in pairs:
            if a not in grouped or b not in grouped:
                continue
            common = sorted(set(grouped[a]) & set(grouped[b]))
            series = []
            for d in common:
                if grouped[b][d] != 0:
                    series.append({"date": d.isoformat(), "value": round(grouped[a][d] / grouped[b][d], 4)})
            result.append({"label": label, "series": series})
        return result

    async def get_index_status(self) -> list[dict]:
        """Current price + 200-day MA for major indices."""
        symbols = ["SP500", "NDX", "RUT", "DJI"]
        result = []
        for sym in symbols:
            q = (
                select(MarketData.date, MarketData.value)
                .where(MarketData.symbol == sym)
                .order_by(desc(MarketData.date))
                .limit(250)
            )
            rows = (await self.db.execute(q)).all()
            if not rows:
                continue
            values = [r.value for r in rows]
            current = values[0]
            dma_200 = float(np.mean(values[:200])) if len(values) >= 200 else float(np.mean(values))
            result.append({
                "symbol": sym,
                "price": round(current, 2),
                "dma_200": round(dma_200, 2),
                "above_200dma": current > dma_200,
                "distance_pct": round(((current / dma_200) - 1) * 100, 2) if dma_200 else 0,
                "date": rows[0].date.isoformat(),
            })
        return result

    async def get_breadth_dashboard(self, days: int = 365 * 5) -> dict:
        """Return all series needed for the Market Breadth Dashboard (TradingView-style)."""
        symbols = [
            "SP500", "MMTW", "MMFI", "MMTH", "VIX", "PCC",
            "NYHGH", "NYLOW", "NYMO", "NYSI", "TVOL.US",
        ]
        result = {}
        for sym in symbols:
            series = await self.get_time_series(sym, days)
            result[sym] = series if series else []
        return result

    # ------------------------------------------------------------------
    # Macro Overview helpers
    # ------------------------------------------------------------------

    async def _raw_market(
        self, symbol: str, cutoff: date
    ) -> dict[date, float]:
        q = (
            select(MarketData.date, MarketData.value)
            .where(MarketData.symbol == symbol, MarketData.date >= cutoff)
            .order_by(MarketData.date)
        )
        return {r.date: r.value for r in (await self.db.execute(q)).all()}

    async def _raw_sector(
        self, symbol: str, cutoff: date
    ) -> dict[date, float]:
        q = (
            select(SectorPerformance.date, SectorPerformance.value)
            .where(SectorPerformance.sector == symbol,
                   SectorPerformance.date >= cutoff)
            .order_by(SectorPerformance.date)
        )
        return {r.date: r.value for r in (await self.db.execute(q)).all()}

    async def _raw_factor(
        self, symbol: str, cutoff: date
    ) -> dict[date, float]:
        q = (
            select(FactorReturn.date, FactorReturn.value)
            .where(FactorReturn.factor_name == symbol,
                   FactorReturn.date >= cutoff)
            .order_by(FactorReturn.date)
        )
        return {r.date: r.value for r in (await self.db.execute(q)).all()}

    async def _raw_any(
        self, symbol: str, cutoff: date
    ) -> dict[date, float]:
        """Try MarketData → SectorPerformance → FactorReturn."""
        data = await self._raw_market(symbol, cutoff)
        if data:
            return data
        data = await self._raw_sector(symbol, cutoff)
        if data:
            return data
        return await self._raw_factor(symbol, cutoff)

    def _ratio(
        self, a: dict[date, float], b: dict[date, float]
    ) -> list[dict]:
        common = sorted(set(a) & set(b))
        return [
            {"date": d.isoformat(),
             "value": round(a[d] / b[d], 6)}
            for d in common if b[d] != 0
        ]

    def _to_list(self, data: dict[date, float]) -> list[dict]:
        return [
            {"date": d.isoformat(), "value": v}
            for d, v in sorted(data.items())
        ]

    async def _yield_series(
        self, maturity: str, cutoff: date
    ) -> dict[date, float]:
        q = (
            select(YieldData.date, YieldData.nominal_yield)
            .where(YieldData.maturity == maturity,
                   YieldData.date >= cutoff)
            .order_by(YieldData.date)
        )
        return {
            r.date: r.nominal_yield
            for r in (await self.db.execute(q)).all()
        }

    async def _tips_yield_series(
        self, maturity: str, cutoff: date
    ) -> dict[date, float]:
        q = (
            select(YieldData.date, YieldData.tips_yield)
            .where(YieldData.maturity == maturity,
                   YieldData.date >= cutoff,
                   YieldData.tips_yield.isnot(None))
            .order_by(YieldData.date)
        )
        return {
            r.date: r.tips_yield
            for r in (await self.db.execute(q)).all()
        }

    async def _breakeven_series(
        self, maturity: str, cutoff: date
    ) -> dict[date, float]:
        q = (
            select(YieldData.date, YieldData.breakeven)
            .where(YieldData.maturity == maturity,
                   YieldData.date >= cutoff,
                   YieldData.breakeven.isnot(None))
            .order_by(YieldData.date)
        )
        return {
            r.date: r.breakeven
            for r in (await self.db.execute(q)).all()
        }

    async def get_macro_overview(self, days: int = 365 * 5) -> dict:
        """All series for the Macro Overview dashboard (3 pages)."""
        cutoff = date.today() - timedelta(days=days)

        # SPX for overlay on every chart
        spx = await self._raw_market("SP500", cutoff)

        # ── Page 1: Fixed Income & Liquidity ──────────────
        tip = await self._raw_market("TIP", cutoff)
        ief = await self._raw_market("IEF", cutoff)
        inflation_exp = self._ratio(tip, ief) if tip and ief else []

        # Real yields = 5Y nominal - 5Y breakeven (≈ TIPS yield)
        nom5 = await self._yield_series("5Y", cutoff)
        be5 = await self._breakeven_series("5Y", cutoff)
        real_yields = []
        for d in sorted(set(nom5) & set(be5)):
            real_yields.append({
                "date": d.isoformat(),
                "value": round(nom5[d] - be5[d], 4),
            })

        # 10Y-2Y spread
        y10 = await self._yield_series("10Y", cutoff)
        y2 = await self._yield_series("2Y", cutoff)
        spread_10y2y = []
        for d in sorted(set(y10) & set(y2)):
            spread_10y2y.append({
                "date": d.isoformat(),
                "value": round(y10[d] - y2[d], 4),
            })

        # Forward Fed Funds Rate (100 - ZQ futures price)
        zq = await self._raw_market("ZQ", cutoff)
        fwd_rate = [
            {"date": d.isoformat(), "value": round(100 - v, 4)}
            for d, v in sorted(zq.items())
        ] if zq else []

        # US Liquidity = Fed BS - RRP
        bs_q = (
            select(BalanceSheet.date, BalanceSheet.total_assets)
            .where(BalanceSheet.date >= cutoff)
            .order_by(BalanceSheet.date)
        )
        bs_rows = {
            r.date: r.total_assets
            for r in (await self.db.execute(bs_q)).all()
        }
        rrp_data = await self._raw_market("RRP", cutoff)
        us_liquidity = []
        last_rrp = 0.0
        for d in sorted(bs_rows):
            if d in rrp_data:
                last_rrp = rrp_data[d]
            us_liquidity.append({
                "date": d.isoformat(),
                "value": round(bs_rows[d] - last_rrp, 2),
            })

        # Central bank BS (only what we have: US + ECB)
        ecb = await self._raw_market("ECBBS", cutoff)
        # Sum available CBs; align on US dates
        central_bank_bs: list[dict] = []
        last_ecb = 0.0
        for d in sorted(bs_rows):
            if d in ecb:
                last_ecb = ecb[d]
            central_bank_bs.append({
                "date": d.isoformat(),
                "value": round(bs_rows[d] + last_ecb, 2),
            })

        move_data = await self._raw_market("MOVE", cutoff)
        rrp_series = await self._raw_market("RRP", cutoff)

        # TGA (Treasury General Account)
        tga_data = await self._raw_market("TGA", cutoff)

        # SOFR − EFFR spread (interbank stress indicator)
        sofr = await self._raw_market("SOFR", cutoff)
        effr = await self._raw_market("EFFR_DAILY", cutoff)
        sofr_ff_spread = []
        for d in sorted(set(sofr) & set(effr)):
            sofr_ff_spread.append({
                "date": d.isoformat(),
                "value": round(sofr[d] - effr[d], 4),
            })

        # ── Page 2: Commodities & Global Activity ─────────
        gold = await self._raw_market("GOLD", cutoff)
        oil = await self._raw_market("WTI_OIL", cutoff)
        copper = await self._raw_market("COPPER", cutoff)
        lumber = await self._raw_market("LUMBER", cutoff)

        gold_oil = self._ratio(gold, oil) if gold and oil else []
        gold_copper = self._ratio(gold, copper) if gold and copper else []
        gold_lumber = self._ratio(gold, lumber) if gold and lumber else []

        # Dr. Copper standalone (daily futures)
        copper_fut = await self._raw_market("COPPER_FUT", cutoff)

        # Asian tech/risk proxies
        kospi = await self._raw_market("KOSPI", cutoff)
        taiex = await self._raw_market("TAIEX", cutoff)

        ipo = await self._raw_market("IPO_ETF", cutoff)
        lei = await self._raw_market("LEI", cutoff)
        cnlei = await self._raw_market("CNLEI", cutoff)

        # ── Page 3: Risk Appetite & Relative Performance ──
        sphb = await self._raw_factor("SPHB", cutoff)
        splv = await self._raw_factor("SPLV", cutoff)
        xly = await self._raw_sector("XLY", cutoff)
        xlp = await self._raw_sector("XLP", cutoff)
        xlk = await self._raw_sector("XLK", cutoff)
        xlb = await self._raw_sector("XLB", cutoff)
        ivv = await self._raw_market("IVV", cutoff)
        ijr = await self._raw_market("IJR", cutoff)
        iwc = await self._raw_factor("IWC", cutoff)
        eem = await self._raw_factor("EEM", cutoff)
        vea = await self._raw_market("VEA", cutoff)

        # Credit spreads: HYG/IEI (high yield vs treasuries)
        hyg = await self._raw_market("HYG", cutoff)
        iei = await self._raw_market("IEI_ETF", cutoff)

        # XLF relative strength (financials vs broad market)
        xlf = await self._raw_sector("XLF", cutoff)

        return {
            "spx": self._to_list(spx),
            # Page 1: Fixed Income & Liquidity
            "inflation_expectations": inflation_exp,
            "real_yields": real_yields,
            "yield_spread_10y_2y": spread_10y2y,
            "forward_fed_rate": fwd_rate,
            "central_bank_bs": central_bank_bs,
            "us_liquidity": us_liquidity,
            "move": self._to_list(move_data),
            "rrp": self._to_list(rrp_series),
            "tga": self._to_list(tga_data),
            "sofr_ff_spread": sofr_ff_spread,
            # Page 2: Commodities & Global Activity
            "gold_oil": gold_oil,
            "gold_copper": gold_copper,
            "gold_lumber": gold_lumber,
            "copper": self._to_list(copper_fut),
            "kospi": self._to_list(kospi),
            "taiex": self._to_list(taiex),
            "ipo": self._to_list(ipo),
            "us_lei": self._to_list(lei),
            "cn_lei": self._to_list(cnlei),
            # Page 3: Risk Appetite & Relative Performance
            "high_beta_low_beta": self._ratio(sphb, splv),
            "cyclical_non_cyclical": self._ratio(xly, xlp),
            "tech_materials": self._ratio(xlk, xlb),
            "large_small": self._ratio(ivv, ijr),
            "micro_small": self._ratio(iwc, ijr),
            "em_dm": self._ratio(eem, vea),
            "hyg_iei": self._ratio(hyg, iei) if hyg and iei else [],
            "xlf_relative": self._ratio(xlf, spx) if xlf and spx else [],
        }

    # ------------------------------------------------------------------
    # Cross-Asset Radar (dashboard 5×4 grid — same data sources as macro overview)
    # ------------------------------------------------------------------

    def _last_value(self, series: list[dict]) -> float | None:
        """Last value from [{date, value}, ...] or None."""
        if not series:
            return None
        return float(series[-1]["value"])

    def _pct_change_over_period(
        self, series: list[dict], days_back: int
    ) -> float | None:
        """Approximate % change: last vs point ~days_back ago (by date)."""
        if not series or len(series) < 2:
            return None
        cutoff = date.today() - timedelta(days=days_back)
        parsed = []
        for s in series:
            d = s.get("date")
            v = s.get("value")
            if d is None or v is None:
                continue
            try:
                dt = d if isinstance(d, date) else date.fromisoformat(str(d).split("T")[0])
            except Exception:
                continue
            parsed.append((dt, float(v)))
        if len(parsed) < 2:
            return None
        parsed.sort(key=lambda x: x[0])
        past_val = next((v for d, v in reversed(parsed) if d <= cutoff), None)
        if past_val is None:
            past_val = parsed[0][1]
        last_val = parsed[-1][1]
        if past_val == 0:
            return None
        return round(((last_val - past_val) / past_val) * 100, 2)
    def _signal_from_change(self, change: float | None, up_good: bool) -> str:
        if change is None:
            return "neutral"
        thresh = 2.0
        if up_good:
            return "bullish" if change > thresh else ("bearish" if change < -thresh else "neutral")
        return "bearish" if change > thresh else ("bullish" if change < -thresh else "neutral")

    async def get_cross_asset_radar(self) -> list[dict]:
        """Values for all 20 Cross-Asset Radar cells (same sources as macro overview)."""
        cutoff = date.today() - timedelta(days=180)
        overview = await self.get_macro_overview(180)

        def cell(name: str, value: float | None, unit: str, signal: str) -> dict:
            return {"name": name, "value": value, "unit": unit, "signal": signal}

        cells: list[dict] = []
        # Row 1: Yields and credit
        y10 = await self._yield_series("10Y", cutoff)
        y2 = await self._yield_series("2Y", cutoff)
        spread_bps = None
        if y10 and y2:
            common = sorted(set(y10) & set(y2))
            if common:
                d = common[-1]
                spread_bps = round((y10[d] - y2[d]) * 100, 1)
        sig = "bullish" if (spread_bps is not None and spread_bps > 0) else ("bearish" if (spread_bps is not None and spread_bps < 0) else "neutral")
        cells.append(cell("Yield Curve 2s10s", spread_bps, "bp", sig))

        real_10y = None
        be10 = await self._breakeven_series("10Y", cutoff)
        if y10 and be10:
            common = sorted(set(y10) & set(be10))
            if common:
                d = common[-1]
                real_10y = round(y10[d] - be10[d], 2)
        sig = "bearish" if (real_10y is not None and real_10y > 1.5) else ("bullish" if (real_10y is not None and real_10y < 0) else "neutral")
        cells.append(cell("Real Yields 10Y TIPS", real_10y, "%", sig))

        nom_10y = round(sorted(y10.values())[-1], 2) if y10 else None
        cells.append(cell("Nominal 10Y Yield", nom_10y, "%", "neutral"))

        hy_spread = await self._raw_market("HY_SPREAD", cutoff)
        hy_bps = round(list(hy_spread.values())[-1], 0) if hy_spread else None
        cells.append(cell("Credit Spreads HY OAS", hy_bps, "bp", "neutral" if hy_bps is None else ("bearish" if hy_bps > 400 else "bullish")))

        cells.append(cell("Financial Conditions Index", None, "", "neutral"))

        # Row 2: VIX, DXY, Fed BS trend, Junk vs IG, Put/Call
        vix_data = await self._raw_market("VIX", cutoff)
        vix_val = round(list(vix_data.values())[-1], 1) if vix_data else None
        sig = "bullish" if (vix_val is not None and vix_val < 15) else ("bearish" if (vix_val is not None and vix_val > 30) else "neutral")
        cells.append(cell("VIX", vix_val, "", sig))

        dxy_data = await self._raw_market("DXY", cutoff)
        dxy_chg = None
        if dxy_data and len(dxy_data) >= 2:
            dates = sorted(dxy_data.keys())
            v30 = dxy_data.get(dates[-1] - timedelta(days=30)) or list(dxy_data.values())[0]
            v_now = list(dxy_data.values())[-1]
            dxy_chg = round(((v_now - v30) / v30) * 100, 1) if v30 else None
        sig = self._signal_from_change(dxy_chg, False)
        cells.append(cell("DXY", dxy_chg, "%", sig))

        bs_trend = None
        cb_bs = overview.get("central_bank_bs") or []
        if len(cb_bs) >= 2:
            idx_0 = max(0, len(cb_bs) - 1 - 12)
            v0 = cb_bs[idx_0]["value"]
            v1 = cb_bs[-1]["value"]
            if v0 and v0 != 0:
                bs_trend = round(((v1 - v0) / v0) * 100, 1)
        cells.append(cell("Fed Balance Sheet Trend", bs_trend, "%", self._signal_from_change(bs_trend, True)))

        hyg_iei = self._last_value(overview.get("hyg_iei") or [])
        hyg_iei_chg = self._pct_change_over_period(overview.get("hyg_iei") or [], 90)
        cells.append(cell("Junk vs IG", hyg_iei_chg, "%", self._signal_from_change(hyg_iei_chg, True)))
        cells.append(cell("Equity Put/Call Ratio", None, "", "neutral"))

        # Row 3: Commodities
        gold_data = await self._raw_market("GOLD", cutoff)
        gold_chg = None
        if gold_data and len(gold_data) >= 2:
            dates = sorted(gold_data.keys())
            v30 = gold_data.get(dates[-1] - timedelta(days=30)) or list(gold_data.values())[0]
            v_now = list(gold_data.values())[-1]
            gold_chg = round(((v_now - v30) / v30) * 100, 1) if v30 else None
        cells.append(cell("Gold", gold_chg, "%", self._signal_from_change(gold_chg, True)))

        oil_data = await self._raw_market("WTI_OIL", cutoff)
        oil_chg = None
        if oil_data and len(oil_data) >= 2:
            dates = sorted(oil_data.keys())
            v30 = oil_data.get(dates[-1] - timedelta(days=30)) or list(oil_data.values())[0]
            v_now = list(oil_data.values())[-1]
            oil_chg = round(((v_now - v30) / v30) * 100, 1) if v30 else None
        cells.append(cell("Oil", oil_chg, "%", self._signal_from_change(oil_chg, True)))

        copper_list = overview.get("copper") or []
        if not copper_list:
            copper_fut = await self._raw_market("COPPER_FUT", cutoff)
            copper_list = self._to_list(copper_fut) if copper_fut else []
        copper_chg = self._pct_change_over_period(copper_list, 30)
        cells.append(cell("Copper", copper_chg, "%", self._signal_from_change(copper_chg, True)))
        cells.append(cell("Broad Commodities Index", None, "", "neutral"))
        em_dm_chg = self._pct_change_over_period(overview.get("em_dm") or [], 90)
        cells.append(cell("EM vs DM", em_dm_chg, "%", self._signal_from_change(em_dm_chg, True)))

        # Row 4: Factor ratios
        large_small_chg = self._pct_change_over_period(overview.get("large_small") or [], 90)
        cells.append(cell("Small Cap vs Large Cap", large_small_chg, "%", self._signal_from_change(large_small_chg, True)))
        tech_mat_chg = self._pct_change_over_period(overview.get("tech_materials") or [], 90)
        cells.append(cell("Growth vs Value", tech_mat_chg, "%", self._signal_from_change(tech_mat_chg, True)))
        hb_lb_chg = self._pct_change_over_period(overview.get("high_beta_low_beta") or [], 90)
        cells.append(cell("High Beta vs Low Beta", hb_lb_chg, "%", self._signal_from_change(hb_lb_chg, True)))
        cyc_def_chg = self._pct_change_over_period(overview.get("cyclical_non_cyclical") or [], 90)
        cells.append(cell("Cyclicals vs Defensives", cyc_def_chg, "%", self._signal_from_change(cyc_def_chg, True)))
        cells.append(cell("EPS Revisions Breadth", None, "", "neutral"))

        return cells

    # ------------------------------------------------------------------
    # Major Indices & Bitcoin dashboard
    # ------------------------------------------------------------------

    async def get_indices_dashboard(self, days: int = 365 * 5) -> dict:
        """Price data with computed 200-day MA for major indices + BTC."""
        ma_window = 200
        cutoff = date.today() - timedelta(days=days)
        extended_cutoff = date.today() - timedelta(days=days + ma_window + 60)

        index_map = {
            "spx": "SP500",
            "ndx": "NDX",
            "rut": "RUT",
            "dji": "DJI",
            "btc": "BTC",
        }

        result: dict = {}
        for key, symbol in index_map.items():
            raw = await self._raw_any(symbol, extended_cutoff)
            if not raw:
                result[key] = []
                continue

            sorted_dates = sorted(raw.keys())
            values = [raw[d] for d in sorted_dates]

            merged = []
            for i, d in enumerate(sorted_dates):
                if d < cutoff:
                    continue
                ma = None
                if i >= ma_window - 1:
                    window = values[i - ma_window + 1: i + 1]
                    ma = round(sum(window) / ma_window, 2)
                merged.append({
                    "date": d.isoformat(),
                    "price": round(raw[d], 2),
                    "ma200": ma,
                })
            result[key] = merged

        # Breadth sub-charts: % of stocks above 200MA / 50MA per index
        breadth_map = {
            "spx_above200": "MMTH",
            "spx_above50": "MMFI",
            "ndx_above200": "NAA200",
            "ndx_above50": "NAA50",
            "rut_above200": "MMTH",
            "rut_above50": "MMFI",
            "dji_above200": "MMTH",
            "dji_above50": "MMFI",
        }
        for key, symbol in breadth_map.items():
            data = await self._raw_market(symbol, cutoff)
            result[key] = self._to_list(data) if data else []

        # BTC & Stablecoin dominance (CoinGecko — current only, no historical)
        try:
            import httpx
            r = httpx.get("https://api.coingecko.com/api/v3/global", timeout=10)
            if r.status_code == 200:
                j = r.json()
                mc = j.get("data", {}).get("market_cap_percentage", {})
                result["btc_dominance_current"] = mc.get("btc")
                # Stablecoins: usdt + usdc + dai + busd + tusd
                result["stable_dominance_current"] = sum(
                    mc.get(k, 0) for k in ["usdt", "usdc", "dai", "busd", "tusd"]
                )
            else:
                result["btc_dominance_current"] = None
                result["stable_dominance_current"] = None
        except Exception:
            logger.debug("CoinGecko dominance fetch failed", exc_info=True)
            result["btc_dominance_current"] = None
            result["stable_dominance_current"] = None

        return result

    # ------------------------------------------------------------------
    # Rates & Yield Curve dashboard
    # ------------------------------------------------------------------

    async def get_rates_dashboard(self, days: int = 365 * 5) -> dict:
        """Rates, real yields, forward rate, and breakeven spread."""
        cutoff = date.today() - timedelta(days=days)

        y2 = await self._yield_series("2Y", cutoff)
        y5 = await self._yield_series("5Y", cutoff)
        y10 = await self._yield_series("10Y", cutoff)
        y30 = await self._yield_series("30Y", cutoff)

        be5 = await self._breakeven_series("5Y", cutoff)
        be10 = await self._breakeven_series("10Y", cutoff)

        # 5Y Real Yield = nominal − breakeven
        real_5y = [
            {"date": d.isoformat(), "value": round(y5[d] - be5[d], 4)}
            for d in sorted(set(y5) & set(be5))
        ]

        # 10Y Real Yield
        real_10y = [
            {"date": d.isoformat(), "value": round(y10[d] - be10[d], 4)}
            for d in sorted(set(y10) & set(be10))
        ]

        # Forward Fed Funds Rate from ZQ futures (100 − price)
        zq = await self._raw_market("ZQ", cutoff)
        fwd_rate = [
            {"date": d.isoformat(), "value": round(100 - v, 4)}
            for d, v in sorted(zq.items())
        ] if zq else []

        # Multi-yield overlay (2Y/5Y/10Y/30Y on one chart)
        all_dates = sorted(
            (set(y2) | set(y5) | set(y10) | set(y30))
            - {d for d in (set(y2) | set(y5) | set(y10) | set(y30))
               if d < cutoff}
        )
        yield_overlay = []
        for d in all_dates:
            pt: dict = {"date": d.isoformat()}
            if d in y2:
                pt["y2"] = y2[d]
            if d in y5:
                pt["y5"] = y5[d]
            if d in y10:
                pt["y10"] = y10[d]
            if d in y30:
                pt["y30"] = y30[d]
            yield_overlay.append(pt)

        # TIPS breakeven spread (10Y − 5Y inflation premium)
        be_spread = [
            {"date": d.isoformat(), "value": round(be10[d] - be5[d], 4)}
            for d in sorted(set(be5) & set(be10))
        ]

        return {
            "forward_fed_rate": fwd_rate,
            "yield_overlay": yield_overlay,
            "real_yield_5y": real_5y,
            "real_yield_10y": real_10y,
            "yield_2y": self._to_list(y2),
            "breakeven_spread_10y_5y": be_spread,
        }

    # ------------------------------------------------------------------
    # Sentiment dashboard
    # ------------------------------------------------------------------

    def _rebase_group(
        self,
        group_data: list[dict[date, float]],
        cutoff: date,
    ) -> list[dict]:
        """Average multiple series and rebase to 0% from first common date."""
        if not group_data:
            return []

        all_dates = set()
        for d in group_data:
            all_dates |= set(d.keys())
        all_dates = sorted(d for d in all_dates if d >= cutoff)
        if not all_dates:
            return []

        merged: list[tuple[date, float]] = []
        for d in all_dates:
            vals = [s[d] for s in group_data if d in s]
            if vals:
                merged.append((d, sum(vals) / len(vals)))

        if not merged:
            return []
        base = merged[0][1]
        if base == 0:
            return []
        return [
            {"date": d.isoformat(),
             "value": round(((v / base) - 1) * 100, 2)}
            for d, v in merged
        ]

    async def get_sentiment_dashboard(self, days: int = 365) -> dict:
        """Sector group rotation + macro context sub-indicators."""
        cutoff = date.today() - timedelta(days=days)

        # Sector groups
        non_cyc_syms = ["XLP", "XLU", "XLV"]
        cyc_syms = ["XLY", "XLB", "XLE", "XLRE", "XLI"]
        sensitive_syms = ["XLF", "XLC", "XLK"]

        non_cyc = [await self._raw_sector(s, cutoff) for s in non_cyc_syms]
        cyclical = [await self._raw_sector(s, cutoff) for s in cyc_syms]
        sensitive = [await self._raw_sector(s, cutoff) for s in sensitive_syms]

        # High Beta / Low Vol ratio (single series, not averaged)
        sphb = await self._raw_factor("SPHB", cutoff)
        splv = await self._raw_factor("SPLV", cutoff)
        hb_ratio = self._ratio(sphb, splv) if sphb and splv else []
        # Rebase to 0%
        if hb_ratio:
            base = hb_ratio[0]["value"]
            if base != 0:
                hb_ratio = [
                    {"date": p["date"],
                     "value": round(((p["value"] / base) - 1) * 100, 2)}
                    for p in hb_ratio
                ]

        # GLD & TLT defensive rotation
        gld = await self._raw_market("GLD", cutoff)
        tlt = await self._raw_market("TLT", cutoff)
        gld_rebased = self._rebase_group([gld], cutoff) if gld else []
        tlt_rebased = self._rebase_group([tlt], cutoff) if tlt else []

        # Sub-indicators
        # 1. Inversion: 10Y-2Y spread + recession bands
        y10 = await self._yield_series("10Y", cutoff)
        y2 = await self._yield_series("2Y", cutoff)
        inversion = [
            {"date": d.isoformat(),
             "value": round(y10[d] - y2[d], 4)}
            for d in sorted(set(y10) & set(y2))
        ]

        # 2. US Interest Rate (EFFR)
        effr = await self._raw_market("EFFR_DAILY", cutoff)

        # 3. US Inflation (CPI YoY) — from indicator_values
        from app.services.inflation_service import InflationService
        infl_svc = InflationService(self.db)
        cpi_yoy = await infl_svc.get_inflation_series("CPI", "yoy", days)

        return {
            "non_cyclical": self._rebase_group(
                [d for d in non_cyc if d], cutoff),
            "cyclical": self._rebase_group(
                [d for d in cyclical if d], cutoff),
            "sensitive": self._rebase_group(
                [d for d in sensitive if d], cutoff),
            "high_beta": hb_ratio,
            "gld": gld_rebased,
            "tlt": tlt_rebased,
            "inversion": inversion,
            "effr": self._to_list(effr) if effr else [],
            "cpi_yoy": cpi_yoy,
        }

    # ------------------------------------------------------------------
    # Currency dashboard
    # ------------------------------------------------------------------

    async def get_currency_dashboard(self, days: int = 365 * 5) -> dict:
        """Currency index multiline + macro context sub-indicators."""
        cutoff = date.today() - timedelta(days=days)

        # FX pairs from FRED (MarketData table)
        # EXY≈EURUSD, BXY≈GBPUSD, AXY≈AUDUSD are direct (higher=currency stronger)
        # CXY≈1/USDCAD, JXY≈1/USDJPY, CNY≈1/USDCNH need inversion
        fx_config: list[tuple[str, str, bool]] = [
            ("DXY", "DXY", False),
            ("EXY (EUR)", "EURUSD", False),
            ("BXY (GBP)", "GBPUSD", False),
            ("AXY (AUD)", "AUDUSD", False),
            ("CXY (CAD)", "USDCAD", True),
            ("JXY (JPY)", "USDJPY", True),
            ("CNY", "USDCNH", True),
            ("CEW (EM FX)", "CEW", False),
        ]

        lines: list[dict] = []
        for label, symbol, invert in fx_config:
            raw = await self._raw_market(symbol, cutoff)
            if not raw:
                continue
            sorted_dates = sorted(raw.keys())
            if invert:
                vals = {d: 1.0 / raw[d] for d in sorted_dates if raw[d] != 0}
            else:
                vals = {d: raw[d] for d in sorted_dates}

            if not vals:
                continue
            first_val = vals[sorted_dates[0]] if not invert else vals.get(sorted_dates[0])
            if not first_val:
                continue
            series = [
                {"date": d.isoformat(),
                 "value": round(((v / first_val) - 1) * 100, 2)}
                for d, v in sorted(vals.items())
            ]
            lines.append({"symbol": label, "series": series})

        # Sub-indicators (same as Sentiment)
        y10 = await self._yield_series("10Y", cutoff)
        y2 = await self._yield_series("2Y", cutoff)
        inversion = [
            {"date": d.isoformat(), "value": round(y10[d] - y2[d], 4)}
            for d in sorted(set(y10) & set(y2))
        ]

        effr = await self._raw_market("EFFR_DAILY", cutoff)

        from app.services.inflation_service import InflationService
        infl_svc = InflationService(self.db)
        cpi_yoy = await infl_svc.get_inflation_series("CPI", "yoy", days)

        return {
            "lines": lines,
            "inversion": inversion,
            "effr": self._to_list(effr) if effr else [],
            "cpi_yoy": cpi_yoy,
        }

    # ------------------------------------------------------------------
    # S&P 500 Sectors dashboard
    # ------------------------------------------------------------------

    async def get_sectors_dashboard(self, days: int = 365) -> dict:
        """All S&P 500 sector ETFs + XME + BTC rebased to 0%."""
        cutoff = date.today() - timedelta(days=days)

        sector_config: list[tuple[str, str, str]] = [
            ("SPY", "S&P 500 (SPY)", "#ffffff"),
            ("XLE", "XLE - Energy", "#ef4444"),
            ("XLB", "XLB - Materials", "#f97316"),
            ("XLRE", "XLRE - Real Estate", "#a3e635"),
            ("XLU", "XLU - Utilities", "#22d3ee"),
            ("XLK", "XLK - Technology", "#22c55e"),
            ("XLI", "XLI - Industrials", "#c084fc"),
            ("XLV", "XLV - Health Care", "#f472b6"),
            ("XLF", "XLF - Financials", "#60a5fa"),
            ("XLP", "XLP - Consumer Staples", "#fbbf24"),
            ("XLY", "XLY - Consumer Discretionary", "#e879f9"),
            ("XLC", "XLC - Communication Services", "#a78bfa"),
            ("XME", "XME - Metals & Mining", "#fb923c"),
        ]

        lines: list[dict] = []
        for symbol, label, color in sector_config:
            raw = await self._raw_sector(symbol, cutoff)
            if not raw:
                continue
            sorted_dates = sorted(raw.keys())
            base = raw[sorted_dates[0]]
            if base == 0:
                continue
            series = [
                {"date": d.isoformat(),
                 "value": round(((raw[d] / base) - 1) * 100, 2)}
                for d in sorted_dates
            ]
            lines.append({"symbol": label, "series": series, "color": color})

        # BTC from MarketData
        btc = await self._raw_market("BTC", cutoff)
        if btc:
            sorted_dates = sorted(btc.keys())
            base = btc[sorted_dates[0]]
            if base != 0:
                btc_series = [
                    {"date": d.isoformat(),
                     "value": round(((btc[d] / base) - 1) * 100, 2)}
                    for d in sorted_dates
                ]
                lines.append({
                    "symbol": "BTC - Bitcoin",
                    "series": btc_series,
                    "color": "#f59e0b",
                })

        # Sub-indicators
        y10 = await self._yield_series("10Y", cutoff)
        y2 = await self._yield_series("2Y", cutoff)
        inversion = [
            {"date": d.isoformat(), "value": round(y10[d] - y2[d], 4)}
            for d in sorted(set(y10) & set(y2))
        ]

        effr = await self._raw_market("EFFR_DAILY", cutoff)

        from app.services.inflation_service import InflationService
        infl_svc = InflationService(self.db)
        cpi_yoy = await infl_svc.get_inflation_series("CPI", "yoy", days)

        return {
            "lines": lines,
            "inversion": inversion,
            "effr": self._to_list(effr) if effr else [],
            "cpi_yoy": cpi_yoy,
        }

    async def get_fx_relative_strength(self, period_days: int = 365) -> list[dict]:
        """FX pairs rebased to 0%."""
        cutoff = date.today() - timedelta(days=period_days)
        fx_symbols = ["EURUSD", "USDJPY", "GBPUSD", "USDCAD", "AUDUSD", "USDCHF", "DXY"]
        result = []
        for sym in fx_symbols:
            q = (
                select(MarketData.date, MarketData.value)
                .where(MarketData.symbol == sym, MarketData.date >= cutoff)
                .order_by(MarketData.date)
            )
            rows = (await self.db.execute(q)).all()
            if not rows:
                continue
            base = rows[0].value
            series = [
                {"date": r.date.isoformat(), "value": round(((r.value / base) - 1) * 100, 2)}
                for r in rows if base != 0
            ]
            result.append({
                "symbol": sym,
                "series": series,
                "current": rows[-1].value,
                "change_pct": round(((rows[-1].value / base) - 1) * 100, 2) if base else 0,
            })
        return result
