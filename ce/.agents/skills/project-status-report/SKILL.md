---
name: project-status-report
description: Generates the CE cross-phase project status report (Tracker, artifacts, spec quality, traceability, token usage, optional GitHub) and saves markdown under reports/. Use when the user asks for a project status report, final PMO report, cross-phase status, or token usage audit after planning phases complete; or when Tracker_snapshot fails and the report must still include Tracker via Tracker_search_issues.
disable-model-invocation: true
---

# CE: `project-status-report`

## Load the playbook (local)

The canonical playbook for this skill lives **in this repo**:

1. Read `ce/.agents/commands/project-status-report.md`.
2. Follow it **step by step**. Use the tools it names; where a named tool or MCP prompt is unavailable, use the playbook's manual fallback path (or say the step cannot be run — do not improvise a different workflow).

## If the playbook file is missing

Report the missing path to the user and stop. There is no server or upstream copy to fall back to — `ce/.agents/commands/` is the single source of truth.
