---
# Coherence Engine - managed configuration, regenerate with: pnpm run generate:agent-skills
name: troubleshoot-setup
description: Diagnose CE server setup: call troubleshoot_setup MCP tool directly (no arguments); reports what is configured, what is missing, and exact fix steps
disable-model-invocation: true
---

# CE: `troubleshoot-setup`

## Load the playbook (MCP)

1. Ensure the **Coherence Engine MCP server** is connected in your AI tool (see https://coherence-engine.fly.dev/docs/ for connection details).
2. Load the canonical playbook text:
   - Call **`resources/read`** with URI **`ce://commands/troubleshoot-setup`** (plural `commands`), **or**
   - Call **`get_slash_command`** with **`command_name`:** **`troubleshoot-setup`**
3. Follow the loaded playbook **step by step**. Use Tracker, GitHub, shell, and other tools exactly as the playbook specifies.

## If the resource read fails

- Confirm the MCP server URL and auth.
- Retry with **`get_slash_command`** and `troubleshoot-setup`.
- **Do not** assume a local copy of this playbook in the project - init does **not** copy playbook bodies; those files live on the **MCP server** and in the **framework** repo for authoring only.

## All commands

All commands load via **`get_slash_command`** with the kebab-case name or from **`ce://commands/{name}`** (see https://coherence-engine.fly.dev/ce/docs/commands.md).
