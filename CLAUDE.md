# MacroLens — project notes

Macro trading terminal: regime analysis, Fed policy, yield curve, inflation, Forecast Lab (HMM + XGBoost).

- Router: webapp/dashboard
- Modules: background-jobs, error-monitoring
- Stack: Python 3.12 FastAPI + SQLAlchemy async + Alembic + APScheduler (backend/), Next.js 16 + React 18 + Tailwind + TanStack Query + Recharts/lightweight-charts (frontend/), Postgres 16, Redis 7. Deviation from the router default (Next+Drizzle): the data/ML core is Python, so the backend stays FastAPI (existing project, ADR in docs/ARCHITECTURE.md).
- Services: Vercel (frontend), Hugging Face Spaces (backend), Supabase/Neon Postgres, Upstash Redis, FRED API (all deploys are owner-only)
- Progress: `docs/STATE.md` · Plan: `docs/plan.md` · Architecture: `docs/ARCHITECTURE.md` · Audit: `docs/AUDIT_2026-10-24.md` · Release: `docs/RELEASE_CHECKLIST.md` (docs/ is gitignored: these files are local, untracked)

## Commands
- Backend (from `backend/`, Windows): `.venv/Scripts/python.exe -m pytest`; `ruff check app tests`; `black --check app tests`; `isort --check-only app tests`; `mypy app`.
- Frontend (from `frontend/`): `npm run lint`, `npm run typecheck`, `npm run build`.
- Migrations: `alembic upgrade head` (baseline creates the schema on empty DB).
- Stack: `docker compose up --build` (dev), `+ -f docker-compose.prod.yml` (self-host; needs POSTGRES_PASSWORD, REDIS_PASSWORD, ADMIN_API_KEY).

## Working rules
- Resume from the last unchecked step in `docs/STATE.md`.
- Before each process step / plan task run `node E:/Main/Dev/coding-brain/scripts/step-brief.mjs --project . --step <step>` (or `--task <id>`) and follow it.
- After each task: run its check -> tick `docs/plan.md` -> one line in `docs/STATE.md` -> local commit.

## Rules
- Write/train/refresh/LLM endpoints require `X-API-Key` (`ADMIN_API_KEY`); see `backend/app/security.py`.
- Next rewrites are resolved at build time: set `BACKEND_URL` / `BACKEND_INTERNAL_URL` before `next build`.
- Never commit `.env*`. Never push/deploy without the owner's yes.
