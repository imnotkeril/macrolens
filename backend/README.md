---
title: MacroLens API
emoji: 📈
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# MacroLens API (backend)

FastAPI service for the MacroLens macro terminal: macro indicators, Fed policy, yield curve,
Cycle Radar and Navigator analytics, Forecast Lab (HMM + XGBoost artifacts), economic calendar,
alerts, LLM agents and memory retrieval. It runs an APScheduler scheduler in-process, so it is
**always-on**, not serverless.

Deploy runbook: [`../DEPLOY.md`](../DEPLOY.md). Project overview: [`../README.md`](../README.md).
The HF Spaces front matter above sets the Docker SDK and `app_port: 7860`. The image listens on
`$PORT` (default `7860`).

## Stack

Python 3.12 (image and CI), FastAPI, SQLAlchemy 2 async with asyncpg, Alembic, Pydantic Settings,
APScheduler, Redis client, pandas/NumPy, scikit-learn, XGBoost, hmmlearn.

## Run locally

Needs PostgreSQL and Redis reachable at the URLs in `.env`. Easiest: run only the data services
with Docker, `docker compose up -d db redis` from the repo root (ports bind to `127.0.0.1`).

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # set FRED_API_KEY; see the env table in ../README.md
alembic upgrade head               # create or migrate the schema
uvicorn app.main:app --reload --port 8000
```

Health: `GET http://127.0.0.1:8000/api/health` returns `{"status":"ok","service":"MacroLens API"}`.
Interactive docs: `/docs` (Swagger UI) and `/openapi.json`. The Markdown API reference is
[`../llms.txt`](../llms.txt).

## Migrations

Alembic revisions live in `alembic/versions/` (5 revisions: `baseline_000` creates the full schema
on an empty database, then four incremental revisions). `alembic upgrade head` is the only
supported way to change a migrated database. The dev compose file does not run Alembic; see
[`../DEPLOY.md`](../DEPLOY.md).

## Tests and checks

From `backend/`:

```bash
pip install -r requirements-dev.txt
ruff check app tests
black --check app tests
isort --check-only app tests
mypy app
pytest --cov=app/services/forecast_lab --cov-config=.coveragerc --cov-fail-under=60
```

`pytest` is configured by `pytest.ini` (`testpaths = tests`, asyncio auto mode). Coverage covers
the unit-tested Forecast Lab core; the gate is 60%.

## Layout

```text
app/
  main.py        app factory, lifespan (schema bootstrap, scheduler), routers, /api/health
  config.py      Settings (pydantic-settings, reads .env)
  security.py    ASGI guard: X-API-Key on non-GET /api/*, per-IP rate limit, body size limit
  database.py    async engine and session factory
  api/           15 routers (one module per prefix, see ../llms.txt)
  models/        SQLAlchemy ORM models
  schemas/       Pydantic response and agent-output schemas
  services/      analytics and integrations (see below)
  tasks/         APScheduler jobs (scheduler.py)
alembic/         migration environment and revisions
config/          Forecast Lab and Navigator YAML (phase rules, expectations, macro panel)
data/            runtime data; the active Forecast Lab bundle is committed
tests/           pytest suite
```

Service groups under `app/services/`: `cycle_engine.py` (Cycle Radar), `navigator_engine.py`
and `navigator_*_expectations.py` (Navigator quadrants), `fed_tracker.py` and `fed_dashboard.py`
(Fed policy), `yield_analyzer.py`, `inflation_service.py`, `indicator_analyzer.py` (z-scores,
trends), `market_service.py`, `calendar_service.py` and `calendar_canary_service.py`,
`alert_service.py`, `data_collector.py` (FRED/Yahoo ingestion), `data_sources/` (provider
adapters and router), `fred_client.py`, `yahoo_client.py`, `cme_fedwatch_client.py`,
`fed_press_*`, `forecast_lab/` (phase, macro and recession models, ensemble, diagnostics),
`ml_*` and `ml2_*` (legacy ML regime and ML2 endpoints), `agents/` (Fed, macro-data, news and
master agents), `agent_*` and `intelligence_pipeline.py`, `memory_*` and `retrieval_service.py`
(memory store, ingestion, retrieval), `embedding_service.py`, `llm/` (Claude client, JSON
extraction, OpenAI embeddings), `telegram_news_ingestion.py`.

## Scheduler jobs

Started in the FastAPI lifespan (`app/tasks/scheduler.py`), 11 cron jobs in the process timezone:

| Job id | When | What |
|---|---|---|
| `daily_market` | daily 18:00 | market data (yields, commodities, FX) |
| `daily_yields` | daily 18:05 | yield curve |
| `daily_fed` | daily 18:10 | Fed funds |
| `weekly_mba` | Wed 12:00 | MBA mortgage data |
| `weekly_claims` | Thu 12:00 | initial claims |
| `weekly_bs` | Thu 18:15 | Fed balance sheet |
| `monthly_macro` | 1st and 15th, 14:00 | macro indicators |
| `daily_alerts` | daily 18:30 | indicator analytics and alert checks |
| `daily_intelligence` | daily 18:40 | ML2 refresh, agents, master recommendation |
| `daily_memory` | daily 18:50 | memory snapshots and domain ingestion |
| `daily_calendar_canary` | daily 19:00 | external calendar canary feed |

## Environment

All variables are documented in [`.env.example`](.env.example) (names match `Settings` in
`app/config.py`). Required for real data: `FRED_API_KEY`. Required for write endpoints:
`ADMIN_API_KEY` (or `ALLOW_UNAUTHENTICATED_ADMIN=true` for local dev only).
