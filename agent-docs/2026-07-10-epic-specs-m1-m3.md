# Epic Specifications: UTBIS First Real User Arc (EP-001..EP-003)

**Sources:** approved Milestone PRDs 1–3 + milestone plan (2026-07-10). One epic per milestone
(milestone-plan decision log). Sections that duplicate the milestone PRDs are referenced, not
restated. No Jira connected — `Key: TBD` throughout; the story-spec doc (next phase) is the backlog.

---

# Epic: Data Safety & Entry Path

## Epic ID: EP-001

**Milestone:** M1 — Real Facts, Safely · **Priority:** Must Have · **Status:** Ready

## Overview

### Business Value
Real financial facts are about to live only in a local Postgres DB. A backup with one proven
restore removes the single-copy risk; an entry checklist turns "someday I'll enter my data" into
a 10-minute task. (Full objective: M1 PRD §1.)

### User Impact
Owner can enter real data without fear of loss; future sessions have a documented entry path.

### Success Metrics
| Metric | Target | How Measured |
| --- | --- | --- |
| Restore fidelity | Businesses section matches source after restore | Spot-check during verification exercise |
| Privacy invariant | Guard test green incl. backup location | CI |

## User Stories

- [ ] Story: As a user whose real financial facts live only in a local PostgreSQL database, I want a simple backup-and-restore procedure folded into my monthly ritual, so that a disk failure or bad migration cannot destroy the only copy of my tax profile
  - Key: TBD
  - Summary: pg_dump backup step + one verified restore, documented in ritual doc
  - Acceptance Criteria:
    - Given the ritual doc, when the backup step runs (pg_dump-based, one command), then a dated dump lands in a local, gitignored location
    - Given a dump, when restored to a scratch database once (verification exercise), then a spot-checked section (businesses) matches the source
    - Given the backup location, then it is covered by .gitignore; the guard test is extended if the location is inside the repo
  - Edge Cases:
    - Dump directory missing: command creates it
    - Postgres version mismatch on restore: documented as a known caveat in the ritual doc, not engineered around
  - Risks/Deps: none (foundation story)

- [ ] Story: As a business owner with real financial data, I want to enter my LLC's facts through the My Data UI into my own user account, so that scans run against reality instead of seed data, with nothing committable to the public repo
  - Key: TBD
  - Summary: Entry checklist (worksheet → My Data mapping); entry itself owner-paced, non-gating
  - Acceptance Criteria:
    - Given the worksheet user_data/private/businesses.local.yaml, when the owner has entered its facts via My Data, then a scan of the owner's account reads those values
    - Given the businesses section, when entity_type is set, then it uses scanner vocabulary (llc_single)
    - Given remaining TODO-owner fields, when unresolved, then they are null in the DB and surfaced as missing_facts, not blockers
    - Given any file under user_data/private/, then git check-ignore passes (guard test — shipped 2026-07-10)
    - Given this story's dev-side deliverable, then an entry checklist exists in user_data/private/README.md mapping worksheet fields → My Data sections/fields with scanner-vocabulary notes (field names only — no real values)
  - Edge Cases:
    - Seed/test users coexist with owner account: per-user isolation keeps scans separate
    - Worksheet drifts from DB: worksheet is entry source; DB canonical after entry; ritual reconciles monthly
  - Risks/Deps: Entry execution is owner-paced and NOT an exit gate (PM/PO 2026-07-10); dev deliverable is the checklist only

## Test Scenarios
1. **Happy path:** run backup → dated dump exists → restore to scratch DB → businesses data matches.
2. **Guard:** `git check-ignore` passes for a file in the backup location (test-level, synthetic path).

## Dependencies
None. Parallel-safe with EP-002.

## Technical Notes
Backup as npm script or documented one-liner in ritual doc — smallest thing that works; decided
during implementation. `pg_dump` custom format (`-Fc`) preferred for pg_restore fidelity.

---

# Epic: Trigger Benefits End-to-End

## Epic ID: EP-002

**Milestone:** M2 — Trigger Benefits · **Priority:** Must Have · **Status:** Ready

## Overview

