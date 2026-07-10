# Product Requirements Document: UTBIS — First Real User Arc

## Version History

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.0 | 2026-07-10 | Travis Cox (PM/PO) with Claude Code | Initial version, from approved SOW+ (`2026-07-10-sow-utbis.md`) |

> Intermediate document per PRD guidelines: this project PRD seeds the System PRD and Milestone
> PRDs; only those two are deliverables to the Milestones phase.

## 1. Overview

### 1.1 Purpose

Convert UTBIS from a synthetic-data demo into a working tool for its first real user — the
owner's single-member LLC. Three capabilities make that real: (1) the owner's actual facts in the
per-user database, safely backed up; (2) threshold-trigger benefits (§41 R&D credit, S-corp
election) that report "almost available" with a dollar distance-to-threshold against the real
books; (3) a monthly books ritual that keeps the data current with one command. The product tells
the owner *when a CPA conversation becomes worth its fee* — it never computes credits or prepares
elections.

### 1.2 Success Metrics

| Metric | Target | Timeline |
| --- | --- | --- |
| Real-profile scan shows §41 + S-corp triggers with distance | Both visible with correct math vs books aggregates | End of arc |
| §41 benefit record + rule tests | Green in full suite; suite stays ≥396, lint/build clean | Each milestone exit |
| Privacy guard | `privateDataIgnored.test.ts` green in CI; no real values in any commit | Continuous |
| DB backup | Documented step + one verified restore | M1 exit |
| Monthly ritual end-to-end | Documented + walked through once (aspirational ≤15 min, recorded not gated) | End of arc |

### 1.3 Target Users

- **Primary:** Owner-operator (Travis as LLC owner) — pre-profit single-member LLC, R&D-performing,
  keeps cash books in CSV, wants to know when tax elections become worth professional fees.
- **Secondary:** CPA (future recipient of trigger flags and packets — not engaged this arc).

## 2. User Stories

### 2.1 Real facts in the system

#### Story S1: Enter real facts via My Data

**As a** business owner with real financial data
**I want to** enter my LLC's facts through the My Data UI into my own user account
**So that** scans run against reality instead of seed data, with nothing committable to the public repo

**Acceptance Criteria:**

- [ ] Given the worksheet `user_data/private/businesses.local.yaml`, when the owner has entered its
      facts via My Data, then a scan of the owner's account reads those values (verify via scan
      output referencing real aggregates)
- [ ] Given the businesses section, when `entity_type` is set, then it uses scanner vocabulary
      (`llc_single`)
- [ ] Given remaining `TODO owner` fields (name, EIN, formation state), when unresolved, then they
      are null in the DB and listed by the scan as `missing_facts` — not blockers
- [ ] Given any file under `user_data/private/`, then `git check-ignore` passes (guard test in CI — already shipped 2026-07-10)

**Edge Cases:**

- Seed/test users coexist with the owner account → per-user isolation keeps scans separate
- Worksheet drifts from DB → worksheet is the entry source, DB is canonical after entry; ritual step 3 reconciles

#### Story S2: Local database backup

**As a** user whose real financial facts now live only in a local PostgreSQL database
**I want** a simple backup-and-restore procedure folded into my monthly ritual
**So that** a disk failure or bad migration cannot destroy the only copy of my tax profile

**Acceptance Criteria:**

- [ ] Given the ritual doc, when the backup step runs (`pg_dump`-based, one command), then a dated
      dump lands in a local, gitignored location
- [ ] Given a dump, when restored to a scratch database once (verification exercise), then a
      spot-checked section (businesses) matches the source
- [ ] Given the backup location, then it is covered by `.gitignore` (extend guard test if under the repo)

**Edge Cases:**

- Dump directory missing → command creates it
- Postgres version mismatch on restore → documented as a known caveat in the ritual doc, not engineered around

### 2.2 Threshold-trigger benefits

#### Story S3: §41 R&D credit benefit record

**As a** pre-profit R&D-performing business owner
**I want** the §41 research credit in the benefit library with a cash-spend threshold trigger
**So that** the scanner tells me when my research spend justifies a CPA conversation about the credit

**Acceptance Criteria:**

- [ ] Given `tax_library/federal/`, when the scan runs, then a §41 benefit record evaluates, including:
      §174A immediate-expensing note (2025 act), QSB payroll-tax offset path, 20-yr carryforward,
      QRE scope note (research cloud/LLM compute; 65% contract research)
- [ ] Given annual cash operating spend ≥ $5,000 (threshold heuristic), when the rule evaluates,
      then status is `nearly_eligible`/`eligible_now`-class with message "evaluate with CPA"
- [ ] Given spend below threshold, then the result reports the trigger as not-fired with structured
      distance data (threshold, current value, distance)
- [ ] Given the record, then it carries the non-goal boundary: UTBIS flags the conversation, never computes the credit
- [ ] Rule covered by Vitest cases (below, at, above threshold) using synthetic fixtures only

**Edge Cases:**

- No businesses in profile → `not_applicable`
- Spend exactly at threshold → fired (≥)
- Missing financials → `unknown` with `missing_facts` listing the absent aggregate

