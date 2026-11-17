from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.response_cache import ResponseCacheMiddleware, is_cacheable
from app.services import ttl_cache


def _client() -> tuple[TestClient, dict[str, int]]:
    calls = {"n": 0}
    app = FastAPI()

    @app.get("/api/market/breadth")
    async def breadth(x: int = 0):
        calls["n"] += 1
        return {"n": calls["n"], "x": x, "pad": "a" * 3000}

    @app.get("/api/market/broken")
    async def broken():
        calls["n"] += 1
        return JSONResponse({"error": "boom"}, status_code=500)

    @app.get("/api/data/status")
    async def status():
        calls["n"] += 1
        return {"n": calls["n"]}

    @app.post("/api/market/breadth")
    async def post_breadth():
        calls["n"] += 1
        return {"n": calls["n"]}

    app.add_middleware(ResponseCacheMiddleware)
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    ttl_cache.clear()
    return TestClient(app), calls


def test_get_is_cached_per_query_and_marks_hit():
    client, calls = _client()
    first = client.get("/api/market/breadth?x=1")
    second = client.get("/api/market/breadth?x=1")
    other = client.get("/api/market/breadth?x=2")
    assert first.headers["x-cache"] == "MISS"
    assert second.headers["x-cache"] == "HIT"
    assert second.json() == first.json()
    assert other.json()["x"] == 2
    assert calls["n"] == 2


def test_clear_drops_cached_responses():
    client, calls = _client()
    client.get("/api/market/breadth")
    ttl_cache.clear()
    client.get("/api/market/breadth")
    assert calls["n"] == 2


def test_errors_non_get_and_other_prefixes_are_not_cached():
    client, calls = _client()
    client.get("/api/market/broken")
    client.get("/api/market/broken")
    client.get("/api/data/status")
    client.get("/api/data/status")
    client.post("/api/market/breadth")
    client.post("/api/market/breadth")
    assert calls["n"] == 6


def test_large_response_is_gzipped():
    client, _ = _client()
    r = client.get("/api/market/breadth", headers={"accept-encoding": "gzip"})
    assert r.headers["content-encoding"] == "gzip"
    assert r.json()["pad"] == "a" * 3000


def test_navigator_current_is_excluded():
    assert not is_cacheable("GET", "/api/navigator/current")
    assert is_cacheable("GET", "/api/navigator/forward")
    assert not is_cacheable("POST", "/api/market/breadth")
