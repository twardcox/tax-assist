# Architecture Template: UTBIS

## Version History

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.0 | 2026-07-10 | Travis Cox (with Claude Code) | Initial inventory of the existing, running stack |

> This is an **inventory of a built system**, not a proposal. Sections that don't exist for a
> local, solo-operated app are marked **N/A** rather than filled with aspirational tooling.

---

## 1. Overview

### 1.1 System Description

UTBIS is a two-process local web app: a Fastify (TypeScript) API server backed by PostgreSQL, and
a React SPA served by Vite in dev. Domain logic — benefit scanner (59 rules), strategy-stack
evaluator, scenario modeling, tax calculator (Form 1040 + 8 schedules, 2024/2025 params), IRS PDF
form filler, 17-source tax-law updater, CPA packet generator — lives in `backend-ts/src/domain/`.
The benefit library is YAML records in `tax_library/` loaded at scan time. AI features (document
classification, scan narratives, law-change classification) call the Anthropic API when
`ANTHROPIC_API_KEY` is set and degrade gracefully when not.

### 1.2 Architecture Style

| Aspect | Choice | Rationale |
| --- | --- | --- |
| **Pattern** | Monolith (single API server + SPA) | Solo-operated local tool; no scale pressure |
| **API Style** | REST (JSON over Fastify routes) | Simple, stable route contract preserved through the Python→TS migration |
| **Data Strategy** | Traditional relational; `data_json` per section is canonical, typed columns are search indexes | Schema-normalization decision 2026-06 (9 typed section tables) |

### 1.3 Architecture Diagram

```
React 19 SPA (Vite, :5173)
   │  fetch/TanStack Query, JWT bearer
   ▼
Fastify 5 API (:8000)  ── routes/ (auth, userData, scan, scenarios, documents,
   │                        taxLaw, taxForms, reports, dashboard…)
   ├─ domain/scanner      ← tax_library/*.yaml (63 benefits, 3 stacks)
   ├─ domain/taxForms     ← IRS PDF templates (pdf-lib fill)
   ├─ domain/taxLaw       → Federal Register, IRS, IRB, Treasury, Congress.gov,
   │                        DAWSON, 10 state DORs (fetch + dedupe + state file)
   ├─ domain/documents    ← Anthropic API (classification/extraction)
   └─ db/ (pg driver)     → PostgreSQL (29 tables; documents as BLOBs)
```

---

## 2. Tech Stack

### 2.1 Languages

| Language | Version | Purpose | Rationale |
| --- | --- | --- | --- |
| TypeScript | 5.x (strict) | Backend + shared domain logic | Migrated from Python 2026-06; single language, typed domain |
| JavaScript (JSX) | ES2022 | Frontend (React) | Existing SPA; schemas in `frontend/src/schemas/*.js` |
| Python | 3.x | **Retired from runtime** — legacy scripts kept as migration reference only | Historical |

### 2.2 Frontend

| Category | Technology | Version | Purpose |
| --- | --- | --- | --- |
| **Framework** | React | 19 | SPA |
| **State Management** | TanStack Query + React context | 5.62 | Server state; no Redux |
| **Styling** | Tailwind CSS | 3.x | Utility styling |
| **UI Components** | Hand-rolled (`FieldInput`, `FieldGroup`, `ListEditor`, …) | — | Accessibility retrofitted 2026-06 (Phase A/B redesign) |
| **Form Handling** | Schema-driven custom (`frontend/src/schemas/*.js` → `SectionForm`) | — | My Data sections generated from schema files |
| **Data Fetching** | TanStack Query | 5.62 | Caching, invalidation |
| **Routing** | React Router | 6.28 | Client routing |
| **Build Tool** | Vite | 5.x | Dev server + build |

### 2.3 Backend

