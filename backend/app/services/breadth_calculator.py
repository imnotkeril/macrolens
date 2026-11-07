"""S&P 500 market breadth computed from constituent prices.

Yahoo does not carry StockCharts/TradingView breadth symbols (MMTH, NYHGH, ...), so we
build the same series ourselves from daily OHLCV of the current S&P 500 members.

Known limits (state them in the UI): the universe is today's constituents (survivorship
bias in old history), highs/lows use closing prices, and the numbers describe the S&P 500,
not the whole NYSE.
"""

from __future__ import annotations

import io
import logging
from datetime import date, timedelta
from pathlib import Path

import httpx
import pandas as pd

logger = logging.getLogger(__name__)

TICKERS_FILE = Path(__file__).resolve().parent.parent / "resources" / "sp500_tickers.txt"
WIKI_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
CHUNK_SIZE = 100
LOOKBACK_DAYS = 400  # > 252 trading days so 200MA and 52w windows are warm at `start`
MIN_COVERAGE = 0.8  # drop dates where fewer than 80% of the usual tickers have a price


def load_tickers() -> list[str]:
    """Current S&P 500 tickers: Wikipedia if reachable, else the bundled snapshot."""
    try:
        resp = httpx.get(
            WIKI_URL,
            headers={"User-Agent": "macrolens-breadth/1.0 (research)"},
            timeout=20,
            follow_redirects=True,
        )
        resp.raise_for_status()
        table = pd.read_html(io.StringIO(resp.text))[0]
        tickers = sorted({s.strip().replace(".", "-") for s in table["Symbol"].astype(str)})
        if len(tickers) >= 450:
            return tickers
        logger.warning("Wikipedia S&P 500 list too short (%d); using snapshot", len(tickers))
    except Exception:
        logger.warning("Could not fetch S&P 500 list; using bundled snapshot", exc_info=True)
    return [t for t in TICKERS_FILE.read_text().split() if t]


def download_prices(tickers: list[str], start: date) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Download adjusted Close and Volume for `tickers` in chunks. Returns (close, volume)."""
    import yfinance as yf  # imported lazily: heavy, and tests don't need it

    closes: list[pd.DataFrame] = []
    volumes: list[pd.DataFrame] = []
    for i in range(0, len(tickers), CHUNK_SIZE):
        chunk = tickers[i : i + CHUNK_SIZE]
        try:
            df = yf.download(
                chunk,
                start=start.isoformat(),
                auto_adjust=True,
                progress=False,
                threads=True,
                timeout=30,
            )
        except Exception:
            logger.warning("Breadth download failed for chunk %d", i // CHUNK_SIZE, exc_info=True)
            continue
        if df is None or df.empty:
            logger.warning("Breadth download returned nothing for chunk %d", i // CHUNK_SIZE)
            continue
        closes.append(df["Close"])
        volumes.append(df["Volume"])
    if not closes:
        return pd.DataFrame(), pd.DataFrame()
    close = pd.concat(closes, axis=1)
    volume = pd.concat(volumes, axis=1)
    for frame in (close, volume):
        frame.index = pd.to_datetime(frame.index).tz_localize(None)
    return close.sort_index(), volume.sort_index()


def compute_breadth(
    close: pd.DataFrame, volume: pd.DataFrame | None = None
) -> dict[str, pd.Series]:
    """Turn a (dates x tickers) close matrix into breadth series.

    Keys match the symbols the app already reads from `market_data`:
    MMTW/MMFI/MMTH (% above 20/50/200 MA), NYHGH/NYLOW (52-week highs/lows, closing basis),
    NYMO (McClellan oscillator), NYSI (summation index), TVOL.US (total volume).
    """
    if close.empty:
        return {}
    close = close.sort_index()

    # Ignore dates where most tickers are missing (partial download / holiday artefacts).
    counts = close.notna().sum(axis=1)
    close = close[counts >= MIN_COVERAGE * counts.max()]
    if close.empty:
        return {}

    out: dict[str, pd.Series] = {}

    for symbol, window in (("MMTW", 20), ("MMFI", 50), ("MMTH", 200)):
        ma = close.rolling(window, min_periods=window).mean()
        valid = ma.notna() & close.notna()
        above = (close > ma) & valid
        n_valid = valid.sum(axis=1)
        out[symbol] = (above.sum(axis=1) / n_valid * 100).where(n_valid > 0).dropna()

    # Full 252-day window required; the date's own close counts as a new high/low if it ties.
    roll_max = close.rolling(252, min_periods=252).max()
    roll_min = close.rolling(252, min_periods=252).min()
    valid_hl = roll_max.notna() & close.notna()
    out["NYHGH"] = ((close >= roll_max) & valid_hl).sum(axis=1).where(valid_hl.any(axis=1)).dropna()
    out["NYLOW"] = ((close <= roll_min) & valid_hl).sum(axis=1).where(valid_hl.any(axis=1)).dropna()

    # Advance/decline -> ratio-adjusted net advances -> McClellan oscillator + summation index.
    diff = close.diff()
    adv = (diff > 0).sum(axis=1)
    dec = (diff < 0).sum(axis=1)
    total = (adv + dec).where(adv + dec > 0)
    rana = ((adv - dec) / total * 1000).dropna()
    if len(rana) > 39:
        nymo = rana.ewm(span=19, adjust=False).mean() - rana.ewm(span=39, adjust=False).mean()
        nymo = nymo.iloc[39:]  # drop EMA warm-up
        out["NYMO"] = nymo
        out["NYSI"] = nymo.cumsum()

    if volume is not None and not volume.empty:
        vol = volume.reindex(close.index).sum(axis=1, min_count=1).dropna()
        vol = vol[vol > 0]
        if not vol.empty:
            out["TVOL.US"] = vol

    return out


def rebase_summation(nymo: pd.Series, anchor: float) -> pd.Series:
    """Summation index for a short window: `anchor` (last stored NYSI) + cumulative NYMO."""
    return anchor + nymo.cumsum()


def get_breadth_series(start: str | None = None, years: int = 10) -> dict[str, pd.Series]:
    """Full pipeline: tickers -> prices -> breadth series trimmed to `start`."""
    start_date = date.fromisoformat(start) if start else date.today() - timedelta(days=365 * years)
    tickers = load_tickers()
    close, volume = download_prices(tickers, start_date - timedelta(days=LOOKBACK_DAYS))
    if close.empty:
        logger.warning("No prices downloaded; breadth not computed")
        return {}
    series = compute_breadth(close, volume)
    cutoff = pd.Timestamp(start_date)
    # NYSI is cumulative: its level depends on where accumulation starts, so only trim at the end.
    return {k: v[v.index >= cutoff] for k, v in series.items()}
