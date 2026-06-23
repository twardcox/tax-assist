# CE Project Context Templates

These templates are deployed by `init_project` into new CE projects to give AI tools immediate orientation on the CE workflow.

## Templates

| Template file             | Deployed as                       | Tool                           |
| ------------------------- | --------------------------------- | ------------------------------ |
| `CLAUDE-project.md`       | `CLAUDE.md`                       | Claude Code (Cowork)           |
| `GEMINI-project.md`       | `GEMINI.md`                       | Gemini CLI                     |
| `AGENTS-project.md`       | `AGENTS.md`                       | OpenAI Codex CLI / agent tools |
| `copilot-instructions.md` | `.github/copilot-instructions.md` | GitHub Copilot                 |

## Keep These in Sync

All four templates contain the same content. When you update one, update all four.

Checklist for every edit:

- [ ] `CLAUDE-project.md`
- [ ] `GEMINI-project.md`
- [ ] `AGENTS-project.md`
- [ ] `copilot-instructions.md`

## What the Templates Cover

- **Start Here** - `get_next_steps` as the session entry point; `get_project_config` for project config
- **Phase Context** - Planning (I–VI) vs Development (VII–X) split, which client/agent to use
- **Gate-check** - When and how to invoke `gate_check_pre_sow` / `gate_check_phase_transition`
- **Agent Skills** - Location of `.claude/skills/` and `.cursor/skills/`; how to list available skills
- **Where Data Lives** - MCP server volume vs Google Drive vs local disk
- **Key Directories** - `research/`, `agent-docs/`, `output-docs/`, `reports/`, `specs/tasks/`
- **Guardrails** - Spec read-only rule, no framework artifact generation, how to start SOW+
