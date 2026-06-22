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

FastAPI service powering the MacroLens macro-trading terminal: macro indicators, Fed policy,
yield curve, regime/Navigator analytics, Forecast Lab (HMM + XGBoost), economic calendar, and
LLM-backed intelligence agents. A background scheduler (APScheduler) refreshes data on an
interval, so this service is **always-on** — not serverless.

The YAML front-matter above configures this as a **Hugging Face Spaces** Docker app
(listens on port `7860`). See [`../DEPLOY.md`](../DEPLOY.md) for the full deploy runbook.

## Run locally

```bash
cp .env.example .env          # fill FRED_API_KEY at minimum
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Or run the whole stack (Postgres + Redis + backend + frontend) from the repo root:

```bash
docker compose up --build
```

## Required environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres DSN (`postgresql+asyncpg://...`) |
| `REDIS_URL` | Redis URL |
| `FRED_API_KEY` | FRED data (required for real data) |
| `CORS_ALLOW_ORIGINS` | Comma-separated frontend origins for prod |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Optional — LLM agents / embeddings |

See `.env.example` for the complete list. Health check: `GET /api/health`.
Interactive API docs: `/docs`.
