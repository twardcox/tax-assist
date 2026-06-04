# UTBIS Handoff Document
**Universal Tax Benefit Intelligence System**
**Project root:** `d:\programs\tax-assist`
**Last updated:** 2026-06-04
**Python:** 3.14.5 | **Node:** npm (frontend)

---

## Current State

**Library:** 44 benefits (38 federal + 6 state) · **Tests:** 63/63 passing
**Nav pages:** Dashboard · My Data · Scenarios · Documents · Planning · Tax Law · Reports
**Auth:** JWT self-registration · **DB:** SQLite (25 tables) · **Users:** multi-user, fully isolated

### Start the full stack
```powershell
# Load env vars first (required for AI features)
Get-Content .env | ForEach-Object { if ($_ -match '^([^#=]+)=(.*)$') { [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim()) } }

# Terminal 1 — backend (migrates YAML → DB automatically on first run)
python -m uvicorn api.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend && npm run dev
```
- API + docs: http://localhost:8000 / http://localhost:8000/docs
- App: http://localhost:5173 → redirects to `/login`

**Default credentials (auto-created on first run from existing YAML data):**
- Email: `admin@localhost` · Password: `changeme123` ← **change this**

**Test user (rich profile, 10 eligible benefits):**
- Email: `alex.carter@example.com` · Password: `TestUser123!`
- Re-create: `python scripts/create_test_user.py`

---

## Environment Variables (`.env`)

```
ANTHROPIC_API_KEY=sk-ant-...      # Required: AI Analysis, CPA Packet, receipt extraction
CONGRESS_API_KEY=...              # Optional: Congress.gov scraper (defaults to DEMO_KEY)
DAWSON_USERNAME=...               # US Tax Court login
DAWSON_PASSWORD=...               # US Tax Court login
JWT_SECRET_KEY=...                # Optional: JWT signing secret (defaults to dev key — set in prod)
```

---

## Architecture

### Data layer: SQLite (`state/transactions.db`)

All user data is stored in a normalized relational database. YAML files in `user_data/` are legacy backups only.

**25 tables:** `users`, `revoked_tokens`, `households`, `spouses`, `dependents`, `w2_income`, `self_employment_income`, `rental_income`, `investment_income`, `retirement_distributions`, `social_security_income`, `other_income`, `adjustments`, `businesses`, `business_vehicles`, `business_assets`, `properties`, `investment_accounts`, `plans_529`, `employer_retirement_plans`, `ira_accounts`, `self_employed_retirement`, `healthcare`, `goals`, `documents`, `transactions`, `transaction_benefits`, `revoked_tokens`

**Key DB functions (`api/db.py`):**
- `init_db()` — creates all tables; safe to call on every startup
- `save_section_data(user_id, tax_year, section, data_dict)` — writes a full section to the correct tables
- `get_section_data(user_id, tax_year, section) → dict` — reconstructs a section dict from DB
- `get_all_user_data(user_id, tax_year) → dict` — assembles the full `_data` dict that UserFacts expects
- `apply_dot_path_to_section(user_id, tax_year, section, dot_path, operation, value)` — AI extraction path

### Scanner pipeline (`scripts/scan_opportunities.py`)

**`UserFacts(tax_year, user_id=None)`**
- `user_id` provided → `_load_from_db()` → calls `get_all_user_data()`
- `user_id=None` → `_load_from_yaml()` (CLI fallback, reads `user_data/*.yaml`)
- Public interface (all helper methods) is identical either way — zero rule changes

**`RulesEngine`** — dispatches `benefit.id` (kebab) → `_rule_<id_with_underscores>()`. 44 rules. All call `self.f.*` helpers; none open files.

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

`api/migrate.py` — idempotent YAML→DB import. Creates `admin@localhost` on first run, imports all YAML sections, assigns orphan transactions.

### Document accounting (`api/routes/documents.py`)

`POST /documents/apply` body:
```json
{
  "meta": {"file_id", "filename", "date", "merchant", "total_amount",
           "deductible_pct", "tax_category", "benefit_ids", "form_line"},
  "updates": [{"yaml_file"|"section", "dot_path", "operation", "value", "label"}]
}
```
- Duplicate check: `file_already_applied(user_id, file_id)` blocks re-apply
- Scales `add` operations by `deductible_pct` before writing
- Calls `apply_dot_path_to_section()` → DB write (not YAML)
- Writes a `transactions` ledger record per applied update

### AI document extraction (`scripts/classify_receipts.py`)

Three prompt types selected by filename + content:
- `RECEIPT_PROMPT` — returns `benefit_ids[]`, `deductible_pct`, `form_line`, `suggested_updates`
- `INCOME_FORM_PROMPT` — W-2, 1099-NEC/INT/DIV/B/R, 1098, K-1, SSA-1099; extracts box values
- `MILEAGE_PROMPT` — extracts total business miles, computes `total_amount` at IRS rate

Model: `claude-haiku-4-5-20251001` (cheap + fast).

