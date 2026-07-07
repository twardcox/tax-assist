# Handoff to GitHub Copilot — 2026-07-07

Read first: `CLAUDE.md` (full state), then `ce/skills/*.md` (working rules:
the-setup, the-planner, the-honest-advisor, the-bug-hunter, security-sweep).
Reference these from `.github/copilot-instructions.md`.

## Where things stand
- Branch `audit` (local, **unpushed**, off main). Clean tree, 396 backend tests,
  lint + both builds green.
- Just shipped: **Strategy Stacks** — spec `docs/superpowers/specs/2026-07-06-strategy-stacks-design.md`,
  plan `docs/superpowers/plans/2026-07-07-strategy-stacks.md` (all 9 tasks done).
  4 new benefits (donor-advised-fund, crut-664, 831b-microcaptive, nongrantor-dynasty-trust),
  3 stacks in `tax_library/stacks/`, evaluator `backend-ts/src/domain/scanner/stacks.ts`,
  Dashboard `StackCard.jsx`, miner `npm run suggest:stacks`.
- Earlier on this branch (also unpushed): OBBBA 2025 param fixes, PolicyEngine
  param pipeline, Form 1040 remap for the IRS 9/5/25 revision, verification tooling.

## Next work, in order
1. **OBBBA Schedule 1-A deductions** — plan already approved and written:
   `docs/superpowers/plans/2026-07-06-obbba-deductions.md` (spec
   `docs/superpowers/specs/` fbf021a). Execute it task-by-task, TDD, commit per task.
   Covers senior $6k bonus deduction, tips, overtime, car-loan interest:
   schema fields + calculator + Schedule 1-A form mapping.
2. Per-rule accuracy audit of the 59 scanner rules + ~58 benefit YAMLs vs current law.
3. Value-level checks for the 6 aux forms (Sch 3, A, 8812, 2441, 8863, 5695 —
   position-verified only).
4. Phase C cross-section data redundancy (see CLAUDE.md — trace duplicated fields
   through taxCalculator.ts before touching).
5. Decide integration: push/PR the `audit` branch when the owner is ready.

## Non-negotiables
- Validation loop before any commit: focused vitest → `npm test` → `npm run lint`
  → `npm run build` (all in backend-ts); frontend build if UI touched.
- Never invent tax parameters; abuse boundaries stay on flagged strategies.
- `npm test` wipes the dev DB — re-seed (`npm run seed:test-user`) afterwards.
