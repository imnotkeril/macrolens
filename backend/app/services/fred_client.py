import logging
from datetime import date, timedelta
from typing import Any

import pandas as pd
from fredapi import Fred

from app.config import get_settings

logger = logging.getLogger(__name__)

# Complete FRED series ID mapping for all tracked indicators
INDICATOR_SERIES: dict[str, dict[str, Any]] = {
    # --- HOUSING (Leading) ---
    "Building Permits": {
        "fred_id": "PERMIT",
        "category": "housing",
        "importance": 3,
        "type": "leading",
        "frequency": "monthly",
        "source": "U.S. Census Bureau",
        "unit": "Thousands",
    },
    "Housing Starts": {
        "fred_id": "HOUST",
        "category": "housing",
        "importance": 3,
        "type": "leading",
        "frequency": "monthly",
        "source": "U.S. Census Bureau",
        "unit": "Thousands",
    },
    "New Home Sales": {
        "fred_id": "HSN1F",
        "category": "housing",
        "importance": 3,
        "type": "leading",
        "frequency": "monthly",
        "source": "U.S. Census Bureau",
        "unit": "Thousands",
    },
    "Existing Home Sales": {
        "fred_id": "EXHOSLUSM495S",
        "category": "housing",
        "importance": 3,
        "type": "leading",
        "frequency": "monthly",
        "source": "NAR",
        "unit": "Millions",
    },
    "Case-Shiller Home Price Index": {
        "fred_id": "CSUSHPISA",
        "category": "housing",
        "importance": 3,
        "type": "leading",
        "frequency": "monthly",
        "source": "S&P Dow Jones / Case-Shiller",
        "unit": "Index Jan 2000=100",
    },
    # --- ORDERS / PRODUCTION (Coincident) ---
    "Chicago Fed National Activity Index": {
        "fred_id": "CFNAI",
        "category": "orders",
        "importance": 3,
        "type": "coincident",
        "frequency": "monthly",
        "source": "Federal Reserve Bank of Chicago",
        "unit": "Index",
    },
    "Consumer Sentiment (Michigan)": {
        "fred_id": "UMCSENT",
        "category": "orders",
        "importance": 3,
        "type": "leading",
        "frequency": "monthly",
        "source": "University of Michigan",
        "unit": "Index 1966Q1=100",
    },
    "Durable Goods Orders": {
        "fred_id": "DGORDER",
        "category": "orders",
        "importance": 3,
        "type": "coincident",
        "frequency": "monthly",
        "source": "U.S. Census Bureau",
        "unit": "Millions USD",
    },
    "Industrial Production": {
        "fred_id": "INDPRO",
        "category": "orders",
        "importance": 3,
        "type": "coincident",
        "frequency": "monthly",
        "source": "Federal Reserve",
        "unit": "Index 2017=100",
    },
    "Capacity Utilization": {
        "fred_id": "TCU",
        "category": "orders",
        "importance": 3,
        "type": "coincident",
        "frequency": "monthly",
        "source": "Federal Reserve",
        "unit": "Percent",
    },
    "Factory Orders": {
        "fred_id": "AMTMNO",
        "category": "orders",
        "importance": 2,
        "type": "coincident",
        "frequency": "monthly",
        "source": "U.S. Census Bureau",
        "unit": "Millions USD",
    },
    "Business Inventories": {
        "fred_id": "BUSINV",
        "category": "orders",
        "importance": 2,
        "type": "coincident",
        "frequency": "monthly",
        "source": "U.S. Census Bureau",
        "unit": "Millions USD",
    },
    # --- INCOME / SALES (Coincident) ---
    "Retail Sales": {
        "fred_id": "RSAFS",
        "category": "income_sales",
        "importance": 3,
        "type": "coincident",
        "frequency": "monthly",
        "source": "U.S. Census Bureau",
        "unit": "Millions USD",
    },
    "Personal Income": {
        "fred_id": "PI",
        "category": "income_sales",
        "importance": 3,
        "type": "coincident",
        "frequency": "monthly",
        "source": "BEA",
        "unit": "Billions USD",
    },
    "Personal Spending": {
        "fred_id": "PCE",
        "category": "income_sales",
        "importance": 3,
        "type": "coincident",
        "frequency": "monthly",
        "source": "BEA",
        "unit": "Billions USD",
    },
    # --- EMPLOYMENT (Lagging) ---
    "Nonfarm Payrolls": {
        "fred_id": "PAYEMS",
        "category": "employment",
        "importance": 3,
        "type": "lagging",
        "frequency": "monthly",
        "source": "BLS",
        "unit": "Thousands",
    },
    "Unemployment Rate": {
        "fred_id": "UNRATE",
        "category": "employment",
        "importance": 3,
        "type": "lagging",
        "frequency": "monthly",
        "source": "BLS",
        "unit": "Percent",
    },
    "Initial Jobless Claims": {
        "fred_id": "ICSA",
        "category": "employment",
        "importance": 3,
        "type": "coincident",
        "frequency": "weekly",
        "source": "DOL",
        "unit": "Thousands",
    },
    "JOLTS Job Openings": {
        "fred_id": "JTSJOL",
        "category": "employment",
        "importance": 3,
        "type": "coincident",
        "frequency": "monthly",
        "source": "BLS",
        "unit": "Thousands",
    },
    "Average Hourly Earnings": {
        "fred_id": "CES0500000003",
        "category": "employment",
        "importance": 3,
        "type": "lagging",
        "frequency": "monthly",
        "source": "BLS",
        "unit": "USD",
    },
    # --- INFLATION ---
    "CPI": {
        "fred_id": "CPIAUCSL",
        "category": "inflation",
        "importance": 3,
        "type": "lagging",
        "frequency": "monthly",
        "source": "BLS",
        "unit": "Index 1982-84=100",
    },
    "Core CPI": {
        "fred_id": "CPILFESL",
        "category": "inflation",
        "importance": 3,
        "type": "lagging",
        "frequency": "monthly",
        "source": "BLS",
        "unit": "Index 1982-84=100",
    },
    "Core PCE": {
        "fred_id": "PCEPILFE",
        "category": "inflation",
        "importance": 3,
        "type": "lagging",
        "frequency": "monthly",
        "source": "BEA",
        "unit": "Index 2017=100",
    },
    "PPI": {
        "fred_id": "PPIACO",
        "category": "inflation",
        "importance": 3,
        "type": "leading",
        "frequency": "monthly",
        "source": "BLS",
        "unit": "Index 1982=100",
    },
    "PCE": {
        "fred_id": "PCEPI",
        "category": "inflation",
        "importance": 3,
        "type": "lagging",
        "frequency": "monthly",
        "source": "BEA",
        "unit": "Index 2017=100",
    },
    "Core PPI": {
        "fred_id": "PPIFES",
        "category": "inflation",
        "importance": 3,
        "type": "leading",
        "frequency": "monthly",
        "source": "BLS",
        "unit": "Index Nov 2009=100",
    },
    # --- Tier 2 additional ---
    "Manufacturers New Orders": {
        "fred_id": "NEWORDER",
        "category": "orders",
        "importance": 3,
        "type": "leading",
        "frequency": "monthly",
        "source": "U.S. Census Bureau",
        "unit": "Millions USD",
    },
    "Consumer Goods New Orders": {
        "fred_id": "ACDGNO",
        "category": "orders",
        "importance": 2,
        "type": "coincident",
        "frequency": "monthly",
        "source": "U.S. Census Bureau",
        "unit": "Millions USD",
    },
    "Monthly Supply of New Houses": {
        "fred_id": "MSACSR",
        "category": "housing",
        "importance": 2,
        "type": "leading",
        "frequency": "monthly",
        "source": "U.S. Census Bureau",
        "unit": "Months Supply",
    },
    "Construction Spending": {
        "fred_id": "TLRESCONS",
        "category": "housing",
        "importance": 2,
        "type": "leading",
        "frequency": "monthly",
        "source": "U.S. Census Bureau",
        "unit": "Millions USD",
    },
    "30-Year Mortgage Rate": {
        "fred_id": "MORTGAGE30US",
        "category": "housing",
        "importance": 3,
        "type": "leading",
        "frequency": "weekly",
        "source": "Freddie Mac",
        "unit": "Percent",
    },
    "Inventories/Sales Ratio": {
        "fred_id": "ISRATIO",
        "category": "orders",
        "importance": 2,
        "type": "coincident",
        "frequency": "monthly",
        "source": "U.S. Census Bureau",
        "unit": "Ratio",
    },
}

