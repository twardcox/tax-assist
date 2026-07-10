# User Story Specifications: UTBIS First Real User Arc

**Source:** approved epic specs `2026-07-10-epic-specs-m1-m3.md`. No Jira connected — this
document **is the backlog** (User Stories GUIDELINES workflow step 4). Keys stay `TBD`.
Estimates in ideal dev-hours (solo, AI-augmented).

---

## Story: As a user whose real financial facts live only in a local PostgreSQL database, I want a simple backup-and-restore procedure folded into my monthly ritual, so that a disk failure or bad migration cannot destroy the only copy of my tax profile

- Key: TBD
- Epic: EP-001 — Data Safety & Entry Path
- Milestone: M1
- Summary: pg_dump backup step + one verified restore, documented in ritual doc
- Outcome Statement: A dated dump exists after every ritual run; a restore has been proven once; losing the DB no longer means losing the profile
- Objective: Remove the single-copy risk before real data lands in Postgres
- Success Metric (Baseline → Target): 0 backups, unproven restore → dated dump per ritual run, 1 verified restore with matching businesses section
- Scope: In: pg_dump command/step, gitignore coverage, guard-test extension, restore verification, ritual-doc section. Out: scheduling/automation, retention pruning.
- Acceptance Criteria:
  - Given the ritual doc, when the backup step runs (pg_dump-based, one command), then a dated dump lands in a local, gitignored location
  - Given a dump, when restored to a scratch database once (verification exercise), then a spot-checked section (businesses) matches the source
  - Given the backup location, then it is covered by .gitignore; the guard test is extended if the location is inside the repo
- Edge Cases:
  - Dump directory missing: command creates it
  - Postgres version mismatch on restore: documented as a known caveat, not engineered around
- Risks/Deps: None (foundation story; do first)
- Estimate: 2h

---

## Story: As a business owner with real financial data, I want to enter my LLC's facts through the My Data UI into my own user account, so that scans run against reality instead of seed data, with nothing committable to the public repo

- Key: TBD
- Epic: EP-001 — Data Safety & Entry Path
- Milestone: M1
- Summary: Entry checklist (worksheet → My Data mapping); entry itself owner-paced, non-gating
- Outcome Statement: Entering real facts is a checklist-guided ≤10-minute task; the dev deliverable (checklist) exists even before entry happens
- Objective: Unblock owner data entry without building any new UI
- Success Metric (Baseline → Target): entry requires reading schemas/code → entry requires only the checklist
- Scope: In: checklist in user_data/private/README.md (field names only). Out: any new entry UI; the entry act itself (owner-paced, not a gate — PM/PO 2026-07-10).
- Acceptance Criteria:
  - Given the worksheet user_data/private/businesses.local.yaml, when the owner has entered its facts via My Data, then a scan of the owner's account reads those values
  - Given the businesses section, when entity_type is set, then it uses scanner vocabulary (llc_single)
  - Given remaining TODO-owner fields, when unresolved, then they are null in the DB and surfaced as missing_facts, not blockers
  - Given any file under user_data/private/, then git check-ignore passes (guard test — shipped 2026-07-10)
  - Given this story's dev-side deliverable, then an entry checklist exists in user_data/private/README.md mapping worksheet fields → My Data sections/fields with scanner-vocabulary notes (field names only — no real values)
- Edge Cases:
  - Seed/test users coexist with owner account: per-user isolation keeps scans separate
  - Worksheet drifts from DB: worksheet is entry source; DB canonical after entry; ritual reconciles monthly
- Risks/Deps: None dev-side; entry act depends on owner availability
- Estimate: 1h (dev side)

---

## Story: As a pre-profit R&D-performing business owner, I want the §41 research credit in the benefit library with a cash-spend threshold trigger, so that the scanner tells me when my research spend justifies a CPA conversation about the credit

- Key: TBD
- Epic: EP-002 — Trigger Benefits End-to-End
- Milestone: M2
- Summary: §41 benefit YAML record + rule with $5k gte trigger and structured TriggerStatus
- Outcome Statement: Every scan of a business profile evaluates §41 and states either "evaluate with CPA" or the dollar distance to the $5k spend threshold
- Objective: First trigger benefit in the library, proving the trigger pattern
- Success Metric (Baseline → Target): §41 absent from library → present with correct trigger math at below/at/above
- Scope: In: benefit record, rule, trigger data, tests. Out: computing the credit, election paperwork (arc non-goal).
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
- Risks/Deps: Blocked by: trigger-engine groundwork inside "trigger-table reporting" implementation order (M2 design review resolves A3 + multi-business aggregation before build)
- Estimate: 3h

---

## Story: As a growing LLC owner, I want the existing S-corp election benefit extended with the ~$40k net-profit breakeven trigger, so that the scanner flags when entity-structure change becomes worth evaluating

