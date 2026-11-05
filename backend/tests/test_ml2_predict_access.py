"""S-02: ml2/predict mutates state, so it is POST + admin key; GET is read-only."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import ml2
from app.config import Settings
from app.database import get_db
from app.security import SecurityMiddleware


def _fake_session() -> MagicMock:
    result = MagicMock()
    result.scalar_one_or_none.return_value = None  # nothing stored yet
    session = MagicMock()
    session.execute = AsyncMock(return_value=result)
    session.commit = AsyncMock()
    session.add = MagicMock()
    return session


def _client(session: MagicMock, **overrides) -> TestClient:
    app = FastAPI()
    app.add_middleware(SecurityMiddleware, settings=Settings(_env_file=None, **overrides))
    app.include_router(ml2.router, prefix="/api/ml2")

    async def _db():
        yield session

    app.dependency_overrides[get_db] = _db
    return TestClient(app)


def test_post_predict_without_key_is_401_and_does_not_touch_db():
    session = _fake_session()
    r = _client(session, admin_api_key="k").post("/api/ml2/predict")
    assert r.status_code == 401
    session.execute.assert_not_called()
    session.commit.assert_not_called()


def test_post_predict_wrong_key_is_401():
    session = _fake_session()
    r = _client(session, admin_api_key="k").post("/api/ml2/predict", headers={"X-API-Key": "x"})
    assert r.status_code == 401
    session.commit.assert_not_called()


def test_post_predict_fails_closed_when_key_unset():
    session = _fake_session()
    r = _client(session, admin_api_key="").post("/api/ml2/predict")
    assert r.status_code == 503
    session.commit.assert_not_called()


@pytest.mark.parametrize("path", ["/api/ml2/predict", "/api/ml2/latest-stored"])
def test_get_is_public_and_read_only(path):
    session = _fake_session()
    r = _client(session, admin_api_key="k").get(path)
    assert r.status_code == 200
    body = r.json()
    assert body["trained"] is False
    assert body["factors"] == []
    session.add.assert_not_called()
    session.commit.assert_not_called()