# FRED series for Fed policy data
FED_SERIES = {
    "fed_funds_upper": "DFEDTARU",
    "fed_funds_lower": "DFEDTARL",
    "effr": "DFF",
    "balance_total": "WALCL",
    "balance_treasuries": "TREAST",
    "balance_mbs": "WSHOMCB",
    "balance_reserves": "WRESBAL",
}

# FRED series for yield curve
YIELD_SERIES = {
    "3M": "DGS3MO",
    "1Y": "DGS1",
    "2Y": "DGS2",
    "3Y": "DGS3",
    "5Y": "DGS5",
    "7Y": "DGS7",
    "10Y": "DGS10",
    "20Y": "DGS20",
    "30Y": "DGS30",
}

TIPS_SERIES = {
    "5Y": "DFII5",
    "10Y": "DFII10",
    "20Y": "DFII20",
    "30Y": "DFII30",
}

BREAKEVEN_SERIES = {
    "5Y": "T5YIE",
    "10Y": "T10YIE",
    "20Y": "T20YIEM",
    "30Y": "T30YIEM",
}

# Cross-asset market data
MARKET_SERIES = {
    "WTI_OIL": "DCOILWTICO",
    "COPPER": "PCOPPUSDM",
    "DXY": "DTWEXBGS",
    "VIX": "VIXCLS",
    "SP500": "SP500",
    "TGA": "WTREGEN",
    "RRP": "RRPONTSYD",
    "USREC": "USREC",
}

