---
# Coherence Engine - managed configuration, regenerate with: pnpm run generate:agent-skills
name: council
description: Reporter is the default entry point: `/council` - smart orchestrator (selects specialists + dispatches skills); `/council full` - all four specialists; `/council [agent]` - dispatch to named agent; topic arg - Exploration Council; MCP ce://commands/council
disable-model-invocation: true
---

# CE: `council`

## Agent roster

| Agent           | Invoke with                  | Purpose                                                                                                                         |
| --------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Adversary**   | `/council adversary [scope]` | Penetration-tester - attacks code on first principles; bugs, security, async hazards, no spec context                           |
| **Developer**   | `/council developer [scope]` | Craft review - architecture conformance, abstraction quality, AI slop, naming, convention consistency                           |
| **PMO**         | `/council pmo [scope]`       | Spec traceability - maps every AC and business requirement to the implementation; finds gaps and scope drift                    |
| **Design**      | `/council design [scope]`    | Design-system review - Figma spec fidelity, token usage, Storybook coverage, regressions, outdated patterns                     |
| **Reporter**    | `/council reporter [scope]`  | Post-council orchestrator - analyzes specialist findings, invokes CE skills as warranted, returns enriched results              |
| **Full**        | `/council full [scope]`      | Run all four specialist agents in parallel, then Reporter; combined report with individual verdicts and an overall gate verdict |
| **Exploration** | `/council [topic]`           | Parallel deep-dive into a codebase area using generic investigator agents                                                       |

1. Ensure the **Coherence Engine MCP server** is connected in your AI tool (see https://coherence-engine.fly.dev/docs/ for connection details).
2. Load the canonical playbook text:
   - Call **`resources/read`** with URI **`ce://commands/council`** (plural `commands`), **or**
   - Call **`get_slash_command`** with **`command_name`:** **`council`**
3. Check the argument and route as follows:
   - **No argument** or **file path/glob** - Reporter in **Orchestrator mode**
   - **`full [scope]`** - Reporter in **Dispatch mode** (all four specialists)
   - **`adversary [scope]`** - Reporter in **Dispatch mode** (Adversary)
   - **`developer [scope]`** - Reporter in **Dispatch mode** (Developer)
   - **`pmo [scope]`** - Reporter in **Dispatch mode** (PMO)
   - **`design [scope]`** - Reporter in **Dispatch mode** (Design)
   - **Topic/area-of-interest string** (not a file path, not a known agent name) - Exploration Council
4. Follow the loaded playbook **step by step**. Use Tracker, GitHub, shell, and other tools exactly as the playbook specifies.

## If the resource read fails

- Confirm the MCP server URL and auth.
- Retry with **`get_slash_command`** and `council`.
- **Do not** assume a local copy of this playbook in the project - init does **not** copy playbook bodies; those files live on the **MCP server** and in the **framework** repo for authoring only.

## All commands

All commands load via **`get_slash_command`** with the kebab-case name or from **`ce://commands/{name}`** (see https://coherence-engine.fly.dev/ce/docs/commands.md).
