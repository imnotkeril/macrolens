"""
In-memory progress store for long-running tasks: data refresh and ML train.
Single runner per task (refresh/train), so one active progress per key.
When ML_TRAIN_PROGRESS_FILE is set (worker process), train progress is also written to that file.
"""
from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any

_lock = threading.Lock()
_refresh: dict[str, Any] = {}
_train: dict[str, Any] = {}


def set_refresh_progress(
    phase: str = "",
    percent: float = 0.0,
    message: str = "",
    log_line: str | None = None,
    done: bool = False,
    error: str | None = None,
) -> None:
    with _lock:
        global _refresh
        if phase:
            _refresh["phase"] = phase
        if percent is not None:
            _refresh["percent"] = min(100.0, max(0.0, percent))
        if message:
            _refresh["message"] = message
        if log_line is not None:
            _refresh.setdefault("logs", []).append(log_line)
        if done:
            _refresh["done"] = True
        if error is not None:
            _refresh["error"] = error


def get_refresh_progress() -> dict[str, Any]:
    with _lock:
        out = {
            "phase": _refresh.get("phase", ""),
            "percent": _refresh.get("percent", 0.0),
            "message": _refresh.get("message", ""),
            "logs": list(_refresh.get("logs", [])),
            "done": _refresh.get("done", False),
            "error": _refresh.get("error"),
        }
        return out


def clear_refresh_progress() -> None:
    with _lock:
        global _refresh
        _refresh = {}


def init_refresh_progress() -> None:
    """Call at start of refresh to reset and set running."""
    with _lock:
        global _refresh
        _refresh = {
            "phase": "starting",
            "percent": 0.0,
            "message": "Starting refresh…",
            "logs": [],
            "done": False,
            "error": None,
        }


def set_train_progress(
    phase: str = "",
    percent: float = 0.0,
    message: str = "",
    log_line: str | None = None,
    done: bool = False,
    error: str | None = None,
) -> None:
    with _lock:
        global _train
        if phase:
            _train["phase"] = phase
        if percent is not None:
            _train["percent"] = min(100.0, max(0.0, percent))
        if message:
            _train["message"] = message
        if log_line is not None:
            _train.setdefault("logs", []).append(log_line)
        if done:
            _train["done"] = True
        if error is not None:
            _train["error"] = error
        # When running in worker process, persist to file so API can read progress
        progress_file = os.environ.get("ML_TRAIN_PROGRESS_FILE")
        if progress_file:
            try:
                out = {
                    "phase": _train.get("phase", ""),
                    "percent": _train.get("percent", 0.0),
                    "message": _train.get("message", ""),
                    "logs": list(_train.get("logs", [])),
                    "done": _train.get("done", False),
                    "error": _train.get("error"),
                }
                Path(progress_file).parent.mkdir(parents=True, exist_ok=True)
                Path(progress_file).write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
            except Exception:
                pass


def get_train_progress() -> dict[str, Any]:
    with _lock:
        out = {
            "phase": _train.get("phase", ""),
            "percent": _train.get("percent", 0.0),
            "message": _train.get("message", ""),
            "logs": list(_train.get("logs", [])),
            "done": _train.get("done", False),
            "error": _train.get("error"),
        }
        return out


def get_train_progress_from_file(progress_file_path: str) -> dict[str, Any] | None:
    """Read train progress from file (written by worker). Returns None if file missing or invalid."""
    try:
        path = Path(progress_file_path)
        if not path.exists():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        return {
            "phase": data.get("phase", ""),
            "percent": data.get("percent", 0.0),
            "message": data.get("message", ""),
            "logs": list(data.get("logs", [])),
            "done": data.get("done", False),
            "error": data.get("error"),
        }
    except Exception:
        return None


def clear_train_progress() -> None:
    with _lock:
        global _train
        _train = {}


def init_train_progress() -> None:
    """Call at start of train to reset and set running."""
    with _lock:
        global _train
        _train = {
            "phase": "dataset",
            "percent": 0.0,
            "message": "Building dataset…",
            "logs": [],
            "done": False,
            "error": None,
        }
