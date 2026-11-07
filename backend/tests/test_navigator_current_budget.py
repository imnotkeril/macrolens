"""GET /api/navigator/current must answer within its budget even if the engine hangs."""

from __future__ import annotations

import asyncio
import time
from contextlib import asynccontextmanager

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import navigator as nav_api
from app.services import ttl_cache
from app.services.navigator_engine import NavigatorEngine


@asynccontextmanager
async def _fake_session():
    yield object()


@pytest.fixture
def client(monkeypatch):
    ttl_cache.clear()
    monkeypatch.setattr(nav_api, "async_session", _fake_session)
    app = FastAPI()
    app.include_router(nav_api.router, prefix="/api/navigator")
    yield TestClient(app)
    ttl_cache.clear()


def test_hanging_engine_returns_empty_state_within_budget(client, monkeypatch):
    calls = {"n": 0}

    async def hang(self):
        calls["n"] += 1
        await asyncio.sleep(30)

    monkeypatch.setattr(NavigatorEngine, "get_recommendation", hang)
    monkeypatch.setattr(nav_api, "_CURRENT_BUDGET_S", 0.2)

    t0 = time.perf_counter()
    r = client.get("/api/navigator/current")
    assert r.status_code == 200
    assert r.json()["insufficient_data"] is True
    assert time.perf_counter() - t0 < 3

    # A second request right after is served from the short failure cache, not another hang.
    t1 = time.perf_counter()
    assert client.get("/api/navigator/current").status_code == 200
    assert time.perf_counter() - t1 < 0.5
    assert calls["n"] == 1


def test_successful_result_is_cached(client, monkeypatch):
    calls = {"n": 0}

    async def ok(self):
        calls["n"] += 1
        return NavigatorEngine._empty_recommendation()

    monkeypatch.setattr(NavigatorEngine, "get_recommendation", ok)
    assert client.get("/api/navigator/current").status_code == 200
    assert client.get("/api/navigator/current").status_code == 200
    assert calls["n"] == 1
