# Contributing

MacroLens is a proprietary macro trading terminal (see [`LICENSE`](LICENSE)). Bug reports and small, focused fixes are the easiest changes to review; please open an issue before larger work.

## Setup
```bash
# backend
cd backend && pip install -r requirements.txt -r requirements-dev.txt
ruff check app tests && black --check app tests && isort --check-only app tests
mypy app && pytest -q

# frontend
cd ../frontend && npm ci && npm run lint && npm run typecheck && npm run build
```
Copy `.env.example` to `.env` if you need to change settings. Never commit `.env*` files or keys.

## Pull requests
- Branch from `main`; one topic per pull request.
- Add or update a test for every behaviour change.
- Lint, types, tests and build must pass; CI runs the same commands.
- Privileged endpoints (writes, training, refresh, LLM) stay behind `X-API-Key`; do not weaken the security middleware.

## Reporting problems
Use the issue templates. For security problems follow [`SECURITY.md`](SECURITY.md) instead of opening a public issue.
