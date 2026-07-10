# Milestone PRD: M3 — Monthly Ritual

**Parent:** [2026-07-10-system-prd-first-real-user.md](./2026-07-10-system-prd-first-real-user.md) · **Depends on:** M2 (hard — scan output), M1 (hard — backup step) · **Duration:** ~1–2 dev sessions · **Version:** 1.0 (2026-07-10)

Shared context (glossary: *ritual*, *books*; trigger contract) lives in the System PRD.

## 1. Objective

Monthly bookkeeping becomes one sitting: a single command validates the books CSV, recomputes the
financial aggregates the triggers read, runs the scan, and surfaces the report with the trigger
table; the documented ritual wraps that command with receipts and backup. Without this milestone,
M2's triggers decay — data goes stale the first month nobody re-enters aggregates by hand.

## 2. User Stories (this milestone)

### Story M3-1 (S6): Monthly books ritual command

**As a** business owner doing monthly bookkeeping,
**I want** one command that validates the books CSV, recomputes financial aggregates, runs the scan, and surfaces the report,
**so that** monthly upkeep is one sitting (aspirational ≤15 min) instead of a manual multi-step chore.

**Acceptance Criteria:**
- [ ] Given `user_data/private/books/<year>-transactions.csv`, when the command runs, then the CSV is schema-validated (columns: date, amount, category, project, description, receipt; known categories; parseable dates/amounts) with row-level error messages
- [ ] Given valid books, when the command runs, then business financial aggregates (cash operating spend, net profit/loss) are recomputed and written to the owner's businesses section (mechanism — API PUT vs direct repo — decided at design; must preserve typed-column sync)
- [ ] Given updated data, then a scan is triggered and the resulting report (incl. trigger table) is surfaced
- [ ] Given the ritual doc (`user_data/private/README.md`), then it reflects the command + backup step (from M1) + receipts flow, and one full walkthrough has been performed with duration recorded (aspirational ≤15 min, not gated — PM/PO 2026-07-10)
- [ ] Command lives in `backend-ts` tooling (npm script), tested with synthetic CSV fixtures

**Edge Cases:**
- Malformed row → command fails with row number + reason; nothing written
- Backend not running → clear error naming the prerequisite (or command self-hosts the logic — design decision)
- Year boundary → command takes year/file as argument, defaults to current year
- Revenue rows (future) → aggregates must not silently assume expense-only books; design decides sign convention now, even if revenue is $0 this year

## 3. Functional Requirements

| ID | Requirement | Priority | Rationale |
| --- | --- | --- | --- |
| M3-FR-01 | CSV schema validation with row-level errors; invalid input writes nothing | Must | FR-006; books are the system of record |
| M3-FR-02 | Aggregate recompute (cash operating spend, net profit/loss) from CSV | Must | FR-007; feeds M2 trigger metrics |
| M3-FR-03 | Write aggregates to owner's businesses section preserving `data_json`-canonical + typed-column sync | Must | System PRD T2 mitigation — reuse `saveSectionData` path |
| M3-FR-04 | Chain: validate → recompute → write → scan → surface report | Must | FR-008; the one-command promise |
| M3-FR-05 | Ritual doc v2: command + backup + receipts + timed walkthrough recorded | Must | SOW obj. 3 |
| M3-FR-06 | Synthetic CSV fixtures in tests (valid, malformed row, unknown category, year arg) | Must | Privacy invariant + M3-FR-01 coverage |

## 4. Non-Functional Requirements (delta from System PRD §6)

- Ritual writes only to the authenticated owner's account (System PRD §6.1 per-user isolation) —
  the command must take/resolve an explicit user identity, never "first user in table".

## 5. Data Requirements

- No schema changes. Writes businesses section via existing section-save path.
- Reads: books CSV (contract per `user_data/private/README.md`, now loader-enforced).
- The CSV → aggregate mapping is the one new data transformation: category/project columns → cash
  operating spend; spend vs revenue sign convention decided at design (edge case above).

## 6. Dependencies & Assumptions

- Hard: M2 (scan output incl. trigger table), M1 (backup step folded into ritual doc)
- Assumption A1: owner appends transactions monthly; the command makes the rest mechanical
- Open question at design: API-based vs direct repo write (project PRD §10)

## 7. Out of Scope (this milestone)

- Receipt file management/automation (stays manual: drop PDF, reference in CSV)
- Lab-ledger reconciliation (quarterly human ritual by standing decision — never a coupling)
- Scheduling/automation of the ritual (owner-initiated by design)
- Multi-year backfill tooling

## 8. Exit Gate

- [ ] One command runs the full chain against a test profile (synthetic CSV)
- [ ] Malformed input writes nothing and names the offending row
- [ ] Ritual doc v2 complete (command + backup + receipts)
- [ ] One full walkthrough performed; duration recorded
- [ ] Full suite green; lint + builds clean; guard test green

## 9. Traceability

Project PRD S6 (FR-006..008) · SOW obj. 3 + backup amendment · Backlog Story C ·
`user_data/private/README.md` monthly ritual (v1, being superseded).
