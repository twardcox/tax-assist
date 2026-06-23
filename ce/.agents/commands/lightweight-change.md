---
description: Minor updates to existing planning specs (ACs, copy) - no new scope, no new tickets
---

## Task

The user invoked `/lightweight-change`. Use this for **small, surgical edits** to **existing** planning documents already in `agent-docs/` (or the server volume). This path **does not** create new Jira issues for **new** scope; it does not replace `/new-ticket` for new tasks, bugs, or user stories.

## Allowed (lightweight)

- Tighten or clarify **acceptance criteria** on an existing user story, epic, or task spec
- Fix typos, terminology, or cross-references between sections
- Add a missing **non-scope** note (e.g. testing constraint, link to a doc)
- Regenerate a `.docx` for HITL only when the user asks (via `save_artifact` with docx, if your server supports it for the path)

## Not allowed (stop and redirect)

- **New** user story, epic, or milestone work - use `/new-ticket` (user story) → change pass-a/b → `/change-apply`
- New **Task** or **Bug** in Jira - use `/new-ticket` (Path A)
- Removing a committed scope item without change workflow - use `/new-ticket` and the change runbook
- Anything that changes **multiple** epics in a way that reorders priorities - use `/new-ticket` (user story) or a formal change

If the user is unsure, ask one question: "Is this a clarification of something already in the spec, or new scope?" New scope → `/new-ticket`.

## Step 1 - Target document

- `list_artifacts` to find the right file (epic, milestone prd, sprint plan, system prd)
- `read_artifact` the target(s)

## Step 2 - Apply edits

- Make minimal diffs: preserve structure and headings; keep traceability to existing Jira keys where they appear
- `save_artifact` the updated `.md` with a clear one-line change summary in the session (not in the file unless a changelog is standard in your org)

## Step 3 - Jira

- **Do not** create or transition Jira issues in this command unless the user explicitly asked to sync a description tweak on **one** existing issue that maps 1:1 to the spec line you edited
- If Jira must reflect the text change, prefer `jira_get_issue` + a single focused update, or state that the user should run `/jira-reconcile-docs` for bulk alignment

## Step 4 - Done

- Summarize what changed, what was _not_ changed, and when to use `/new-ticket` next time
- **STOP**
