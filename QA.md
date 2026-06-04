# UTBIS Phase 5 — QA Document
**Reviewer:** Claude Code  
**Date:** 2026-06-02  
**Scope:** FastAPI backend (`api/`) and React frontend (`frontend/src/`) built in Phase 5

---

## 1. What Was Built

Phase 5 adds a web UI layer on top of the existing Phase 1–4 Python engine. The stack is:

```
Browser (React 19 / Vite)
    ↕ HTTP /api/*  (proxied in dev, same origin in prod)
FastAPI (Python, port 8000)
    ↕ direct Python imports
Existing engine: scan_opportunities.py, scenario_simulator.py, update_tax_law.py
    ↕ reads/writes
user_data/*.yaml, tax_library/, reports/
```

The UI does not add new tax logic. It wraps the existing CLI tools behind an HTTP API so they can be operated from a browser.

---

## 2. Architecture Notes

### Backend

Five route modules, each registered under `/api`:

| File | Prefix | Responsibilities |
|---|---|---|
| `scan.py` | `/api/scan` | Runs `OpportunityScanner`, returns JSON + writes `reports/opportunity_report.md` |
| `user_data.py` | `/api/user-data` | Read/write `user_data/*.yaml` files as raw text |
| `reports.py` | `/api/reports` | Serve contents of `reports/*.md` |
| `scenarios.py` | `/api/scenarios` | Runs `ScenarioUserFacts` + `diff_results`, returns before/after diff |
| `tax_law.py` | `/api/tax-law` | Lists `tax_library/future_law/*.yaml`; triggers `update_tax_law.py` as subprocess |

CORS is open to `localhost:5173`, `localhost:3000`, `127.0.0.1:5173`. If `frontend/dist/` exists (production build), FastAPI serves the static files directly so only one process is needed.

### Frontend

- **React Query** manages all server state (caching, loading states, refetch).
- **React Router v6** handles client-side navigation.
- **Vite dev proxy** forwards `/api/*` to `localhost:8000`, so there is no CORS issue in dev.
- All `fetch` calls go through a single `api.js` wrapper which throws on non-2xx responses.

---

## 3. Page-by-Page Walkthrough

### Dashboard (`/dashboard`)

**Data flow:** User clicks Run Scan → `POST /api/scan?tax_year=N` → backend runs `OpportunityScanner.scan()` + `write_report()` → returns `{total, counts, results[]}` → React state holds results for the session (not persisted across page reload).

**What it renders:**
- 6 status summary cards (counts by status from the `counts` map)
- Status filter dropdown (filters `results[]` client-side)
- Category filter dropdown (filters client-side against `category` field)
- Expandable table rows: each row shows name / status badge / category / estimated_value / risk_level. Clicking opens a detail panel with message, next_steps, missing_facts, changes_needed, forms_required, phaseout_note, review_required flag.

**Completeness:** All fields from `OpportunityResult` are surfaced. The `documents_needed` field exists on the dataclass but is not shown in the expanded row — this is the only field that goes unrendered.

### My Data (`/user-data`)

**Data flow:** On mount, fetches `GET /api/user-data` (section names). Clicking a section fetches `GET /api/user-data/{section}` (raw YAML text). Save calls `PUT /api/user-data/{section}` with the textarea content. Backend validates YAML with `yaml.safe_load` before writing — invalid YAML returns HTTP 422.

**Draft safety:** A `useEffect` resets the textarea content only when the *section changes* (detected by comparing `sectionData.section` to a `loadedSection` ref). Subsequent React Query refetches of the same section do not overwrite the user's edits. Reset button explicitly reverts to the last-fetched content.

**Write protection:** Only the 10 known sections (`VALID_SECTIONS` in `user_data.py`) are writable via PUT. Any other YAML file that appears in `list_sections` is read-only through the API.

### Scenarios (`/scenarios`)

**Data flow:** Fetches `GET /api/scenarios` on mount (list of 8 scenario keys + descriptions). Clicking a card calls `POST /api/scenarios/{key}` → backend runs baseline scan + scenario scan + `diff_results()` → returns `{baseline_counts, scenario_counts, diff: {newly_added, improved, degraded, removed}}`.

**What it renders:**
- 2-column card grid of scenario names
- After run: side-by-side count comparison, then 4 diff sections (newly unlocked, improved, degraded, removed). Empty sections are hidden.

**Limitation:** Only one scenario result is shown at a time. Running a second scenario replaces the first.

### Tax Law (`/tax-law`)

**Data flow:** Fetches `GET /api/tax-law/changes?limit=50` on mount and every 30 seconds. The "Update Now" button calls `POST /api/tax-law/update` with source/days/dry_run query params. The backend fires the update as a background task (subprocess) and returns immediately. Results appear on the next 30-second refetch (or when the user waits the ~30-second message window).

**Change card fields rendered:** title, description, change_type (color-coded), source, effective_date, detected_date, url (external link), affected_benefits.

### Reports (`/reports`)

