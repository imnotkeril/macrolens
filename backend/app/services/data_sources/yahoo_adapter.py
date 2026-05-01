from __future__ import annotations

import pandas as pd

from app.services.data_sources.base import ProviderAdapter, SourceHealth
from app.services.yahoo_client import YahooClient


class YahooAdapter(ProviderAdapter):
    source_name = "yahoo"

    def __init__(self, client: YahooClient):
        self.client = client

    def fetch_market_data(self, start: str | None = None) -> dict[str, pd.Series]:
        return self.client.get_market_data(start=start)

    def fetch_fx_data(self, start: str | None = None) -> dict[str, pd.Series]:
        # Yahoo is not used as primary FX source here.
        return {}

    def fetch_regime_data(self, start: str | None = None) -> dict[str, pd.Series]:
        # Yahoo has no dedicated macro regime block.
        return {}

    def fetch_macro_overview_data(self, start: str | None = None) -> dict[str, pd.Series]:
        # Keep macro overview on FRED currently.
        return {}

    def healthcheck(self) -> SourceHealth:
        try:
            test = self.client.get_series("SPY")
            if test.empty:
                return SourceHealth(source=self.source_name, status="degraded", note="SPY returned empty series")
            return SourceHealth(source=self.source_name, status="ok")
        except Exception as exc:
            return SourceHealth(source=self.source_name, status="down", note=str(exc))
