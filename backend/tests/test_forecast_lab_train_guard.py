"""Tier-A regression: POST /api/forecast-lab/train must reject concurrent training (B1)."""

import json
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import forecast_lab as fl
from app.services.forecast_lab import progress as prog


@pytest.fixture
def client(tmp_path, monkeypatch):
    # Never touch real artifacts: progress file and artifacts dir live in tmp_path.
    monkeypatch.setattr(prog, "_path", lambda: tmp_path / "progress.json")
    monkeypatch.setattr(fl, "resolve_artifacts_dir", lambda: tmp_path / "artifacts")
    monkeypatch.setattr(
        fl, "get_settings", lambda: SimpleNamespace(forecast_lab_enable_train_endpoint=True)
    )

    calls: list[int] = []

    async def fake_training(session):  # never trains for real; leaves progress "in flight"
        calls.append(1)

    @asynccontextmanager
    async def fake_session():
        yield object()

    monkeypatch.setattr(fl, "run_training", fake_training)
    monkeypatch.setattr(fl, "async_session", fake_session)
    app = FastAPI()
    app.include_router(fl.router, prefix="/api/forecast-lab")
    c = TestClient(app)
    c.calls = calls  # type: ignore[attr-defined]
    return c


def test_second_train_rejected_while_running(client):
    assert client.post("/api/forecast-lab/train").status_code == 200
    r = client.post("/api/forecast-lab/train")
    assert r.status_code == 409
    assert "already in progress" in r.json()["detail"]
    assert len(client.calls) == 1


def test_train_allowed_after_done(client):
    assert client.post("/api/forecast-lab/train").status_code == 200
    prog.set_progress(100.0, "done", "[100%] done", done=True)
    assert client.post("/api/forecast-lab/train").status_code == 200
    assert len(client.calls) == 2


def test_stale_progress_file_does_not_block(client):
    old = (datetime.now(UTC) - timedelta(hours=5)).isoformat()
    payload = {"percent": 40, "message": "x", "log_line": None, "done": False, "updated_at": old}
    prog._path().write_text(json.dumps(payload), encoding="utf-8")
    assert client.post("/api/forecast-lab/train").status_code == 200


def test_held_lock_rejects(client):
    import asyncio

    async def go():
        async with fl._train_lock:
            return client.post("/api/forecast-lab/train").status_code

    assert asyncio.run(go()) == 409
