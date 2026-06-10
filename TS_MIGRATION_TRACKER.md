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
| Planning | api/routes/planning.py | backend-ts/src/routes/planning.ts | Backend B | DONE |
| Scan | api/routes/scan.py | backend-ts/src/routes/scan.ts | Backend A | DONE |
| Scenarios | api/routes/scenarios.py | backend-ts/src/routes/scenarios.ts | Backend A | DONE |
| Reports | api/routes/reports.py | backend-ts/src/routes/reports.ts | Backend B | DONE |
| Documents | api/routes/documents.py | backend-ts/src/routes/documents.ts | Backend B | DONE |
| Tax forms | api/routes/tax_forms.py | backend-ts/src/routes/taxForms.ts | Backend B | DONE |
| Tax law | api/routes/tax_law.py | backend-ts/src/routes/taxLaw.ts | Backend A | DONE |

## Logic Ports
| Module | Python Source | TypeScript Target | Owner | Status |
|---|---|---|---|---|
| Scanner | scripts/scan_opportunities.py | backend-ts/src/domain/scanner/* | Backend A | DONE |
| Scenarios | scripts/scenario_simulator.py | backend-ts/src/domain/scenarios/* | Backend A | DONE |
| CPA packet | scripts/generate_cpa_packet.py | backend-ts/src/domain/reports/cpaPacket.ts | Backend B | DONE |
| Receipt classifier | scripts/classify_receipts.py | backend-ts/src/domain/documents/* | Backend B | DONE |
| Tax law updater | scripts/update_tax_law.py (retired) | backend-ts/src/domain/taxLaw/updater.ts | Backend A | DONE |
| Tax forms | scripts/generate_tax_forms.py | backend-ts/src/domain/taxForms/* | Backend B | DONE |
| Test seeder | scripts/create_test_user.py | backend-ts/src/scripts/createTestUser.ts | Backend B | DONE |

## Data Layer
| Area | Python Source | TypeScript Target | Owner | Status |
|---|---|---|---|---|
| DB schema/migrations | api/db.py | backend-ts/src/db/init.ts (section_data JSON arch) | Backend B | DONE |
| YAML->DB bootstrap | api/migrate.py | backend-ts/src/db/bootstrap.ts | Backend B | DONE |
| Auth token revoke store | api/db.py revoked_tokens | backend-ts/src/db/revokedTokens.ts | Backend A | DONE |

## Test and Parity
| Suite | Python Source | TypeScript Target | Owner | Status |
|---|---|---|---|---|
| API baseline tests | N/A | backend-ts/test/api.test.ts | QA/Release | DONE |
| Eligibility parity | tests/test_eligibility.py | backend-ts/test/eligibility.test.ts | QA/Release | DONE |
| Rules parity | tests/test_rules.py | backend-ts/test/rules.test.ts | QA/Release | DONE |
| Forms parity | tests/test_forms.py | backend-ts/test/forms.test.ts | QA/Release | DONE |
| Tax law parity | tests/test_update_tax_law.py | backend-ts/test/taxLaw.test.ts | QA/Release | DONE |

## Migration Complete — 2026-06-10

All rows above are DONE. The `switch-to-ts` branch is ready to merge to `main`.

## Next Sprint Goals

1. Add more benefit rules — extend `tax_library/` beyond the current 58 benefits.
2. Normalize the DB schema — migrate `section_data` JSON blobs toward relational tables.
3. Merge `switch-to-ts` → `main` and retire the branch.
