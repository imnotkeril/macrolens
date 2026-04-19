"""Load phase rule thresholds from YAML."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
RULE_PATH = _BACKEND_ROOT / "config" / "forecast_lab" / "phase_rule.yaml"


@lru_cache
def load_phase_rules() -> list[dict[str, Any]]:
    if not RULE_PATH.exists():
        return [
            {"quadrant": "Q1_GOLDILOCKS", "growth_gte": 0.0, "fed_lte": 0.0},
            {"quadrant": "Q2_REFLATION", "growth_lt": 0.0, "fed_lte": 0.0},
            {"quadrant": "Q3_OVERHEATING", "growth_gte": 0.0, "fed_gt": 0.0},
            {"quadrant": "Q4_STAGFLATION", "growth_lt": 0.0, "fed_gt": 0.0},
        ]
    with open(RULE_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return list(data.get("rules") or [])


def match_quadrant(growth_score: float, fed_policy_score: float) -> str:
    g, f = growth_score, fed_policy_score
    for rule in load_phase_rules():
        q = str(rule.get("quadrant", ""))
        ok = True
        if "growth_gte" in rule and g < float(rule["growth_gte"]):
            ok = False
        if "growth_lt" in rule and g >= float(rule["growth_lt"]):
            ok = False
        if "growth_lte" in rule and g > float(rule["growth_lte"]):
            ok = False
        if "growth_gt" in rule and g <= float(rule["growth_gt"]):
            ok = False
        if "fed_gte" in rule and f < float(rule["fed_gte"]):
            ok = False
        if "fed_lte" in rule and f > float(rule["fed_lte"]):
            ok = False
        if "fed_lt" in rule and f >= float(rule["fed_lt"]):
            ok = False
        if "fed_gt" in rule and f <= float(rule["fed_gt"]):
            ok = False
        if ok:
            return q
    return "Q1_GOLDILOCKS"
