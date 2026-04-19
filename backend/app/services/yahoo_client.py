import logging
from datetime import date, timedelta

import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)

YAHOO_MARKET_SERIES = {
    "GOLD": "GC=F",
    "SILVER": "SI=F",
    "BTC": "BTC-USD",
}

YAHOO_SECTOR_ETFS = {
    "XLE": "XLE",
    "XLB": "XLB",
    "XLRE": "XLRE",
    "XLU": "XLU",
    "XLK": "XLK",
    "XLI": "XLI",
    "XLV": "XLV",
    "XLF": "XLF",
    "XLP": "XLP",
    "XLY": "XLY",
    "XLC": "XLC",
    "XME": "XME",
    "SPY": "SPY",
}

YAHOO_INDEX_SERIES = {
    "NDX": "^NDX",
    "RUT": "^RUT",
    "DJI": "^DJI",
}

YAHOO_FACTOR_ETFS = {
    "SPHB": "SPHB",
    "SPLV": "SPLV",
    "IWC": "IWC",
    "EEM": "EEM",
    "EFA": "EFA",
}

YAHOO_EXTRA = {
    "MOVE": "^MOVE",
}

YAHOO_BREADTH_SERIES = {
    "MMTW": "^MMTW",       # % of S&P 500 stocks above 20-day MA
    "MMFI": "^MMFI",       # % of S&P 500 stocks above 50-day MA
    "MMTH": "^MMTH",       # % of S&P 500 stocks above 200-day MA
    "NAA200": "^NAA200",   # % of Nasdaq stocks above 200-day MA
    "NAA50": "^NAA50",     # % of Nasdaq stocks above 50-day MA
    "PCC": "^PCC",         # CBOE Put/Call Ratio
    "NYHGH": "^NYHGH",     # NYSE New Highs
    "NYLOW": "^NYLOW",     # NYSE New Lows
    "NYMO": "^NYMO",       # McClellan Oscillator
    "NYSI": "^NYSI",       # McClellan Summation Index
}

YAHOO_MACRO_ETFS = {
    "GLD": "GLD",          # SPDR Gold Shares ETF
    "TLT": "TLT",          # iShares 20+ Year Treasury Bond ETF
    "TIP": "TIP",          # iShares TIPS Bond ETF
    "IEF": "IEF",          # iShares 7-10 Year Treasury Bond ETF
    "IVV": "IVV",          # iShares Core S&P 500 ETF
    "SPY": "SPY",          # Forecast Lab asset_implied pairs + sector proxy
    "IWM": "IWM",          # Russell 2000 ETF (pairs vs SPY)
    "VTV": "VTV",          # Value factor ETF
    "VUG": "VUG",          # Growth factor ETF
    "XLP": "XLP",          # Consumer Staples (also in sector table; needed in market_data for FL)
    "XLY": "XLY",          # Consumer Discretionary
    "IJR": "IJR",          # iShares Core S&P SmallCap 600 ETF
    "VEA": "VEA",          # Vanguard FTSE Developed Markets ETF
    "IPO_ETF": "IPO",      # Renaissance IPO ETF
    "LUMBER": "LBS=F",     # Random Length Lumber Futures
    "ZQ": "ZQ=F",          # 30-Day Federal Funds Futures
    "HYG": "HYG",          # iShares High Yield Corporate Bond ETF
    "IEI_ETF": "IEI",      # iShares 3-7 Year Treasury Bond ETF
    "LQD": "LQD",          # iShares Investment Grade Corporate Bond ETF
    "COPPER_FUT": "HG=F",  # Copper Futures (daily)
    "KOSPI": "^KS11",      # Korea KOSPI Index
    "TAIEX": "^TWII",      # Taiwan TAIEX Index
    "USDCNH": "CNY=X",     # USD/CNY onshore yuan
    "CEW": "CEW",           # WisdomTree Emerging Currency Strategy Fund
}

SECTOR_LABELS = {
    "XLE": "Energy",
    "XLB": "Materials",
    "XLRE": "Real Estate",
    "XLU": "Utilities",
    "XLK": "Technology",
    "XLI": "Industrials",
    "XLV": "Health Care",
    "XLF": "Financials",
    "XLP": "Consumer Staples",
    "XLY": "Consumer Discretionary",
    "XLC": "Communication Services",
    "XME": "Metals & Mining",
    "SPY": "S&P 500 (SPY)",
}

SECTOR_GROUPS = {
    "Non-Cyclical": ["XLP", "XLU", "XLV"],
    "Cyclical": ["XLY", "XLI", "XLB", "XLE", "XLF"],
    "Sensitive": ["XLK", "XLC"],
    "High Beta": ["SPHB"],
}


class YahooClient:
    """Fetches market data from Yahoo Finance for series unavailable on FRED."""

    def __init__(self, historical_years: int = 10):
        self._years = historical_years

    def get_series(self, symbol: str, start: str | None = None) -> pd.Series:
        start = start or (date.today() - timedelta(days=365 * self._years)).isoformat()
        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(start=start, auto_adjust=True)
            if df.empty:
                raise ValueError(f"No data returned for {symbol}")
            series = df["Close"].dropna()
            series.index = series.index.tz_localize(None)
            return series
        except Exception:
            logger.exception("Failed to fetch Yahoo series %s", symbol)
            raise

    def get_market_data(self, start: str | None = None) -> dict[str, pd.Series]:
        result = {}
        for name, symbol in YAHOO_MARKET_SERIES.items():
            try:
                result[name] = self.get_series(symbol, start=start)
            except Exception:
                logger.warning("Could not fetch Yahoo market series %s (%s)", name, symbol)
        return result

    def get_sector_data(self, start: str | None = None) -> dict[str, pd.Series]:
        result = {}
        for name, symbol in YAHOO_SECTOR_ETFS.items():
            try:
                result[name] = self.get_series(symbol, start=start)
            except Exception:
                logger.warning("Could not fetch sector ETF %s (%s)", name, symbol)
        return result

    def get_index_data(self, start: str | None = None) -> dict[str, pd.Series]:
        result = {}
        for name, symbol in YAHOO_INDEX_SERIES.items():
            try:
                result[name] = self.get_series(symbol, start=start)
            except Exception:
                logger.warning("Could not fetch index %s (%s)", name, symbol)
        return result

    def get_factor_data(self, start: str | None = None) -> dict[str, pd.Series]:
        result = {}
        for name, symbol in YAHOO_FACTOR_ETFS.items():
            try:
                result[name] = self.get_series(symbol, start=start)
            except Exception:
                logger.warning("Could not fetch factor ETF %s (%s)", name, symbol)
        return result

    def get_extra_data(self, start: str | None = None) -> dict[str, pd.Series]:
        result = {}
        for name, symbol in {**YAHOO_EXTRA}.items():
            try:
                result[name] = self.get_series(symbol, start=start)
            except Exception:
                logger.warning("Could not fetch extra series %s (%s)", name, symbol)
        return result

    def get_breadth_data(self, start: str | None = None) -> dict[str, pd.Series]:
        result = {}
        for name, symbol in YAHOO_BREADTH_SERIES.items():
            try:
                result[name] = self.get_series(symbol, start=start)
            except Exception:
                logger.warning("Could not fetch breadth series %s (%s)", name, symbol)
        return result

    def get_macro_etf_data(self, start: str | None = None) -> dict[str, pd.Series]:
        result = {}
        for name, symbol in YAHOO_MACRO_ETFS.items():
            try:
                result[name] = self.get_series(symbol, start=start)
            except Exception:
                logger.warning("Could not fetch macro ETF %s (%s)", name, symbol)
        return result
