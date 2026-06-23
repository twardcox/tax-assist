---
# Coherence Engine - managed configuration, regenerate with: pnpm run generate:agent-skills
name: design-review
description: Design readiness (Design Agent); epic/ticket/delivery modes; MCP ce://commands/design-review
disable-model-invocation: true
---

# CE: `design-review`

## Activate Design Agent first

1. Invoke **`design_agent`** (or `design_validate_epic` / `design_validate_ticket` when scope is clear).
2. Load **`ce://agents/design`** for the full checklist and verdict rules.

## Load the playbook (MCP)

3. Ensure the **Coherence Engine MCP server** is connected in your AI tool (see https://coherence-engine.fly.dev/docs/ for connection details).
4. Load the canonical playbook text:
   - Call **`resources/read`** with URI **`ce://commands/design-review`**, **or**
   - Call **`get_slash_command`** with **`command_name`:** **`design-review`**
5. Follow the loaded playbook **step by step** (modes: epic | ticket | delivery).

## Modes

- **Epic** — planning client; UI epic before Gate-Check
- **Ticket** — dev client; before implementation
- **Delivery** — pre-PR gate; optional `/council design` for code fidelity

## If the resource read fails

- Confirm the MCP server URL and auth.
- Retry with **`get_slash_command`** and `design-review`.
- **Do not** assume a local copy of this playbook in the project - init does **not** copy playbook bodies.

## All commands

All commands load via **`get_slash_command`** with the kebab-case name or from **`ce://commands/{name}`** (see https://coherence-engine.fly.dev/ce/docs/commands.md).
