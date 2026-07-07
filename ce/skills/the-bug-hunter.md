# The Bug Hunter — debugging + validation loop

- Reproduce before fixing; fix root cause in the shared function, then grep every caller.
- Validation loop (always, from backend-ts): focused vitest → `npm test` → `npm run lint` → `npm run build`; plus `cd frontend && npm run build` if UI touched. Verify UI live (Playwright or manually) against the seeded user — zero console errors (favicon 404 is pre-existing noise).
- Gotchas that have burned sessions: vitest parity tests read files with paths relative to `backend-ts/` (run from there); `test/rules.test.ts` parity greps for literal `id: "<rule-id>"` — every scanner rule needs one there, written exactly `"<id>": (_benefit, facts) => {` in rules.ts; `loadBenefitLibrary` walks ALL of tax_library recursively (skip non-benefit kinds).
- Form-fill work: never trust markitdown text extraction — use `verifyFields.mjs` / `checkFieldMappings.mjs` live AcroForm dumps; sha256 revision guard exits 2 if the IRS re-publishes a PDF.
