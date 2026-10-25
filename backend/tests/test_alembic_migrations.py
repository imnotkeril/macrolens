"""Alembic upgrade/downgrade on an empty throwaway DB. Skipped unless MACROLENS_TEST_DATABASE_URL is set."""

import os
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy.engine import make_url

URL = os.environ.get("MACROLENS_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not URL, reason="MACROLENS_TEST_DATABASE_URL not set")

BACKEND = Path(__file__).resolve().parents[1]
_THROWAWAY = ("test", "tmp", "throwaway", "audit", "scratch")


def _alembic(*args: str) -> subprocess.CompletedProcess:
    env = {**os.environ, "DATABASE_URL": URL or ""}
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND,
        env=env,
        capture_output=True,
        text=True,
        timeout=300,
    )


@pytest.fixture(scope="module", autouse=True)
def _guard():
    name = (make_url(URL).database or "").lower()  # type: ignore[arg-type]
    host = make_url(URL).host or ""  # type: ignore[arg-type]
    if host not in ("127.0.0.1", "localhost", "::1") or not any(m in name for m in _THROWAWAY):
        pytest.fail(f"refusing to run migrations on non-throwaway DB {name!r} @ {host!r}")


def test_upgrade_noop_downgrade_roundtrip():
    for args in (
        ("upgrade", "head"),
        ("upgrade", "head"),  # idempotent no-op
        ("downgrade", "-1"),
        ("upgrade", "head"),
    ):
        r = _alembic(*args)
        assert r.returncode == 0, f"alembic {' '.join(args)} failed:\n{r.stderr[-2000:]}"
