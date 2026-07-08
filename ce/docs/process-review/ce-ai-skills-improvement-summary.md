# CE AI Skills Improvement Summary

**Scope:** `D:\programs\tax-assist\ce` · **Date:** 2026-07-07
**Companion:** [ce-ai-skills-review.md](ce-ai-skills-review.md) (full findings) · [skill-inventory.md](../skill-index/skill-inventory.md) (per-file status)

---

## 1. Files reviewed

All 162 files enumerated; ~45 read in full depth (framework core, all rules, all agent personas, all 5 local skills, representative commands and templates); the remainder catalogued by structure, size, and sampling. Detail: review report §3.

## 2. Skills identified

- **5 project-local skills** (`skills/`) — tax-assist domain (the real crown jewels)
- **43 command playbooks** (`.agents/commands/`)
- **45 generated skill loader stubs** (`.agents/skills/*/SKILL.md`)
- **6 always-on rules**, **10 agent personas**, **9 phase guidelines**, **14 artifact/instruction templates**

## 3. Skills updated

| File | Nature of update |
|---|---|
| `skills/the-planner.md` | Full restructure to the skill template: triggers, when-not-to-use, I/O, tool rules, failure handling, validation, ACs, 2 examples; "audit is current" made a dated, verify-each-session assumption |
| `skills/the-bug-hunter.md` | Full restructure; all four hard-won gotchas preserved and promoted to a named "Known Gotchas" section; validation loop made non-optional AC; sha256-exit-2 and markitdown rules given failure-handling entries |
| `skills/the-honest-advisor.md` | Full restructure; source grounding made **binding** ("no tax figure from model memory"); prohibited-outputs list made explicit (no clean recommendations of T.D. 10029 / IR-2023-65 schemes); ambiguity default-to-conservative rule and CPA/attorney escalation added; the §643(b) refusal case written as a worked example |
| `skills/security-sweep.md` | Full restructure; all precedents preserved (`POST /api/tax-law/update`, Congress.gov 403-swallowing, vibe-code recurrence watch); added private-escalation protocol for live vulnerabilities and rotate-then-scrub secrets rule |
| `skills/the-setup.md` | Full restructure; **`npm test` DB wipe promoted to a warn-and-confirm gate**; post-wipe re-seed made an unprompted follow-up; failure table for the four common env symptoms |
| `agents/developer-assistant.md` | Two stale links fixed (`../ce/Phase%20VI - Development/` → `../Development/`; `../ce/SOW/...` → `../SOW/...`) |
| `PRD/milestone-prd-template.md` | Was **empty (0 bytes)** while referenced by README as a key template — filled with a milestone-PRD structure consistent with `system-prd-template.md`, with a header note recommending upstream sync if a canonical version exists |

## 4. Skills merged, split, or archived

**None.** Considered and rejected:

- *Merging* `security-sweep` into the framework's adversary/quality-gate security items — rejected: different altitude (repo-specific boundaries vs. generic review); cross-references added instead.
- *Archiving* the empty `User Stories/` and `Change Workflow/` folders — rejected: README references them; repaired with content instead (see §7).
- *Splitting* `council.md` (597 lines) — recommended upstream, not done locally (vendored file).

## 5. Templates created (8, under `docs/templates/`)

`ai-skill-template.md` (the provided structure, plus "write None. rather than deleting sections" and perishable-assumption dating) · `agent-instruction-template.md` (persona pattern with must-not-call tool lists, modeled on the framework's best existing practice) · `workflow-template.md` (step/gate/actor tables, rollback, timeboxes) · `prompt-template.md` (CE-frontmatter-compatible; failure behavior + uncertainty marking) · `skill-test-template.md` (executable-by-agent checklist with injected-failure table) · `human-review-checklist-template.md` (provenance/content/consequence checks; named reviewer roles) · `tool-use-rule-template.md` (destructive-effects declaration; known failure modes) · `failure-handling-template.md` (failure-mode table + fail-loudly principles + standard report format).

## 6. Skill tests created (8, under `docs/skill-tests/`)

For the five local skills: `skill-test-the-planner.md`, `skill-test-the-bug-hunter.md`, `skill-test-the-honest-advisor.md`, `skill-test-security-sweep.md`, `skill-test-the-setup.md`. For the three most load-bearing framework behaviors (as contract tests, since the files themselves are vendored): `skill-test-quality-gate.md`, `skill-test-start-ticket.md`, `skill-test-gate-check.md`. Each includes objective, reproducible inputs, expected behavior/output, safety checks, injected-failure checks, ACs, and a last-run log. **None has been executed yet** — first runs are a recommended next action.

## 7. Major improvements made

1. **The tax-domain guardrails are now enforceable policy, not lore.** The Honest Advisor's rules (never invent parameters; debunk-don't-recommend flagged strategies; deterministic scanner; CPA/attorney gates) now have binding grounding language, prohibited-output lists, escalation paths, a worked refusal example, and a test.
2. **Destructive operations gated.** The `npm test` DB wipe is now a warn-and-confirm rule in two skills instead of a parenthetical.
3. **Every local skill is now predictable:** triggers, non-triggers, inputs, outputs, failure handling, validation, ACs, examples — while every original domain fact was preserved.
4. **Broken framework integrity repaired locally:** empty milestone-PRD template filled; missing `User Stories/task-template.md` created; empty `User Stories/` and `Change Workflow/` folders given READMEs that route to the real workflow; stale agent links fixed.
5. **Discoverability layer created:** skill inventory (status per file), local skills README with maintenance rules, and this process-review trail.
6. **Reusable authoring system:** the 8 templates make the next skill/rule/prompt/test consistent by default.

