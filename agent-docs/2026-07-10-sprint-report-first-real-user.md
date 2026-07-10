# Sprint Report: First Real User Arc — Sprints 1–3 (M1–M3)

**Date:** 2026-07-10 · **Branch:** `first-real-user` (5 commits, not pushed) · **Author:** Claude Code under PM/PO blanket AFK authorization
**Placed in `agent-docs/` (committed) rather than `reports/` because `reports/*.md` is gitignored for generated artifacts.**

## Outcomes vs plan

| Sprint | Goal | Result |
| --- | --- | --- |
| 1 (M1) | Backup + restore proven; entry checklist | ✅ `2ca42b1` — dated `pg_dump` via `npm run backup:db`; restore verified (content-hash match); guard test extended to `backups/`; checklist at `docs/my-data-entry-checklist.md` |
| 2 (M2) | Trigger benefits end-to-end | ✅ `32ff909` — YAML `trigger:` blocks (gte+lte), `TriggerStatus` on `ScanResult`, §41 record, S-corp threshold, Dashboard Trigger Watch table, report section. Verified live: §41 FIRED at $10,010 spend; S-corp distance $30,991; zero console errors |
| 3 (M3) | One-command monthly ritual | ✅ `d9248c8` — `npm run ritual -- --user <email>`: CSV validation (row-numbered, atomic) → aggregates → scan → report → trigger printout, in-process. Walkthrough: 1.5 s command-side; at-threshold case exercised live |

**Carryover:** none in code. S1 (owner enters real facts) remains owner-paced by design — the
checklist is waiting; PM/PO said "don't have time to input my info" at the Project-PRD gate.

## Exit gates

All three milestone exit gates met in full (final: 449 tests green — up from 396 baseline; lint +
both builds clean; guard test green). Two AFK decisions taken beyond the letter of the specs,
both logged in commit messages:

1. **Entry checklist committed** at `docs/my-data-entry-checklist.md` instead of only appended to
   the gitignored private README (M1 PRD said README; exit gate said "committed" — resolved in
   favor of committed, field names only).
2. **Test-DB isolation guard** (unplanned, M3): discovered `npm test` truncates the dev database
   via `resetTablesForTest()` — it wiped the seeded user twice during this arc and would wipe the
   owner's real profile the same way. Local test runs now use a dedicated `tax_assist_test` DB
   (vitest.config.ts); CI unaffected. This was a data-loss landmine squarely inside the arc's
   privacy/safety NFR, so it was fixed rather than logged.

## Environment findings (for PM/PO awareness, no action taken)

- **Port 5432 is double-bound**: native PostgreSQL 18 (owns `tax_assist`) and Docker's
  `image-upload-postgres` both listen on 5432. Currently harmless — the Docker instance has no
  `tax_assist` DB, so app connections succeed against native — but it cost debugging time and
  could bite any project on this machine. Recommendation (not executed while AFK): move one of
  them to a dedicated port.
- CLAUDE.md says the API is on :8000; it actually runs on :8001 (Vite proxy agrees). CompreFace
  owns :8000. Stale doc only.

## Cost line (lab discipline §1.7–1.8)

| Item | Amount | Source |
| --- | --- | --- |
| Cash spend this sprint (LLM/API/data) | $0 new external | No new services; Claude Code usage rides existing subscription; app's ANTHROPIC key not exercised (no AI-analysis runs) |
| External/expert/counsel spend | $0 | — |
| Founder-hours (sprint) | ~1 h owner attention (gate reviews + decisions), ±25% | Coarse estimate per §1.8; agent session wall-time ~4 h is not founder-hours |
| Cumulative vs caps | $0 cash against the $0-new-cash cap — no cap events | Sprint plan spend cap held |

## Next steps (in order)

1. **Owner (10 min):** enter real facts via `docs/my-data-entry-checklist.md`, then run
   `npm run ritual -- --user <your-email> --year 2026` and `npm run backup:db`. That completes S1
   and produces the first real trigger report (books currently: spend $3.41 → §41 distance ≈ $4,996.59).
2. **PM/PO:** review branch `first-real-user` (5 commits), then merge/PR per
   `superpowers:finishing-a-development-branch` — nothing pushed, per AFK ground rules.
3. Time the first real monthly ritual end-to-end (walkthrough record in the private README).
4. Next arc candidates: benefit-library growth (trigger pattern now reusable), Phase C data-redundancy reconciliation, port-5432 cleanup.
