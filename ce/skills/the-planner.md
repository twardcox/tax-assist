# The Planner — spec → plan → execute

## Skill ID

`the-planner`

## Purpose

Turn a change request into a written spec and a bite-sized TDD plan, then execute the plan task-by-task with a commit per task. Prevents the two failure modes this repo has actually hit: plans written without reading the real code, and vague plan steps ("TBD") that stall execution.

## When to Use

- Any non-trivial feature, refactor, or multi-file change, before writing code
- Work large enough that "just start editing" risks a wrong-place diff
- When the user asks for a plan, spec, or design first

## When Not to Use

- Single bug with an obvious repro → use `the-bug-hunter`
- Trivial copy/config edits → just make the change with a normal commit
- CE framework/process changes → belong upstream, not in project work (see `.agents/rules/project-rules.md`)

## Inputs Required

- The change request (user message or ticket), with acceptance criteria if they exist
- **The real code the change touches — read it before planning.** Loader recursion, test-parity greps, etc. have bitten planning sessions before. The smallest diff in the wrong place is a second bug. If you can't yet identify the touched code, that discovery is plan step 0 — never an assumption.

## Optional Inputs

- Jira ticket / epic context (`jira_get_issue`, `read_artifact`)
- Prior specs and plans under `docs/superpowers/specs/` and `docs/superpowers/plans/`

## Tools Required

- File read/write, grep, git, test runner. **`npm test` is destructive** (wipes the shared dev DB — see `the-setup`); warn before running it.

## Output

- Spec: `docs/superpowers/specs/YYYY-MM-DD-<name>.md`
- Plan: `docs/superpowers/plans/YYYY-MM-DD-<name>.md`
- Executed work: one commit per plan task on a feature branch

## Process

1. **Brainstorm/design first.** Write the spec: problem, chosen approach, alternatives rejected and why.
2. **Read the real code the change touches** — actual files, not memory of them. Note the current behavior the plan must not break.
3. **Write the plan as bite-sized TDD tasks.** Each task: failing test → run to see it fail → minimal code → run green → commit. **Exact file paths, complete code in every step, no "TBD."**
4. **Get plan approval** from the user before executing (one short approval question).
5. **Execute task-by-task, committing per task on a feature branch.** Do not batch tasks into one commit. **Every commit updates `CHANGELOG.md` in the same commit** (framework rule, `.agents/rules/project-rules.md`; the repo follows Keep a Changelog).
6. If execution proves the plan wrong, stop at the task boundary, amend the plan file, and say what changed — never silently diverge.

## Source Grounding

Plans cite the files and behaviors they are based on. Any tax figures or strategy content in a spec follows `the-honest-advisor` grounding rules (no invented parameters; `taxParams.generated.ts` or cited primary sources only).

## Safety and Compliance

- No implementation before plan approval.
- Tax-content work planned here inherits `the-honest-advisor` review gates (`review_required: cpa/attorney` flags carry into the resulting work).
- Never satisfy a plan step by deleting or weakening a failing test.

## Assumptions

- Mark assumptions in the spec as `ASSUMPTION:` lines.
- **Perishable:** the current working base branch was `audit` when this was written (2026-07). Verify with `git branch --show-current` each session; if the base looks wrong, ask rather than branch.

## Failure Handling

- **Can't locate the touched code** → discovery becomes plan task 0; do not guess paths.
- **Tests already failing before your change** → stop and report; don't build on a red base.
- **A plan step proves impossible mid-execution** → stop at the task boundary, update the plan file, re-confirm with the user.
- **Request out of scope** (pure debugging, framework change) → name the right skill and hand off.

## Validation

- Each task's test was observed failing before the implementing commit and passing after.
- `git log` shows one commit per task, messages matching plan task names.
- The `the-bug-hunter` validation loop (focused vitest → `npm test` → lint → build) is green at completion.

## Acceptance Criteria

- [ ] Spec and plan exist at the dated paths above
- [ ] Plan has zero placeholder steps; all file paths exact; complete code in every step
- [ ] User approved the plan before task 1 executed
- [ ] One commit per task on a feature branch, each updating `CHANGELOG.md`; final validation loop green

## Examples

**Typical:** "Add a new scanner rule." Plan task 1 adds the failing parity test (`test/rules.test.ts` greps for the literal `id: "<rule-id>"` — see `the-bug-hunter`), task 2 adds the rule written exactly `"<id>": (_benefit, facts) => {` in rules.ts, task 3 eligibility tests, task 4 logic.

**Edge case:** A draft plan for benefit-library work assumes flat traversal; reading the real code shows `loadBenefitLibrary` walks ALL of tax_library recursively (skipping non-benefit kinds). Correct behavior: rewrite the plan before approval — this exact class of miss is why step 2 is mandatory.

## Related Skills

`the-bug-hunter` (validation loop, repo gotchas) · `the-honest-advisor` (tax content) · `the-setup` (environment) · framework `/start-ticket` (its agent-led plan/diff HITL protocol is compatible with this loop)

## Change Log

| Date | Change | Author |
|---|---|---|
| 2026-07-07 | Restructured to skill template; all original rules preserved; branch note dated as perishable | AI skills review pass |