## 8. Items not changed and why

| Item | Why not changed |
|---|---|
| 45 generated `SKILL.md` stubs | Header marks them managed/generated (`pnpm run generate:agent-skills`); hand edits would be overwritten and create generator drift. Improvements routed upstream (review §24). |
| 43 command playbooks' content | Vendored framework authoring copies; the framework's own rule says framework changes belong in the coherence-engine repo. They are also mostly good. Contract tests + upstream recommendations instead. |
| Agent personas (besides link fixes) | Already close to best practice (explicit scope, deny-lists, HITL); documented as strengths. |
| `lib/`, `scripts/`, `.github/`, `.husky/` | Application/tooling code — out of scope per instructions. |
| `create-milestone.md` naming mismatch | A local rename would desync from the server/generator; flagged for upstream instead. |
| Auth-walled Google-Doc/Atlassian links | Removing them loses human value; replacing them needs content owners. Flagged with two options (vendor summaries or mark human-only). |

## 9. Remaining gaps

1. Skill tests unexecuted (no baseline results yet).
2. Upstream items open: stub fallback-to-local-copy, create-milestone rename, single-sourcing the pre-PR gate and invocation matrix, Gate-Check secrets scanning, `ai-review` tool tightening, coverage-metric precision.
3. No decision log or risk log exists (recommended files, review §25).
4. `Testing/`, `CI-CD/`, `Code Review/` guidelines remain stubs deferring to external docs.
5. No CI lint enforcing skill-template structure (a small `scripts/` addition would prevent drift).
6. The tax-domain wording in the Honest Advisor should get a **human tax-professional sign-off** — an AI pass can structure the guardrails but should not be their last reviewer.

## 10. Recommended next pass

In 2–4 weeks of real use: (1) run all 8 skill tests and log results; (2) review which skills actually fired vs. were bypassed, and tighten triggers accordingly; (3) check the perishable facts (base branch, ports, credentials) against reality; (4) file the upstream PRs and then re-sync the vendored copy; (5) extend tests to `commit`/`merge-pr`/`change-apply` (write-heavy commands currently untested); (6) add the skill-structure lint to CI.

## Audit follow-up changes (2026-07-07, second pass)

A skeptical self-audit ([ce-ai-skills-audit.md](ce-ai-skills-audit.md)) verified the first pass's claims **against the real repo** (all referenced paths/scripts/routes/params files confirmed to exist) and found 10 issues, all fixed or explicitly marked:

1. **Contradiction fixed (F1):** the rewritten Planner/Bug Hunter commit workflows omitted the framework's live **CHANGELOG-per-commit** rule — added to both skills' process and acceptance criteria.
2. **Inventory defect fixed (F2):** `pre-flight.md` was listed in two §D rows — deduplicated; inventory change log added.
3. **Executability fixes (F3, F5, F6):** the-setup's validation now names the verified `GET /health` route; `docs/skill-tests/README.md` (runner protocol — fresh session, no answer key in context, human scores, honest logging) and `docs/templates/README.md` (which-template-when index) created; gate-check test T4 restated in an executable form.
4. **Reference fixes (F4):** `skills/README.md` paths converted to correct relative links.
5. **Policy sharpening (F7, F8):** the-honest-advisor's "When Not to Use" made concrete, and the deterministic scanner explicitly declared the **non-AI baseline** that any future AI suggestion layer must sit on top of; the equivalent structural note (AI reviewers run after deterministic gates) added to the inventory's pre-PR gate row.
6. **Assumptions/open questions marked, not smoothed over (F9):** unexecuted facts in the-setup (ports, credentials, wipe behavior) labeled `ASSUMPTION (unexecuted)`; the `changeme123` bootstrap password rotation raised as an `OPEN QUESTION (maintainer)`; the milestone-PRD reconstruction and the tax-professional sign-off remain open from the first pass.
7. **No splits or merges performed:** no local skill is oversized or duplicated; the one oversized file (`council.md`, 597 lines, vendored) stays an upstream recommendation.
8. **No fake work introduced:** all skill-test Last Run tables still honestly read "not yet run."

Files changed in the audit pass: `skills/the-planner.md`, `skills/the-bug-hunter.md`, `skills/the-setup.md`, `skills/the-honest-advisor.md`, `skills/README.md`, `docs/skill-index/skill-inventory.md`, `docs/skill-tests/skill-test-gate-check.md`, `docs/process-review/ce-ai-skills-improvement-summary.md` (this section); created: `docs/process-review/ce-ai-skills-audit.md`, `docs/skill-tests/README.md`, `docs/templates/README.md`.

**Audit verdict:** reusable as an AI project-planning and execution reference, with two caveats — the skill tests are still unexecuted (structural, not empirical, assurance), and disconnected-environment reuse depends on the upstream stub-fallback fix.

## 11. Reuse as a process reference for future projects

This directory now demonstrates a portable pattern: **vendored delivery framework + thin local domain-skill layer + docs/ audit layer.** To reuse on a new project: copy `docs/templates/` wholesale; write 3–6 local skills with the ai-skill template (env/setup, debugging loop, domain-accuracy policy, security boundaries — the four that mattered here will matter almost everywhere); give each a skill test before first use; stand up `docs/skill-index/skill-inventory.md` on day one with the maintenance rule ("change a skill → update its row + test in the same PR"); and keep the split discipline — framework changes go upstream, domain knowledge goes in local skills, and generated files are never hand-edited. The Honest Advisor is the exemplar for any regulated domain: a policy-layer skill with binding source grounding, prohibited outputs, conservative defaults, and named human-review gates.
