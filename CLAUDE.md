# Claude Handoff

Project: `tax-assist`
Branch: `switch-to-ts`

## Current State — Migration Complete

The Python → TypeScript migration is fully done. Every item in `TS_MIGRATION_TRACKER.md` is DONE.

- **Active runtime:** `backend-ts` (TypeScript/Fastify) — all Python routes retired
- **All 17 tax-law sources** ported; `scripts/update_tax_law.py` deleted
- **Scanner:** 59 rules, full parity, regression-tested
- **Scenarios:** with AI narrative support
- **CPA packet:** 4-bucket status sections, household summary, AI summary block
- **Tax forms:** full `TaxCalculator` (2024/2025 params), ZIP package generator, text summary
- **YAML→DB bootstrap:** idempotent on startup; creates `admin@localhost` / `changeme123`
- **Test seeder:** `npm run seed:test-user` (alex.carter@example.com / TestUser123!)
- **225 tests passing**, lint and build clean

## Next Sprint Goals

1. **Add more benefit rules** — extend the library beyond the current 58 benefits
   (see `tax_library/federal/`, `tax_library/state/`, `tax_library/county/`)
2. **Normalize the DB schema** — migrate `section_data` JSON blobs toward proper relational tables
3. **Merge to main** — the `switch-to-ts` branch is ready

## Validation Loop

1. Run focused Vitest tests for the source you touched.
2. Run `npm test` (full suite) in `backend-ts`.
3. Run `npm run lint` in `backend-ts`.
4. Run `npm run build` in `backend-ts`.

## Useful References

- Migration tracker: `TS_MIGRATION_TRACKER.md`
- Main handoff: `HANDOFF.md`
- Benefit library: `tax_library/federal/`, `tax_library/state/`, `tax_library/county/`
- Scanner rules: `backend-ts/src/domain/scanner/rules.ts`
- Tax calculator: `backend-ts/src/domain/taxForms/taxCalculator.ts`
