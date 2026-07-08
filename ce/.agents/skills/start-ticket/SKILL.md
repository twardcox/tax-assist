---
name: start-ticket
description: Ticket lists then 3 Qs (ticket, self/agent, branch); Next Steps + auxiliary
disable-model-invocation: true
---

# CE: `start-ticket`

## Load the playbook (local)

The canonical playbook for this skill lives **in this repo**:

1. Read `ce/.agents/commands/start-ticket.md`.
2. Follow it **step by step**. Use the tools it names; where a named tool or MCP prompt is unavailable, use the playbook's manual fallback path (or say the step cannot be run — do not improvise a different workflow).

## If the playbook file is missing

Report the missing path to the user and stop. There is no server or upstream copy to fall back to — `ce/.agents/commands/` is the single source of truth.
