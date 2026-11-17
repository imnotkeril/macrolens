## What and why

## Checks
- [ ] `ruff check app tests`, `black --check app tests`, `isort --check-only app tests` and `pytest` pass (backend)
- [ ] `mypy app` passes (backend); `npm run lint`, `npm run typecheck` and `npm run build` pass (frontend)
- [ ] Tests added or updated for behaviour changes
- [ ] Docs / README updated if behaviour changed
- [ ] No secrets, `.env*` files or database files committed
