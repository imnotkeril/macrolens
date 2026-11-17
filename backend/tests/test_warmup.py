from app.main import app
from app.services import ttl_cache
from app.warmup import WARMUP_PATHS


def test_warmup_paths_are_real_get_routes():
    paths = app.openapi()["paths"]
    missing = [p for p in WARMUP_PATHS if "get" not in paths.get(p, {})]
    assert not missing


def test_stale_returns_value_of_any_age():
    ttl_cache.clear()
    assert ttl_cache.stale("k") is None
    ttl_cache.put("k", {"v": 1})
    assert ttl_cache.stale("k") == {"v": 1}
    ttl_cache.clear()
