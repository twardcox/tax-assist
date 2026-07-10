# UTBIS Handoff Document
**Universal Tax Benefit Intelligence System**
**Project root:** `d:\programs\tax-assist`
**Last updated:** 2026-07-10
**Backend Runtime:** TypeScript/Fastify (`backend-ts`) | **Legacy Python:** retained for migration references

---

## Claude Code Handoff

### New workstream (2026-07-10): First real user — owner's LLC books + trigger benefits

Entry point: `docs/backlog/first-real-user-private-overlay.md` (committed on this branch). The owner's
single-member LLC becomes UTBIS's first real user profile. Already in place (local-only, gitignored —
verify `git check-ignore` before any commit; repo is PUBLIC): `user_data/private/books/2026-transactions.csv`
(real business books), `user_data/private/businesses.local.yaml` (real facts, some TODO-owner fields),
`user_data/private/README.md` (monthly ritual). `.gitignore` rule for `user_data/private/` is committed.

**Translation note:** the backlog draft was written against the README/ROADMAP (Python scanner + YAML)
view. Since the live system is TS + SQLite ("My Data" UI, multi-user, gitignored DB), Story A (private
overlay) may reduce to entering real facts via My Data — decide overlay-vs-DB at design review. Story B
stands as written: add §41 R&D credit (+§174A note) to the benefit library and support threshold-style
"almost available" reporting (distance-to-threshold: ~$5k/yr cash spend → §41 CPA conversation;
~$40k/yr net profit → S-corp election). Story C (monthly books ritual command) depends on A+B. The CSV
books remain the cash system of record regardless of implementation choice. Cross-repo context:
`d:\programs\public-data\lab-overview\` cost-and-monetization-discipline.md §1.7–1.10 + project-cost-ledger.md.

### TS migration (previous workstream)

This workspace is mid-migration from Python to TypeScript. The active runtime path is `backend-ts`. The tax-law updater migration is complete and `scripts/update_tax_law.py` has been retired.

### What is already done
- `/api/tax-law/update` uses the TypeScript updater path; the Python script is deleted.
- All 17 tax-law sources are ported to `backend-ts/src/domain/taxLaw/updater.ts`:
  Federal Register, IRS News, IRS Publications, Internal Revenue Bulletin, Treasury Regulations, Congress.gov legislation, US Tax Court (DAWSON), and 10 state revenue departments (CA, NY, IL, MA, NJ, CO, OR, PA, OH, GA).
- AI classification via Claude Haiku runs post-fetch when `ANTHROPIC_API_KEY` is set.
- Focused regression tests cover date filtering, dedupe, and state tracking for each source.
- Scanner parity work is largely complete and protected by direct tests.

### What should happen next
- Continue porting remaining logic per `TS_MIGRATION_TRACKER.md` (Scanner, Scenarios, CPA packet are IN_PROGRESS; Tax forms and Test seeder are TODO).
- Keep the route contract stable while porting incrementally.

### Safe validation loop
- Run focused Vitest tests for the touched source first.
- Then run the tax-law/API smoke tests.
- Finish with `npm run lint` and `npm run build` in `backend-ts`.

---

## Current State

**Library:** 58 benefits (46 federal + 6 state + 6 county) · **Tests:** 74/74 passing
**Nav pages:** Dashboard · My Data · Scenarios · Documents · Planning · Tax Law · Tax Forms · Reports
**Auth:** JWT self-registration · **DB:** SQLite (29 tables) · **Users:** multi-user, fully isolated
**Documents:** Stored as BLOBs in `documents` table — no filesystem dependency

### Start the full stack (TypeScript backend)
```powershell
# Load env vars first (required for AI features)
Get-Content .env | ForEach-Object { if ($_ -match '^([^#=]+)=(.*)$') { [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim()) } }

