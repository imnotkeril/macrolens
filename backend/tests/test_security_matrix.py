"""Tier-A security matrix for the admin-key middleware: bypass attempts and edge paths."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
from app.security import SecurityMiddleware, is_admin_request


def _client(**overrides) -> TestClient:
    cfg = Settings(_env_file=None, **overrides)
    app = FastAPI()
    app.add_middleware(SecurityMiddleware, settings=cfg)

    @app.post("/api/data/refresh")
    async def refresh():
        return {"ok": True}

    @app.put("/api/thing")
    async def put_thing():
        return {"ok": True}

    @app.delete("/api/thing")
    async def del_thing():
        return {"ok": True}

    @app.patch("/api/thing")
    async def patch_thing():
        return {"ok": True}

    @app.get("/api/thing")
    async def get_thing():
        return {"ok": True}

    @app.post("/api/alerts/{aid}/read")
    async def read(aid: str):
        return {"ok": True}

    @app.post("/other/mutate")
    async def other():
        return {"ok": True}

    return TestClient(app)


@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
def test_every_mutating_method_is_guarded(method):
    c = _client(admin_api_key="k")
    assert c.request(method, "/api/thing").status_code == 401
    assert c.request(method, "/api/thing", headers={"X-API-Key": "k"}).status_code in (200, 405)


@pytest.mark.parametrize(
    "path",
    [
        "/api/data/refresh/",
        "/api//data/refresh",
        "/api/data/refresh/../refresh",
        "/api/%64ata/refresh",
    ],
)
def test_path_variants_never_reach_handler_without_key(path):
    c = _client(admin_api_key="k")
    r = c.post(path, follow_redirects=False)
    assert r.status_code in (401, 404, 307), (path, r.status_code)
    assert (
        r.json().get("ok") is not True
        if r.headers.get("content-type", "").startswith("application/json")
        else True
    )


def test_trailing_slash_admin_path_is_still_admin():
    assert is_admin_request("POST", "/api/data/refresh/")
    assert _client(admin_api_key="k").post("/api/data/refresh/").status_code == 401


def test_case_variants_not_routed():
    c = _client(admin_api_key="k")
    # Routing is case-sensitive: an upper-case path cannot reach the handler.
    assert c.post("/API/data/refresh").status_code == 404
    assert c.post("/api/DATA/refresh", headers={"X-API-Key": "k"}).status_code == 404


def test_lowercase_method_cannot_bypass():
    assert is_admin_request("POST", "/api/x")
    # ASGI methods are upper-case by spec; a lower-case one is not "safe" either.
    assert is_admin_request("post", "/api/x")


def test_open_write_regex_is_strict():
    assert not is_admin_request("POST", "/api/alerts/12/read")
    assert not is_admin_request("POST", "/api/alerts/12/read/")
    assert is_admin_request("POST", "/api/alerts/abc/read")
    assert is_admin_request("POST", "/api/alerts/12/read/extra")
    assert is_admin_request("POST", "/api/alerts/12/delete")
    assert is_admin_request("POST", "/api/alerts/12/read\n/x")
    assert is_admin_request("DELETE", "/api/alerts/12")


def test_non_api_paths_are_not_guarded():
    assert not is_admin_request("POST", "/other/mutate")
    assert _client(admin_api_key="k").post("/other/mutate").status_code == 200


def test_empty_and_whitespace_key_rejected():
    c = _client(admin_api_key="k")
    assert c.post("/api/data/refresh", headers={"X-API-Key": ""}).status_code == 401
    assert c.post("/api/data/refresh", headers={"X-API-Key": " k"}).status_code == 401
    assert c.post("/api/data/refresh", headers={"X-API-Key": "K"}).status_code == 401
    assert c.post("/api/data/refresh", headers={"X-API-Key": "kk"}).status_code == 401


def test_empty_configured_key_never_matches_empty_header():
    c = _client(admin_api_key="")
    assert c.post("/api/data/refresh", headers={"X-API-Key": ""}).status_code == 503
    assert c.post("/api/data/refresh").status_code == 503


def test_non_ascii_key_header_does_not_crash():
    c = _client(admin_api_key="k")
    r = c.post("/api/data/refresh", headers={"X-API-Key": "é".encode("latin-1")})
    assert r.status_code == 401


def test_options_preflight_passes_without_key():
    c = _client(admin_api_key="k", rate_limit_per_minute=1)
    for _ in range(3):
        assert c.options("/api/data/refresh").status_code != 401


def test_auth_checked_before_handler_and_rate_limit_applies_to_bad_keys():
    c = _client(admin_api_key="k", rate_limit_admin_per_minute=2)
    codes = [
        c.post("/api/data/refresh", headers={"X-API-Key": "bad"}).status_code for _ in range(4)
    ]
    assert codes == [401, 401, 429, 429]  # brute force is throttled


def test_forwarded_for_ignored_unless_trusted():
    c = _client(admin_api_key="k", rate_limit_admin_per_minute=1)
    h = lambda ip: {"X-API-Key": "k", "X-Forwarded-For": ip}  # noqa: E731
    assert c.post("/api/data/refresh", headers=h("1.1.1.1")).status_code == 200
    # Spoofed XFF must not mint a fresh bucket.
    assert c.post("/api/data/refresh", headers=h("2.2.2.2")).status_code == 429
    t = _client(admin_api_key="k", rate_limit_admin_per_minute=1, rate_limit_trust_proxy=True)
    assert t.post("/api/data/refresh", headers=h("1.1.1.1")).status_code == 200
    assert t.post("/api/data/refresh", headers=h("2.2.2.2")).status_code == 200


def test_oversize_declared_body_rejected_before_auth_passes():
    c = _client(admin_api_key="k", max_request_body_bytes=10, rate_limit_per_minute=0)
    r = c.post("/api/data/refresh", content=b"x" * 50, headers={"X-API-Key": "k"})
    assert r.status_code == 413
