# Workflow Name

<!-- For multi-step, possibly multi-agent workflows (like the change workflow or pre-PR gate).
     A workflow differs from a skill: it sequences skills/commands and defines gates between them. -->

## Workflow ID

kebab-case, stable.

## Goal

The end state this workflow produces, in one sentence.

## Entry Conditions

What must be true before starting (approved artifacts, branch state, config present). List the check for each.

## Actors

| Actor | Role in this workflow |
|---|---|
| Human (role) | approvals, decisions |
| Agent (name) | which steps |

## Steps

| # | Step | Actor | Skill/command used | Output | Gate to next step |
|---|---|---|---|---|---|
| 1 | | | | | |

Every gate states **who** passes it and **what evidence** is required. Steps without gates should say "none" explicitly.

## Human Checkpoints

Where the workflow stops for human input, what is presented, and the exact approval form (e.g., `Output Approved.`).

## Rollback / Abort

How to stop mid-workflow safely at each gate; what gets cleaned up; what must be reported.

## Failure Handling

Per step: likely failure → detection → retry/skip/abort decision rule → escalation.

## Timeboxes

Expected duration per step; what to do when a step exceeds it (report, don't silently grind).

## Outputs and Records

Artifacts produced, where they live, and what audit trail remains (reports, logs, checkpoint records).

## Acceptance Criteria

Testable statements that the workflow completed correctly.

## Change Log

| Date | Change | Author |
|---|---|---|
