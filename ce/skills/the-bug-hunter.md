# The Bug Hunter — debugging + validation loop

## Skill ID

`the-bug-hunter`

## Purpose

Fix bugs at the root cause and prove the fix with a fixed validation loop. Encodes the repo-specific traps that have burned sessions before, so they burn no one twice.

## When to Use

- Any bug report, regression, failing test, or "it worked yesterday"
- After any fix, as the standard validation loop before a PR (the pre-PR gate assumes it)

## When Not to Use

- Feature work without a defect → `the-planner`
- Auth/input-validation concerns → `security-sweep` (run it too if the bug touches a route)
- Environment won't start at all → `the-setup` first

## Inputs Required

- A reproduction: failing test, exact steps, or the observed-vs-expected pair. **Reproduce before fixing** — no fix lands without first seeing the failure.
- Working dev environment per `the-setup` (seeded user available for UI verification)

## Optional Inputs

- Recent `git log` around the regression window; related ticket

## Tools Required

- vitest, npm (lint/build), Playwright or manual browser for live UI checks
- Form-fill work: `verifyFields.mjs` / `checkFieldMappings.mjs` (via `npx tsx scripts/<x>.mjs`)
- **`npm test` is destructive** — wipes the shared dev DB; warn first and re-seed after (see `the-setup`)

## Output

- Root-cause fix (in the shared function, not a caller-side patch) + a regression test that failed before the fix
- Green validation loop (below), stated explicitly in the wrap-up with command results
- One-paragraph root-cause note in the commit/PR description
- Fix commit updates `CHANGELOG.md` in the same commit (framework rule, `.agents/rules/project-rules.md`)

## Process

1. **Reproduce before fixing.** Capture the failing test or exact steps.
2. Trace to the **root cause in the shared function** — then **grep every caller** of that function to check the fix's blast radius and find sibling bugs.
3. Write the regression test; see it fail.
4. Apply the minimal correct fix; see it pass.
5. **Run the validation loop — always, from `backend-ts/`:** focused vitest → `npm test` → `npm run lint` → `npm run build`; plus `cd frontend && npm run build` if UI touched.
6. **Verify UI live** (Playwright or manually) against the seeded user — **zero console errors** (the favicon 404 is pre-existing noise and is the *only* tolerated console message).
7. Re-seed the test user after the loop (`npm test` invalidated the old user id).

## Known Gotchas (have burned sessions — check before debugging "mysteries")

- vitest **parity tests read files with paths relative to `backend-ts/`** — run them from there, or they fail spuriously.
- `test/rules.test.ts` **parity-greps for the literal `id: "<rule-id>"`** — every scanner rule needs one, written exactly `"<id>": (_benefit, facts) => {` in rules.ts. A rule that "mysteriously" fails parity is usually formatted differently.
- `loadBenefitLibrary` **walks ALL of tax_library recursively** (skip non-benefit kinds) — don't assume flat traversal.
- **Form-fill:** never trust markitdown text extraction — use `verifyFields.mjs` / `checkFieldMappings.mjs` live AcroForm dumps. The **sha256 revision guard exits 2** when the IRS re-publishes a PDF — that exit code means "form changed upstream," not "your code broke."

## Source Grounding

Root-cause claims cite file:line. If the bug involves tax values, the correct value comes from `taxParams.generated.ts` or a cited primary source per `the-honest-advisor` — never from memory.

## Safety and Compliance

- Never "fix" by weakening/deleting the failing test or widening a type to `any`.
- If debugging reveals a security hole (unauthenticated route, leaked secret), stop and follow `security-sweep` escalation before continuing.
- Warn before destructive commands (`npm test` DB wipe).

## Assumptions

Label with `ASSUMPTION:` in the root-cause note. Common trap: assuming the seeded user id is stable — it is not (new id each seed run).

## Failure Handling

- **Can't reproduce** → say so with what was tried; do not fix blind. Ask for environment details or capture logs.
- **Fix works but validation loop fails elsewhere** → the fix has blast radius; return to step 2 (grep callers), don't patch the symptom.
- **sha256 guard exits 2** → IRS re-published the form; re-verify field mappings with the live AcroForm dump before touching mapping code.
- **Console errors that aren't the favicon 404** → not done; each one is either fixed or explicitly triaged with the user.

## Validation

The loop in step 5–6 *is* the validation. It is not optional and not reorderable.

## Acceptance Criteria

- [ ] Regression test exists and was seen failing pre-fix
- [ ] Fix is in the shared function; all callers grepped and checked
- [ ] Full validation loop green from `backend-ts/` (+ frontend build if UI touched)
- [ ] Live UI verified with seeded user; zero console errors (favicon 404 excepted)
- [ ] Root-cause note written
- [ ] `CHANGELOG.md` updated in the fix commit

## Examples

**Typical:** A scanner rule returns wrong eligibility. Repro via focused vitest; root cause is in the shared eligibility helper; grep finds two other rules calling it — one has the same latent bug; both fixed; regression tests added for each; loop green; UI spot-checked as alex.carter.

**Edge case:** Form-fill fields "disappear" after an IRS PDF update. markitdown extraction looks plausible but is wrong; `verifyFields.mjs` live dump shows renamed AcroForm fields and the sha256 guard exits 2. Correct behavior: update mappings from the dump, refresh the guard hash — no code "fix" chasing the extraction text.

## Related Skills

`the-setup` (env + seed user + DB-wipe warning) · `the-planner` (if the fix grows into multi-file work) · `security-sweep` (route/input bugs) · framework `/pre-flight`, `/test-coverage` (pre-PR gate wraps this loop)

## Change Log

| Date | Change | Author |
|---|---|---|
| 2026-07-07 | Restructured to skill template; all gotchas preserved verbatim in intent; failure paths added | AI skills review pass |