### Background job pattern (scan.py, reports.py, documents.py)
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
| POST   | `/documents/upload` | Upload file → classify → store in `documents` table |
| GET    | `/documents` | List documents for current user |
| DELETE | `/documents/{file_id}` | Delete file + DB record |
| POST   | `/documents/{file_id}/extract` | Start AI extraction job |
| GET    | `/documents/extract/{job_id}` | Poll extraction status |
| POST   | `/documents/apply` | Apply extraction → DB write + ledger record |
| GET    | `/transactions` | List ledger records (filterable by benefit_id, tax_category) |
| GET    | `/transactions/summary` | Totals grouped by category |
| DELETE | `/transactions/{id}` | Reverse a transaction (sets status='reversed') |
| GET    | `/reconciliation` | Ledger totals vs. unprocessed doc checklist |

### Reports & Tax Law
| Method | Path | Description |
|---|---|---|
| GET  | `/reports` | List generated reports |
| GET  | `/reports/{name}` | Fetch report markdown |
| POST | `/reports/cpa-packet?with_ai=bool` | Generate CPA packet (background) |
| GET  | `/reports/cpa-packet/{job_id}` | Poll CPA packet status |
| GET  | `/tax-law/changes?limit=20` | List change records |
| POST | `/tax-law/update` | Trigger update_tax_law.py |
| GET  | `/tax-law/status` | Check if update running |
| GET  | `/tax-law/alert-count?since_days=30` | Count recent alerts |

---

## Frontend

**Pages:** Dashboard, My Data (UserData.jsx), Scenarios, Documents, Planning, TaxLaw, Reports, Login

**Auth flow:** `AuthContext.jsx` → stores JWT in `localStorage` under key `utbis_token` → `ProtectedRoute.jsx` redirects to `/login` if missing → 401 response auto-clears token and redirects.

**My Data** saves via `api.updateSection(section, formStateObject)` → `PUT /user-data/{section}` body `{data: {...}}` → `save_section_data()` → DB tables. No YAML serialization on the frontend.

**Documents** — after AI extraction, shows `benefit_ids[]` as violet badges, `form_line`, EIN (income forms), and a `deductible_pct` slider (0–100%). Apply All sends the `meta` envelope to `/documents/apply`.

---

## How to Add a New Benefit

1. Create `tax_library/federal/federal-<name>.yaml` (id, name, category, jurisdiction, authority)
2. Add `_rule_<id_with_underscores>(self, b: dict) → OpportunityResult` to `RulesEngine` in `scripts/scan_opportunities.py`
3. Add entry to `rules/eligibility_rules/federal-rules.yaml` and `forms/federal_forms.yaml`
4. Optionally add to `DEADLINE_MAP` in `api/routes/planning.py`
5. Add benefit ID to `BENEFIT_IDS` list in `scripts/classify_receipts.py` (for AI document association)

---

## Key Design Rules (Do Not Violate)

1. **DB is source of truth** — `user_data/*.yaml` are read-only backups after migration
2. **No hardcoded user facts** — all user data comes from `get_all_user_data(user_id, tax_year)`
3. **No fraud recommendations** — legal, documented strategies only
4. **Risk levels must be conservative** — when in doubt, escalate to `high_review_required`
5. **All benefit records must cite authority** — IRC section, IRS pub, form instruction, or state statute
6. **Missing facts → `nearly_eligible`, not `not_applicable`** — flag what's missing
7. **Scanner must run on blank facts without errors** — all rule methods handle None/empty gracefully
8. **`BENEFIT_DIRS` is an allow-list** — never rglob all of `tax_library/`; only scan explicit dirs
9. **State rules gate on `self.f.state()` first** — None → `NEARLY_ELIGIBLE`; wrong state → `NOT_APPLICABLE`
10. **User confirmation before DB writes** — AI extraction proposes; user clicks Apply
11. **Never expose `ANTHROPIC_API_KEY`** through API — only expose boolean `ai_available`
12. **All scanner routes pass `user_id`** — `UserFacts(tax_year, user_id=uid)`; never create scanner without it in API context
13. **Background threads receive `user_id` as param** — never capture from request context

---

## How to Test

```powershell
python -m pytest tests/ -v                         # 63 tests, all passing

# CLI scanner — uses YAML fallback (no user_id)
python scripts/scan_opportunities.py
python scripts/scan_opportunities.py --output json

# Test user (creates if not exists, re-seeds data, runs scanner)
python scripts/create_test_user.py

# DB verification
python -c "
from api.db import init_db, user_count, get_user_by_email, get_all_user_data
init_db()
u = get_user_by_email('admin@localhost')
d = get_all_user_data(u['id'], 2025)
print('sections:', [k for k,v in d.items() if v])
"

python scripts/scenario_simulator.py --list
python scripts/scenario_simulator.py --scenario start_llc

python scripts/update_tax_law.py --dry-run --no-ai
python scripts/classify_receipts.py --file documents/receipts/some.pdf
```