#### Story S4: S-corp election threshold extension

**As a** growing LLC owner
**I want** the existing S-corp election benefit extended with the ~$40k net-profit breakeven trigger
**So that** the scanner flags when entity-structure change becomes worth evaluating

**Acceptance Criteria:**

- [ ] Given net profit ≥ $40,000, when the rule evaluates, then the S-corp benefit fires "evaluate with CPA"
- [ ] Given net profit below $40,000 (including negative), then trigger not-fired with structured
      distance data (e.g. net profit −$3.41 → distance $40,003.41)
- [ ] Existing S-corp rule behavior preserved for non-trigger aspects (regression tests stay green)
- [ ] Vitest cases: loss, below, at, above threshold — synthetic fixtures

**Edge Cases:**

- Net loss → distance = threshold − (negative profit); rendered without double negatives
- Multiple businesses → trigger evaluates aggregate of scanner's business-facts source (design decision at milestone level)

#### Story S5: Trigger-table reporting

**As a** user with threshold-trigger benefits
**I want** scan output and the UI to show a trigger table — threshold, current value, distance, fired/not-fired
**So that** I can see at a glance how far each CPA conversation is

**Acceptance Criteria:**

- [ ] Given a scan with trigger-bearing benefits, when results are returned, then each carries a
      structured trigger object `{ threshold, current_value, distance, fired }` (exact shape at design)
- [ ] Given the Dashboard (placement confirmed PM/PO 2026-07-10), when trigger benefits exist,
      then a trigger-table section renders them (mirrors the standing-triggers table in the lab
      cost-discipline doc)
- [ ] Given no trigger benefits in a profile, then the section is absent (no empty chrome)
- [ ] Report output (`reports/opportunity_report.md` path) includes the trigger table

**Edge Cases:**

- Trigger data missing on a non-trigger benefit → renders as today, no regression
- Currency formatting: negative current values (losses) render as −$X.XX

### 2.3 Monthly ritual

#### Story S6: Monthly books ritual command

**As a** business owner doing monthly bookkeeping
**I want** one command that validates the books CSV, recomputes financial aggregates, runs the scan, and surfaces the report
**So that** monthly upkeep is one sitting (aspirational ≤15 min) instead of a manual multi-step chore

**Acceptance Criteria:**

- [ ] Given `user_data/private/books/<year>-transactions.csv`, when the command runs, then the CSV
      is schema-validated (columns: date, amount, category, project, description, receipt;
      known categories; parseable dates/amounts) with row-level error messages
- [ ] Given valid books, when the command runs, then business financial aggregates (cash operating
      spend, net profit/loss) are recomputed and written to the owner's businesses section
      (mechanism — API PUT vs direct — decided at design)
- [ ] Given updated data, then a scan is triggered and the resulting report (incl. trigger table) is surfaced
- [ ] Given the ritual doc, then it reflects the command + backup step, and one full walkthrough
      has been performed with duration recorded
- [ ] Command lives in `backend-ts` tooling (npm script), tested with synthetic CSV fixtures

**Edge Cases:**

- Malformed row → command fails with row number + reason; nothing written
- Backend not running → clear error naming the prerequisite (or command self-hosts the logic — design)
- Year boundary (new CSV file) → command takes the year/file as argument, defaults to current year

## 3. Functional Requirements

| ID | Requirement | Priority | Rationale |
| --- | --- | --- | --- |
| FR-001 | Scanner results support structured trigger data (threshold, current value, distance, fired) | Must | Core of "almost available" reporting (SOW obj. 2) |
| FR-002 | §41 R&D credit benefit record with $5k cash-spend trigger | Must | SOW obj. 2; standing tax trigger §1.10 |
| FR-003 | S-corp benefit extended with $40k net-profit trigger | Must | SOW obj. 2; standing tax trigger §1.10 |
| FR-004 | Trigger table rendered in UI and markdown report | Must | Visibility of obj. 2 |
| FR-005 | `pg_dump` backup step + one verified restore | Must | SOW amendment at gate (PM/PO 2026-07-10) |
| FR-006 | Books CSV validation with row-level errors | Must | Ritual integrity; books are system of record |
| FR-007 | Aggregate recompute from CSV into businesses section | Must | Keeps scan inputs honest monthly |
| FR-008 | One-command ritual (validate → recompute → scan → report) | Should | Story C; composed from FR-005..007 |
| FR-009 | Trigger thresholds defined in benefit YAML (not hardcoded in TS) | Should | Library-driven design consistent with existing records; CPA-adjustable |
| FR-010 | Real facts entered via existing My Data UI (no new entry UI) | Must | Design review 2026-07-10; zero new code for entry |

## 4. Non-Functional Requirements

### 4.1 Performance

- No new requirements. Scan remains interactive-speed locally (63-record library; currently sub-second-to-seconds).

### 4.2 Security / Privacy (the load-bearing NFR)

- No real financial value may appear in any committed file, test fixture, or doc. Synthetic fixtures only.
- `user_data/private/` (and backup location, if in-repo) gitignored with CI-enforced guard test.
- All new endpoints/commands operate on the authenticated user's own data (existing isolation model).

