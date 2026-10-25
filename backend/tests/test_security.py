from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.config import Settings
from app.security import SecurityMiddleware, is_admin_request


def _client(**overrides) -> TestClient:
    cfg = Settings(_env_file=None, **overrides)
    app = FastAPI()
    app.add_middleware(SecurityMiddleware, settings=cfg)

    @app.get("/api/health")
    async def health():
        return {"ok": True}

    @app.get("/api/thing")
    async def thing():
        return {"ok": True}

    @app.post("/api/data/refresh")
    async def refresh():
        return {"ok": True}

    @app.post("/api/alerts/read-all")
    async def read_all():
        return {"ok": True}

    @app.post("/api/echo")
    async def echo(request: Request):
        return {"n": len(await request.body())}

    return TestClient(app)


def test_is_admin_request():
    assert is_admin_request("POST", "/api/forecast-lab/train")
    assert is_admin_request("POST", "/api/agents/run")
    assert not is_admin_request("GET", "/api/forecast-lab/train/status")
    assert not is_admin_request("POST", "/api/alerts/5/read")
    assert not is_admin_request("POST", "/api/alerts/read-all")


def test_admin_disabled_without_key():
    c = _client()
    assert c.post("/api/data/refresh").status_code == 503
    assert c.get("/api/thing").status_code == 200


def test_admin_requires_key():
    c = _client(admin_api_key="s3cret")
    assert c.post("/api/data/refresh").status_code == 401
    assert c.post("/api/data/refresh", headers={"X-API-Key": "nope"}).status_code == 401
    assert c.post("/api/data/refresh", headers={"X-API-Key": "s3cret"}).status_code == 200


def test_open_write_and_dev_opt_in():
    c = _client(admin_api_key="s3cret")
    assert c.post("/api/alerts/read-all").status_code == 200
    assert _client(allow_unauthenticated_admin=True).post("/api/data/refresh").status_code == 200


def test_rate_limit():
    c = _client(rate_limit_per_minute=3, rate_limit_admin_per_minute=2, admin_api_key="k")
    codes = [c.get("/api/thing").status_code for _ in range(5)]
    assert codes == [200, 200, 200, 429, 429]
    assert c.get("/api/health").status_code == 200  # exempt
    h = {"X-API-Key": "k"}
    assert [c.post("/api/data/refresh", headers=h).status_code for _ in range(3)] == [200, 200, 429]


def test_body_limit():
    c = _client(
        max_request_body_bytes=100, rate_limit_per_minute=0, allow_unauthenticated_admin=True
    )
    assert c.post("/api/echo", content=b"x" * 50).json() == {"n": 50}
    assert c.post("/api/echo", content=b"x" * 500).status_code == 413
