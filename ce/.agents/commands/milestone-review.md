---
description: Mid- or end-of-milestone - compare Jira to Milestone PRD, update spec, flag extensions
---

## Task

The user invoked `/milestone-review`. Use at **mid-milestone** checkpoints or at **milestone close** in the **management loop** to align the Milestone PRD and Jira with reality.

## Step 1 - Load milestone context

- Ask the user which milestone (id or name) if not obvious from the conversation
- `read_artifact` the **Milestone PRD** for that milestone (from `list_artifacts` - `kind: milestone` or name pattern from PRD/III)
- Optionally `read_artifact` **System PRD** for shared constraints

## Step 2 - Jira slice for this milestone

- `jira_snapshot` or `jira_search_issues` with JQL scoped to the milestone (epic, `fixVersion`, or label your project uses - example: `fixVersion = "M1" AND project = KEY`)
- Classify: Done / In Progress / To Do / Blocked; note spillover to the next milestone

## Step 3 - Compare PRD to delivery

- For each major deliverable in the Milestone PRD, map to Jira epics/stories: done vs not
- Flag: PRD items with **no** Jira; Jira work **not** in the PRD (drift)
- If dates are in the PRD, compare to actual closure or expected completion

## Step 4 - Update the Milestone PRD (as needed)

- `save_artifact` updates to the Milestone PRD to reflect:
  - **Status** section: what completed, what moved, new risks
  - **Revised** dates or scope with explicit rationale
  - Links to the relevant Jira keys
- If the change is **new scope** (new epics or re-baselining major outcomes), do **not** only patch the PRD - point the user to `/new-ticket` (user story) for the change workflow, then re-run this review

## Step 5 - Optional output-docs

- If the org uses `.docx` HITL: after PM approves, generate review copy the same way other phases do (e.g. pandoc or server `save_artifact` for docx)

## Step 6 - Communicate

- One-page style summary: health (green/yellow/red), top 3 risks, top 3 actions
- **STOP**
