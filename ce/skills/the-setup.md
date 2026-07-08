# The Setup — dev environment for tax-assist

## Skill ID

`the-setup`

## Purpose

Bring up the tax-assist dev environment correctly and avoid its one destructive trap (`npm test` wipes the shared dev DB). This is the app environment skill; framework/CE tooling setup is `/init-project` / `/troubleshoot-setup`.

## When to Use

- Fresh clone, new session, or "nothing works" environment confusion
- Before any skill that needs a running app or seeded user (`the-bug-hunter` UI verification)

## When Not to Use

- CE framework bundle/MCP issues → framework `/troubleshoot-setup`, `/sync`, `/init-project`
- CI environment issues → `/ci-status`

## Inputs Required

- `backend-ts/.env` with `DATABASE_URL` (PostgreSQL) — plus ANTHROPIC_API_KEY, CONGRESS_API_KEY for features that need them (names per `security-sweep`; never print values)

## Optional Inputs

- None

## Tools Required

- shell, npm, tsx. **Destructive:** `npm test` (see Safety).

## Output

- Backend running on **8001**, frontend on **5173**, seeded user available, and (when needed) admin access — with the current seed-user id known.

## Process

1. **Backend:** `cd backend-ts && npm run dev` (Fastify, port 8001).
2. **Frontend:** `cd frontend && npm run dev` (Vite 5173, proxies `/api` → 8001).
3. **DB:** PostgreSQL via `DATABASE_URL` in `backend-ts/.env`. Confirm connectivity before blaming code.
4. **Seed user:** `npm run seed:test-user` → `alex.carter@example.com` / `TestUser123!`. **Creates a NEW user id each run** — re-seed and **re-query the id** after any `npm test`; never reuse a cached id.
5. **Admin bootstrap:** `admin@localhost` / `changeme123`.
6. **Scripts** run TS directly via tsx: `npx tsx scripts/<x>.mjs` (see `verifyFields.mjs`, `suggestStacks.mjs`, `checkFieldMappings.mjs`).

## Source Grounding

Ports, credentials, and commands here are the repo's ground truth; if reality disagrees (port changed, script renamed), trust the repo, then update this file in the same change.

## Safety and Compliance

- **`npm test` wipes the shared dev DB.** Warn before running it in any session where the user may have state they care about; re-seed afterward. Never run it casually "to check things."
- Seed/admin credentials are **dev-only** conveniences; never reuse them in anything production-like, and never commit new secrets (see `security-sweep`).

## Assumptions

- Dev DB is shared and disposable-with-warning. If evidence suggests it holds data someone cares about, stop and ask before any wiping operation.
- `ASSUMPTION (unexecuted, from original author):` ports 8001/5173, seed credentials, and the `npm test` wipe behavior are documented but were not re-executed during the 2026-07 review/audit passes. If any fails in practice, trust reality and update this file in the same change.
- `OPEN QUESTION (maintainer):` has the `admin@localhost` / `changeme123` bootstrap password been rotated anywhere it matters? It is dev-only by policy, but the default should be confirmed as dev-only in every deployed environment.

## Failure Handling

- **Backend won't start** → check `DATABASE_URL` and Postgres availability first; report the actual error, don't reinstall the world.
- **Frontend API calls fail** → confirm backend on 8001 and the Vite proxy; don't hardcode URLs as a workaround.
- **Seeded user "missing" or auth fails after tests** → expected consequence of the DB wipe; re-seed and re-query the id (step 4), don't debug auth.
- **Script fails under plain node** → run via `npx tsx` (they're TS).

## Validation

- `curl localhost:8001/health` responds (route: `backend-ts/src/routes/health.ts`); frontend loads at 5173; login as seed user succeeds; current user id captured.

## Acceptance Criteria

- [ ] Both servers running on expected ports
- [ ] Seed user login verified this session with a freshly-queried id
- [ ] User warned before any `npm test` in the session

## Examples

**Typical:** New session for UI bug work: start backend, start frontend, re-seed, log in as alex.carter, capture the new user id, hand off to `the-bug-hunter`.

**Edge case:** After running `npm test`, Playwright login fails. This is the wipe, not a bug: re-seed, re-query the id, and continue — do not open an auth investigation.

## Related Skills

`the-bug-hunter` (consumes this environment) · `security-sweep` (secrets rules) · framework `/init-project`, `/troubleshoot-setup` (CE tooling, not app env)

## Change Log

| Date | Change | Author |
|---|---|---|
| 2026-07-07 | Restructured to skill template; all commands/credentials preserved; DB-wipe promoted to warning gate | AI skills review pass |