# Regime / Cycle Radar series (stored in market_data table)
# NAPM/NAPMNOI/ISMPMN/DGNO not available; use OECD manufacturing confidence + DGORDER
REGIME_SERIES = {
    "ISM_PMI": "BSCICP02USM460S",
    "ISM_NEW_ORDERS": "DGORDER",
    "HY_SPREAD": "BAMLH0A0HYM2",
    "IG_SPREAD": "BAMLC0A0CM",
    "LEI": "USSLIND",
    "SAHM_RULE": "SAHMREALTIME",
    "SLOOS": "DRTSCILM",
    "REAL_GDP": "A191RL1Q225SBEA",
    "M2": "M2SL",
    "CONSUMER_CREDIT": "TOTALSL",
}

MACRO_OVERVIEW_SERIES = {
    "CNLEI": "CHNLOLITONOSTSAM",  # China OECD Composite Leading Indicator
    "ECBBS": "ECBASSETSW",        # ECB Total Assets (weekly, EUR millions)
    "SOFR": "SOFR",               # Secured Overnight Financing Rate (daily, %)
    "EFFR_DAILY": "DFF",          # Effective Federal Funds Rate (daily, %)
    "MICH": "MICH",               # Michigan 5Y Inflation Expectations (monthly, %)
    "STICKY_CPI": "CORESTICKM159SFRBATL",  # Sticky CPI ex F&E YoY (Atlanta Fed)
}

# Foreign exchange rates
FX_SERIES = {
    "EURUSD": "DEXUSEU",
    "USDJPY": "DEXJPUS",
    "GBPUSD": "DEXUSUK",
    "USDCAD": "DEXCAUS",
    "AUDUSD": "DEXUSAL",
    "USDCHF": "DEXSZUS",
}


