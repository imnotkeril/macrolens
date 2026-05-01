from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date

import pandas as pd


@dataclass
class SourceHealth:
    source: str
    status: str
    note: str | None = None


class ProviderAdapter(ABC):
    source_name: str

    @abstractmethod
    def fetch_market_data(self, start: str | None = None) -> dict[str, pd.Series]:
        raise NotImplementedError

    @abstractmethod
    def fetch_fx_data(self, start: str | None = None) -> dict[str, pd.Series]:
        raise NotImplementedError

    @abstractmethod
    def fetch_regime_data(self, start: str | None = None) -> dict[str, pd.Series]:
        raise NotImplementedError

    @abstractmethod
    def fetch_macro_overview_data(self, start: str | None = None) -> dict[str, pd.Series]:
        raise NotImplementedError

    @abstractmethod
    def healthcheck(self) -> SourceHealth:
        raise NotImplementedError

    @staticmethod
    def compute_gap_days(series: pd.Series) -> int:
        if series.empty:
            return 9999
        last = series.index.max()
        last_date = last.date() if hasattr(last, "date") else last
        return max((date.today() - last_date).days, 0)
