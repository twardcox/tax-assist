---
description: CE Change Workflow - Pass A (change impact analysis)
---

## Task

Execute CE Change Workflow - PASS A (Change Impact Analysis). Produce exactly one change-impact-report and one approval checklist. Do not mutate Jira.

## Authoritative Rules

- You MUST follow Docs/GUIDELINES.md exactly (or read ce://docs/change-runbook if the project does not have it yet).
- Jira snapshot is the source of truth for current execution state.
- PASS A MUST NOT mutate Jira (no apply scripts, no status changes).
- PASS A MUST produce exactly ONE output file and must OVERWRITE it (do not append).
- PASS A MUST include exactly ONE approval checklist at the end.
- If required inputs are missing or incomplete, STOP and instruct the user what to do.

## Required Inputs

Must exist:

- Docs/input/change-request.md
- Docs/input/jira-snapshot.json

## Strategic Context Input

Must be used for reasoning:

- Docs/input/project-input.filled.md

## Templates

Must be used as structure guidance:

- Docs/output/change-impact-report.template.md
- Docs/input/change-request.template.md

## Optional Historical Context

Read-only; do not treat as current state:

- Docs/output/05-epics-and-tickets.md

## Output

Only one file:

- Docs/output/change-impact-report.md

---

## Step 0 - Hard Preflight (STOP early if needed)

1. If Docs/input/change-request.md does not exist:

   - Tell the user to create it by copying Docs/input/change-request.template.md
   - Tell them to save it as Docs/input/change-request.md
   - STOP

2. If Docs/input/change-request.md exists but is effectively empty or placeholders only:

   - Tell the user to fill it using Docs/input/change-request.template.md
   - STOP

3. If Docs/input/jira-snapshot.json does not exist:
   - Tell the user to run /new-ticket (user story path) or ensure jira-snapshot.json was generated
   - STOP

---

## Step 1 - Context Alignment

Before analysing impact:

- Read Docs/input/project-input.filled.md to understand:
  - Original goals and non-goals
  - Scope boundaries
  - Architecture assumptions
  - Delivery phases
  - Risk posture
  - Test strategy expectations

Use this document to:

- Identify and explicitly call out any **scope changes** relative to the original project definition
- Highlight where the change-request expands, reduces, or reshapes agreed scope
- Identify which project dimensions are affected (requirements, architecture, delivery, testing)
- Surface potential conflicts with original goals, constraints, or non-goals (do not block them)

Do not:

- Rewrite or replan the project
- Treat this document as current execution state
- Override Jira snapshot with assumptions from this file

---

## Step 2 - Generate Change Impact Report

Create/overwrite Docs/output/change-impact-report.md using the structure in:

- Docs/output/change-impact-report.template.md

Strict rules:

- One report
- One top-level header
- No duplicated sections
- No repeated analysis blocks
- No multiple approval sections

---

## Step 3 - Analysis Rules

For each impacted Jira issue (from snapshot), include:

- Jira Key
- Current Summary
- Current Description quality (Empty / Placeholder / Adequate)
- Current Status + statusCategory
- Classification: KEEP / MODIFY / DEPRECATE / LOCKED / NEW
- Reason tied to change-request.md
- Note if the change impacts: Requirements, Architecture, Delivery Plan, Risk profile, Test strategy

Mutability rules:

- MODIFY and DEPRECATE: only allowed if statusCategory == "To Do"
- LOCKED: statusCategory != "To Do"; must not be modified; if impacted → propose follow-up NEW work

Deprecation (proposal only in Pass A):

- Represent by prefixing title with "[Deprecated]"
- No Jira status changes in Pass A

Quality triage:

- If summary is empty/meaningless (e.g., "ce") or description is empty/placeholder-only:
  - If statusCategory == "To Do": classify as DEPRECATE (proposed) with reason "insufficient detail / no purpose".
  - If statusCategory != "To Do": classify as LOCKED and add NEW follow-up ticket to replace with proper scope.
- For MODIFY items with weak or placeholder descriptions, include "Proposed description update" bullets tied to change-request.md.

---

## Step 4 - Approval Checklist (single instance)

At the very end of the file, include exactly this block and nothing else approval-related:

```markdown
## Approval Checklist

- [ ] PM/Lead approved proposed DEPRECATIONS
- [ ] PM/Lead approved proposed MODIFICATIONS
- [ ] PM/Lead approved NEW tickets/epics
```

Rules:

- Use lowercase [x] when approved
- Do not add any other approval text anywhere else in the file

---

## Final Instructions to User

- Review Docs/output/change-impact-report.md
- Tick the relevant checkboxes ([ ] → [x])
- Then run: /change-pass-b
