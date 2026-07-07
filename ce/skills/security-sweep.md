# Security Sweep — trust boundaries

- Every mutating route needs auth (`app.authenticate` / `authenticateOptional` only when truly public). Precedent: `POST /api/tax-law/update` was once unauthenticated — fixed.
- Validate all input at routes with zod; AppError for failures. Filing-detail formats are validated (routing numbers, phones).
- Never hallucinate external API auth: Congress.gov uses `CONGRESS_API_KEY` query param (no Basic auth; 403s are swallowed as empty results — check the key first when results vanish).
- Secrets live in `backend-ts/.env` (DATABASE_URL, ANTHROPIC_API_KEY, CONGRESS_API_KEY) — never commit.
- Watch for reverted vibe-code recurring: pasted system prompts in CLAUDE.md, invented auth schemes.
