# Milestone PRD: M2 — Trigger Benefits

**Parent:** [2026-07-10-system-prd-first-real-user.md](./2026-07-10-system-prd-first-real-user.md) · **Depends on:** — (soft: M1 for real-data verification) · **Duration:** ~2–3 dev sessions · **Version:** 1.0 (2026-07-10)

Shared context — **especially the canonical trigger contract (System PRD §5.2: `TriggerStatus`
with `label` and `comparison: gte|lte`) and glossary** — lives in the System PRD and is
referenced, not duplicated here.

## 1. Objective

The scanner learns the two standing tax triggers and reports "almost available" with a structured
dollar distance: at any scan, the owner sees how far the LLC is from each CPA-conversation-worthy
threshold (§41 research credit at ~$5k cash spend; S-corp election at ~$40k net profit), rendered
as a trigger table on the Dashboard and in the markdown report. This is the arc's core value —
without it, UTBIS still answers "what exists" but not "when is it worth acting."

## 2. User Stories (this milestone)

### Story M2-1 (S3): §41 R&D credit benefit record

**As a** pre-profit R&D-performing business owner,
**I want** the §41 research credit in the benefit library with a cash-spend threshold trigger,
**so that** the scanner tells me when my research spend justifies a CPA conversation about the credit.

**Acceptance Criteria:**
- [ ] Given `tax_library/federal/`, when the scan runs, then a §41 benefit record evaluates, including: §174A immediate-expensing note (2025 act), QSB payroll-tax offset path, 20-yr carryforward, QRE scope note (research cloud/LLM compute; 65% contract research)
- [ ] Given annual cash operating spend ≥ $5,000, when the rule evaluates, then status is `nearly_eligible`/`eligible_now`-class with message "evaluate with CPA"
- [ ] Given spend below threshold, then the result reports the trigger not-fired with structured `TriggerStatus` (threshold, current, distance, fired, label)
- [ ] Given the record, then it carries the non-goal boundary: UTBIS flags the conversation, never computes the credit
- [ ] Rule covered by Vitest cases (below, at, above threshold) using synthetic fixtures only

**Edge Cases:**
- No businesses in profile → `not_applicable`
- Spend exactly at threshold → fired (gte)
- Missing financials → `unknown` with `missing_facts` naming the absent aggregate

### Story M2-2 (S4): S-corp election threshold extension

**As a** growing LLC owner,
**I want** the existing S-corp election benefit extended with the ~$40k net-profit breakeven trigger,
**so that** the scanner flags when entity-structure change becomes worth evaluating.

**Acceptance Criteria:**
- [ ] Given net profit ≥ $40,000, when the rule evaluates, then the S-corp benefit fires "evaluate with CPA"
- [ ] Given net profit below $40,000 (including negative), then trigger not-fired with structured distance (e.g. net profit −$3.41 → distance $40,003.41)
- [ ] Existing S-corp rule behavior preserved for non-trigger aspects (regression tests stay green)
- [ ] Vitest cases: loss, below, at, above threshold — synthetic fixtures

**Edge Cases:**
- Net loss → distance = threshold − (negative profit); rendered without double negatives
- Multiple businesses → aggregation decision at design review (open question, project PRD §10)

### Story M2-3 (S5): Trigger-table reporting

**As a** user with threshold-trigger benefits,
**I want** scan output and the Dashboard to show a trigger table — label, threshold, current value, distance, fired/not-fired,
**so that** I can see at a glance how far each CPA conversation is.

**Acceptance Criteria:**
- [ ] Given a scan with trigger-bearing benefits, when results are returned, then each carries `trigger?: TriggerStatus` per the System PRD §5.2 contract (incl. human-readable `label`, `comparison: gte|lte` both supported)
- [ ] Given the Dashboard (PM/PO placement 2026-07-10), when trigger benefits exist, then a trigger-table section renders label | threshold | current | distance | fired
- [ ] Given no trigger benefits in a profile, then the section is absent (no empty chrome)
- [ ] Report output (`reports/opportunity_report.md` path) includes the trigger table