### Business Value
The arc's core: converts the scanner from "what exists" to "when is it worth acting," per the two
standing tax triggers (lab cost-discipline §1.10). (Full objective: M2 PRD §1.)

### User Impact
Owner sees, at every scan, the dollar distance to each CPA-conversation threshold.

### Success Metrics
| Metric | Target | How Measured |
| --- | --- | --- |
| Trigger math correctness | below/at/above + loss cases exact | Vitest |
| Live rendering | Dashboard table renders for seeded profile | Playwright/live verification |
| Regression | Suite ≥396 green | CI |

## User Stories

- [ ] Story: As a pre-profit R&D-performing business owner, I want the §41 research credit in the benefit library with a cash-spend threshold trigger, so that the scanner tells me when my research spend justifies a CPA conversation about the credit
  - Key: TBD
  - Summary: §41 benefit YAML record + rule with $5k gte trigger and structured TriggerStatus
  - Acceptance Criteria:
    - Given tax_library/federal/, when the scan runs, then a §41 benefit record evaluates, including §174A immediate-expensing note (2025 act), QSB payroll-tax offset path, 20-yr carryforward, QRE scope note (research cloud/LLM compute; 65% contract research)
    - Given annual cash operating spend ≥ $5,000, when the rule evaluates, then status is nearly_eligible/eligible_now-class with message "evaluate with CPA"
    - Given spend below threshold, then the result reports the trigger not-fired with structured TriggerStatus (threshold, current, distance, fired, label)
    - Given the record, then it carries the non-goal boundary: UTBIS flags the conversation, never computes the credit
    - Given the rule, then Vitest covers below, at, above threshold using synthetic fixtures only
  - Edge Cases:
    - No businesses in profile: not_applicable
    - Spend exactly at threshold: fired (gte)
    - Missing financials: unknown with missing_facts naming the absent aggregate
  - Risks/Deps: Blocked by trigger-engine groundwork (this epic's design review resolves A3 and multi-business aggregation first)

- [ ] Story: As a growing LLC owner, I want the existing S-corp election benefit extended with the ~$40k net-profit breakeven trigger, so that the scanner flags when entity-structure change becomes worth evaluating
  - Key: TBD
  - Summary: S-corp record + rule gains $40k gte trigger; existing behavior preserved
  - Acceptance Criteria:
    - Given net profit ≥ $40,000, when the rule evaluates, then the S-corp benefit fires "evaluate with CPA"
    - Given net profit below $40,000 (including negative), then trigger not-fired with structured distance (e.g. net profit −$3.41 → distance $40,003.41)
    - Given existing S-corp rule behavior, then non-trigger aspects are preserved (regression tests stay green)
    - Given the rule, then Vitest covers loss, below, at, above threshold with synthetic fixtures
  - Edge Cases:
    - Net loss: distance = threshold − (negative profit); rendered without double negatives
    - Multiple businesses: aggregation per design-review decision
  - Risks/Deps: Blocked by trigger-engine groundwork (same as above)

- [ ] Story: As a user with threshold-trigger benefits, I want scan output and the Dashboard to show a trigger table — label, threshold, current value, distance, fired/not-fired — so that I can see at a glance how far each CPA conversation is
  - Key: TBD
  - Summary: TriggerStatus on ScanResult; Dashboard trigger-table; markdown report section
  - Acceptance Criteria:
    - Given a scan with trigger-bearing benefits, when results are returned, then each carries trigger?: TriggerStatus per System PRD §5.2 (incl. human-readable label; comparison gte|lte both supported and unit-tested)
    - Given the Dashboard (PM/PO placement 2026-07-10), when trigger benefits exist, then a trigger-table section renders label | threshold | current | distance | fired
    - Given no trigger benefits in a profile, then the section is absent (no empty chrome)
    - Given report output (reports/opportunity_report.md path), then it includes the trigger table
  - Edge Cases:
    - Non-trigger benefits: render as today, no regression
    - Negative current values (losses): formatted as −$X.XX
    - lte trigger ("stay under X"): distance/fired semantics per contract; direction clear from label/threshold rendering
  - Risks/Deps: Consumes both stories above; Dashboard component follows existing StackCard/status patterns

## UI Requirements
One new Dashboard section/component (trigger table). Reuse existing card, status-color, and
accessibility patterns (Phase A/B standards). No new primitives expected — extend by composition.

## Test Scenarios
1. **Happy path:** seeded profile scan → both triggers present, math exact, table renders.
2. **Error case:** benefit YAML with malformed trigger block → loader validation error names the field.
3. **Edge:** profile with no businesses → §41 not_applicable, no trigger row.

## Dependencies
Soft: EP-001 (real-data verification upgrade only). Design review resolves: A3 (rule-engine vs
report-layer), multi-business aggregation, scan_runs persistence interaction.

## Technical Notes
Trigger threshold lives in YAML (M2-FR-01); TS code reads metric keys via `UserFacts` accessors
(M2-FR-08: `annual_cash_operating_spend`, `net_profit`). Contract frozen in System PRD §5.2.

---

# Epic: Monthly Ritual

## Epic ID: EP-003

**Milestone:** M3 — Monthly Ritual · **Priority:** Must Have · **Status:** Ready

## Overview

### Business Value
Keeps M2's triggers honest month over month; makes bookkeeping one sitting. (Full objective: M3 PRD §1.)

### User Impact
Owner runs one command monthly; report + trigger table appear; data never silently stales.

### Success Metrics
| Metric | Target | How Measured |
| --- | --- | --- |
| End-to-end chain | One command: validate → recompute → write → scan → report | Test + walkthrough |
| Input safety | Malformed CSV writes nothing | Vitest |
| Ritual viability | Walkthrough performed, duration recorded (aspirational ≤15 min) | Timed run |

## User Stories

- [ ] Story: As a business owner doing monthly bookkeeping, I want one command that validates the books CSV, recomputes financial aggregates, runs the scan, and surfaces the report, so that monthly upkeep is one sitting instead of a manual multi-step chore
  - Key: TBD
  - Summary: npm-script ritual command + ritual doc v2 + timed walkthrough
  - Acceptance Criteria:
    - Given user_data/private/books/<year>-transactions.csv, when the command runs, then the CSV is schema-validated (columns: date, amount, category, project, description, receipt; known categories; parseable dates/amounts) with row-level error messages
    - Given valid books, when the command runs, then business financial aggregates (cash operating spend, net profit/loss) are recomputed and written to the owner's businesses section preserving data_json-canonical + typed-column sync
    - Given updated data, then a scan is triggered and the resulting report (incl. trigger table) is surfaced
    - Given the ritual doc, then it reflects the command + backup step (EP-001) + receipts flow, and one full walkthrough has been performed with duration recorded (not gated)
    - Given the command, then it lives in backend-ts tooling (npm script) and is tested with synthetic CSV fixtures (valid, malformed row, unknown category, year arg)
  - Edge Cases:
    - Malformed row: command fails with row number + reason; nothing written
    - Backend not running: clear error naming the prerequisite (or command self-hosts the logic — design decision)
    - Year boundary: command takes year/file as argument, defaults to current year
    - Revenue rows (future): sign convention decided at design even though revenue is $0 this year
  - Risks/Deps: Blocked by EP-002 (scan output) and EP-001 (backup step in doc); per-user isolation — command must resolve explicit user identity, never "first user in table"

## Test Scenarios
1. **Happy path:** synthetic CSV → aggregates computed → section updated → scan run → report contains trigger table.
2. **Error case:** CSV with non-numeric amount on row 7 → error names row 7; DB unchanged.
3. **Edge:** unknown category → error names the category and row; DB unchanged.

## Dependencies
Hard: EP-001, EP-002. Design review resolves: API vs direct repo write; sign convention.

## Technical Notes
Reuse `saveSectionData` (typed-column sync built in). CSV parsing: stdlib/hand-rolled split is
fine for a 6-column contract — no new dependency (System PRD C4).

---

## Change Log

| Date | Change | Author | Reason |
| --- | --- | --- | --- |
| 2026-07-10 | Initial epic specs EP-001..003 | TC + Claude Code | From approved milestone PRDs |