| Category | Technology | Version | Purpose |
| --- | --- | --- | --- |
| **Runtime** | Node.js | 22 (CI) / 24 (local) | JS execution |
| **Framework** | Fastify | 5.4 | HTTP server (`buildApp()` async factory) |
| **ORM/Query Builder** | None — raw `pg` with typed repo modules (`db/*Repo.ts`) | pg 8.22 | Deliberate: small surface, no ORM dependency |
| **Validation** | Zod | 3.25 | Route payload validation |
| **Authentication** | Custom JWT (`jsonwebtoken` + `bcryptjs`) | — | Self-registration, per-user isolation |
| **API Documentation** | None (route contract documented in HANDOFF/tests) | — | N/A for solo project |
| **Job Queue** | None — tax-law update runs in-process with `already_running` guard | — | N/A |
| **PDF** | pdf-lib | 1.17 | IRS AcroForm fill + flatten |
| **AI SDK** | @anthropic-ai/sdk | 0.102 | Claude (Haiku classification; narrative generation) |

### 2.4 Mobile

N/A.

---

## 3. Data Layer

### 3.1 Primary Database

| Attribute | Value |
| --- | --- |
| **Type** | PostgreSQL |
| **Version** | Local install (16.x-class) |
| **Managed Service** | Self-hosted local; `DATABASE_URL` in `.env` |
| **Connection Pooling** | `pg` built-in Pool |
| **Replication** | None |
| **Backup Strategy** | None automated — **known gap**; real user data now raises the stakes (see Decision Log) |
| **Retention Period** | Indefinite (local) |

**Schema Management:**

- Migration Tool: custom `backend-ts/src/db/migrate.ts` (idempotent, runs at startup)
- Migration Strategy: version-controlled TypeScript migrations; YAML→DB bootstrap only when user table is empty

### 3.2 Secondary Databases

None. N/A.

### 3.3 File Storage

| Provider | Purpose | Configuration |
| --- | --- | --- |
| PostgreSQL BLOBs (`documents` table) | Uploaded documents | No filesystem dependency |
| Local filesystem (`state/`, `reports/`, `tax_library/future_law/`) | Tax-law updater state + generated reports | Git-tracked where non-sensitive |
| Local filesystem, gitignored (`user_data/private/`, `documents/receipts/`) | Real books CSV (cash system of record), receipts, worksheet | Guarded by `privateDataIgnored.test.ts` |

### 3.4 Data Models (Canonical)

Canonical per-user tax facts: 9 typed section tables (`household_data`, `income_data`,
`businesses_data`, `real_estate_data`, `investments_data`, `retirement_data`, `healthcare_data`,
`dependents_data`, `goals_data`) keyed by `(user_id, tax_year)`; `data_json` is canonical, typed
columns are search indexes. Benefit records: YAML schema per `tax_library/example-benefit.yaml`.
Full dictionary: `docs/DATA_DICTIONARY.md`. Scan access layer:
`backend-ts/src/domain/scanner/userFacts.ts` (`UserFacts.fromUserSections`).

---

## 4. Infrastructure & Hosting

Local single-machine operation (Windows 11 dev box). No cloud provider, no staging/production
environments, no orchestration, no CDN/LB/DNS. **All of §4: N/A by design** — see SOW constraint
"local, single-machine operation stays the model."

---

## 5. CI/CD Pipeline

### 5.1 Source Control

| Attribute | Value |
| --- | --- |
| **Platform** | GitHub (public repo) |
| **Repository Structure** | Monorepo (`backend-ts/`, `frontend/`, `tax_library/`, `ce/`, docs) |
| **Branch Strategy** | Feature branches off `main`; long-running workstream branches (`switch-to-ts`, `audit`, current session branches) |
| **Protected Branches** | `main` (PR-based merges) |
| **Required Reviews** | Self + AI review (solo project) |

### 5.2 CI Platform

| Attribute | Value |
| --- | --- |
| **Platform** | GitHub Actions |
| **Build Agent** | Hosted `ubuntu-latest`, Node 22 |
| **Parallelization** | Single job per workflow |
| **Caching Strategy** | Default npm cache |