**Data flow:** Fetches `GET /api/reports` on mount (list of non-empty `.md` files, sorted by mtime). Clicking a report fetches `GET /api/reports/{name}` (markdown text). Rendered via `react-markdown` with `@tailwindcss/typography` prose classes.

**Security:** The backend blocks path traversal (`..`, `/`, `\` in the name param) and enforces `.md` extension. Only files in `reports/` are accessible.

---

## 4. Issues Found

### Bugs

**B1 — Dead import in `TaxLaw.jsx` (minor)**  
`useQueryClient` is imported and assigned to `qc` but never used:
```js
// TaxLaw.jsx line 2
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
const qc = useQueryClient();  // qc is never referenced
```
Fix: remove `useQueryClient` from the import and delete the `qc` line.

**B2 — Unhandled scanner exceptions return bare 500 (`scan.py`)**  
If `OpportunityScanner.scan()` throws — e.g., if a user saved broken YAML that the scanner can't parse — FastAPI returns an unformatted 500 with a Python traceback in the body. The frontend shows the raw error string in the error box, which is readable but not ideal.  
Fix: wrap the scan call in a try/except and return an HTTP 422 with a human-readable detail string.

**B3 — Same fix applies to `scenarios.py`**  
`run_scenario` runs the scanner twice with no error handling. Same root cause as B2.

### Best Practice Issues

**P1 — `sys.path.insert` in two route files at module level**  
Both `scan.py` and `scenarios.py` call `sys.path.insert(0, str(ROOT / "scripts"))` at import time. Since both are loaded when the app starts, the scripts directory ends up in `sys.path` twice. This is harmless but the pattern is fragile — a better approach is a single `scripts/__init__.py` or a top-level `conftest`-style setup.

**P2 — `_update_running` global is single-process only (`tax_law.py`)**  
The flag that tracks whether an update is running is a Python module-level variable. It works correctly with `--workers 1` (the default). With multiple uvicorn workers (e.g., `--workers 4`), each worker has its own state, so `/tax-law/status` would be unreliable. For a local single-user tool this is fine, but document it if workers are ever increased.

**P3 — No source whitelist validation for `update_tax_law.py` subprocess**  
`tax_law.py` passes the `source` query param directly to the subprocess as `--source {source}`. The `update_tax_law.py` script validates the source value and will reject unknown values with an error, but it still receives the raw string from the HTTP request. Since this is a local tool, the practical risk is zero, but adding a server-side whitelist check would make intent explicit:
```python
KNOWN_SOURCES = {"federal_register", "irs_news", "irs_publications",
                 "treasury_regulations", "congress_legislation", "tax_court"}
if source and source not in KNOWN_SOURCES:
    raise HTTPException(400, f"Unknown source '{source}'")
```

**P4 — `_serialize` redundancy (`scan.py`, `scenarios.py`)**  
After `asdict(result)`, the `status` field is an `EligibilityStatus` enum instance (which is also a `str`). The subsequent `d["status"] = result.status.value` overwrites it with the same string. Since FastAPI would serialize it correctly either way (str-enum is a str subclass), the override is redundant but not harmful.

**P5 — `VALID_SECTIONS` can drift from actual files**  
`list_sections` dynamically discovers all `user_data/*.yaml` files, but `update_section` enforces a hardcoded set of 10 names. If a new YAML file is added to `user_data/`, it will appear in the section list but fail silently on save with a 400 error. Consider deriving `VALID_SECTIONS` from the directory at startup rather than hardcoding it — or keep the whitelist but add a comment marking it as intentional.

### Missing / Incomplete

**M1 — `documents_needed` not shown in Dashboard row expansion**  
`OpportunityResult.documents_needed` is populated by some rules but is not rendered in the expanded row. All other `OpportunityResult` fields are displayed. Add it alongside `forms_required`.

**M2 — No loading indicator during scan on first load**  
The Dashboard's "No scan data" placeholder is shown while `scanMutation.isPending` is false. During the scan (`isPending = true`), the placeholder disappears but the results table doesn't appear yet — leaving the page visually blank except for the disabled button. A spinner or "Scanning X benefits…" progress message would improve the experience.

**M3 — Scenario runner blocks other scenario cards while running**  
When a scenario is running, only the clicked card's button is disabled (`disabled={runMutation.isPending && activeKey === key}`). The other 7 cards remain clickable and would fire a second `mutate()` call that replaces the in-flight result. Fix: disable all cards while any scenario is running (`disabled={runMutation.isPending}` without the `activeKey` check).

**M4 — Tax Law page "Update Now" button allows repeated clicks**  
The button is disabled only while `triggerMutation.isPending` (which resolves immediately since the endpoint returns at once). After the first click, the button re-enables and a second click fires another subprocess. The `/tax-law/status` endpoint exists to check `_update_running` but the UI never queries it to disable the button. Fix: poll `/tax-law/status` after triggering and disable the button while `running === true`.

---

## 5. Known Limitations (By Design)

These are intentional tradeoffs, not bugs:

| Limitation | Reason |
|---|---|
| Scan results lost on page reload | Scanner writes to `reports/opportunity_report.md`; on reload, use the Reports page to view the last run. Full session persistence would require a database. |
| Tax law update runs as subprocess | Avoids blocking the FastAPI event loop for long-running HTTP calls. The tradeoff is that the `_update_running` flag is in-process only. |
| No authentication | This is a local single-user tool. Adding auth would add complexity with no benefit for the intended use case. |
| YAML editor is raw text | No field-by-field form. For a tool where users are expected to understand the data model, raw YAML editing is the correct tradeoff. |
| Scan is synchronous in the endpoint | `POST /scan` blocks until complete (typically < 1 second on blank facts). On populated facts with 30+ benefits it may take 2–3 seconds. If Claude AI analysis (`--ai` flag) were exposed through the API, this would need to become async. |
| 6-column status card grid | Will wrap on viewports narrower than ~900px. No mobile breakpoints were added since this is a desktop power tool. |

---

## 6. QA Test Checklist

### Backend (run with `uvicorn api.main:app --reload`)

```
[ ] GET /api/user-data                    → returns list of 10 section names
[ ] GET /api/user-data/household          → returns YAML text with correct section name
[ ] PUT /api/user-data/household          → saves valid YAML, returns {saved: true}
[ ] PUT /api/user-data/household          → send broken YAML → 422 with "Invalid YAML"
[ ] PUT /api/user-data/nonexistent        → 404
[ ] GET /api/reports                      → returns list of .md files sorted by mtime
[ ] GET /api/reports/opportunity_report.md → returns content (after running a scan)
[ ] GET /api/reports/../secrets.md        → 400 "Invalid report name"
[ ] GET /api/scenarios                    → returns 8 scenarios
[ ] POST /api/scenarios/start_llc         → runs and returns diff object
[ ] POST /api/scenarios/does_not_exist    → 404
[ ] POST /api/scan                        → runs and returns results array
[ ] GET /api/tax-law/changes              → returns {changes: [], total: 0} if none
[ ] POST /api/tax-law/update?dry_run=true → {status: "started"} immediately
[ ] GET /api/tax-law/status               → {running: false} after update finishes
[ ] GET /docs                             → OpenAPI docs load
```

### Frontend (run with `npm run dev` in `frontend/`)

```
[ ] / redirects to /dashboard
[ ] Dashboard: "No scan data" placeholder shows on first load
[ ] Dashboard: Run Scan → button shows "Scanning…" → results appear
[ ] Dashboard: summary cards show counts matching status filter
[ ] Dashboard: status filter hides/shows rows correctly
[ ] Dashboard: category filter hides/shows rows correctly
[ ] Dashboard: clicking a row expands details; clicking again collapses
[ ] Dashboard: expanded row shows next_steps, missing_facts, changes_needed when present
[ ] My Data: section list loads on mount
[ ] My Data: clicking a section loads YAML into editor
[ ] My Data: editing and saving shows "Saved" message
[ ] My Data: sending invalid YAML shows "Error: 422..." message
[ ] My Data: Reset reverts edits to last-fetched content
[ ] My Data: switching sections clears the editor before new content loads
[ ] Scenarios: all 8 scenario cards are shown
[ ] Scenarios: clicking a card disables it and shows "Running…"
[ ] Scenarios: result shows baseline counts, scenario counts, and diff sections
[ ] Scenarios: running a second scenario replaces the first result
[ ] Tax Law: change list loads (empty state if no records)
[ ] Tax Law: "Update Now" fires and shows banner message
[ ] Tax Law: list auto-refreshes every 30 seconds
[ ] Reports: list shows .md files
[ ] Reports: selecting a report renders markdown with formatting
[ ] NavBar: active link is visually distinct from inactive links
[ ] NavBar: all links navigate correctly without full reload
```

### Production build

```
[ ] cd frontend && npm run build   → builds without errors
[ ] uvicorn api.main:app --port 8000   → serves frontend at http://localhost:8000
[ ] http://localhost:8000/api/user-data → API still works when served from same origin
```

---

## 7. Fix Priority

| ID | Severity | Effort | Recommended action |
|---|---|---|---|
| B2, B3 | Medium | 10 min | Add try/except around scanner calls in scan.py and scenarios.py |
| M3 | Low | 2 min | Change `disabled` condition on scenario cards to `runMutation.isPending` |
| B1 | Low | 1 min | Remove dead `useQueryClient` import and `qc` variable in TaxLaw.jsx |
| M1 | Low | 5 min | Add `documents_needed` to the expanded row in Dashboard.jsx |
| M4 | Low | 15 min | Poll `/tax-law/status` and disable Update Now button while running |
| P3 | Low | 5 min | Add source whitelist check in tax_law.py |
| M2 | Low | 5 min | Add a spinner/message during scan in Dashboard.jsx |
| P1, P2, P4, P5 | Info | — | Document or address in future refactor |
