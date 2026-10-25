# MacroLens — project notes

Macro trading terminal. FastAPI backend (`backend/`), Next.js 16 frontend (`frontend/`), Postgres 16 + Redis.
Family: webapp / dashboard. Resume from `docs/STATE.md` and `docs/plan.md` (docs/ is gitignored: local only).

## Commands
- Backend (from `backend/`, Windows): `.venv/Scripts/python.exe -m pytest`; `ruff check app tests`; `black --check app tests`; `isort --check-only app tests`; `mypy app`.
- Frontend (from `frontend/`): `npm run lint`, `npm run typecheck`, `npm run build`.
- Migrations: `alembic upgrade head` (baseline creates the schema on empty DB).
- Stack: `docker compose up --build` (dev), `+ -f docker-compose.prod.yml` (self-host; needs POSTGRES_PASSWORD, REDIS_PASSWORD, ADMIN_API_KEY).

## Rules
- Write/train/refresh/LLM endpoints require `X-API-Key` (`ADMIN_API_KEY`); see `backend/app/security.py`.
- Next rewrites are resolved at build time: set `BACKEND_URL` / `BACKEND_INTERNAL_URL` before `next build`.
- Never commit `.env*`. Never push/deploy without the owner's yes.
