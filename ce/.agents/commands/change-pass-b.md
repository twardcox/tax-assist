---
description: CE Change Workflow - Pass B (updated backlog proposal)
---

## Task

Execute CE Change Workflow - PASS B (Updated Backlog Proposal). Generate updated-epics-and-tickets.md from the approved impact report. Do not mutate Jira; do not run apply.

## Authoritative Rules

- You MUST follow the change workflow exactly: use the project's `Docs/GUIDELINES.md` when it exists, otherwise `ce/Change Workflow/README.md` in this bundle.
- Jira snapshot is the source of truth for status and existing keys.
- Pass B MUST NOT mutate Jira.
- Pass B MUST generate updated-epics-and-tickets.md in the exact structure required by the importer script.
- Pass B MUST enforce the deprecation convention:
  - Prefix title with [Deprecated]
  - Do not change status in Jira (status changes happen only in apply step if enabled)
  - Do not move deprecated items into a special epic
  - Do not delete anything
- Locked items (statusCategory != "To Do") must not be modified; if impacted, propose follow-up tickets instead.

## Inputs (must exist)

- Docs/output/change-impact-report.md
- Docs/input/jira-snapshot.json

## Structure Template

Must be used as the output schema:

- Docs/template/jira-structure.template.md

## Optional Context (read-only)

- Docs/input/project-input.filled.md
- Docs/output/05-epics-and-tickets.md (historical baseline only)

## Output

Only this file:

- Docs/output/updated-epics-and-tickets.md

---

## Step 1 - Preconditions

- If change-impact-report.md is missing: STOP and instruct user to run /change-pass-a.
- If jira-snapshot.json is missing: STOP and instruct user to run /new-ticket (user story path) or ensure jira-snapshot.json was generated.

Approval validation (checkbox-only):

- Open Docs/output/change-impact-report.md and find the single section titled exactly: "## Approval Checklist"
- Validate approvals as follows (lowercase x only):
  - If DEPRECATIONS checkbox is [x], then deprecations are allowed.
  - If MODIFICATIONS checkbox is [x], then modifications are allowed.
  - If NEW tickets/epics checkbox is [x], then new items are allowed.
- If the Approval Checklist section is missing OR none of the boxes are [x]:
  - STOP and instruct the PM to approve by changing [ ] to [x] (lowercase).
- Do NOT use APPROVAL_STATUS / APPROVED_BY / APPROVED_AT (they are not used in this workflow).

---

## Step 2 - Generate Updated Backlog Proposal

Create/overwrite Docs/output/updated-epics-and-tickets.md. Use Docs/output/jira-structure.template.md as the exact schema (do not invent a new format; match headings and field labels exactly).

Ticket key rules:

- Existing issues MUST keep their real Jira keys (from jira-snapshot.json).
- New issues MUST use: Key: TBD
- Do not invent keys like PROJ-001.

Status-aware rules:

- MODIFY: only if statusCategory is "To Do" AND the MODIFICATIONS approval box is [x]
- DEPRECATE: only if statusCategory is "To Do" AND the DEPRECATIONS approval box is [x]; apply by prefixing the ticket title with [Deprecated]; for deprecated items, do NOT update other fields (description, scope, etc.) in the proposal.
- LOCKED items: keep unchanged in the proposal; if impacted by the change request, add NEW follow-up tickets (Key: TBD) rather than modifying locked tickets.

Epic rules:

- Only include epics you actually want created/managed.
- Do NOT create an "Unassigned / Needs Epic Assignment" epic.
- If an item is intentionally not in an epic, leave it unassigned (do not force it into a placeholder epic).

---

## Step 3 - Stop and Handoff

- Do NOT run jira-change-apply in this command.
- After generating the proposal, instruct the user to run: /change-apply
