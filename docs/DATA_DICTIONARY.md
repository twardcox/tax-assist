# Data Dictionary

## Database: PostgreSQL (`tax_assist`)

### Tables

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `email` | TEXT | Unique, used for login |
| `password_hash` | TEXT | bcrypt |
| `created_at` | TIMESTAMPTZ | |

#### `household_data`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → users |
| `tax_year` | INT | |
| `data_json` | JSONB | Canonical — the full household schema blob |
| `updated_at` | TIMESTAMPTZ | |

#### `income_data`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → users |
| `tax_year` | INT | |
| `data_json` | JSONB | Canonical |
| `updated_at` | TIMESTAMPTZ | |

#### `businesses_data`, `real_estate_data`, `investments_data`, `retirement_data`, `healthcare_data`, `dependents_data`, `goals_data`
Same shape as `income_data`. One row per user per tax year per section. `data_json` is always canonical; typed columns (where present) are search indexes only.

### Schema files
- Section schemas: `frontend/src/schemas/` — defines field groups, labels, types, `essential`, `advanced`, `showIf`, `defaultOpen`
- DB migration: `backend-ts/db/migrate.ts`
- Seed: `backend-ts/scripts/seedTestUser.ts` (alex.carter@example.com / TestUser123!)

### Known data redundancies (Phase C — not yet resolved)
- Capital gains: `income_data` (`investment_income.*`) and `investments_data` (`realized_gains_losses_this_year.*`)
- HSA contributions: `income_data` W-2 list, `income_data` adjustments, and `healthcare_data`
- Rental income: `real_estate_data` (`rental_use.gross_rental_income`) vs `income_data` (`rental_income[].gross_rents`)