class FredClient:
    """Wrapper around the FRED API with error handling and rate-limit awareness."""

    def __init__(self, historical_years: int | None = None):
        settings = get_settings()
        if not settings.fred_api_key:
            logger.warning("FRED_API_KEY not set — data collection will fail")
        self._fred = Fred(api_key=settings.fred_api_key) if settings.fred_api_key else None
        self._historical_years = (
            int(historical_years) if historical_years is not None else settings.historical_years
        )

    @property
    def is_configured(self) -> bool:
        return self._fred is not None

    def _start_date(self) -> str:
        return (date.today() - timedelta(days=365 * self._historical_years)).isoformat()

    def get_series(
        self,
        series_id: str,
        start: str | None = None,
        end: str | None = None,
    ) -> pd.Series:
        if not self.is_configured:
            raise RuntimeError("FRED API key not configured")
        start = start or self._start_date()
        end = end or date.today().isoformat()
        try:
            data = self._fred.get_series(
                series_id,
                observation_start=start,
                observation_end=end,
            )
            return data.dropna()
        except Exception:
            logger.exception("Failed to fetch FRED series %s", series_id)
            raise

    def get_latest(self, series_id: str) -> tuple[date, float] | None:
        try:
            data = self.get_series(series_id, start=(date.today() - timedelta(days=90)).isoformat())
            if data.empty:
                return None
            last_date = data.index[-1].date()
            return last_date, float(data.iloc[-1])
        except Exception:
            logger.exception("Failed to get latest for %s", series_id)
            return None

    def get_indicator_data(self, indicator_name: str, start: str | None = None) -> pd.Series:
        meta = INDICATOR_SERIES.get(indicator_name)
        if not meta:
            raise ValueError(f"Unknown indicator: {indicator_name}")
        return self.get_series(meta["fred_id"], start=start)

    def get_all_indicator_series(self) -> dict[str, dict]:
        return INDICATOR_SERIES.copy()

    def get_yield_curve_data(self, start: str | None = None) -> dict[str, pd.Series]:
        result = {}
        for maturity, sid in YIELD_SERIES.items():
            try:
                result[maturity] = self.get_series(sid, start=start)
            except Exception:
                logger.warning("Could not fetch yield series %s (%s)", maturity, sid)
        return result

    def get_tips_data(self, start: str | None = None) -> dict[str, pd.Series]:
        result = {}
        for maturity, sid in TIPS_SERIES.items():
            try:
                result[maturity] = self.get_series(sid, start=start)
            except Exception:
                logger.warning("Could not fetch TIPS series %s", maturity)
        return result

    def get_breakeven_data(self, start: str | None = None) -> dict[str, pd.Series]:
        result = {}
        for maturity, sid in BREAKEVEN_SERIES.items():
            try:
                result[maturity] = self.get_series(sid, start=start)
            except Exception:
                logger.warning("Could not fetch breakeven series %s", maturity)
        return result

    def get_fed_rates(self, start: str | None = None) -> dict[str, pd.Series]:
        result = {}
        for name, sid in FED_SERIES.items():
            if name.startswith("balance"):
                continue
            try:
                result[name] = self.get_series(sid, start=start)
            except Exception:
                logger.warning("Could not fetch Fed rate series %s", name)
        return result

    def get_balance_sheet(self, start: str | None = None) -> dict[str, pd.Series]:
        result = {}
        for name, sid in FED_SERIES.items():
            if not name.startswith("balance"):
                continue
            try:
                result[name] = self.get_series(sid, start=start)
            except Exception:
                logger.warning("Could not fetch balance sheet series %s", name)
        return result

    def get_market_data(self, start: str | None = None) -> dict[str, pd.Series]:
        result = {}
        for name, sid in MARKET_SERIES.items():
            try:
                result[name] = self.get_series(sid, start=start)
            except Exception:
                logger.warning("Could not fetch market series %s (%s)", name, sid)
        return result

    def get_regime_data(self, start: str | None = None) -> dict[str, pd.Series]:
        result = {}
        for name, sid in REGIME_SERIES.items():
            try:
                result[name] = self.get_series(sid, start=start)
            except Exception:
                logger.warning("Could not fetch regime series %s (%s)", name, sid)
        return result

    def get_fx_data(self, start: str | None = None) -> dict[str, pd.Series]:
        result = {}
        for name, sid in FX_SERIES.items():
            try:
                result[name] = self.get_series(sid, start=start)
            except Exception:
                logger.warning("Could not fetch FX series %s (%s)", name, sid)
        return result

    def get_macro_overview_data(
        self, start: str | None = None
    ) -> dict[str, pd.Series]:
        result = {}
        for name, sid in MACRO_OVERVIEW_SERIES.items():
            try:
                result[name] = self.get_series(sid, start=start)
            except Exception:
                logger.warning(
                    "Could not fetch macro overview series %s (%s)",
                    name, sid,
                )
        return result
