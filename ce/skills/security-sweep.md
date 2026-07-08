# Security Sweep — trust boundaries

## Skill ID

`security-sweep`

## Purpose

Trust-boundary review for tax-assist: authentication on routes, input validation, secrets hygiene, and external-API auth correctness. Encodes precedents from real incidents in this repo so they don't recur.

## When to Use

- Before any PR that adds/changes routes, auth, input handling, or external API calls
- Periodic sweep of the route table
- Whenever "vibe-coded" changes may have reintroduced reverted patterns (see checklist item 5)

## When Not to Use

- Generic adversarial code review across the whole diff → framework `/council adversary` (this skill is the tax-assist-specific boundary checklist; they complement, not replace, each other)
- Functional bugs without a trust boundary → `the-bug-hunter`

## Inputs Required

- The diff or route list under review; access to `backend-ts/` source

## Optional Inputs

- Route inventory grep (`app.(get|post|put|patch|delete)`) for full sweeps

## Tools Required

- grep/file read; no network access needed. Read access to `.env` **names** (never print values).

## Output

- Findings list (route/file:line, issue, severity, fix) and applied fixes where in scope
- Private escalation for anything live-exploitable (see Safety)

## Process / Checklist

1. **Every mutating route needs auth** — `app.authenticate`, or `authenticateOptional` **only when truly public**. Precedent: `POST /api/tax-law/update` was once unauthenticated — fixed; check that class of route first.
2. **Validate all input at routes with zod;** `AppError` for failures. Filing-detail formats are validated (routing numbers, phones) — new filing fields follow the same pattern.
3. **Never hallucinate external API auth.** Congress.gov uses the `CONGRESS_API_KEY` **query param** (no Basic auth). Its 403s are **swallowed as empty results** — when results vanish, check the key first, don't invent an auth scheme.
4. **Secrets live in `backend-ts/.env`** (DATABASE_URL, ANTHROPIC_API_KEY, CONGRESS_API_KEY) — **never commit**; check the diff for accidental inclusion of `.env` content or literals that look like keys.
5. **Watch for reverted vibe-code recurring:** pasted system prompts in CLAUDE.md, invented auth schemes. If a previously-reverted pattern reappears, flag it explicitly as a recurrence.

## Source Grounding

Findings cite file:line. External-API auth claims cite the provider's docs or the working code path — not memory (see the Congress.gov precedent: memory invents Basic auth that doesn't exist).

## Safety and Compliance

- **Live vulnerability found (unauthenticated mutating route in deployed code, leaked secret):** stop feature work; report **privately to the maintainer** — never describe the exploit in a public artifact, PR body, or commit message. For a leaked secret: rotate first, then scrub history; treat the old value as burned.
- Never print secret values in output; refer to keys by name only.
- This skill reviews and fixes defensively; it does not write exploit tooling.

## Assumptions

Routes are assumed non-public until shown otherwise — the burden is on `authenticateOptional` usage to justify itself, not the reverse.

## Failure Handling

- **Unsure whether a route is legitimately public** → flag for human decision with the route's purpose; don't guess in either direction.
- **External API returns empty where data existed** → key/auth check before code changes (403-swallowing precedent).
- **Fix requires schema/behavior change beyond the sweep** → open a finding + ticket rather than expanding scope silently.

## Validation

- Grep the route table: every mutating route has an auth handler; every `authenticateOptional` has a justification.
- Diff scan: no secrets, no `.env` content.
- New/changed inputs have zod schemas with tests exercising rejection paths.

## Acceptance Criteria

- [ ] All checklist items run against the diff/scope; findings written with file:line and severity
- [ ] No unauthenticated mutating routes remain (or each has a human-approved public justification)
- [ ] No secrets in the diff; any live exposure escalated privately + rotated
- [ ] Recurrence of reverted patterns explicitly flagged if seen

## Examples

**Typical:** New `POST /api/filing-details` route — verify `app.authenticate` present, zod schema validates routing number/phone formats, failures raise `AppError`, tests cover a rejected malformed routing number.

**Edge case:** Congress.gov integration "stops returning bills." Wrong move: add Basic-auth headers (hallucinated scheme). Right move: check `CONGRESS_API_KEY` — the 403 is being swallowed as an empty result; fix the key, then consider surfacing 403s distinctly.

## Related Skills

`the-bug-hunter` (validation loop after fixes) · `the-honest-advisor` (the tax-law update route precedent overlaps both) · framework `/council adversary` (generic attack review) · framework `quality-gate` dev section (security scan item)

## Change Log

| Date | Change | Author |
|---|---|---|
| 2026-07-07 | Restructured to skill template; all precedents preserved; private-escalation and secrets rules added | AI skills review pass |
