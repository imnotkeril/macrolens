# MacroLens — Deployment Guide

MacroLens splits into two deployables:

| Component | Where | Why |
|---|---|---|
| **Frontend** (Next.js) | **Vercel** (free) | Static + edge; proxies `/api/*` to the backend |
| **Backend** (FastAPI) | **Hugging Face Spaces** (Docker, free) | Always-on: APScheduler jobs + ML training can't run serverless |
| **Postgres** | **Supabase** or **Neon** (free) | HF free Spaces have ephemeral disk |
| **Redis** | **Upstash** (free) | Same — needs to live outside the Space |

> The backend is **not** Vercel-compatible: it runs a background scheduler, holds DB/Redis
> connections, and trains ML models. Vercel functions are short-lived, so the API lives on HF.

---

## 1. Provision managed data services (free tiers)

1. **Postgres** — create a project on [Supabase](https://supabase.com) or [Neon](https://neon.tech).
   Grab the connection string and convert it to the asyncpg driver:
   `postgresql+asyncpg://USER:PASSWORD@HOST:5432/DBNAME`
2. **Redis** — create a database on [Upstash](https://upstash.com); copy the `rediss://...` URL.

## 2. Deploy the backend to Hugging Face Spaces

The backend ships as a Docker Space. `backend/README.md` already carries the HF front-matter
(`sdk: docker`, `app_port: 7860`), and `backend/Dockerfile` listens on `7860`.

```bash
# 1. Create a new Space: huggingface.co/new-space  → SDK: Docker, blank template.
# 2. Push only the backend/ folder to the Space repo:
git clone https://huggingface.co/spaces/imnotkeril/macrolens-api hf-space
cp -r backend/* backend/.dockerignore hf-space/
cd hf-space && git add . && git commit -m "Deploy MacroLens API" && git push
```

Then in the Space **Settings → Variables and secrets**, set:

| Secret | Value |
|---|---|
| `DATABASE_URL` | Supabase/Neon asyncpg DSN |
| `REDIS_URL` | Upstash `rediss://` URL |
| `FRED_API_KEY` | your FRED key |
| `ADMIN_API_KEY` | long random string; required for write/train/refresh/LLM endpoints (`X-API-Key`) |
| `RATE_LIMIT_TRUST_PROXY` | `true` only if the platform proxy sets a trustworthy `X-Forwarded-For` |
| `CORS_ALLOW_ORIGINS` | `https://<your-app>.vercel.app` |
| `ANTHROPIC_API_KEY` | optional (LLM agents) |
| `OPENAI_API_KEY` | optional (embeddings) |

The container runs `alembic upgrade head` on boot (the container fails fast if a migration errors;
the baseline revision creates the schema on an empty DB), then starts uvicorn. Confirm health at
`https://imnotkeril-macrolens-api.hf.space/api/health`.

> **Free-tier limits:** the Space sleeps after inactivity and disk is ephemeral. The active
> Forecast Lab model bundle is committed in the repo so the API works on a cold start; newly
> trained bundles are lost on restart unless committed or moved to paid persistent storage.

## 3. Deploy the frontend to Vercel

```bash
# Vercel project → Root Directory: frontend/
```

Set one environment variable in Vercel (Project → Settings → Environment Variables):

| Variable | Value |
|---|---|
| `BACKEND_URL` | `https://imnotkeril-macrolens-api.hf.space` |

`next.config.js` rewrites `/api/*` to `BACKEND_URL` (read at build time, so set it *before* the
build; it defaults to `http://127.0.0.1:8000`, never to production), so the browser only ever talks to the
Vercel origin (no CORS round-trips). Deploy — done.

---

## Self-hosting the whole stack (alternative)

One box (VPS / Oracle Cloud Always Free), everything in Docker:

```bash
cp .env.example .env          # fill secrets: POSTGRES_PASSWORD, REDIS_PASSWORD, ADMIN_API_KEY (alphanumeric)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Postgres + Redis + backend + frontend all run as containers with `restart: unless-stopped`.
Ports bind to `127.0.0.1` (frontend `:3000`, backend `:8000`): terminate TLS with a reverse proxy
(Caddy/nginx) in front of the frontend, or set `FRONTEND_BIND=0.0.0.0` on a firewalled host. The
frontend image proxies `/api/*` to `http://backend:8000` (build arg `BACKEND_INTERNAL_URL`).

## Verify a deployment

- Backend: `curl https://<backend>/api/health` → `{"status":"ok"}`
- Frontend: open the Vercel URL; the dashboard should load live data via `/api/*`.
