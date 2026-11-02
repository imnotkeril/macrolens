# Handoff
status: active
date: 2026-11-02
from-chat-tokens: ~300k

## Goal
Bring MacroLens (FastAPI + Next.js 16 macro terminal, router webapp/dashboard) to release-ready per coding-brain: security/correctness fixes from docs/AUDIT_2026-10-24.md, framework steps, accurate docs. No push/PR/deploy without owner yes.

## State
- Done: audit; Alembic baseline; admin API key + rate/body limit (backend/app/security.py); deps bump (fastapi 0.162, Next 16.4.3); compose hardening; B1 concurrent-train fix; review (reviewer, security-reviewer), qa-tester, tech-writer, docs auditor; README quick start/architecture/5 screenshots (assets/screenshots, tracked).
- Not run yet: design-reviewer, devops (release-prep), Playwright MCP browser QA/a11y/perf. docs/RELEASE_CHECKLIST.md was written by the session, not devops.
- Running: nothing (all audit-macrolens* containers/ports cleaned).
- Branch/commit: chore/audit @ 99fc62a, tree clean, 27 commits ahead of origin/main, NOT pushed.
- Counts at HEAD: pytest 59 passed + 1 skipped (needs MACROLENS_TEST_DATABASE_URL), cov 67.74%; ruff/black/isort/mypy clean; lint 0 errors/12 warnings; tsc 0; build ok; pip-audit and npm audit --omit=dev clean.
- docs/ is in .gitignore: STATE.md, plan.md, QA.md, KPI_DICTIONARY.md, RELEASE_CHECKLIST.md, AUDIT_*.md, review/*.md, HANDOFF.md exist only on disk (untracked). Tracked copy of this note: HANDOFF.md at repo root. Tracked docs: README, DEPLOY, USER_GUIDE, CHANGELOG, llms.txt, CLAUDE.md, AGENTS.md.

## Decisions
- Python backend kept (not Next+Drizzle): data/ML core is Python.
- P2/P3 findings (docs/review/*.md, plan.md backlog) deliberately not fixed: scope = no extra hardening.
- docs/ stays untracked until the owner decides.

## Next
1. Run devops agent for release-prep (reconcile docs/RELEASE_CHECKLIST.md); `node E:/Main/Dev/coding-brain/scripts/step-brief.mjs --project . --step release-prep` first.
2. If Playwright MCP is wired (`apply-router.mjs --mcp playwright`), run design-reviewer + browser QA (375/768/1440, console, a11y) on a local stack with audit ports.
3. With owner yes: fix P2 (rate-limit identity behind proxy, GET /api/ml2/predict and memory search paid/writing GETs), serve /llms.txt, forward compose vars.

## Open questions
- CHANGELOG version number/date; track docs/ in git?; push chore/audit + PR?; ADMIN_API_KEY/BACKEND_URL/CORS for Vercel+HF.

## Traps
- Docker default ports 3000/5432/6379/8000 are taken (native Postgres, other sessions): use `-p audit-macrolens-*` with `ports: !override`.
- pip needs `--use-feature=truststore` here; venv at session scratchpad (venv2), py3.11.
- Next rewrites are baked at build time; running the app rewrites tracked backend/data/forecast_lab_artifacts/active_bundle_id.txt (git checkout it, never commit).
- Commits by tech-writer carry Haiku co-author trailer; next dev regenerates frontend/AGENTS.md (local-excluded).

## Verify
- `cd backend && PYTHONUTF8=1 python -m pytest -q && ruff check app tests && black --check app tests && mypy app`
- `cd frontend && npm run lint && npm run typecheck && npm run build`
