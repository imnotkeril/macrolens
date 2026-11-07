# AGENTS.md — MacroLens

Instructions for any coding agent (Cursor, Codex, Claude Code).

- Goal: macro trading terminal (regime analysis, Fed policy, yield curve, inflation, Forecast Lab diagnostics).
- Stack: FastAPI + SQLAlchemy async + Alembic (backend/), Next.js 16 + React 18 + Tailwind (frontend/), Postgres 16, Redis 7.
- Read first: `docs/STATE.md` (progress), `docs/plan.md`, `docs/ARCHITECTURE.md`, `README.md`, `DEPLOY.md`.
- Backend checks (from `backend/`): `ruff check app tests`, `black --check app tests`, `isort --check-only app tests`, `mypy app`, `pytest`. Frontend (from `frontend/`): `npm run lint`, `npm run typecheck`, `npm run build`.
- Write/train/refresh/LLM endpoints are protected by `X-API-Key` (`backend/app/security.py`).
- Work one task from `docs/plan.md` at a time; verify, tick it, add a line to `docs/STATE.md`, commit locally.
- Never commit secrets (`.env*`). Never push or deploy without the owner's approval.
- Code, comments and docs in English.
