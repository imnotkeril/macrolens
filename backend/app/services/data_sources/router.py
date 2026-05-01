from __future__ import annotations

from app.services.data_sources.base import ProviderAdapter


class SourceRouter:
    """Simple source router with fallback semantics."""

    def __init__(self, primary: ProviderAdapter, fallback: ProviderAdapter | None = None):
        self.primary = primary
        self.fallback = fallback

    def fetch_market_data(self, start: str | None = None):
        data = self.primary.fetch_market_data(start=start)
        if data or self.fallback is None:
            return data, self.primary.source_name
        return self.fallback.fetch_market_data(start=start), self.fallback.source_name

    def fetch_fx_data(self, start: str | None = None):
        data = self.primary.fetch_fx_data(start=start)
        if data or self.fallback is None:
            return data, self.primary.source_name
        return self.fallback.fetch_fx_data(start=start), self.fallback.source_name

    def fetch_regime_data(self, start: str | None = None):
        data = self.primary.fetch_regime_data(start=start)
        if data or self.fallback is None:
            return data, self.primary.source_name
        return self.fallback.fetch_regime_data(start=start), self.fallback.source_name

    def fetch_macro_overview_data(self, start: str | None = None):
        data = self.primary.fetch_macro_overview_data(start=start)
        if data or self.fallback is None:
            return data, self.primary.source_name
        return self.fallback.fetch_macro_overview_data(start=start), self.fallback.source_name
