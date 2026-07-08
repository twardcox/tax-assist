# Change Workflow

Scope changes and new work items at any phase run through the **CE change workflow** commands, not ad-hoc spec edits.

## The workflow

1. **`/new-ticket`** — entry point. Asks type: **task/bug** (quick path) or **user story** (full workflow).
2. For user stories, **`/change-pass-a`** (change impact analysis + approval checklist) and **`/change-pass-b`** (generate `updated-epics-and-tickets.md`) run automatically.
3. **`/change-apply`** — dry-run, then apply to Jira, `agent-docs/`, and `output-docs/`.

For minor edits to **existing** specs (AC wording, copy) with **no new scope**: `/lightweight-change` instead.

## Canonical runbook

The commands require following the change runbook exactly. Resolution order:

1. `Docs/GUIDELINES.md` in the consuming project (if the project has one)
2. MCP resource **`ce://docs/change-runbook`** (server-side canonical)

> **Note (2026-07-07 review pass):** this folder was empty and neither source exists locally in this reference copy — the runbook lives on the CE MCP server. If both sources are unreachable, stop and tell the user; do not improvise a change process (see `docs/process-review/ce-ai-skills-review.md` §11.5).

## Ownership

Change application is **PMO-owned in the planning client**. The dev client is read-only on planning artifacts (`.agents/rules/project-rules.md`) — implementation-side spec gaps are documented in the ticket/PR and handed to PMO.
