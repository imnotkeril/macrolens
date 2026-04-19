"""Training progress file for Forecast Lab (separate from legacy ML progress)."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import get_settings

# If training stops updating (crash / reload), unblock UI after this many seconds.
_STALE_AFTER_SEC = int(os.environ.get("FORECAST_LAB_TRAIN_STALE_SEC", "2700"))


def _path() -> Path:
    s = get_settings()
    p = Path(s.forecast_lab_train_progress_file)
    if not p.is_absolute():
        root = Path(__file__).resolve().parents[3]
        p = (root / p).resolve()
    return p


def _idle_payload() -> dict[str, Any]:
    return {
        "percent": 0.0,
        "message": "idle",
        "log_line": None,
        "done": True,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def reset_progress_idle() -> None:
    """Mark training as idle (e.g. after server restart or manual reset)."""
    path = _path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(_idle_payload()), encoding="utf-8")


def recover_progress_after_restart() -> None:
    """After process restart, any in-flight job is gone — unblock clients."""
    path = _path()
    if not path.exists():
        return
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        reset_progress_idle()
        return
    if data.get("done") is False:
        reset_progress_idle()


def set_progress(percent: float, message: str, log_line: str | None = None, done: bool = False) -> None:
    path = _path()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "percent": round(percent, 2),
        "message": message,
        "log_line": log_line,
        "done": done,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    path.write_text(json.dumps(payload), encoding="utf-8")


def get_progress() -> dict[str, Any]:
    path = _path()
    if not path.exists():
        return {"percent": 0.0, "message": "idle", "log_line": None, "done": True}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"percent": 0.0, "message": "invalid progress file", "log_line": None, "done": True}

    if data.get("done") is False:
        ts_raw = data.get("updated_at")
        stale = False
        if not ts_raw:
            stale = True
        else:
            try:
                ts = datetime.fromisoformat(str(ts_raw).replace("Z", "+00:00"))
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                age = (datetime.now(timezone.utc) - ts).total_seconds()
                stale = age > _STALE_AFTER_SEC
            except ValueError:
                stale = True
        if stale:
            reset_progress_idle()
            return {
                "percent": 0.0,
                "message": "idle (previous run stale or interrupted)",
                "log_line": None,
                "done": True,
            }

    return data