- Key: TBD
- Epic: EP-002 — Trigger Benefits End-to-End
- Milestone: M2
- Summary: S-corp record + rule gains $40k gte trigger; existing behavior preserved
- Outcome Statement: Every scan states the distance from current net profit to the $40k S-corp breakeven heuristic
- Objective: Second trigger benefit; proves trigger extension of an existing record
- Success Metric (Baseline → Target): S-corp record without threshold data → with correct trigger math incl. loss case
- Scope: In: record extension, rule trigger, tests. Out: election preparation; changing existing eligibility semantics.
- Acceptance Criteria:
  - Given net profit ≥ $40,000, when the rule evaluates, then the S-corp benefit fires "evaluate with CPA"
  - Given net profit below $40,000 (including negative), then trigger not-fired with structured distance (e.g. net profit −$3.41 → distance $40,003.41)
  - Given existing S-corp rule behavior, then non-trigger aspects are preserved (regression tests stay green)
  - Given the rule, then Vitest covers loss, below, at, above threshold with synthetic fixtures
- Edge Cases:
  - Net loss: distance = threshold − (negative profit); rendered without double negatives
  - Multiple businesses: aggregation per design-review decision
- Risks/Deps: Blocked by: same trigger-engine groundwork as §41 story
- Estimate: 2h

---

## Story: As a user with threshold-trigger benefits, I want scan output and the Dashboard to show a trigger table — label, threshold, current value, distance, fired/not-fired — so that I can see at a glance how far each CPA conversation is

- Key: TBD
- Epic: EP-002 — Trigger Benefits End-to-End
- Milestone: M2
- Summary: TriggerStatus on ScanResult; Dashboard trigger table; markdown report section
- Outcome Statement: One glance at the Dashboard answers "how far is each CPA conversation" in dollars
- Objective: Make trigger data visible where the owner already looks
- Success Metric (Baseline → Target): trigger info absent from UI/report → rendered table on Dashboard + report for any trigger-bearing scan
- Scope: In: type extension, YAML trigger block + loader validation, lte+gte semantics, Dashboard component, report section. Out: any other Dashboard changes; new UI primitives.
- Acceptance Criteria:
  - Given a scan with trigger-bearing benefits, when results are returned, then each carries trigger?: TriggerStatus per System PRD §5.2 (incl. human-readable label; comparison gte|lte both supported and unit-tested)
  - Given the Dashboard (PM/PO placement 2026-07-10), when trigger benefits exist, then a trigger-table section renders label | threshold | current | distance | fired
  - Given no trigger benefits in a profile, then the section is absent (no empty chrome)
  - Given report output (reports/opportunity_report.md path), then it includes the trigger table
- Edge Cases:
  - Non-trigger benefits: render as today, no regression
  - Negative current values (losses): formatted as −$X.XX
  - lte trigger ("stay under X"): distance/fired per contract; direction clear from rendering
- Risks/Deps: Foundation for and consumer of the two benefit stories — implementation order: engine/types first (this story's backend half), then records, then UI half
- Estimate: 4h

---

## Story: As a business owner doing monthly bookkeeping, I want one command that validates the books CSV, recomputes financial aggregates, runs the scan, and surfaces the report, so that monthly upkeep is one sitting instead of a manual multi-step chore

- Key: TBD
- Epic: EP-003 — Monthly Ritual
- Milestone: M3
- Summary: npm-script ritual command + ritual doc v2 + timed walkthrough
- Outcome Statement: Monthly books upkeep is one command plus a review; the ritual doc is the single instruction source
- Objective: Keep trigger inputs fresh with near-zero friction
- Success Metric (Baseline → Target): multi-step manual ritual → one command; walkthrough duration recorded (aspirational ≤15 min, not gated)
- Scope: In: CSV validation, aggregate recompute + section write, scan trigger, report surfacing, ritual doc v2, fixtures. Out: receipt automation, scheduling, lab-ledger coupling, multi-year backfill.
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
- Risks/Deps: Blocked by: "trigger-table reporting" story (scan output) and "backup" story (doc fold-in). Per-user isolation: command resolves explicit user identity, never "first user in table"
- Estimate: 4h

---

## Review Checklist (User Stories — per GUIDELINES)

- [x] Every epic user story has exactly one story spec (6 stories, no splits/merges)
- [x] Each story carries all of its acceptance criteria from the epic (Given/When/Then)
- [x] Stories are INVEST-shaped; small enough for a session
- [x] Blockers/dependencies reference the blocking stories by title
- [x] Estimates present (ideal dev-hours)
- [x] No Task tickets created to split ACs
- [x] Keys `TBD` (no Jira connected; this doc is the backlog)
- [x] Ready for Sprint Planning

**Approval:** Output Approved via PM/PO blanket AFK authorization (2026-07-10, "I accept your recommendations").
