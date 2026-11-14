"""Live replacements for regime inputs that no free source publishes any more.

* MFG_SURVEY / MFG_NEW_ORDERS: average of the Philadelphia and New York (Empire State) Fed
  manufacturing surveys (diffusion indices centred on 0). There is no free ISM PMI.
* LEI_PROXY: a Conference Board-style leading index built from live free series. The official
  US LEI series on FRED stopped in 2020 and the OECD one in 2024.

LEI_PROXY method: each component's monthly change (difference for rates/spreads/diffusion
indices, symmetric % change for levels) is standardised by its own standard deviation and
sign-adjusted (claims and credit spreads are inverse indicators); the monthly composite is the
average of the available components (at least `min_components`), and the index is cumulated
from 100 with the Conference Board formula I_t = I_{t-1} * (200 + M_t) / (200 - M_t).
Standardisation uses the full sample (fixed factors, as the Conference Board does).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

MIN_COMPONENTS = 3


@dataclass(frozen=True)
class ComponentSpec:
    series: pd.Series  # monthly, month-start index
    kind: str  # "diff" (rates, spreads, diffusion indices) | "pct" (levels)
    sign: int  # +1 leading-positive, -1 inverse indicator


def monthly_mean(series: pd.Series) -> pd.Series:
    """Month-start mean of a daily/weekly/monthly series."""
    s = series.dropna().copy()
    s.index = pd.to_datetime(s.index)
    return s.resample("MS").mean().dropna()


def regional_average(*series: pd.Series) -> pd.Series:
    """Mean of the regional surveys available each month."""
    return pd.concat(list(series), axis=1).mean(axis=1, skipna=True).dropna()


def symmetric_pct_change(series: pd.Series) -> pd.Series:
    """Conference Board symmetric % change: 200 * (x_t - x_{t-1}) / (x_t + x_{t-1})."""
    prev = series.shift(1)
    return 200.0 * (series - prev) / (series + prev)


def mfg_status(value: float) -> str:
    """Traffic light for the regional manufacturing survey (0 = neutral)."""
    if value < 0:
        return "red"
    return "yellow" if value < 3 else "green"


def compute_lei_proxy(
    components: dict[str, ComponentSpec],
    *,
    scale: float = 1.0,
    base: float = 100.0,
    min_components: int = MIN_COMPONENTS,
) -> pd.Series:
    """Cumulated composite index (month-start index); empty if nothing can be computed."""
    z_parts: list[pd.Series] = []
    for name, spec in components.items():
        s = spec.series.dropna()
        change = s.diff() if spec.kind == "diff" else symmetric_pct_change(s)
        change = change.replace([np.inf, -np.inf], np.nan).dropna()
        sd = change.std()
        if change.empty or not sd or np.isnan(sd):
            continue
        z_parts.append((spec.sign * change / sd).rename(name))
    if not z_parts:
        return pd.Series(dtype=float)

    z = pd.concat(z_parts, axis=1)
    composite = z.mean(axis=1, skipna=True).where(z.notna().sum(axis=1) >= min_components)
    composite = (scale * composite).dropna()
    if composite.empty:
        return pd.Series(dtype=float)

    months = pd.date_range(
        composite.index.min() - pd.offsets.MonthBegin(1), composite.index.max(), freq="MS"
    )
    changes = composite.reindex(months).fillna(0.0)  # gaps carry the index flat
    factors = (200.0 + changes) / (200.0 - changes)
    return base * factors.cumprod()


def build_regime_composites(raw: dict[str, pd.Series]) -> dict[str, pd.Series]:
    """MFG_SURVEY, MFG_NEW_ORDERS and LEI_PROXY from raw FRED series (missing inputs tolerated)."""
    out: dict[str, pd.Series] = {}

    def _avg(*names: str) -> pd.Series | None:
        parts = [monthly_mean(raw[n]) for n in names if n in raw and len(raw[n].dropna())]
        return regional_average(*parts) if parts else None

    mfg = _avg("PHILLY_MFG", "EMPIRE_MFG")
    if mfg is not None and not mfg.empty:
        out["MFG_SURVEY"] = mfg
    new_orders = _avg("PHILLY_NO", "EMPIRE_NO")
    if new_orders is not None and not new_orders.empty:
        out["MFG_NEW_ORDERS"] = new_orders

    spec_inputs: list[tuple[str, pd.Series | None, str, int]] = [
        ("T10Y3M", raw.get("T10Y3M"), "diff", 1),
        ("ICSA", raw.get("ICSA"), "pct", -1),
        ("PERMIT", raw.get("PERMIT"), "pct", 1),
        ("UMCSENT", raw.get("UMCSENT"), "pct", 1),
        ("HY_SPREAD", raw.get("HY_SPREAD"), "diff", -1),
        ("SP500", raw.get("SP500"), "pct", 1),
        ("MFG_SURVEY", out.get("MFG_SURVEY"), "diff", 1),
    ]
    components = {
        name: ComponentSpec(monthly_mean(series), kind, sign)
        for name, series, kind, sign in spec_inputs
        if series is not None and len(series.dropna()) > 2
    }
    lei = compute_lei_proxy(components)
    if not lei.empty:
        out["LEI_PROXY"] = lei
    return out