# Terminal 1 — backend-ts
cd backend-ts; npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```
- API health: http://localhost:8000/api/health
- App: http://localhost:5173 → redirects to `/login`

**Default credentials (auto-created on first run from existing YAML data):**
- Email: `admin@localhost.com` · Password: `Test1234!` ← **change in prod**

**Test user (rich profile, 10 eligible benefits):**
- Email: `alex.carter@example.com` · Password: `Test1234!`
- Re-create (TypeScript helper): `cd backend-ts && npm run seed:test-user`

---

## Migration Course of Actions

### Scanner and runtime parity work
- Confirmed the repository was already on the `switch-to-ts` branch and used the TypeScript backend as the primary runtime target.
- Kept the scanner migration focused on rule parity and regression coverage rather than rewriting unrelated application flows.
- Preserved the existing API contracts while migrating behavior so the frontend and tests could keep using the same endpoints and payload shapes.

### Tax-law update conversion
- Replaced the `/api/tax-law/update` Python subprocess path with a native TypeScript runner in `backend-ts`.
- Ported the Federal Register updater first because it was the clearest live-source slice and the lowest-risk way to remove a runtime Python dependency.
- Extended the TypeScript updater to handle IRS News, IRS Publications, Internal Revenue Bulletin, and Treasury Regulations source ingestion.
- Kept the output locations the same: `state/update_state.json`, `tax_library/future_law/`, and `reports/tax_law_updates.md`.

### Validation approach
- Added focused tests for each migrated source to prove date filtering, deduplication, and state tracking.
- Validated each slice with targeted Vitest runs before widening to the tax-law API smoke tests.
- Finished each migration step with lint and TypeScript build checks so the repo stayed in a shippable state.

---

## Implementation Decisions

- The primary runtime remains `backend-ts`; legacy Python files are kept only as migration references until each workflow is fully ported.
- The tax-law route continues to return the same user-facing statuses (`started`, `already_running`) and validation errors so client behavior does not change.
- Source handlers are being ported incrementally instead of all at once so each live integration can be validated in isolation.
- File-system side effects were kept compatible with the Python implementation to avoid changing downstream reports or law-change consumers.
- Tests were written around the observable contract of each source handler instead of the exact Python internals, which keeps the port maintainable while still enforcing parity.

---

## Current Migration Status — COMPLETE

The Python → TypeScript migration is fully complete as of 2026-06-10. Every item in `TS_MIGRATION_TRACKER.md` is DONE.

- All routes, domain logic, and data layer are running from `backend-ts`.
- 225 tests passing; lint and build clean.
- `scripts/update_tax_law.py` has been deleted; all other Python scripts are retained as historical reference.
- **Next sprint goals:** add more benefit rules, normalize DB schema, merge `switch-to-ts` → `main`.

---

## Environment Variables (`.env`)

```
ANTHROPIC_API_KEY=sk-ant-...      # Required: AI Analysis, CPA Packet, receipt extraction
CLAUDE_MODEL=claude-haiku-4-5-20251001  # Optional: override AI model for document extraction
CONGRESS_API_KEY=...              # Optional: Congress.gov scraper (defaults to DEMO_KEY)
DAWSON_USERNAME=...               # US Tax Court login
DAWSON_PASSWORD=...               # US Tax Court login
JWT_SECRET_KEY=...                # Required outside test mode: JWT signing secret (server refuses to issue tokens without it)
```

---

## Architecture

### Data layer: SQLite (`state/transactions.db`)

All user data is stored in a normalized relational database. YAML files in `user_data/` are legacy backups only. The `state/` directory is auto-created by `init_db()` on startup — no `.gitkeep` needed.

**29 tables:** `users`, `revoked_tokens`, `households`, `spouses`, `dependents`, `w2_income`, `self_employment_income`, `rental_income`, `investment_income`, `retirement_distributions`, `social_security_income`, `other_income`, `adjustments`, `businesses`, `business_vehicles`, `business_assets`, `properties`, `investment_accounts`, `plans_529`, `employer_retirement_plans`, `ira_accounts`, `self_employed_retirement`, `healthcare`, `goals`, `documents`, `transactions`, `transaction_benefits`, `revoked_tokens`

**Households extended columns (added via migration):** `county TEXT`, `taxpayer_veteran INTEGER`, `taxpayer_disabled INTEGER`, `taxpayer_blind INTEGER`, `taxpayer_active_military INTEGER`

**Key DB functions (`api/db.py`):**
- `init_db()` — creates all tables + runs ALTER TABLE migrations; safe to call on every startup
- `save_section_data(user_id, tax_year, section, data_dict)` — writes a full section to the correct tables
- `get_section_data(user_id, tax_year, section) → dict` — reconstructs a section dict from DB
- `get_all_user_data(user_id, tax_year) → dict` — assembles the full `_data` dict that UserFacts expects
- `apply_dot_path_to_section(user_id, tax_year, section, dot_path, operation, value)` — AI extraction path
- `upsert_document(user_id, file_id, filename, category, confidence, content, size, note)` — stores BLOB
- `get_document_content(user_id, file_id) → (bytes, filename)` — retrieves BLOB for AI extraction
- `get_documents_for_user(user_id) → list[dict]` — metadata only, no BLOB in list query
- `get_user_by_id(user_id) → dict | None` — used by tax form generator for display name

### Scanner pipeline (`scripts/scan_opportunities.py`)

**`UserFacts(tax_year, user_id=None)`**
- `user_id` provided → `_load_from_db()` → calls `get_all_user_data()`
- `user_id=None` → `_load_from_yaml()` (CLI fallback, reads `user_data/*.yaml`)
- Public interface (all helper methods) is identical either way — zero rule changes

**`RulesEngine`** — dispatches `benefit.id` (kebab) → `_rule_<id_with_underscores>()`. **59 rules.** All call `self.f.*` helpers; none open files.

**`OpportunityScanner(tax_year, facts=None)`** — if `facts` is provided, uses it; else creates `UserFacts(tax_year)`.

**`ScenarioUserFacts(data, tax_year, user_id=None)`** — overrides `_load()` with a preloaded dict; ignores DB entirely.

**`AIAdvisor`** — calls `claude-opus-4-8`. Methods: `analyze_opportunities`, `analyze_gaps`, `analyze_scenario`.

### Auth (`api/auth.py`)

JWT via `python-jose`, passwords via `bcrypt` (used directly — passlib has Python 3.14 compat issue).
- `hash_password(plain)` / `verify_password(plain, hashed)`
- `create_access_token(user_id, email) → str` — 60-min expiry, JTI for revocation
- `get_current_user` — FastAPI dependency, raises 401 if missing/invalid/revoked
- `get_current_user_optional` — returns `None` if no token (used on all routes; YAML fallback activates)

### Startup hook (`api/main.py`)

```python
@asynccontextmanager
async def lifespan(app):
    init_db()
    migrate_yaml_if_needed()   # no-op if users table already has rows
    yield
```

`api/migrate.py` — idempotent YAML→DB import. Creates `admin@localhost.com` on first run, imports all YAML sections, assigns orphan transactions.

### Document storage (`api/routes/documents.py`)

Uploaded files are stored as BLOBs in the `documents` table — **no filesystem required**.
- `documents.content BLOB` — raw file bytes (images compressed to JPEG at 85% / 1800px max via Pillow)
- `documents.size INTEGER` — byte count
- `documents.note TEXT` — classification note

Upload behaviour:
- 20 MB hard limit (returns 413 if exceeded)
- Images (jpg/jpeg/png/heic/tiff) compressed to JPEG by Pillow if decodable; renamed to `.jpg`; HEIC/TIFF that fail decoding return 415
- `file_id` = SHA-256 of `"{user_id}:{filename}:{content_digest[:16]}"` — scoped per user and content, so same filename + different content → different ID

`POST /documents/apply` body:
```json
{
  "meta": {"file_id", "filename", "date", "merchant", "total_amount",
           "deductible_pct", "tax_category", "benefit_ids", "form_line"},
  "updates": [{"yaml_file"|"section", "dot_path", "operation", "value", "label"}]
}
```
- Duplicate check: `file_already_applied(user_id, file_id)` blocks re-apply
- Scales all numeric `add` operations by `deductible_pct` before writing (including negative values e.g. credits)
- Calls `apply_dot_path_to_section()` → DB write
- Writes a `transactions` ledger record per applied update

### AI document extraction (`scripts/classify_receipts.py`)

Three prompt types selected by filename + content:
- `RECEIPT_PROMPT` — returns `benefit_ids[]`, `deductible_pct`, `form_line`, `suggested_updates`
- `INCOME_FORM_PROMPT` — W-2, 1099-NEC/INT/DIV/B/R, 1098, K-1, SSA-1099; extracts box values
- `MILEAGE_PROMPT` — extracts total business miles, computes `total_amount` at IRS rate

Key functions:
- `classify_filename(filename, size) → dict` — name-only classification, no disk access
- `extract_with_ai_bytes(content: bytes, filename: str) → dict` — sends BLOB to Claude
- `extract_with_ai(file_path: Path) → dict` — legacy CLI path (still works)

Model: `claude-haiku-4-5-20251001` (cheap + fast) — overridable via `CLAUDE_MODEL` env var. API errors from unrecognised model IDs surface a clear message pointing to that env var.

### Tax form generation (`scripts/generate_tax_forms.py`)

Produces a CPA-ready ZIP package containing filled official IRS PDFs + a print-ready data-summary PDF.

**`TaxCalculator(data, tax_year)`** — full federal tax computation from user DB data. Covers:
- Income: W-2, interest, dividends (ordinary + qualified), IRA/pension/annuity distributions, social security (IRC §86 taxability), short/long-term capital gains, Schedule C (self-employment), Schedule E (rental), K-1 passive income, other income
- Adjustments: ½ SE tax, SE health insurance, student loan interest, educator expenses, HSA, IRA deduction
- Deductions: standard (with age/blindness extra) or itemized (Schedule A — SALT cap, mortgage interest, charitable, medical floor); QBI §199A deduction (simplified)
- Tax: ordinary brackets, LTCG/qualified dividend tiers, Additional Medicare Tax (0.9%), NIIT (3.8%)
- Credits: Child Tax Credit (with phase-out), other dependent credit, child/dependent care, education (AOTC simplified), EV credit (§30D)
- SE tax via Schedule SE (with SS wage base coordination against W-2 wages)
- Payments: W-2 withholding, estimated payments; refund or amount owed
- Tax parameters (brackets, standard deductions, SS wage base, phase-out thresholds, SALT cap) live in
  `backend-ts/src/domain/taxForms/taxParams.generated.ts` — a checked-in snapshot generated from
  [PolicyEngine US](https://github.com/PolicyEngine/policyengine-us) parameter YAML (which cites IRS revenue
  procedures and enacted law). Regenerate with `npm run update:tax-params`, review the diff against the cited
  sources, and keep `test/taxParams.test.ts` (hand-verified pins) in sync. Runtime never fetches — the snapshot
  is the vetted source of truth. Currently 2024 + 2025; add a year to `YEARS` in `scripts/updateTaxParams.mjs`.

**`compute_tax_figures(user_id, tax_year) → dict`** — runs TaxCalculator only, no PDFs. Used by the instant compute endpoint.

**`FormPackageGenerator(user_id, tax_year).generate(progress_cb)`** — downloads IRS PDFs in parallel (6 threads, 10 s per-form timeout, cached in `state/form_cache/`), fills AcroForm fields via pypdf (best-effort — field names vary by PDF version), generates reportlab data-summary PDF, bundles everything into a ZIP at `state/tax_form_packages/`.

**IRS PDF download:** `_fetch_all_parallel()` — downloads all needed forms simultaneously; anything already cached skips the network entirely. If a form fails to download it is omitted from the ZIP (the summary PDF is always present).

**ZIP contents:**
- `00_data_summary_{year}.pdf` — reportlab PDF with every form line organized by section, CPA review flags inline
- `Form_1040_filled.pdf` — official IRS 1040 with best-effort field filling
- `Schedule_C_filled.pdf` (one per business, if applicable)
- `Schedule_A/B/D/E/SE_filled.pdf` (as applicable)
- `field_manifest.json` — all AcroForm field names discovered per PDF (transparency for CPA)
- `INSTRUCTIONS_FOR_CPA.txt` — key figures summary + itemized notes on what needs CPA judgment

**Field mapping note:** IRS PDF AcroForm field names (e.g. `f1_25[0]`) are discovered at runtime via `pypdf.PdfReader.get_fields()`. The mapping in `_build_1040_fields()` is based on known 2024/2025 patterns and will need updating if the IRS revises their PDF structure. The `field_manifest.json` in the ZIP shows exactly which fields were found.

### Shared route utilities (`api/routes/utils.py`)

- `serialize_result(result) → dict` — converts OpportunityResult dataclass, extracting `.value` from status enum
- `count_by_status(results) → dict` — counts results by status string

### Background job pattern (scan.py, reports.py, documents.py, tax_forms.py)
```python
_jobs: dict[str, dict] = {}

def _run_job(job_id, ..., user_id=None):
    try:
        facts = UserFacts(tax_year, user_id=user_id)
        ...
        _jobs[job_id] = {"status": "complete", ...}
    except Exception as exc:
        _jobs[job_id] = {"status": "error", "error": str(exc)}
```
All background threads receive `user_id` as a parameter (not captured from request context).

**Tax form ZIP download** — the `/reports/tax-forms/{job_id}/download` endpoint does not require an auth header because a plain `<a href>` browser download cannot send `Authorization`. The UUID `job_id` serves as the bearer of authority (unguessable).

### Frontend constants (`frontend/src/constants.js`)

Single source of truth for shared values:
- `TOKEN_KEY = "utbis_token"` — localStorage key used by both `api.js` and `AuthContext.jsx`

---

## API Routes (all under `/api`)

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | `{email, password, display_name}` → `{token}` |
| POST | `/auth/login` | `{email, password}` → `{token, user_id, display_name}` |
| POST | `/auth/logout` | Revokes current token (JTI blocklist) |
| GET  | `/auth/me` | `{id, email, display_name}` |

### Data & Scanning
| Method | Path | Description |
|---|---|---|
| GET  | `/config` | `{ai_available, tax_year, benefit_count}` |
| POST | `/scan?tax_year=2025` | Run scanner, return results (reads DB for auth'd user) |
| POST | `/scan/ai-analysis?mode=...` | Start AI analysis background job |
| GET  | `/scan/ai-analysis/{job_id}` | Poll AI analysis status |
| GET  | `/user-data` | List section names |
| GET  | `/user-data/{section}` | Get section as YAML string (compat) |
| PUT  | `/user-data/{section}` | Save section — body: `{data: {...}}` or `{content: "yaml"}` |
| GET  | `/user-data/{section}/parsed` | Get section as JSON |
| GET  | `/scenarios` | List scenarios |
| POST | `/scenarios/{key}?tax_year=2025` | Run scenario diff |
| GET  | `/planning/year-end?tax_year=2025` | Year-end action plan |

### Documents & Ledger
| Method | Path | Description |
|---|---|---|
| POST   | `/documents/upload` | Upload file → classify → store BLOB in `documents` table |
| GET    | `/documents` | List documents for current user (no BLOB in response) |
| DELETE | `/documents/{file_id}` | Delete DB record (no filesystem) |
| POST   | `/documents/{file_id}/extract` | Start AI extraction (reads BLOB from DB) |
| GET    | `/documents/extract/{job_id}` | Poll extraction status |
| POST   | `/documents/apply` | Apply extraction → DB write + ledger record |
| GET    | `/transactions` | List ledger records (filterable by benefit_id, tax_category) |
| GET    | `/transactions/summary` | Totals grouped by category |
| DELETE | `/transactions/{id}` | Reverse a transaction (sets status='reversed') |
| GET    | `/reconciliation` | Ledger totals vs. unprocessed doc checklist |

### Tax Forms
| Method | Path | Description |
|---|---|---|
| GET  | `/tax-forms/compute?tax_year=2025` | Instant JSON: all computed tax figures, no PDF generation |
| POST | `/reports/tax-forms?tax_year=2025` | Start ZIP-generation background job |
| GET  | `/reports/tax-forms/{job_id}` | Poll job status + progress message |
| GET  | `/reports/tax-forms/{job_id}/download` | Download ZIP (no auth header — job_id is the bearer) |

### Reports & Tax Law
| Method | Path | Description |
|---|---|---|
| GET  | `/reports` | List generated reports |
| GET  | `/reports/{name}` | Fetch report markdown |
| POST | `/reports/cpa-packet?with_ai=bool` | Generate CPA packet (background) |
| GET  | `/reports/cpa-packet/{job_id}` | Poll CPA packet status |
| GET  | `/tax-law/changes?limit=20` | List change records |
| POST | `/tax-law/update` | Trigger TypeScript tax-law updater |
| GET  | `/tax-law/status` | Check if update running |
| GET  | `/tax-law/alert-count?since_days=30` | Count recent alerts |

---

## Frontend

**Pages:** Dashboard, My Data (UserData.jsx), Scenarios, Documents, Planning, TaxLaw, Tax Forms (TaxForms.jsx), Reports, Login

**Auth flow:** `AuthContext.jsx` → stores JWT in `localStorage` under key `utbis_token` (from `constants.js`) → `ProtectedRoute.jsx` redirects to `/login` if missing → 401 response auto-clears token and redirects.

**My Data** saves via `api.updateSection(section, formStateObject)` → `PUT /user-data/{section}` body `{data: {...}}` → `save_section_data()` → DB tables. No YAML serialization on the frontend.

**Documents** — no filesystem. Files stored as DB BLOBs. After AI extraction, shows `benefit_ids[]` as violet badges, `form_line`, EIN (income forms), and a `deductible_pct` slider (0–100%). Apply All sends the `meta` envelope to `/documents/apply`.

**Tax Forms page** — two independent steps:
1. **Compute** (instant) — calls `GET /api/tax-forms/compute`, renders collapsible sections for Form 1040 + each applicable schedule (A/B/C/D/E/SE) with IRS line numbers, color-coded amounts, and CPA-review flags inline. No network calls to IRS.
2. **Download ZIP** (separate widget) — calls `POST /api/reports/tax-forms` to start the background job; polls for progress messages; on completion shows a direct `<a href>` download link to the ZIP.

---

## How to Add a New Benefit

1. Create `tax_library/{federal|state|county}/<id>.yaml` (id, name, category, jurisdiction, authority)
2. Add `_rule_<id_with_underscores>(self, b: dict) → OpportunityResult` to `RulesEngine` in `scripts/scan_opportunities.py`
3. Add entry to `rules/eligibility_rules/{federal|state|county}-rules.yaml` and `forms/federal_forms.yaml`
4. Optionally add to `DEADLINE_MAP` in `api/routes/planning.py`
5. Add benefit ID to `BENEFIT_IDS` list in `scripts/classify_receipts.py` (for AI document association)

**County rules pattern:** gate on `self.f.primary_residence()`, `self.f.is_veteran()`, `self.f.is_disabled()`, `self.f.taxpayer_age()`. Return `NEARLY_ELIGIBLE` with county-specific next steps — we can't enumerate every county's exact program so the rule tells the user what to look up. Use `self.f.county()` and `self.f.state()` to personalize the message.

**PTE election is nexus-aware:** `_rule_pte_election` uses `self.f.business_nexus_states()` (union of `household.residence.state` + all `businesses[].operating_states`) to find qualifying states. A DE-formed LLC operating in CA is correctly evaluated against CA PTE, not DE. `formation_state` triggers a clarifying note when it differs from nexus states. `businesses.operating_states` is stored as comma-separated TEXT in the DB; the getter returns it as a comma-separated string (matches the frontend `type: "text"` field); `business_nexus_states()` handles both string and list.

**PTE profit basis:** `_rule_pte_election` sums `net_profit_loss` across all businesses (`sum(profits)`) — not `max` — so multi-business filers get an accurate savings estimate.

**County solar rule:** `_rule_county_solar_exemption` gates on `primary_residence()` (like all other county rules), not `has_any_real_estate()` — prevents false positives for rental/commercial-only owners.

---

## Key Design Rules (Do Not Violate)

1. **DB is source of truth** — `user_data/*.yaml` are read-only backups after migration
2. **Documents are BLOBs** — never write uploaded files to disk; store in `documents.content`
3. **No hardcoded user facts** — all user data comes from `get_all_user_data(user_id, tax_year)`
4. **No fraud recommendations** — legal, documented strategies only
5. **Risk levels must be conservative** — when in doubt, escalate to `high_review_required`
6. **All benefit records must cite authority** — IRC section, IRS pub, form instruction, or state statute
7. **Missing facts → `nearly_eligible`, not `not_applicable`** — flag what's missing
8. **Scanner must run on blank facts without errors** — all rule methods handle None/empty gracefully
9. **`BENEFIT_DIRS` is an allow-list** — never rglob all of `tax_library/`; only scan explicit dirs
10. **State rules gate on `self.f.state()` first** — None → `NEARLY_ELIGIBLE`; wrong state → `NOT_APPLICABLE`
11. **User confirmation before DB writes** — AI extraction proposes; user clicks Apply
12. **Never expose `ANTHROPIC_API_KEY`** through API — only expose boolean `ai_available`
13. **All scanner routes pass `user_id`** — `UserFacts(tax_year, user_id=uid)`; never create scanner without it in API context
14. **Background threads receive `user_id` as param** — never capture from request context
15. **Tax form ZIP download requires no auth header** — job_id UUID is the bearer; do not add auth middleware to that endpoint

---

## How to Test

```powershell
python -m pytest tests/ -v                         # 74 tests, all passing

# CLI scanner — uses YAML fallback (no user_id)
python scripts/scan_opportunities.py
python scripts/scan_opportunities.py --output json

# Test user (creates if not exists, re-seeds data, runs scanner)
python scripts/create_test_user.py

# DB verification
python -c "
from api.db import init_db, user_count, get_user_by_email, get_all_user_data
init_db()
u = get_user_by_email('admin@localhost.com')
d = get_all_user_data(u['id'], 2025)
print('sections:', [k for k,v in d.items() if v])
"

python scripts/scenario_simulator.py --list
python scripts/scenario_simulator.py --scenario start_llc

# Tax form generation (CLI, requires a valid user_id from the DB)
python scripts/generate_tax_forms.py --user-id <uuid> --tax-year 2025
```

**Verify AI features (requires ANTHROPIC_API_KEY):**
```powershell
# Login at http://localhost:5173/login
# Dashboard: Run Scan → AI Analysis → polls → Reports link
# Documents: Upload receipt → Extract with AI → adjust deductibility slider → Apply All
# Planning: year-end countdown with deadline urgency coloring
# Tax Forms: Compute Tax Figures → review all schedules → Build & Download ZIP
```

---

## Installed Packages

```
Python: fastapi 0.136.3, uvicorn 0.48.0, pyyaml 6.0.3, pytest 9.0.3,
        anthropic 0.105.2, httpx 0.28.1, beautifulsoup4 4.14.3, lxml 6.1.1,
        python-jose[cryptography], bcrypt, passlib (installed but not used directly),
        Pillow 12.2.0 (image compression on upload), email-validator 2.3.0 (pydantic EmailStr),
        pypdf 6.13.0 (IRS PDF AcroForm read/write), reportlab 4.5.1 (data-summary PDF generation)

NOTE: uvicorn runs under pythoncore-3.14-64 — always install into that interpreter:
      C:\Users\tward\AppData\Local\Python\pythoncore-3.14-64\python.exe -m pip install <pkg>

npm:    react 19, react-router-dom 6, @tanstack/react-query 5, react-markdown 9,
        tailwindcss 3, @tailwindcss/typography, vite 6, js-yaml
```

---

## Key Files

```
api/
  main.py              — FastAPI app, lifespan startup (init_db + migrate)
  db.py                — All 29 tables + CRUD + get_all_user_data() + apply_dot_path_to_section()
  auth.py              — JWT + bcrypt, get_current_user / get_current_user_optional deps
  migrate.py           — Idempotent YAML→DB import, creates admin@localhost.com on first run
  routes/
    utils.py           — serialize_result(), count_by_status() shared by scan + scenarios
    auth.py            — /auth/register, /login, /logout, /me
    user_data.py       — Serves from DB; accepts {data:{}} or legacy {content:"yaml"}
    scan.py            — Passes user_id to UserFacts; background thread gets user_id param
    documents.py       — Upload→BLOB, extract from BLOB, apply→DB; no filesystem I/O
    transactions.py    — Ledger CRUD, all scoped to current user
    reconciliation.py  — Ledger vs. unprocessed doc checklist
    planning.py        — Year-end deadlines, passes user_id to scanner
    scenarios.py       — Scenario diff, passes user_id to scanner
    reports.py         — CPA packet generation, passes user_id to scanner
    tax_forms.py       — /tax-forms/compute (instant JSON) + /reports/tax-forms ZIP job

scripts/
  scan_opportunities.py   — UserFacts (DB or YAML), RulesEngine (59 rules), OpportunityScanner
  scenario_simulator.py   — ScenarioUserFacts, SCENARIOS dict, apply_overrides, diff_results
  classify_receipts.py    — classify_filename(), extract_with_ai_bytes(), three AI prompts
  generate_cpa_packet.py  — Markdown CPA packet generator
  generate_tax_forms.py   — TaxCalculator, compute_tax_figures(), FormPackageGenerator
                            IRS PDF download (parallel, cached), pypdf fill, reportlab summary
  update_tax_law.py       — RETIRED (fully ported to backend-ts/src/domain/taxLaw/updater.ts)
  create_test_user.py     — Creates alex.carter@example.com with realistic data

frontend/src/
  constants.js            — TOKEN_KEY and other shared constants
  App.jsx                 — AuthProvider wrapper, /login public route, ProtectedRoute for rest
  api.js                  — All API calls; injects Bearer token; 401 → clear token + redirect
  contexts/
    AuthContext.jsx        — token lifecycle, login/logout/register, useAuth() hook
  pages/
    Login.jsx              — Sign in / register form (toggle)
    Dashboard.jsx          — Scan results, sortable columns, AI Analysis button
    UserData.jsx           — Form-based section editor; saves as {data:{}} JSON
    Documents.jsx          — Upload, AI extract, deductibility slider, benefit badges, ledger strip
    Scenarios.jsx          — What-if simulator
    Planning.jsx           — Year-end countdown
    TaxLaw.jsx             — Change monitor
    TaxForms.jsx           — Compute (instant review) + Download ZIP (background job) for CPA filing
    Reports.jsx            — Report viewer + CPA packet generator
  components/
    NavBar.jsx             — Links + alert badge + user display name + Sign out
    ProtectedRoute.jsx     — Redirects to /login if no token
    userdata/              — SectionForm, FieldGroup, FieldInput, ListEditor, HelpPopover
  schemas/                 — 10 form schemas (household, income, businesses, …)

state/
  transactions.db          — SQLite (all user data + ledger + document BLOBs)
  update_state.json        — Tax law scraper state (DAWSON auth token cache, seen item IDs)
  form_cache/              — Cached IRS fillable PDFs (auto-created; safe to delete to re-download)
  tax_form_packages/       — Generated ZIP packages (auto-created; safe to delete)

user_data/*.yaml           — Legacy backups (read-only after migration; CLI scanner still reads them)
tax_library/federal/       — 46 benefit YAML files (id, name, authority, risk_level)
tax_library/state/         — 6 state benefit YAML files
tax_library/county/        — 6 county benefit YAML files (property tax exemptions)
```

---

## Known Low-Priority Gaps

- IRS PDF AcroForm field names in `_build_1040_fields()` are best-effort based on known 2024/2025 patterns. If the IRS updates their PDF structure, field values may not land in the right boxes. The `field_manifest.json` in every generated ZIP shows what fields the PDF actually has — use it to update the mapping in `generate_tax_forms.py`.
- Tax form generation covers federal only. State return calculation not implemented.
- Schedule C expense line-item detail (Part II) requires CPA to populate from receipts — the generator only fills the top-line gross/net.
- Schedule D individual transactions require Form 8949 — the generator only fills net totals.

Potential next directions:
- Additional state benefits (beyond current 6 states)
- State return computation to accompany federal forms
- Multi-year tax projection / optimizer
- Direct IRS e-file integration
- Mobile-friendly UI pass

---

## Starting Prompt for Next Session

```
Read HANDOFF.md at d:\programs\tax-assist.

Current state:
- 58 benefits (46 federal + 6 state + 6 county), 74/74 tests passing
- 8 frontend pages + Login page (added: Tax Forms)
- Full relational SQLite DB (29 tables) — source of truth for all data
- Document files stored as BLOBs in documents table (no filesystem)
- Multi-user auth: JWT self-registration, bcrypt passwords, JTI revocation
- Migration runs automatically on startup (admin@localhost.com / Test1234!)
- Test user: alex.carter@example.com / Test1234! (10 eligible benefits)
- Shared route utils: api/routes/utils.py (serialize_result, count_by_status)
- Frontend constants: frontend/src/constants.js (TOKEN_KEY)
- County tier: 6 county property tax benefits; households table extended with county, taxpayer_veteran, taxpayer_disabled, taxpayer_blind, taxpayer_active_military columns
- Tax Forms page: two-step flow — instant compute (JSON review) then optional ZIP download
  - TaxCalculator covers full federal return (2024/2025 params): income, adjustments, deductions, tax, credits, SE tax, payments
  - ZIP contains filled IRS PDFs (parallel download, cached in state/form_cache/) + reportlab summary PDF
  - /tax-forms/compute endpoint; /reports/tax-forms POST/GET/{job_id}/download

Load .env before starting:
  Get-Content .env | ForEach-Object { if ($_ -match '^([^#=]+)=(.*)$') { [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim()) } }

Start: uvicorn api.main:app --reload --port 8000  +  cd frontend && npm run dev
```
