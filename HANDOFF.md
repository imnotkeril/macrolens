# Handoff
status: active
date: 2026-11-03
from-chat-tokens: ~300k

## Goal
Bring MacroLens (FastAPI + Next.js 16 macro terminal, router webapp/dashboard) to release-ready per coding-brain: security/correctness fixes from docs/AUDIT_2026-10-24.md, framework steps, accurate docs. No push/PR/deploy without owner yes.

## State
- Done: everything in the previous handoff plus (2026-11-03): safe P2 fixes (failed-key rate bucket, memory query max 256), /llms.txt via frontend/public, provisional CHANGELOG [1.1.0] - 2026-11-03 (best guess, owner confirms), devops release-prep (docs/RELEASE.md, local).
- Branch: chore/audit, pushed to origin up to f9876b7; PR imnotkeril/macrolens#3 OPEN, CI green at 99fc62a. Later local commits may be unpushed (check git status). Do NOT merge/deploy.
- Checks at HEAD: pytest 60 passed + 1 skipped, ruff/black/isort/mypy clean (venv in session scratchpad; PYTHONUTF8=1 needed).
- Not done: design-reviewer + browser QA (375/768/1440). Blocked: Playwright MCP is in .mcp.json but needs a `claude -c` restart; Docker Desktop daemon unresponsive; native Postgres refuses app login.
- Skipped on purpose: S-02 (GET /api/ml2/predict mutates; needs GET->POST + frontend change), S-04 (dev-mode Host/Origin check), trusted-hops config for X-Forwarded-For.
- docs/ is gitignored (local: STATE, plan, RELEASE*, review/, HANDOFF).

## Decisions
- Python backend kept (not Next+Drizzle): data/ML core is Python.
- P2/P3 findings (docs/review/*.md, plan.md backlog) deliberately not fixed: scope = no extra hardening.
- docs/ stays untracked until the owner decides.

## Next
1. Restart with `claude -c`, start Docker (or a local PG), run the stack on audit ports, run design-reviewer + browser QA.
2. Bump manifests to the chosen version once the owner confirms; S-02 fix with owner yes.

## Open questions
- Version/date for CHANGELOG (provisional 1.1.0); waive secrets-scan hits (false positives); track docs/ in git?; ADMIN_API_KEY/BACKEND_URL/CORS values for Vercel+HF; DB snapshot before first alembic upgrade head; Sentry yes/no; stale-ingest monitor.

## Traps
- Docker default ports 3000/5432/6379/8000 are taken (native Postgres, other sessions): use `-p audit-macrolens-*` with `ports: !override`.
- pip needs `--use-feature=truststore` here; venv at session scratchpad (venv2), py3.11.
- Next rewrites are baked at build time; running the app rewrites tracked backend/data/forecast_lab_artifacts/active_bundle_id.txt (git checkout it, never commit).
- Commits by tech-writer carry Haiku co-author trailer; next dev regenerates frontend/AGENTS.md (local-excluded).

## Verify
- `cd backend && PYTHONUTF8=1 python -m pytest -q && ruff check app tests && black --check app tests && mypy app`
- `cd frontend && npm run lint && npm run typecheck && npm run build`
