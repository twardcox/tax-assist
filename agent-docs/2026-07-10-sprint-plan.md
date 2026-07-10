# Sprint Plan: UTBIS — First Real User Arc

## Overview

Three sprints, one per milestone, executed as dev-sessions by a solo AI-augmented developer
(sequential; no parallel capacity). Sprint = the unit of demoable outcome + report; calendar
dates are not planned (founder availability), session order is.

## Sprint Parameters

| Parameter | Value |
| --- | --- |
| Sprint duration | 1 milestone ≈ 1–3 dev sessions |
| Team capacity | ~16 ideal dev-hours total across the arc (solo + Claude Code) |
| Spend cap | **$0 new external cash** (no new APIs/data/experts authorized). LLM usage rides the existing subscription. Any story that would spend cash → stop-and-report (lab discipline). |
| Start date | 2026-07-10 (this session) |
| End date | open (AFK-autonomous execution authorized 2026-07-10) |

## Sprint 1: Data Safety

**Milestone:** M1 · **Goal:** A dated backup exists, a restore is proven, and entering real facts is a checklist task.
**Dates:** session 1

### Stories

| Key | Summary | Est. | Epic |
| --- | --- | --- | --- |
| TBD | pg_dump backup step + one verified restore, documented in ritual doc | 2h | EP-001 |
| TBD | Entry checklist (worksheet → My Data mapping); entry owner-paced | 1h | EP-001 |

### Dependencies
- [ ] None (foundation sprint)

### Success Criteria
- [ ] M1 PRD exit gate: dump produced; restore verified (businesses spot-check); guard test green; checklist committed (field names only); suite/lint/build clean

---

## Sprint 2: Trigger Benefits

**Milestone:** M2 · **Goal:** A scan of the seeded profile shows §41 and S-corp triggers with correct dollar distance, on the Dashboard and in the report.
**Dates:** sessions 2–4

### Stories

| Key | Summary | Est. | Epic |
| --- | --- | --- | --- |
| TBD | Trigger-table reporting (TriggerStatus + YAML block + Dashboard + report) — engine half first | 4h | EP-002 |
| TBD | §41 R&D credit record + rule with $5k gte trigger | 3h | EP-002 |
| TBD | S-corp record extended with $40k gte trigger | 2h | EP-002 |

### Dependencies
- [ ] **M2 design review before build** — resolves A3 (rule-engine vs report-layer), multi-business aggregation, scan-run persistence interaction
- [ ] Engine/type groundwork precedes the two benefit records; UI half last

### Success Criteria
- [ ] M2 PRD exit gate: trigger math exact below/at/above + loss; lte unit-tested; Dashboard table verified live; report section present; suite ≥396 green; CPA language everywhere

---

## Sprint 3: Monthly Ritual

**Milestone:** M3 · **Goal:** One command takes the books CSV to an updated scan report; ritual doc v2 covers the whole monthly sitting.
**Dates:** sessions 5–6

### Stories

| Key | Summary | Est. | Epic |
| --- | --- | --- | --- |
| TBD | Monthly ritual command + ritual doc v2 + timed walkthrough | 4h | EP-003 |

### Dependencies
- [ ] Sprint 1 (backup step folds into doc) and Sprint 2 (scan output) complete
- [ ] **M3 design review before build** — API vs direct write; revenue sign convention

### Success Criteria
- [ ] M3 PRD exit gate: chain end-to-end on synthetic CSV; malformed input writes nothing; doc v2; walkthrough duration recorded; suite green

---

## Milestone-to-Sprint Mapping

| Milestone | Sprints | Key Deliverables |
| --- | --- | --- |
| M1 | Sprint 1 | Backup/restore procedure; entry checklist |
| M2 | Sprint 2 | Trigger engine + §41 + S-corp + Dashboard table + report section |
| M3 | Sprint 3 | Ritual command; ritual doc v2 |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| A3 fails at M2 design review | M | Report-layer fallback preserves the §5.2 contract; buffer session |
| AFK execution hits a genuine PM/PO fork not covered by blanket approval | M | Take the recommendation already documented in the PRDs; log the decision; flag at close-out for review |
| Real values leak into a commit | H | Synthetic-only rule; guard test; pre-commit review of every diff |

---

## Assumptions

- Blanket approval (PM/PO 2026-07-10, AFK): remaining checkpoints self-approved per documented recommendations; work committed on a feature branch; **no push/PR until PM/PO returns**
- Seeded profile is the verification target until S1 entry happens (A4)

**Approval:** Output Approved via PM/PO blanket AFK authorization (2026-07-10).
