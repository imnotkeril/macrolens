# Changelog

All notable changes to this project are documented here. Format: Keep a Changelog 1.1; versioning: Semantic Versioning. Newest first.

## [Unreleased]
### Security
- Write, train, refresh and LLM endpoints now require `X-API-Key` (`ADMIN_API_KEY`); they answer 503 when no key is configured. Added per-IP rate limiting and a request body size limit.
- Updated fastapi/starlette/python-dotenv and Next.js 16.4.3 (pip-audit and `npm audit --omit=dev` report no known vulnerabilities).
- Docker ports bind to 127.0.0.1; DB and Redis passwords come from the environment (required by the production overlay).
### Fixed
- Alembic: baseline revision creates the schema on an empty database; revisions are idempotent; container start fails fast on a migration error.
- `POST /api/forecast-lab/train` rejects a second request while a training run is active (409).
- Production compose: frontend image proxies `/api` to the backend container (build arg `BACKEND_INTERNAL_URL`); dev bind mounts no longer hide the standalone server.
- `black --check` failure in `cycle_engine.py`.
### Changed
- `BACKEND_URL` defaults to the local backend, never to production.
- Frontend upgraded to Next.js 16 (React 18 kept); ESLint flat config.
- The UI asks for the admin key once for privileged actions and keeps it in browser localStorage.