### 5.3 Pipeline Stages

| Stage | Tools | Triggers | Duration |
| --- | --- | --- | --- |
| Backend tests | Vitest (`npm test`, 396+) | PRs/pushes (`ci-checks.yml`) | ~min |
| Backend lint | ESLint + @typescript-eslint | same | ~1 min |
| Backend build | tsc | same | ~1 min |
| Frontend build | Vite | same | ~1 min |
| E2E | Playwright (chromium), pnpm | `e2e-tests.yml`, gated by enable-check | ~min |
| Lighthouse | `lighthouse.yml` | gated | ~min |

### 5.4 Deployment Strategy

N/A — no deployment target; "release" = merge to `main`.

### 5.5 Infrastructure as Code

N/A.

---

## 6. Testing Framework

### 6.1 Test Pyramid

| Level | Framework | Coverage Target | Purpose |
| --- | --- | --- | --- |
| **Unit/Integration** | Vitest (`backend-ts/test/`, 396+ tests) | Key domain flows, not % | Scanner rules, eligibility, tax calculator, forms, tax-law sources, stacks, API |
| **E2E** | Playwright (CI, gated) + live manual verification via Playwright MCP in dev sessions | Critical paths | Full user flows against the real running app |
| **Visual / Performance / Security** | N/A / Lighthouse workflow / none | — | — |

### 6.2 Test Data Management

| Aspect | Approach |
| --- | --- |
| **Fixtures** | Synthetic only (hard rule — public repo); seeded test user `alex.carter@example.com` via `npm run seed:test-user` |
| **Test Database** | Local Postgres; `resetTablesForTest()` between tests |
| **Data Generation** | Hand-written fixtures per suite |
| **Cleanup Strategy** | Truncate via `resetTablesForTest()` |

### 6.3 Mocking Strategy

| Layer | Tool | Approach |
| --- | --- | --- |
| **HTTP (tax-law sources)** | Vitest mocks/stubs per source handler | Contract-based, not internals-based |
| **Database** | Real local Postgres | No in-memory substitute |
| **Anthropic API** | Skipped/stubbed when `ANTHROPIC_API_KEY` absent | Graceful degradation is the tested path |

---

## 7. Monitoring & Observability

N/A — local tool; console logging only (`console.log/warn/error`). Health endpoint:
`GET /api/health` (process alive). No aggregation, metrics, tracing, alerting, or on-call.

---

## 8. Security

### 8.1 Authentication

| Attribute | Value |
| --- | --- |
| **Method** | JWT bearer (custom) |
| **Provider** | Custom (`jsonwebtoken`, `bcryptjs` password hashing) |
| **MFA** | None (local single-operator) |
| **Session Duration** | JWT expiry per auth service config |
| **Token Storage** | Frontend localStorage |

### 8.2 Authorization

| Attribute | Value |
| --- | --- |
| **Model** | Per-user data isolation (all queries keyed by `user_id`) |
| **Implementation** | Route-level auth middleware + repo-layer user scoping |
| **Roles** | Single role; no RBAC |

### 8.3–8.4 Security Tools & Secrets

- Secrets: `.env` (gitignored); `ANTHROPIC_API_KEY`, `DATABASE_URL`, JWT secret.
- Dependency scanning: GitHub default (Dependabot alerts on public repo).
- **Repo-privacy control (the load-bearing one):** real financial data never enters the repo —
  Postgres is outside the tree; `user_data/private/` gitignored with a CI-enforced
  `git check-ignore` guard test; synthetic-only fixtures rule.

### 8.5 Compliance

N/A (personal tool; no third-party PII). The governing posture is the not-tax-advice boundary
documented in README ("What This Is Not") and benefit-record abuse boundaries (e.g. 831(b),
non-grantor trusts per T.D. 10029 / IR-2023-65).

