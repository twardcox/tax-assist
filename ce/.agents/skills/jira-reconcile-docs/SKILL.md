---
name: jira-reconcile-docs
description: Reconcile Jira vs CE docs (agent-docs + specs/tasks); surface out-of-band tickets; optionally annotate + label
disable-model-invocation: true
---

# CE: `jira-reconcile-docs`

## Load the playbook (local)

The canonical playbook for this skill lives **in this repo**:

1. Read `ce/.agents/commands/jira-reconcile-docs.md`.
2. Follow it **step by step**. Use the tools it names; where a named tool or MCP prompt is unavailable, use the playbook's manual fallback path (or say the step cannot be run — do not improvise a different workflow).

## If the playbook file is missing

Report the missing path to the user and stop. There is no server or upstream copy to fall back to — `ce/.agents/commands/` is the single source of truth.
