# TS Migration Tracker

Status board for Python to TypeScript migration on branch switch-to-ts.

## Legend
- TODO: not started
- IN_PROGRESS: currently being implemented
- DONE: implemented and parity-verified

## Backend Runtime
| Area | Python Source | TypeScript Target | Owner | Status |
|---|---|---|---|---|
| App bootstrap | api/main.py | backend-ts/src/app.ts | Backend A | DONE |
| Env/config loader | .env, config/app.yaml usage | backend-ts/src/config/env.ts | Backend A | DONE |
| Paths and dirs | various startup paths | backend-ts/src/lib/paths.ts | Backend A | DONE |
| Error envelope | FastAPI HTTPException detail | backend-ts/src/lib/errors.ts | Backend A | DONE |
| SQLite init foundation | api/db.py init path | backend-ts/src/db/init.ts | Backend B | DONE |

## API Routes
| Route Group | Python Source | TypeScript Target | Owner | Status |
|---|---|---|---|---|
| Health | N/A | backend-ts/src/routes/health.ts | Backend A | DONE |
| Config | api/routes/config.py | backend-ts/src/routes/config.ts | Backend A | DONE |
| Auth | api/routes/auth.py, api/auth.py | backend-ts/src/routes/auth.ts | Backend A | DONE |
| User data | api/routes/user_data.py | backend-ts/src/routes/userData.ts | Backend A | DONE |
| Transactions | api/routes/transactions.py | backend-ts/src/routes/transactions.ts | Backend B | DONE |
| Reconciliation | api/routes/reconciliation.py | backend-ts/src/routes/reconciliation.ts | Backend B | DONE |
| Planning | api/routes/planning.py | backend-ts/src/routes/planning.ts | Backend B | IN_PROGRESS |
| Scan | api/routes/scan.py | backend-ts/src/routes/scan.ts | Backend A | IN_PROGRESS |
| Scenarios | api/routes/scenarios.py | backend-ts/src/routes/scenarios.ts | Backend A | DONE |
| Reports | api/routes/reports.py | backend-ts/src/routes/reports.ts | Backend B | DONE |
| Documents | api/routes/documents.py | backend-ts/src/routes/documents.ts | Backend B | TODO |
| Tax forms | api/routes/tax_forms.py | backend-ts/src/routes/taxForms.ts | Backend B | DONE |
| Tax law | api/routes/tax_law.py | backend-ts/src/routes/taxLaw.ts | Backend A | DONE |

## Logic Ports
| Module | Python Source | TypeScript Target | Owner | Status |
|---|---|---|---|---|
| Scanner | scripts/scan_opportunities.py | backend-ts/src/domain/scanner/* | Backend A | IN_PROGRESS |
| Scenarios | scripts/scenario_simulator.py | backend-ts/src/domain/scenarios/* | Backend A | IN_PROGRESS |
| CPA packet | scripts/generate_cpa_packet.py | backend-ts/src/domain/reports/cpaPacket.ts | Backend B | IN_PROGRESS |
| Receipt classifier | scripts/classify_receipts.py | backend-ts/src/domain/documents/classifier.ts | Backend B | TODO |
| Tax law updater | scripts/update_tax_law.py | backend-ts/src/domain/taxLaw/updater.ts | Backend A | IN_PROGRESS |
| Tax forms | scripts/generate_tax_forms.py | backend-ts/src/domain/taxForms/* | Backend B | TODO |
| Test seeder | scripts/create_test_user.py | backend-ts/src/scripts/createTestUser.ts | Backend B | TODO |

## Data Layer
| Area | Python Source | TypeScript Target | Owner | Status |
|---|---|---|---|---|
| DB schema/migrations | api/db.py | backend-ts/src/db/migrations/* | Backend B | IN_PROGRESS |
| YAML->DB bootstrap | api/migrate.py | backend-ts/src/db/bootstrap.ts | Backend B | TODO |
| Auth token revoke store | api/db.py revoked_tokens | backend-ts/src/db/revokedTokens.ts | Backend A | DONE |

## Test and Parity
| Suite | Python Source | TypeScript Target | Owner | Status |
|---|---|---|---|---|
| API baseline tests | N/A | backend-ts/test/api.test.ts | QA/Release | DONE |
| Eligibility parity | tests/test_eligibility.py | backend-ts/test/eligibility.test.ts | QA/Release | DONE |
| Rules parity | tests/test_rules.py | backend-ts/test/rules.test.ts | QA/Release | DONE |
| Forms parity | tests/test_forms.py | backend-ts/test/forms.test.ts | QA/Release | DONE |
| Tax law parity | tests/test_update_tax_law.py | backend-ts/test/taxLaw.test.ts | QA/Release | DONE |

## Current Sprint Goal
1. Port remaining rule handlers beyond the implemented subset (home office, QBI, vehicle, real estate, state/county property relief, federal family/education credits, selected energy/home-sale rules, core investment strategy rules, key healthcare/retirement planning rules, core itemized deduction rules, and entity/state strategy rules including S Corp election, Solo 401(k), Section 179, bonus depreciation, 1031, REP, PTE, cost segregation, Augusta, and state 529 planning), while continuing to tighten fact-level accuracy (tax-year-aware asset depreciation logic, S Corp salary sanity checks, and contribution-aware 529 logic including negative-path validation).
2. Expand SQLite schema toward normalized section persistence.
3. Keep frontend API contract unchanged for migrated routes.