---

## 9. External Services & APIs

### 9.1 Third-Party Services

| Service | Purpose | Tier | Fallback |
| --- | --- | --- | --- |
| Anthropic API (Claude) | Document classification/extraction, scan narratives, law-change classification | Pay-as-you-go | Features degrade gracefully when key absent |

### 9.2 API Integrations (tax-law updater, read-only fetch)

Federal Register, IRS News, IRS Publications, Internal Revenue Bulletin, Treasury Regulations,
Congress.gov, US Tax Court (DAWSON), and 10 state DORs (CA, NY, IL, MA, NJ, CO, OR, PA, OH, GA).
Public endpoints, no auth, polite rate use; date-filtered + deduped with state tracking in
`state/update_state.json`. PolicyEngine parameter pipeline feeds tax params (2026-07-06 audit).

### 9.3 Internal APIs/Services

Single service. N/A.

---

## 10. Development Environment

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 22 (CI) / 24.13 (local) | npm workspaces not used; per-dir `npm ci` |
| PostgreSQL | local install | `DATABASE_URL` in `.env` |
| Git | 2.x | — |
| VS Code + Claude Code | — | Primary IDE; Playwright MCP for live verification |

Startup: env load → `backend-ts: npm run dev` (:8000) + `frontend: npm run dev` (:5173).
Env template: `.env` (gitignored); validation at startup via config module.

---

## 11. Operational Runbooks

N/A — solo local operation. The one operational document is the monthly books ritual
(`user_data/private/README.md`, target ≤15 min) plus the validation loop in `CLAUDE.md`
(focused Vitest → full suite → lint → build).

---

## 12. Decision Log

| Date | Decision | Options Considered | Rationale | Impact |
| --- | --- | --- | --- | --- |
| 2026-06 | Migrate Python → TypeScript (`backend-ts`) | Keep Python; hybrid | Single typed language, retire subprocess paths | All domain logic in TS; Python retained as reference only |
| 2026-06 | Normalize `section_data` blobs → 9 typed tables | Keep blobs | Searchable indexes; `data_json` stays canonical | `db/migrate.ts` migration |
| 2026-06-22 | SQLite → PostgreSQL | Stay SQLite | Async repos, concurrent access, real driver | `pg` + `DATABASE_URL`; test reset helper |
| 2026-06 | Documents as DB BLOBs | Filesystem | No filesystem dependency, per-user isolation | `documents` table |
| 2026-07-10 | Real user facts via My Data UI/DB, **no YAML overlay** | Gitignored YAML overlay merge | Scan path reads per-user DB (`fromUserSections`); DB is outside the repo — stronger than gitignore | Story A collapsed to data entry + guard test |
| 2026-07-10 | DB backup pulled into SOW scope (PM/PO at SOW+ gate) | pg_dump ritual step; automated task | Real books-derived facts now land in Postgres with no backup | `pg_dump` step in monthly ritual + one verified restore, delivered in M1 |

---

## 13. Appendix

### 13.2 Glossary (seed — canonical copy will live in System PRD)

| Term | Definition |
| --- | --- |
| Benefit record | YAML file in `tax_library/` describing one legal tax benefit incl. eligibility rules |
| Strategy stack | Authored multi-benefit combination evaluated by `scanner/stacks.ts` |
| Trigger benefit | Benefit with a dollar threshold reported as fired / not-fired with distance-to-threshold |
| Books | `user_data/private/books/<year>-transactions.csv` — cash system of record for the LLC |
| Section | One My Data category (household, income, businesses, …) = one typed DB table |

### 13.3 Related Documents

- SOW: `agent-docs/2026-07-10-sow-utbis.md`
- Data dictionary: `docs/DATA_DICTIONARY.md` · Patterns: `docs/PATTERNS.md`
- Living entry point: `HANDOFF.md` · Backlog seed: `docs/backlog/first-real-user-private-overlay.md`
