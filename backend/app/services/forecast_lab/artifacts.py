"""Artifact paths and bundle I/O for Forecast Lab."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from app.config import get_settings

_BACKEND_ROOT = Path(__file__).resolve().parents[3]


def resolve_artifacts_dir(path_str: str | None = None) -> Path:
    s = get_settings()
    p = Path(path_str or s.forecast_lab_artifacts_dir)
    return p if p.is_absolute() else (_BACKEND_ROOT / p).resolve()


def active_bundle_dir(artifacts: Path | None = None) -> Path:
    root = artifacts or resolve_artifacts_dir()
    active = root / "active_bundle_id.txt"
    if not active.exists():
        return root / "default"
    bid = active.read_text(encoding="utf-8").strip() or "default"
    return root / bid


def set_active_bundle(bundle_id: str) -> None:
    root = resolve_artifacts_dir()
    root.mkdir(parents=True, exist_ok=True)
    (root / "active_bundle_id.txt").write_text(bundle_id, encoding="utf-8")


def compute_bundle_id(meta: dict[str, Any]) -> str:
    raw = json.dumps(meta, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def load_meta(bundle_path: Path) -> dict[str, Any] | None:
    mp = bundle_path / "meta.json"
    if not mp.exists():
        return None
    return json.loads(mp.read_text(encoding="utf-8"))
