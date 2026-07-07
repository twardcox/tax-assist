# Skill Test: [skill-name]

<!-- Copy to docs/skill-tests/skill-test-<skill-name>.md. A skill test is an executable-by-agent
     checklist: a fresh agent session is given the skill file + the test inputs, and a reviewer
     scores the behavior against this file. -->

## Skill Under Test

Path: `skills/<name>.md` (or command/rule path)
Version/date of the skill file this test was written against:

## Test Objective

What property of the skill this test verifies (trigger correctness, output shape, safety boundary, failure path — pick the one or two that matter most).

## Test Inputs

The exact starting conditions: user message, repo state, files present/absent, config, seeded data. Reproducible — someone else can set this up.

## Expected Behavior

Step-observable behavior: what the agent should do, in order, including questions it should ask and things it should refuse or warn about.

## Expected Output Structure

The shape of the final deliverable (files created at which paths, report sections, message format).

## Safety Checks

Assertions that must hold regardless of the happy path:

- [ ] No prohibited output produced (list the specific prohibitions for this skill)
- [ ] Human-review gates presented where required
- [ ] Destructive commands warned about / not executed without confirmation

## Failure-Mode Checks

For each designed failure path: inject the failure (missing input, dead tool, conflicting sources) and assert the skill's Failure Handling section is actually followed, not improvised around.

| Injected failure | Expected response |
|---|---|
| | |

## Acceptance Criteria

- [ ] All expected behaviors observed
- [ ] Output structure matches
- [ ] All safety checks pass
- [ ] All failure-mode checks pass

## Last Run

| Date | Runner (human/agent+model) | Result | Notes |
|---|---|---|---|
