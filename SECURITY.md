# Security Policy

## Reporting a vulnerability

Please do not open a public issue for security problems. Report privately through GitHub:
**Security tab -> "Report a vulnerability"** (private security advisory) on this repository.

Include affected component, reproduction steps and impact. You can expect an acknowledgement
within a few days. Do not test against production data or other users' accounts.

## Scope

The FastAPI backend (`backend/`), the Next.js frontend (`frontend/`) and the deployment
configuration in this repository. Secrets are never committed; use `.env` files (git-ignored).
