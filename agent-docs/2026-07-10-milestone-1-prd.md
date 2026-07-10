# Milestone PRD: M1 — Real Facts, Safely

**Parent:** [2026-07-10-system-prd-first-real-user.md](./2026-07-10-system-prd-first-real-user.md) · **Depends on:** — · **Duration:** ~1 dev session + owner-paced entry · **Version:** 1.0 (2026-07-10)

Shared context (trigger contract, glossary, cross-cutting requirements) lives in the System PRD
and is referenced, not duplicated here.

## 1. Objective

The owner's real tax profile can safely exist in the local PostgreSQL database: a backup exists
and restore is proven, so a disk failure or bad migration can no longer destroy the only copy of
real financial facts. The path for entering those facts (My Data UI, worksheet in hand) is
documented so entry is a checklist, not archaeology. Without this milestone, dogfooding puts the
books' derived state at risk and entry stays vague enough to keep getting deferred.

## 2. User Stories (this milestone)

### Story M1-1 (S2): Local database backup

**As a** user whose real financial facts now live only in a local PostgreSQL database,
**I want** a simple backup-and-restore procedure folded into my monthly ritual,
**so that** a disk failure or bad migration cannot destroy the only copy of my tax profile.

**Acceptance Criteria:**
- [ ] Given the ritual doc, when the backup step runs (`pg_dump`-based, one command), then a dated dump lands in a local, gitignored location
- [ ] Given a dump, when restored to a scratch database once (verification exercise), then a spot-checked section (businesses) matches the source
- [ ] Given the backup location, then it is covered by `.gitignore`; the guard test is extended if the location is inside the repo

**Edge Cases:**
- Dump directory missing → command creates it
- Postgres version mismatch on restore → documented as a known caveat in the ritual doc, not engineered around

### Story M1-2 (S1): Enter real facts via My Data (owner-paced, non-gating)

**As a** business owner with real financial data,
**I want to** enter my LLC's facts through the My Data UI into my own user account,
**so that** scans run against reality instead of seed data, with nothing committable to the public repo.

**Acceptance Criteria:**
- [ ] Given the worksheet `user_data/private/businesses.local.yaml`, when the owner has entered its facts via My Data, then a scan of the owner's account reads those values
- [ ] Given the businesses section, when `entity_type` is set, then it uses scanner vocabulary (`llc_single`)
- [ ] Given remaining `TODO owner` fields, when unresolved, then they are null in the DB and surfaced as `missing_facts`, not blockers
- [ ] Given any file under `user_data/private/`, then `git check-ignore` passes (guard test — shipped 2026-07-10)
- [ ] **Deliverable this milestone (dev-side):** an entry checklist appended to `user_data/private/README.md` mapping worksheet fields → My Data sections/fields, with scanner-vocabulary notes

**Edge Cases:**
- Seed/test users coexist with the owner account → per-user isolation keeps scans separate
- Worksheet drifts from DB → worksheet is entry source; DB canonical after entry; ritual reconciles monthly

**Status note (PM/PO 2026-07-10):** entry itself is owner-paced and *not* an exit gate; the
dev-side deliverable is the checklist.

## 3. Functional Requirements

| ID | Requirement | Priority | Rationale |
| --- | --- | --- | --- |
| M1-FR-01 | `pg_dump` backup command producing dated dump in gitignored location | Must | SOW amendment (FR-005) |
| M1-FR-02 | One documented, verified restore to scratch DB | Must | A backup is not a backup until restored once |
| M1-FR-03 | Guard test covers backup location (if in-repo) | Must | Privacy invariant (System PRD §6.1) |
| M1-FR-04 | Entry checklist: worksheet → My Data mapping | Must | Unblocks S1 without new UI (FR-010) |

## 4. Non-Functional Requirements (delta from System PRD §6)

No milestone-specific NFRs. Privacy invariant applies to the dump files (real data at rest —
gitignored location, never committed).

## 5. Data Requirements

No schema changes. Touches: all user tables via `pg_dump` (whole-DB dump); reads
`user_data/private/businesses.local.yaml` (human, via checklist). Backup artifacts: dated
`.dump`/`.sql` files, local only.

## 6. Dependencies & Assumptions

- Depends on: nothing (parallel-safe; can run before/alongside M2)
- Provides: backup step to M3's ritual doc (hard dependency M1→M3)
- Assumptions: A1 (owner keeps worksheet current); T3 risk accepted (pg_dump version caveats documented, not engineered)

## 7. Out of Scope (this milestone)

- Automated/scheduled backups, retention pruning (owner-discretion, later if ever)
- Any new data-entry UI (FR-010: existing My Data only)
- Trigger benefits and ritual command (M2, M3)

## 8. Exit Gate

- [ ] Backup command documented in ritual doc; produces dated dump
- [ ] Restore verified once; businesses section spot-check matches
- [ ] Guard test green (extended if needed)
- [ ] Entry checklist committed (no real values in it — field names only)
- [ ] Full suite/lint/build clean

## 9. Traceability

Project PRD S1, S2 (FR-005, FR-010) · SOW obj. 1, 4 + gate amendment (backup in scope) ·
Backlog `first-real-user-private-overlay.md` Story A (as re-decided 2026-07-10).
