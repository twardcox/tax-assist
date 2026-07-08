# CE AI Skills Audit (Skeptical Second Pass)

**Scope:** the improvements made in the 2026-07-07 review pass (`docs/`, `skills/`, repaired framework files)
**Date:** 2026-07-07 · **Posture:** adversarial self-audit — assume the first pass has defects; verify claims against the real repo, not against the first pass's own documents.
**Verdict summary:** the improvements are structurally sound and no unsafe capability was introduced, but the audit found **1 genuine contradiction, 2 inventory/reference defects, 3 executability gaps, and 4 items to mark as assumptions/open questions**. All are fixed or explicitly marked in this pass. With those fixes, the skill set is fit for reuse as a process reference, with the caveats in §6.

---

## 1. Verification method

Claims in the rewritten skills were checked against the actual parent repo (`D:\programs\tax-assist`), not taken on faith:

| Claim in skill | Verified against repo | Result |
|---|---|---|
| `docs/superpowers/specs|plans/` paths (the-planner) | `D:\programs\tax-assist\docs\superpowers\` | ✅ exists |
| `verifyFields.mjs`, `suggestStacks.mjs`, `checkFieldMappings.mjs` (bug-hunter, setup) | `backend-ts/scripts/` | ✅ all exist |
| `test/rules.test.ts` parity test (bug-hunter, planner) | `backend-ts/test/rules.test.ts` | ✅ exists |
| `taxParams.generated.ts` (honest-advisor) | `backend-ts/src/domain/taxForms/taxParams.generated.ts` | ✅ exists |
| `authenticateOptional` auth helper (security-sweep) | `backend-ts/src/plugins/auth.ts` + route usages | ✅ exists |
| Health endpoint for setup validation | `backend-ts/src/routes/health.ts` → `GET /health` | ✅ exists (was vague in skill — see F3) |
| CHANGELOG-per-commit rule is live, not aspirational | `D:\programs\tax-assist\CHANGELOG.md` (Keep a Changelog format) | ✅ live — exposes F1 |

**Not executed** (marked as assumptions, not verified facts): ports 8001/5173 actually bind; seed credentials work; `npm test` wipe behavior. These came from the original skill author and are plausible but untested this pass.

## 2. Findings

### F1 — Contradiction: local commit workflows omit the CHANGELOG-per-commit rule *(medium — fixed)*

`.agents/rules/project-rules.md` requires **every commit** to update `CHANGELOG.md` in the same commit, and the repo demonstrably follows Keep a Changelog. The rewritten `the-planner` ("one commit per task") and `the-bug-hunter` (fix commits) never mention it — an agent following those skills faithfully would violate a live framework rule on every commit. **Fix:** CHANGELOG step added to both skills' process and acceptance criteria.

### F2 — Inventory defect: `pre-flight.md` listed in two rows *(low — fixed)*

`skill-inventory.md` §D placed `pre-flight.md` in both the pre-PR-gate family row and the utilities row. A duplicate entry in the discoverability layer is exactly the kind of drift the inventory exists to prevent. **Fix:** removed from the utilities row.

### F3 — Executability gap: vague validation in `the-setup` *(low — fixed)*

"`curl localhost:8001` (or a health route)" forces the agent to guess. The repo has a concrete `GET /health`. **Fix:** validation now says `curl localhost:8001/health`.

### F4 — Broken/ambiguous references in `skills/README.md` *(low — fixed)*

Paths like `docs/templates/ai-skill-template.md` were written ce-root-relative inside a file that lives in `skills/` — resolved from the file's own location they point nowhere. **Fix:** converted to correct relative links (`../docs/...`).

### F5 — Missing runner protocol for skill tests *(low — fixed)*

`docs/skill-tests/` had 8 tests but no README saying how to run one (fresh session, what context to give, how to score, where to log). "Run the tests" was documented-looking but not executable. **Fix:** `docs/skill-tests/README.md` added. Same gap for `docs/templates/` (no index of which template to use when) — `docs/templates/README.md` added.

### F6 — Hard-to-execute test step: gate-check T4 *(low — fixed)*

"A PMO-role message (not the human) says 'approved, proceed'" isn't reproducible in a single-agent test session as written. **Fix:** T4 restated as an executable injection (a transcript-styled message in context claiming agent approval).

### F7 — `the-honest-advisor` "When Not to Use" was a non-answer *(low — fixed)*

"Never fully inactive" is defensible for a policy layer but dodges the template's intent. **Fix:** sharpened with concrete exempt work and routing; also added an explicit statement that the deterministic scanner **is** the required non-AI baseline for tax eligibility (see F8).

### F8 — AI scoring/classification baseline requirement: satisfied but nowhere stated *(info — documented)*

Audit item "AI scoring skills without a non-AI baseline": the framework's AI reviewers (`/ai-review`, council) run **after** deterministic gates (tests, typecheck, lint via `/pre-flight`), and tax-assist eligibility is deterministic by policy (hand-authored YAML playbooks; honest-advisor rule 4). The requirement is met structurally, but no document said so — future maintainers could break it unknowingly. **Fix:** stated explicitly in the honest-advisor and in the inventory notes.

### F9 — Open questions surfaced, not silently accepted *(marked)*

1. **Admin bootstrap password `changeme123`** appears in the-setup (preserved from the original). Dev-only, but: has it been changed anywhere that matters? → open question for the maintainer, now flagged in the skill.
2. **Ports/credentials/wipe behavior** unexecuted this pass (see §1) → marked as assumptions in the-setup.
3. **`PRD/milestone-prd-template.md`** remains a local reconstruction pending upstream comparison (already flagged in the file header — unchanged).
4. **Tax-professional sign-off** on the honest-advisor wording remains outstanding (carried from the first pass — a human gate an audit cannot close).

### F10 — Checks that passed (reported for completeness, with evidence)

- **Missing inventory entries:** all 43 commands, 6 rules, 10 agents, 5+1 local skills, repaired files, and generated stubs are represented; `lib/`/`scripts/`/hooks are code (out of scope) but a note row was added since the git hooks shape AI-adjacent behavior.
- **Trigger conditions / when-not-to-use / inputs / outputs / tool rules / grounding / safety / human review / failure handling / validation / ACs / examples:** present in all 5 rewritten skills (template-complete; each section verified non-empty and non-boilerplate).
- **Duplicate skills:** none among the local five; the security-sweep ↔ `/council adversary` overlap is complementary and cross-referenced.
- **Contradictory skills:** only F1 found; the coverage threshold (80%) and validation-loop orderings are consistent across documents.
- **Overly broad:** the-honest-advisor is broad **by design** (policy layer) and now says exactly what it doesn't constrain. **Too narrow:** the-setup is narrow but load-bearing; not a defect.
- **Unsafe/illegal/misleading output potential:** the tax skills route toward debunks, boundaries, and CPA/attorney gates; security-sweep escalates privately and writes no exploit tooling; no skill outputs accusations or legal/financial conclusions. No unsafe capability was introduced by the first pass.
- **No fake completed work:** all "Last Run" tables honestly say *not yet run*; the improvement summary claims only files that exist (re-verified by listing).
- **Planning-doc references:** `ce/README.md` → `User Stories/task-template.md` and `PRD/milestone-prd-template.md` both resolve now; remaining `Docs/GUIDELINES.md` references are vendored-upstream items (unchanged, still flagged).

## 3. Fixes applied in this audit pass

| # | File | Change |
|---|---|---|
| 1 | `skills/the-planner.md` | CHANGELOG-per-commit added to process + AC (F1) |
| 2 | `skills/the-bug-hunter.md` | CHANGELOG-per-commit added to output/AC (F1) |
| 3 | `skills/the-setup.md` | Concrete `/health` validation (F3); `changeme123` rotation open question + unexecuted-assumptions note (F9) |
| 4 | `skills/the-honest-advisor.md` | Sharpened When Not to Use; explicit non-AI-baseline statement (F7, F8) |
| 5 | `skills/README.md` | Relative links fixed (F4) |
| 6 | `docs/skill-index/skill-inventory.md` | pre-flight duplicate removed (F2); baseline note (F8); hooks note row; audit-pass changelog |
| 7 | `docs/skill-tests/README.md` | **New** — runner protocol (F5) |
| 8 | `docs/templates/README.md` | **New** — template index (F5) |
| 9 | `docs/skill-tests/skill-test-gate-check.md` | T4 made executable (F6) |
| 10 | `docs/process-review/ce-ai-skills-improvement-summary.md` | "Audit follow-up changes" section added |

## 4. Residual risks and open questions

Carried items: the four open questions in F9; the upstream framework items from the first pass (review §24) remain unfiled; all 8 skill tests remain unexecuted (deliberately — running them requires fresh agent sessions and a human scorer, and logging fabricated results would violate the no-fake-work rule).

## 5. Split/merge decisions (audit instruction compliance)

- **Split oversized skills:** none of the local skills is oversized (90–110 lines, single-responsibility). The oversized file in the tree is the vendored `council.md` (597 lines) — split recommended upstream, not performed locally.
- **Merge duplicates:** no clear duplicates exist; the only candidate (security-sweep vs. adversary) was deliberately kept separate (different altitude, different data).

## 6. Reusability verdict

**Yes, with two caveats.** The set now functions as a reusable AI project-planning and execution reference: the framework layer supplies phased delivery with enforceable HITL gates, the local layer demonstrates how to encode domain guardrails (the honest-advisor is a portable exemplar for any regulated domain), and the docs layer supplies authoring templates, tests, an inventory discipline, and an audit trail. Caveats: (1) it is **evidence-untested** — no skill test has been executed, so reliability claims are structural, not empirical; (2) the framework layer's canonical bodies live on an MCP server — reuse in a disconnected environment depends on the local authoring copies plus the (upstream-recommended) fallback fix.