**Verify AI features (requires ANTHROPIC_API_KEY):**
```powershell
# Login at http://localhost:5173/login
# Dashboard: Run Scan → AI Analysis → polls → Reports link
# Documents: Upload receipt → Extract with AI → adjust deductibility slider → Apply All
# Planning: year-end countdown with deadline urgency coloring
```

---

## Installed Packages

```
Python: fastapi 0.136.3, uvicorn 0.48.0, pyyaml 6.0.3, pytest 9.0.3,
        anthropic 0.105.2, httpx 0.28.1, beautifulsoup4 4.14.3, lxml 6.1.1,
        python-jose[cryptography], bcrypt, passlib (installed but not used directly)

npm:    react 19, react-router-dom 6, @tanstack/react-query 5, react-markdown 9,
        tailwindcss 3, @tailwindcss/typography, vite 6, js-yaml
```

---

## Key Files

```
api/
  main.py              — FastAPI app, lifespan startup (init_db + migrate)
  db.py                — All 25 tables + CRUD + get_all_user_data() + apply_dot_path_to_section()
  auth.py              — JWT + bcrypt, get_current_user / get_current_user_optional deps
  migrate.py           — Idempotent YAML→DB import, creates admin@localhost on first run
  routes/
    auth.py            — /auth/register, /login, /logout, /me
    user_data.py       — Serves from DB; accepts {data:{}} or legacy {content:"yaml"}
    scan.py            — Passes user_id to UserFacts; background thread gets user_id param
    documents.py       — Upload→classify, extract, apply→DB; _apply_dot_path() is pure (no I/O)
    transactions.py    — Ledger CRUD, all scoped to current user
    reconciliation.py  — Ledger vs. unprocessed doc checklist
    planning.py        — Year-end deadlines, passes user_id to scanner
    scenarios.py       — Scenario diff, passes user_id to scanner
    reports.py         — CPA packet generation, passes user_id to scanner

scripts/
  scan_opportunities.py   — UserFacts (DB or YAML), RulesEngine (44 rules), OpportunityScanner
  scenario_simulator.py   — ScenarioUserFacts, SCENARIOS dict, apply_overrides, diff_results
  classify_receipts.py    — RECEIPT_PROMPT, INCOME_FORM_PROMPT, MILEAGE_PROMPT, extract_with_ai()
  generate_cpa_packet.py  — Markdown CPA packet generator
  update_tax_law.py       — DAWSON Tax Court + 10-state scrapers
  create_test_user.py     — Creates alex.carter@example.com with realistic data

frontend/src/
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
    Reports.jsx            — Report viewer + CPA packet generator
  components/
    NavBar.jsx             — Links + alert badge + user display name + Sign out
    ProtectedRoute.jsx     — Redirects to /login if no token
    userdata/              — SectionForm, FieldGroup, FieldInput, ListEditor, HelpPopover
  schemas/                 — 10 form schemas (household, income, businesses, …)

state/
  transactions.db          — SQLite (all user data + ledger; replaces user_data/*.yaml)
  update_state.json        — Tax law scraper state (DAWSON auth token cache, seen item IDs)

user_data/*.yaml           — Legacy backups (read-only after migration; CLI scanner still reads them)
tax_library/federal/       — 38 benefit YAML files (id, name, authority, risk_level)
tax_library/state/         — 6 state benefit YAML files
```

---

## Known Low-Priority Gaps

| Benefit | IRC / Form | Priority |
|---|---|---|
| Employer-Provided Childcare Credit | §45F / Form 8882 | Low |
| Work Opportunity Tax Credit (WOTC) | §51 / Form 5884 | Low |
| Net Unrealized Appreciation (NUA) | §402(e)(4) | Low |
| Installment Sale | §453 / Form 6252 | Low |
| Excess FICA Withholding Refund | Schedule 3 | Low |
| ICHRA / QSEHRA | ACA §105 | Low |
| Conservation Easement | §170(h) | Low |
| QLAC | §401(a)(9) | Low |

---

## Starting Prompt for Next Session

```
Read HANDOFF.md at d:\programs\tax-assist.

Current state:
- 44 benefits (38 federal + 6 state), 63/63 tests passing
- 7 frontend pages + Login page
- Full relational SQLite DB (25 tables) replaces YAML as source of truth
- Multi-user auth: JWT self-registration, bcrypt passwords, JTI revocation
- Migration runs automatically on startup (admin@localhost / changeme123)
- Test user: alex.carter@example.com / TestUser123! (10 eligible benefits)
- Epic 2 accounting: transaction ledger, benefit_ids on extractions, deductibility %,
  income form schemas (W-2/1099/1098), duplicate detection, reconciliation endpoint
- Epic 3 DB migration: UserFacts reads from DB when user_id provided, YAML is CLI fallback

Load .env before starting:
  Get-Content .env | ForEach-Object { if ($_ -match '^([^#=]+)=(.*)$') { [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim()) } }

Start: uvicorn api.main:app --reload --port 8000  +  cd frontend && npm run dev
```
