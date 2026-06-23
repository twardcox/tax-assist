---
description: PMO management session - orient, gap analysis, spec drift, next-command menu
---

## Task

The user opened a **PMO management loop** session via `/pmo-manage`. Orient the PM/PO to the current project, surface gaps and drift, then recommend the right next command.

## When to use

- After sprint plan exists **or** skip-planning context resolution (`contextResolvedAt`) — project is in **ongoing** planning/delivery
- When the user is not sure which PM-facing playbook to run next
- For a periodic "health check" of specs vs Jira (no Jira mutations unless the user later runs `/new-ticket` → … → `/change-apply` or `jira_sync_specs` as directed elsewhere)

## Authoritative context

- Follow `ce://guidelines/shared` and `ce://guidelines/project-rules` for conventions
- Change workflow: `ce://docs/change-runbook` (or `Docs/GUIDELINES.md` in the project)

## Step 1 - Integrations

- Run `troubleshoot_setup` and summarize blockers
- If Jira is enabled: `jira_status`, then `jira_snapshot` (if saving to a file, use the path your project’s runbook uses - often `Docs/input/` or `reports/`)

## Step 2 - Artifact inventory

- `list_artifacts` - list kinds (sow, prd, epic, milestone, sprint-plan, etc.) and what looks stale or missing
- Identify **sprint plan** or **`project-context.md`** (skip-planning baseline); if neither and no `contextResolvedAt`, the project may still be in the **setup loop** — for skip-planning point to `resolve_project_context`; for greenfield point to phase prompts in `pmo_agent`

## Step 3 - Gap analysis (backlog and specs)

- From `jira_snapshot` / `jira_search_issues` (broad JQL: `project = KEY ORDER BY updated DESC` if snapshot fails)
- For epics and stories, check:
  - Stories without clear epic linkage
  - Epics in `agent-docs/` with no or few matching Jira children
  - `specs/tasks/` (if used) for holes vs open work
- Call out **under-specified** work: missing ACs, missing `read_artifact` targets, or tickets with no spec doc

## Step 4 - Drift analysis (Jira vs agent-docs)

- Compare Jira issue keys and titles to epic and PRD references in `agent-docs/`
- Flag: issues in Jira with **no** corresponding spec section; spec sections (ACs) with **no** ticket; labels/components that do not match milestone intent
- Do **not** mutate Jira in this step - only report. Remediation: `/new-ticket`, `/jira-reconcile-docs`, or `/lightweight-change` (existing-spec edits only) as appropriate

## Step 5 - Recommend next action

Present a **short** summary (bullets) and **one** primary next command with alternates:

| User goal              | Suggest                           |
| ---------------------- | --------------------------------- |
| New sprint is starting | `/sprint-checkin`                 |
| Sprint just ended      | `/sprint-complete`                |
| Fix existing ACs/copy  | `/lightweight-change`             |
| New task/bug/story     | `/new-ticket`                     |
| Milestone boundary     | `/milestone-review`               |
| Full status report     | `/pmo-status` or `project_status` |
| Reconcile ad-hoc Jira  | `/jira-reconcile-docs`            |

**STOP** after the menu unless the user asks to run another playbook in the same session
