"""Pure helpers for asset-implied phase labels (no DB / SQLAlchemy imports)."""

from __future__ import annotations

from bisect import bisect_right
from datetime import date
from typing import Any

from app.services.forecast_lab.rule_phase import ID_TO_QUADRANT, QUADRANT_ORDER, QUADRANT_TO_ID


class _PriceSeries:
    __slots__ = ("_dates", "_vals")

    def __init__(self, dates: list[date], vals: list[float]) -> None:
        self._dates = dates
        self._vals = vals

    def on_or_before(self, d: date) -> float | None:
        i = bisect_right(self._dates, d) - 1
        if i < 0:
            return None
        return self._vals[i]


def forward_pair_hit_rate_for_quadrant(
    series_map: dict[str, _PriceSeries],
    d_start: date,
    d_end: date,
    quadrant_name: str,
    exp: dict[str, Any],
    *,
    max_pairs: int | None = None,
) -> float:
    """
    Forward-looking confirmation: for quadrant YAML pairs, check realized long/short
    spread from d_start to d_end (same semantics as diagnostics phase-asset alignment).
    Returns mean hit rate in [0, 1], or -1 if no evaluable pairs.
    """
    phases_cfg = exp.get("quadrant_phases") or {}
    qconf = phases_cfg.get(quadrant_name) or {}
    pairs = list(qconf.get("pairs") or [])
    if max_pairs is not None:
        pairs = pairs[:max_pairs]
    hits: list[float] = []
    for pair in pairs:
        sym_l = str(pair.get("asset_long", ""))
        sym_s = str(pair.get("asset_short", ""))
        exp_sign = str(pair.get("expected_sign", "positive")).lower()
        sl = series_map.get(sym_l)
        ss = series_map.get(sym_s)
        if sl is None or ss is None:
            continue
        pl0, pl1 = sl.on_or_before(d_start), sl.on_or_before(d_end)
        ps0, ps1 = ss.on_or_before(d_start), ss.on_or_before(d_end)
        if None in (pl0, pl1, ps0, ps1) or pl0 <= 0 or ps0 <= 0:
            continue
        rel_long = pl1 / pl0 - 1.0
        rel_short = ps1 / ps0 - 1.0
        spread = rel_long - rel_short
        ok = spread > 0 if exp_sign == "positive" else spread < 0
        hits.append(1.0 if ok else 0.0)
    return sum(hits) / len(hits) if hits else -1.0


def quadrant_scores_from_prices(
    series_map: dict[str, _PriceSeries],
    d0: date,
    d1: date,
    exp: dict[str, Any],
) -> dict[str, float]:
    phases_cfg = exp.get("quadrant_phases") or {}
    scores: dict[str, float] = {}
    for qname, qconf in phases_cfg.items():
        pairs = qconf.get("pairs") or []
        hits: list[float] = []
        for pair in pairs:
            sym_l = str(pair.get("asset_long", ""))
            sym_s = str(pair.get("asset_short", ""))
            exp_sign = str(pair.get("expected_sign", "positive")).lower()
            sl = series_map.get(sym_l)
            ss = series_map.get(sym_s)
            if sl is None or ss is None:
                continue
            pl0, pl1 = sl.on_or_before(d0), sl.on_or_before(d1)
            ps0, ps1 = ss.on_or_before(d0), ss.on_or_before(d1)
            if None in (pl0, pl1, ps0, ps1) or pl0 <= 0 or ps0 <= 0:
                continue
            rel_long = pl1 / pl0 - 1.0
            rel_short = ps1 / ps0 - 1.0
            spread = rel_long - rel_short
            ok = spread > 0 if exp_sign == "positive" else spread < 0
            hits.append(1.0 if ok else 0.0)
        scores[qname] = sum(hits) / len(hits) if hits else -1.0
    return scores


def pick_quadrant(scores: dict[str, float], rule_id: int) -> tuple[int, bool]:
    """Return (quadrant_id, used_rule_fallback)."""
    valid = {q: s for q, s in scores.items() if s >= 0}
    if not valid:
        return rule_id, True
    best_s = max(valid.values())
    tied = [q for q, s in valid.items() if abs(s - best_s) < 1e-9]
    rule_name = ID_TO_QUADRANT[rule_id]
    if len(tied) == 1:
        return QUADRANT_TO_ID[tied[0]], False
    if rule_name in tied:
        return rule_id, False
    chosen = min(tied, key=lambda q: QUADRANT_ORDER.index(q))
    return QUADRANT_TO_ID[chosen], False
