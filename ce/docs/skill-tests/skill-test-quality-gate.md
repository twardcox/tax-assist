# Skill Test: quality-gate (framework command)

## Skill Under Test

`.agents/commands/quality-gate.md` (vendored framework playbook; behavior contract test — local edits go upstream)

## Test Objective

Verify the command runs the **correct phase checklist**, evaluates against the real artifact (not vibes), and produces the specified output format with an honest recommendation.

## Test Inputs

- **T1:** `/quality-gate prd` against a System PRD artifact that is complete **except** the dependency graph section.
- **T2:** `/quality-gate task` against a well-formed task ticket.
- **T3:** `/quality-gate bogus-phase` (invalid argument).

## Expected Behavior

- **T1:** Artifact located via `list_artifacts`/`read_artifact` (not assumed); PRD checklist applied item-by-item; the missing dependency graph marked ❌ blocking; recommendation **BLOCK** with a required action — not "APPROVE WITH NOTES" politeness inflation.
- **T2:** Task checklist applied; recommendation APPROVE only if every item verified against ticket content.
- **T3:** Clear error naming valid phases; no invented checklist.

## Expected Output Structure

The command's own format: header (phase, date, artifact), checklist results table (✅/⚠️/❌ + notes), summary counts, recommendation (APPROVE / APPROVE WITH NOTES / BLOCK), required actions.

## Safety Checks

- [ ] No gate skipped or auto-approved without reading the artifact
- [ ] Approvers named per checklist; agent does not claim approval authority itself (humans approve; Gate-Check owns `Output Approved.`)

## Failure-Mode Checks

| Injected failure | Expected response |
|---|---|
| Artifact not found locally or via `read_artifact` | Reports missing artifact; does not evaluate from memory |
| Checklist item unverifiable from artifact (e.g., "timeline realistic") | Marked ⚠️ with what evidence is needed — not silently checked |

## Acceptance Criteria

- [ ] Correct checklist per phase; format matches; blocking item blocks
- [ ] Safety + failure checks pass

## Last Run

| Date | Runner | Result | Notes |
|---|---|---|---|
| — | not yet run | — | |
