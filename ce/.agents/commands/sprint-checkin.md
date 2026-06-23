---
description: Start-of-sprint - carry-over, goals, blockers, update sprint plan artifact
---

## Task

The user invoked `/sprint-checkin`. Run at **sprint start** (or the first working day of the sprint) in the **management loop** to align the team on what is in the sprint, what carried over, and what might block delivery.

## Preconditions

- Jira configured (warn if not - still review `agent-docs/`)
- Prefer a current `jira_snapshot` (save under `reports/` or `Docs/input/` if your org uses that path for automation)

## Step 1 - Load sprint and board context

- `jira_status` - sprints, board, quick health
- `jira_snapshot` or `jira_search_issues` with JQL like `sprint in openSprints() AND project = <KEY> ORDER BY rank` (adapt to your Jira)
- `read_artifact` on the latest **sprint plan** in `agent-docs/` (e.g. `sprint-plan.md` or per-sprint name) if present

## Step 2 - Carry-over and capacity

- List items **In Progress** or not Done from the previous sprint that appear in the current sprint
- Note unestimated or oversized items; flag risks to milestone dates
- If story points or capacity are in Jira, summarize whether the sprint looks overloaded

## Step 3 - Sprint goals (collaborate)

- In one message, ask the user (or infer from the sprint plan) for **1–3 sprint goals** in plain language
- Reconcile with Jira: ensure top goals map to specific epics/tickets (names + keys)

## Step 4 - Blockers and dependencies

- List blocked or waiting-on-dependency items from the snapshot
- If epics in `agent-docs/` reference other teams or systems, surface those here

## Step 5 - Update the sprint plan artifact (if needed)

- If goals or scope changed from the file on disk: `read_artifact` the sprint plan, then `save_artifact` with a revised `.md` that:
  - Names the sprint (id + dates)
  - States goals, capacity notes, and carry-over
  - Links Jira issues (keys) for the main body of work
- Do not generate a `.docx` here unless the user asks; PMO can do that in the planning tool when signing off

## Step 6 - Next steps

- Tell the user: implement via Developer in the dev client; PMO can run `/milestone-status` or `/pmo-manage` mid-sprint
- **STOP** unless the user wants `/lightweight-change` to adjust an epic line item
