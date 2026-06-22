from __future__ import annotations

import pandas as pd

from app.services.data_sources.base import ProviderAdapter, SourceHealth
from app.services.fred_client import FredClient


class FredAdapter(ProviderAdapter):
    source_name = "fred"

    def __init__(self, client: FredClient):
        self.client = client

    def fetch_market_data(self, start: str | None = None) -> dict[str, pd.Series]:
        return self.client.get_market_data(start=start)

    def fetch_fx_data(self, start: str | None = None) -> dict[str, pd.Series]:
        return self.client.get_fx_data(start=start)

    def fetch_regime_data(self, start: str | None = None) -> dict[str, pd.Series]:
        return self.client.get_regime_data(start=start)

    def fetch_macro_overview_data(self, start: str | None = None) -> dict[str, pd.Series]:
        return self.client.get_macro_overview_data(start=start)

    def healthcheck(self) -> SourceHealth:
        if not self.client.is_configured:
            return SourceHealth(
                source=self.source_name, status="down", note="FRED API key is missing"
            )
        try:
            test = self.client.get_series("DFF", start=None, end=None)
            if test.empty:
                return SourceHealth(
                    source=self.source_name, status="degraded", note="DFF returned empty series"
                )
            return SourceHealth(source=self.source_name, status="ok")
        except Exception as exc:
            return SourceHealth(source=self.source_name, status="down", note=str(exc))
