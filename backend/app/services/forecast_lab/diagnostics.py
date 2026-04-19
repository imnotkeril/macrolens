"""Diagnostics endpoints helpers."""

from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.forecast_lab.artifacts import active_bundle_dir, load_meta
from app.services.forecast_lab.phase_alignment import compute_phase_asset_alignment


def oos_payload() -> dict[str, Any]:
    bundle = active_bundle_dir()
    meta = load_meta(bundle)
    if not meta:
        return {"bundle_id": "untrained", "metrics": {}}
    return {
        "bundle_id": meta.get("bundle_id", "unknown"),
        "metrics": meta.get("metrics", {}),
        "train_rows": meta.get("train_rows"),
        "val_rows": meta.get("val_rows"),
        "test_rows": meta.get("test_rows"),
    }


async def phase_asset_alignment_payload(
    db: AsyncSession,
    date_from: date,
    date_to: date,
) -> dict[str, Any]:
    bundle = active_bundle_dir()
    meta = load_meta(bundle)
    bid = meta.get("bundle_id", "untrained") if meta else "untrained"
    stats = await compute_phase_asset_alignment(db, date_from, date_to)
    return {"bundle_id": bid, **stats}
