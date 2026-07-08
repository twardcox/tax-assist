---
name: troubleshoot-setup
description: Diagnose CE server setup: call troubleshoot_setup MCP tool directly (no arguments); reports what is configured, what is missing, and exact fix steps
disable-model-invocation: true
---

# CE: `troubleshoot-setup`

## Load the playbook (local)

The canonical playbook for this skill lives **in this repo**:

1. Read `ce/.agents/commands/troubleshoot-setup.md`.
2. Follow it **step by step**. Use the tools it names; where a named tool or MCP prompt is unavailable, use the playbook's manual fallback path (or say the step cannot be run — do not improvise a different workflow).

## If the playbook file is missing

Report the missing path to the user and stop. There is no server or upstream copy to fall back to — `ce/.agents/commands/` is the single source of truth.
