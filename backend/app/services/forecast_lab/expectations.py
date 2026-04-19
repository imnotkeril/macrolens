"""Load asset–phase expectation YAML for diagnostics."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_EXPECTATIONS_PATH = _BACKEND_ROOT / "config" / "forecast_lab" / "asset_phase_expectations.yaml"


def load_expectations(path: Path | None = None) -> dict[str, Any]:
    p = path or DEFAULT_EXPECTATIONS_PATH
    if not p.exists():
        return {
            "evaluation_horizon_months": 1,
            "quadrant_phases": {},
        }
    with open(p, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}
