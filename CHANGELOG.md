# Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- CE framework setup: `.ce-project.json`, husky git hooks, `docs/DATA_DICTIONARY.md`, `docs/PATTERNS.md`
- `docs/` directory with data dictionary and patterns reference

### Removed
- Legacy Python backend (`api/`) — fully superseded by TypeScript/Fastify backend
- Legacy Python scripts (`scripts/*.py`) and tests (`tests/*.py`)
- Committed `__pycache__/` directories
- `QA.md` — described deleted Python/FastAPI architecture
- Stale `update_tax_law.py` reference from `ROADMAP.md`

---

## Previous work (summarized — see git log for detail)

### 2026-06-22
- PostgreSQL migration complete (SQLite → PostgreSQL); all repos async; `DATABASE_URL` in `.env`

### 2026-06-16
- All IRS form field mappings verified via live AcroForm dump (`verifyFields.mjs`)
- `FIELD_MAP.md` corrected for Sch SE, Sch D, Sch B, Form 1040 header and refund fields

### 2026-06-11
- Form 1040 header field fixes (name rows, filing status checkboxes, dependents array)
- Per-form tab UI: one tab per applicable form with embedded PDF viewer and download

### 2026-06-02 — My Data UX/Accessibility Redesign
- Phase A: shared component accessibility (`FieldInput`, `FieldGroup`, `HelpPopover`, `SectionForm`)
- Phase A: `household.js` reordered — Your Info (name/SSN/DOB) is now first group
- Phase B: same pattern applied to `income.js`, `businesses.js`, `real_estate.js`, `investments.js`, `retirement.js`, `healthcare.js`, `dependents.js`

### 2026-05-xx — Python → TypeScript migration complete
- All 17 tax-law sources ported to `backend-ts`
- 59 scanner rules, full parity
- `TaxCalculator` (2024/2025 params), ZIP package generator, per-form PDF filler
- YAML → DB bootstrap; 225 tests passing
