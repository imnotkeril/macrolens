"""Macro panel YAML."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
MACRO_PANEL_PATH = _BACKEND_ROOT / "config" / "forecast_lab" / "macro_panel.yaml"


@lru_cache
def load_macro_panel_config() -> dict[str, Any]:
    if not MACRO_PANEL_PATH.exists():
        return {"horizons": [1, 3, 6], "series": []}
    with open(MACRO_PANEL_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}