**Edge Cases:**
- Non-trigger benefits → render as today, no regression
- Negative current values (losses) → formatted as −$X.XX, no double negatives
- `lte` trigger ("stay under X") → distance/fired semantics per contract; rendered with direction made clear by the label/threshold column

## 3. Functional Requirements

| ID | Requirement | Priority | Rationale |
| --- | --- | --- | --- |
| M2-FR-01 | Benefit YAML schema gains additive `trigger:` block (metric, label, threshold, comparison gte\|lte), loader-validated | Must | FR-009; thresholds CPA-adjustable as data |
| M2-FR-02 | `ScanResult` gains optional `TriggerStatus` per System PRD §5.2 | Must | FR-001; the canonical contract |
| M2-FR-03 | §41 record + rule with $5k gte trigger | Must | FR-002; standing trigger §1.10 |
| M2-FR-04 | S-corp record extended with $40k gte trigger, behavior-preserving | Must | FR-003 |
| M2-FR-05 | Dashboard trigger-table component (existing card/status patterns) | Must | FR-004; placement decided |
| M2-FR-06 | Trigger table in markdown report output | Must | FR-004 |
| M2-FR-07 | `lte` comparison implemented and tested (even though both launch triggers are gte) | Must | PM/PO 2026-07-10 gate decision |
| M2-FR-08 | Metric resolution from `UserFacts` for `annual_cash_operating_spend` and `net_profit` | Must | Trigger math needs defined inputs |

## 4. Non-Functional Requirements (delta from System PRD §6)

- All trigger language reads "evaluate with CPA" (System PRD §6.1 not-tax-advice boundary) — restated here because every M2 artifact touches it.
- Trigger-table component meets Phase A/B accessibility standards (§6.3): status not conveyed by color alone.

## 5. Data Requirements

- No DB schema changes (scan results computed, not stored per-row — verify `scan_runs` persistence shape at design; if runs are persisted as JSON, trigger data rides along additively).
- Benefit YAML schema: additive `trigger:` block (M2-FR-01). Schema doc/example record updated (`tax_library/example-benefit.yaml`).
- New metric accessors on `UserFacts` if absent: annual cash operating spend (maps to businesses financials `operating_expenses`-class aggregate — exact source at design), net profit (`firstBusinessNetProfit()` exists; multi-business question open).

## 6. Dependencies & Assumptions

- Soft depends on M1: real-data verification upgrades from seeded to owner profile when S1 lands; synthetic verification suffices for exit.
- Provides to M3: the scan output (trigger table) the ritual surfaces — hard dependency M2→M3.
- Assumption A3 (rule engine extends additively) validated at this milestone's design review **before build**; fallback is report-layer computation (contract unchanged either way).
- Open questions to resolve at M2 design review: multi-business aggregation (first vs sum); `scan_runs` persistence interaction.

## 7. Out of Scope (this milestone)

- Ritual command and doc updates (M3)
- Backup (M1)
- Any additional trigger benefits beyond §41 + S-corp (post-arc library growth)
- Computing credit amounts or election paperwork (arc-wide non-goal)

## 8. Exit Gate

- [ ] Seeded-profile scan shows both triggers with correct threshold/current/distance/fired/label
- [ ] `lte` path unit-tested (synthetic below/at/above)
- [ ] Dashboard trigger table renders (verified live); absent when no triggers
- [ ] Markdown report includes trigger table
- [ ] Full suite ≥396 green; lint + both builds clean; guard test green
- [ ] "Evaluate with CPA" language + non-goal notes present in both records

## 9. Traceability

Project PRD S3, S4, S5 (FR-001..004, FR-009) · SOW obj. 2 · Standing triggers: lab
cost-discipline §1.10 · System PRD §5.2 contract (incl. 2026-07-10 gate amendments).