### 4.3 Scalability

- N/A — single-machine, per-user local operation stays the model.

### 4.4 Accessibility

- Trigger-table UI follows the Phase A/B accessibility standards already in the component library
  (label association, focus-visible rings, `role="status"` for live updates as applicable).

### 4.5 Compliance

- Not-tax-advice boundary: all trigger language reads "evaluate with CPA"; records carry non-goal
  notes; thresholds documented as heuristics.

## 5. User Experience

### 5.1 User Flow: Monthly ritual

```
1. Owner appends transactions to books CSV (+ drops receipts in documents/receipts/)
2. Owner runs the ritual command (one npm script)
3. Command validates CSV → recomputes aggregates → updates businesses section → runs scan
4. Command surfaces the report; owner reviews the trigger table
   (§41: threshold $5,000 | current $X | distance $Y | fired?)
5. Owner runs/confirms backup step (dated pg_dump)
6. If a trigger fired → schedule the CPA conversation
```

### 5.2 Wireframes / Design References

Trigger table mirrors the standing-triggers table in
`public-data/lab-overview/cost-and-monetization-discipline.md` §1.10. Dashboard card styling
follows existing `StackCard.jsx` patterns.

### 5.3 UI Requirements

- Trigger table appears on the **Dashboard** (PM/PO decision 2026-07-10) only when
  trigger-bearing results exist; also included in the markdown report output (FR-004).
- Distance values formatted as currency; fired state visually distinct (existing status color system).

## 6. Data Requirements

### 6.1 Data Models

- **Extends** `ScanResult` (backend-ts/src/domain/scanner/types.ts) with optional trigger data —
  exact shape at design; no DB schema change anticipated (scan results are computed, not stored per-row).
- Benefit YAML schema gains threshold-trigger fields (FR-009) — additive, backward compatible.
- Books CSV schema (existing, documented in `user_data/private/README.md`) becomes the validated contract.

### 6.2 Data Validation Rules

| Field | Validation | Error Message |
| --- | --- | --- |
| CSV `date` | ISO parseable | "row N: unparseable date" |
| CSV `amount` | numeric | "row N: non-numeric amount" |
| CSV `category` | in known set | "row N: unknown category X" |
| YAML trigger threshold | positive number | Benefit-loader validation error |

### 6.3 Data Retention

- Backups: local, dated dumps; retention is owner's discretion (no automated pruning this arc).

## 7. Integration Requirements

### 7.1 External Systems

None new. Anthropic API untouched (narratives already handle scan results generically — verify at design).

### 7.2 Internal Systems

| System | Purpose | Type | Requirements |
| --- | --- | --- | --- |
| Scanner (`domain/scanner`) | Trigger evaluation | In-process | Additive to rule engine + benefit loader |
| My Data / section repos | Aggregate writes from ritual | API or repo call | Respect canonical `data_json` + typed-column sync |
| Reports (`reports/opportunity_report.md`) | Trigger table in markdown output | File output | Existing report generator extended |

## 8. Assumptions and Dependencies

### 8.1 Assumptions

- A1 (from SOW): owner keeps worksheet/profile current; TODO fields tolerable as `missing_facts`.
- A2: $5k / $40k thresholds are CPA-conversation heuristics, adjustable in YAML.
- A3: rule engine + YAML schema can express triggers additively (validated at design; fallback: report-layer computation).

### 8.2 Dependencies

- S1 (real facts) precedes meaningful verification of S3–S5 against reality (they're testable
  synthetically regardless). **Status note (PM/PO 2026-07-10):** owner data entry is deferred —
  seeder has run, real facts not yet entered. S1 is owner-paced and does not gate development of
  any other story; until it lands, real-data verification uses the seeded profile.
- S6 depends on S2–S5 (composes them).
- No external dependencies.

## 9. Out of Scope

- Computing §41 credit amounts, preparing elections, any filing artifacts
- Multi-tenant/hosted deployment; new infra
- Phase C data-redundancy reconciliation (capital gains / HSA / rental-income duplicates)
- Lab-ledger integration (quarterly reconciliation stays a human ritual)
- Broader library expansion beyond the two trigger benefits

## 10. Open Questions

| Question | Owner | Target Date |
| --- | --- | --- |
| Trigger data in rule engine vs report layer (A3) | Developer, at M2 design | M2 design review |
| Ritual command: API-based vs direct repo write for aggregates | Developer, at M3 design | M3 design review |
| ~~Trigger table placement~~ — **RESOLVED: Dashboard** (PM/PO 2026-07-10) | — | — |
| Multiple-business aggregation for triggers (first vs sum) | PM/PO + Developer | M2 design review |

## 11. Appendix

### 11.1 Research References

- Backlog seed: `docs/backlog/first-real-user-private-overlay.md` (Story A design decision recorded there)
- Standing triggers: `public-data/lab-overview/cost-and-monetization-discipline.md` §1.10
- Approved SOW+: `agent-docs/2026-07-10-sow-utbis.md`, `agent-docs/2026-07-10-architecture-utbis.md`

### 11.2 Glossary

See Architecture doc §13.2 (canonical copy moves to System PRD next phase).
