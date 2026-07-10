# Milestone Plan: UTBIS — First Real User Arc

**Sources:** approved System PRD + Milestone PRDs 1–3 (2026-07-10) · **Version:** 1.0 (2026-07-10)

## Overview

Three small milestones, executed sequentially by a solo AI-augmented developer, planned in
**dev-sessions** rather than calendar weeks (founder-hours are the budget, lab discipline §1.8).
M1 runs first because it is one session and protects real data before any lands; M2 is the core
value; M3 composes M1+M2 into the monthly loop. One epic per milestone — the arc is small enough
that finer epic slicing would be ceremony.

## Milestone 1: Real Facts, Safely

### Objective
The owner's real tax profile can safely exist in the local DB: backup exists, restore proven,
entry path documented as a checklist.

### Duration
Start: next dev session · Duration: ~1 session (+ owner-paced entry, non-gating)

### Features Included

| Epic ID | Feature | Priority | Dependencies |
| --- | --- | --- | --- |
| EP-001 | Data safety & entry path (backup/restore + worksheet→My Data checklist) | Must | None |

### Success Criteria
- [ ] Dated `pg_dump` backup command documented; dump produced
- [ ] One restore to scratch DB verified; businesses section spot-check matches
- [ ] Backup destination gitignored; guard test green (extended if in-repo)
- [ ] Entry checklist committed (field names only — no real values)
- [ ] Full suite/lint/build clean

### Key Deliverables
- Backup/restore procedure in ritual doc (v1.5 — v2 lands in M3)
- Entry checklist in `user_data/private/README.md`

### Risks

| Risk | Probability | Impact | Mitigation |
| --- | --- | --- | --- |
| pg_dump/restore caveats on Windows | L | L | Document caveat; the verified restore *is* the test |

### Resource Requirements
Solo (Claude Code-augmented). No specialists.

### Dependencies
- **External:** none
- **Internal:** none (parallel-safe)

## Milestone 2: Trigger Benefits

### Objective
Scanner reports the two standing tax triggers as structured "almost available" data with dollar
distance; visible on Dashboard and in the markdown report.

### Duration
Start: after M1 · Duration: ~2–3 sessions

### Features Included

| Epic ID | Feature | Priority | Dependencies |
| --- | --- | --- | --- |
| EP-002 | Trigger benefits end-to-end (YAML schema + TriggerStatus + §41 record + S-corp extension + Dashboard table + report section) | Must | None hard; EP-001 soft (real-data verification) |

### Success Criteria
- [ ] M2 PRD exit gate in full (seeded-profile scan correct; `lte` tested; Dashboard table live-verified; report section; suite ≥396 green; CPA language present)

### Key Deliverables
- `trigger:` YAML block (loader-validated) + `TriggerStatus` on `ScanResult` (System PRD §5.2 contract)
- `tax_library/federal/` §41 record; S-corp record extended
- Dashboard trigger-table component; markdown report section
- **M2 design review first** (validates A3: rule-engine vs report-layer; resolves multi-business aggregation)

### Risks

| Risk | Probability | Impact | Mitigation |
| --- | --- | --- | --- |
| A3 wrong — rule engine resists trigger semantics | M | M | Design review before build; report-layer fallback keeps the §5.2 contract intact |
| Scan-run persistence shape complicates additive trigger data | L | M | Checked at design review |

### Resource Requirements
Solo. No specialists.

### Dependencies
- **External:** none
- **Internal:** M1 soft (verification upgrade only)

## Milestone 3: Monthly Ritual

### Objective
One command: validate books CSV → recompute aggregates → scan → surface report; ritual doc v2
wraps it with receipts + backup; one timed walkthrough.

### Duration
Start: after M2 · Duration: ~1–2 sessions

### Features Included

| Epic ID | Feature | Priority | Dependencies |
| --- | --- | --- | --- |
| EP-003 | Monthly ritual command + ritual doc v2 | Must | EP-002 (scan output), EP-001 (backup step) |

### Success Criteria
- [ ] M3 PRD exit gate in full (chain runs on synthetic CSV; malformed input writes nothing; doc v2; walkthrough timed; suite green)

### Key Deliverables
- npm-script ritual command in `backend-ts` with CSV validation + aggregate write (typed-column-sync preserving)
- Ritual doc v2; recorded walkthrough duration
- **M3 design review first** (API vs direct write; sign convention for revenue rows)

### Risks

| Risk | Probability | Impact | Mitigation |
| --- | --- | --- | --- |
| Aggregate write path breaks typed-column sync | L | M | Reuse `saveSectionData`; regression tests |
| Walkthrough exposes ritual friction >15 min | M | L | Duration recorded not gated; friction feeds next arc |

### Resource Requirements
Solo. No specialists.

### Dependencies
- **External:** none
- **Internal:** M1 + M2 complete

## Critical Path

```
M1 (1 session) → M2 (2–3 sessions) → M3 (1–2 sessions)
       └──— S1 owner data entry: owner-paced, joins wherever it lands, gates nothing
```

(M2 does not technically depend on M1, but solo execution makes sequential the plan; M1-first
protects data before entry happens.)

## Overall Timeline

```
Session 1:      M1 — backup/restore + entry checklist
Sessions 2–4:   M2 — design review, trigger engine + records, surfaces
Sessions 5–6:   M3 — design review, ritual command + doc v2, walkthrough
Buffer:         +1 session contingency (A3 fallback or ritual friction)
```

No calendar dates — sessions are scheduled by founder availability; sprint report at arc close
carries the founder-hours cost line (lab §1.7).

## Key Assumptions

- A3 (rule engine extends additively) — validated at M2 design review before build
- A1 (owner keeps worksheet current) — S1 non-gating, ritual reconciles
- Seeded profile suffices for M2 exit verification (A4)

## Decision Log

| Date | Decision | Rationale | Impact |
| --- | --- | --- | --- |
| 2026-07-10 | One epic per milestone (EP-001..003) | Arc too small for finer slicing; stories already carry ACs | Simpler traceability |
| 2026-07-10 | M1 first despite M2 being critical path | 1 session; protects real data before entry | Negligible delay to M2 |
| 2026-07-10 | Sessions, not weeks, as planning unit | Founder-hours are the budget (lab §1.8) | Sprint report converts at close |
