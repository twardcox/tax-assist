---
description: Weekly, bi-weekly, or daily team snapshot - PRs, Jira by assignee, blocked, next-up per contributor
argument-hint: [daily|weekly|bi-weekly]
allowed-tools: all
---

## Task

The user invoked **`/project-snapshot`**. Produce a **cadence snapshot** for PM/standups: **open PRs**, **recently merged PRs**, **Jira** issues with **assignees**, **blocked** work, and **next ticket up** per contributor - lighter than the full **`project_status`** audit.

## What to do

1. **Invoke the MCP prompt** **`project_snapshot`** with:

   - **`cadence`:** from **`$ARGUMENTS`** - `daily`, `weekly`, or `bi_weekly` (`bi-weekly` → `bi_weekly`). Default **`weekly`** if unset.
   - **`include_jira`** / **`include_github`:** default **true** unless the user skips one.

2. **Follow the loaded prompt** - **`show_project_config`** first; then GitHub tools (**`github_list_open_prs`**, **`github_list_recent_merged_prs`**), then Jira (**`jira_snapshot`**, **`jira_search_issues`** for blocked and next-up); finish with **`save_report`** under **`reports/`**.

3. **If the prompt is not available**, use **`getPrompt`** / **`project_snapshot`** or mirror the steps from the MCP server's prompt text.

## Rules

- **Blocked** and **next-up** JQL must match this project's workflow (status names, flags, backlog ordering).
- This snapshot **does not** replace **`project_status`** for phase completion / token audits.

## Output

One markdown file in **`reports/`** for the chosen cadence (standup, weekly email, or stakeholder update).
