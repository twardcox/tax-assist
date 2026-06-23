# Agents

Reference documentation for AI agent roles in the Coherence Engine framework. **This is the single source of truth** for agent definitions - used by prompts, rules, and docs.

**Audience: humans** - for understanding and designing agent behavior. Operational tooling (MCP tools, prompts, slash commands) lives at [github.com/assembleinc/coherence-engine](https://github.com/assembleinc/coherence-engine).

---

## Canonical Agent List

| File                                               | Prompt                                                                            | Scope                                                                                     |
| -------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [pmo-assistant.md](./pmo-assistant.md)             | `pmo_agent`                                                                       | **Planning client** (e.g. Cowork) - all PM docs, ticket planning                          |
| [developer-assistant.md](./developer-assistant.md) | `developer_agent`                                                                 | **Dev client** (recommended: Cursor) - code, tests, PRs; read-only on planning artifacts  |
| [gate-check.md](./gate-check.md)                   | `gate_check_pre_sow` / `gate_check_phase_transition` / `gate_check_validate_only` | Document validation, security scan, HITL handoff                                          |
| [ambient-assistant.md](./ambient-assistant.md)     | `ambient_agent`                                                                   | **Any client** - social/behavioral cues at session start; brief read-only project context |
| [design-assistant.md](./design-assistant.md)       | `design_agent` \| `design_validate_epic` \| `design_validate_ticket`              | **Any client** - design spec and design-system readiness; `/design-review`                |

## Council Sub-Agents

Specialist agents invoked via `/council <name>`. See [council/README.md](./council/README.md).

| File                                           | Command              | Role                                                                     |
| ---------------------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| [council/adversary.md](./council/adversary.md) | `/council adversary` | Attacks source code independent of spec - bugs, security, error handling |
| [council/developer.md](./council/developer.md) | `/council developer` | Craft review - architecture conformance, abstraction quality, AI slop    |
| [council/pmo.md](./council/pmo.md)             | `/council pmo`       | Spec traceability - maps ACs and business requirements to implementation |
| [council/designer.md](./council/designer.md)   | `/council design`    | Design-system review - Figma spec, tokens, Storybook, regressions        |

---

## URIs

Each agent is served as `ce://agents/{name}` (e.g. `ce://agents/pmo`). Prompts load these at boot.

---

## Relationship to CE

- **PMO** - **Planning client** (e.g. Cowork). **Setup loop:** planning phases. **Management loop:** ongoing (specs vs tickets, `/pmo-manage`, `/sprint-checkin`, `/lightweight-change`, etc.). See [pmo-assistant.md](./pmo-assistant.md) § two operating loops. Creates and updates all planning artifacts; ticket planning sync; scope changes. Does not run HITL or validate inputs.
- **Developer** - **Implementation client** (recommended: Cursor). Code, tests, PRs; reads specs only - does not save or rewrite `agent-docs/` / `output-docs/`. Does not run HITL.
- **Gate-Check** - Document validation, security scan, HITL handoff; agent of record for `Output Approved.` Does not create specs or code.
- **Ambient** - Conversational cues (greetings, check-ins, sign-offs) at session start; read-only orientation via `get_next_steps` / `project_snapshot`. Does not create artifacts, run phases, or block other agents.
- **Design** - Spec and design-system readiness (states, accessibility, Figma alignment) before development; `/design-review`. Read-only on planning artifacts; escalates gaps to PMO. Does not implement code or accept `Output Approved.`
- **Maintainer** - Framework evolution (templates, guidelines, commands); **cross-tool normalization** (keeps `.claude/` and `.cursor/` directories in sync). Auto-invoked in the coherence-engine repo. Does not run project work or HITL.

Each agent's oversight is limited to its domain; see the **Oversight (Limited Scope)** section in each agent file.

---

## Cross-Tool Normalization

CE must behave identically in Claude Code, Cursor, Gemini CLI, GitHub Copilot CLI, Codex, and any future AI tools. The Maintainer is responsible for maintaining parity across tool-specific directories.

**Canonical config:** `agent-tools-sync.json` - defines all tool mappings, generation targets, and `init_project` copy rules.

| Directory              | Tool(s)                                    | Type                                                       |
| ---------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| `ce/.claude/skills/`   | Claude Code                                | Generated + hand-authored                                  |
| `ce/.cursor/skills/`   | Cursor                                     | Generated + hand-authored                                  |
| `ce/.agents/skills/`   | Gemini CLI, Copilot CLI, Codex, `gh skill` | Generated + hand-authored (cross-tool alias)               |
| `ce/.claude/rules/`    | Claude Code                                | Hand-authored `.md`                                        |
| `ce/.cursor/rules/`    | Cursor                                     | Hand-authored `.mdc`                                       |
| `ce/.agents/rules/`    | Gemini CLI, Copilot CLI, Codex, `gh skill` | Hand-authored `.md` (tool-agnostic)                        |
| `ce/.claude/commands/` | Claude Code                                | Authoring source (planning phases)                         |
| `ce/.cursor/commands/` | Cursor                                     | Authoring source (Phases VI–IX)                            |
| `ce/.agents/commands/` | Gemini CLI, Copilot CLI, Codex, `gh skill` | Full union - all phases I–IX (cross-tool authoring source) |

All commands are served via MCP (`ce://commands/{name}`) and are accessible from any tool. Skill files are thin loaders pointing to the same MCP server resources. See the Maintainer Agent definition (`ce://agents/maintainer`) for the full sync checklist.

---

## Contribution

When adding or changing an agent, update its `.md` file here and any prompt that loads it. Keep this list in sync with `get_recommended_agent` and agent-invocation rules.
