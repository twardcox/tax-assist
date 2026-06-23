# Project Overview

This project uses **Coherence Engine (CE)**. Connect the CE MCP Server so tools and prompts are available.

**Full reference:** <https://coherence-engine.fly.dev/ce/docs/>

## Start Here

Run `get_next_steps` at the start of every session - it identifies your current phase, the recommended agent, and what to do next.

Project config (Jira key, GitHub repo, Google Drive folder) is stored in `.ce-project.json`. Call `get_project_config` to read it.

## Phase Context

- **Planning phases** (SOW+, PRD, Milestones, Epics, User Stories, Sprint Planning): Run in your planning client (recommended: Cowork). Invoke `pmo_agent` to activate the PM/PO Agent. Put research inputs (briefs, architecture notes, interviews) in `research/`. The PMO Agent produces SOW+, PRDs, milestones, epics, and Jira tickets.
- **Development phases** (Development, Testing, Code Review, CI/CD): Run in your dev IDE (recommended: Cursor). Invoke `developer_agent` or use `/start-ticket`. Read specs via `list_artifacts` / `read_artifact`. Task ticket specs: `read_task_spec` / `list_task_specs` (server volume or Drive + disk when configured).

**Gate-check:** Before SOW+ and at every phase transition, the Gate-Check Agent validates and must approve artifacts. Use `gate_check_pre_sow` before starting SOW+ (legacy alias: `gate_check_pre_sow`), and `gate_check_phase_transition` between subsequent phases.

## Agent Skills

Agent Skills are thin MCP loaders copied to `.claude/skills/` (Claude Code) and `.cursor/skills/` (Cursor) by `init_project`. Run `/ce` to list all available skills, or invoke any by name (e.g. `/start-ticket`, `/pre-flight`, `/ai-review`).

## Where Data Lives

- **MCP server (hosted):** `agent-docs/`, `specs/tasks/`, and `.ce-project.json` on the server volume.
- **Google Drive (if linked, local repo):** `research/`, `output-docs/` (`.docx`), `reports/`, and `specs/tasks/` (under Drive folder `specs/tasks/`) - otherwise those paths are on project disk.

## Key Directories

- `research/` - SOW+ inputs (disk or Drive)
- `agent-docs/` - Spec artifacts (SOW+, PRDs, epics) - server when hosted
- `output-docs/` - `.docx` for PM/PO sign-off (disk or Drive)
- `reports/` - Traceability and audits (disk or Drive)
- `specs/tasks/` - Per-ticket implementation specs (server volume, or disk or Drive when local)

## Guardrails

- **Start every session with `get_next_steps`.** It tells you which phase you are in and what to do.
- **Spec artifacts are read-only in the dev client.** Use `list_artifacts` / `read_artifact` only. Do not call `save_artifact`, `apply_scope_changes`, or `jira_sync_specs` - the PMO Agent owns those in the planning client (Cowork).
- **Do not generate framework artifacts here.** SOW+, PRD, milestones, and epics are produced by the PMO Agent via the planning client. This project consumes the framework.
- **Framework changes** (templates, guidelines, commands) belong in the coherence-engine repo, not here.
- **To start SOW+:** Open your planning client (e.g. Cowork), connect the CE MCP Server, run `gate_check_pre_sow`, then invoke `pmo_agent`.
