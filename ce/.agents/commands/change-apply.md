---
description: CE Change Workflow - apply approved backlog changes to Jira, agent-docs, and output-docs
---

## Task

Execute CE Change Workflow - APPLY. After a dry-run and explicit user confirmation, apply the approved `updated-epics-and-tickets.md` to Jira, save updated specs to agent-docs, and archive the change record in output-docs.

## Authoritative Rules

- You MUST follow Docs/GUIDELINES.md exactly (or read ce://docs/change-runbook if the project does not have it yet).
- You MUST NOT apply changes without explicit human confirmation.
- Never modify locked tickets (statusCategory != "To Do").
- Never delete issues.
- Never silently change status except the runbook-approved deprecation behavior (if enabled).
- Always dry-run first.

## Inputs (must exist)

- Docs/output/updated-epics-and-tickets.md
- Docs/input/jira-snapshot.json

---

## Step 1 - Preconditions

- If updated-epics-and-tickets.md is missing: STOP and instruct user to run /change-pass-b.

Approval validation (checkbox-only):

- Docs/output/change-impact-report.md must exist.
- Open Docs/output/change-impact-report.md and find the single section titled exactly: "## Approval Checklist"
- Validate approvals as follows (lowercase x only):
  - If DEPRECATIONS checkbox is [x], then deprecations are allowed.
  - If MODIFICATIONS checkbox is [x], then modifications are allowed.
  - If NEW tickets/epics checkbox is [x], then new items are allowed.
- If the Approval Checklist section is missing OR none of the boxes are [x]:
  - STOP and instruct the PM to approve by changing [ ] to [x] (lowercase).

Note: Do NOT use APPROVAL_STATUS / APPROVED_BY / APPROVED_AT. This workflow uses checkbox approval only.

---

## Step 2 - Dry Run

Analyze Docs/output/updated-epics-and-tickets.md against Docs/input/jira-snapshot.json. Summarize:

- epics to create
- tickets to create (Key: TBD)
- tickets to update
- tickets to transition to Done (deprecated only)
- any locked tickets skipped
- any Blocks links to be created

Do not mutate Jira.

---

## Step 3 - Explicit Confirmation

Ask the user exactly:

"Type APPLY to proceed, or anything else to cancel."

STOP and wait for the user response. If user does not type APPLY, do not run apply.

---

## Step 4 - Apply

If and only if user typed APPLY:

- Read Docs/output/updated-epics-and-tickets.md.
- Call `jira_sync_specs` with the markdown content (ensure it follows jira-structure-template format).
- Or use `jira_create_issue`, `jira_update_issue`, `jira_transition_issue` as needed for the changes.

---

## Step 5 - Update Agent-Docs

Save the updated backlog proposal as a permanent spec record:

- Call `save_artifact` with the content of `Docs/output/updated-epics-and-tickets.md`.
  - Use artifact name: `updated-epics-and-tickets` (or a date-stamped variant if a prior copy exists).
- If any new epic or story specs were generated during the change analysis, save each to agent-docs via `save_artifact`.
- Report which artifacts were saved.

## Step 6 - Update Output-Docs

Archive the change decision record:

- Call `save_artifact` with the content of `Docs/output/change-impact-report.md`.
  - Use artifact name: `change-impact-report` (or a date-stamped variant, e.g. `change-impact-report-YYYY-MM-DD`).
- Report which output-doc was saved.

## Step 7 - Refresh Snapshot

- Call `jira_snapshot` and save the result to Docs/input/jira-snapshot.json.
- Report completion and point user to the updated snapshot file. STOP.
