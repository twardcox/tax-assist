# Patterns

## Stack
- **Backend:** Fastify (TypeScript) in `backend-ts/` — Vitest, ESLint, TypeScript (tsc/tsx)
- **Frontend:** React + Vite (JavaScript/JSX) in `frontend/` — Tailwind CSS
- **Database:** PostgreSQL via `pg` driver; `DATABASE_URL` in `.env`
- **Runtime:** Node 22; root `package.json` orchestrates via `concurrently`

## Backend patterns (`backend-ts/`)

### Route registration
Routes are Fastify plugins registered in `src/routes/`. Each file exports an async plugin function and calls `fastify.register()` in `src/app.ts`.

### Data access
All user section data flows through typed repo modules in `src/db/` (e.g. `sectionRepo.ts`). Reads return `data_json` parsed as the relevant schema type. Never read raw columns for business logic — `data_json` is canonical.

### Scanner
`src/domain/scanner/scan.ts` → loads all benefits from `tax_library/`, evaluates rules in `rules.ts` against `UserFacts` (`userFacts.ts`), returns `ScanResult[]`. No side effects; pure function.

### Tax calculator
`src/domain/taxForms/taxCalculator.ts` — single `TaxCalculator` class; instantiate with `{ household, income, ... }` data blobs. All 2024/2025 parameters inline.

### IRS form filling
`src/domain/taxForms/fillIrsForms.ts` — `fillSingleIrsForm(userId, taxYear, formKey)`. Uses `pdf-lib` to fill AcroForm fields. Field map reference: `state/pdf_check/FIELD_MAP.md`.

### Testing
- Framework: Vitest with Fastify `app.inject()` for HTTP integration tests
- Test DB cleanup: `resetTablesForTest()` in `src/db/client.ts`
- Run: `npm test --prefix backend-ts`
- Validation loop: test → lint → build (in that order)

## Frontend patterns (`frontend/src/`)

### Data flow
React Query manages all server state. All fetch calls go through `src/lib/api.ts`. No direct `fetch()` calls in components.

### Schema-driven UI
`pages/UserData.jsx` renders sections from schemas in `schemas/`. `SectionForm.jsx` iterates field groups; `FieldGroup.jsx` / `FieldInput.jsx` / `ListEditor.jsx` handle rendering. `showIf`, `advanced`, `defaultOpen` are all evaluated client-side against current section data.

### Completeness signal
`lib/sectionCompleteness.js` — reads `essential`-flagged fields to compute per-section fill %. Used for nav status dots.

## CI
GitHub Actions (`.github/workflows/ci-checks.yml`): install → test → lint → build for backend-ts and frontend. PostgreSQL service container spun up for tests. No Python jobs.
