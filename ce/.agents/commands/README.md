# CE Slash Commands - Product & Planning (Claude)

Cross-tool slash commands for **Coherence Engine** - the **generic/tool-agnostic namespace** compatible with Gemini CLI, GitHub Copilot CLI, Codex, `gh skill`, and any other MCP-capable AI tool that reads the `.agents/` convention.

**All commands are available across all three namespaces** (`.agents/`, `.claude/`, `.cursor/`) with namespace-appropriate content. This namespace covers the full command set with generic wording. For Claude Code–specific versions, see `.claude/commands/`. For Cursor-specific versions, see `.cursor/commands/`.

**Hub commands:** **`/ce`** is the **static** entry point - shows all commands grouped by phase and client (no live status call). **`/ce-status`** (mirrored in the dev client) runs **`get_next_steps`**, prints a **short** phase/status summary, then lists **planning + dev client** slash commands with **suggested next steps** highlighted (`ce://commands/ce-status`).

## Usage

In Claude Code (Cowork), type `/` followed by the command name:

```
/ce
/create-product-requirement-doc MyProject
/breakdown-milestone M1-Foundation
/new-ticket
```

---

## Command Reference

### Discovery & Navigation

| Command      | Description                                                                       | Arguments |
| ------------ | --------------------------------------------------------------------------------- | --------- |
| `/ce`        | Static hub - all commands grouped by phase and client; no live status call        | -         |
| `/ce-status` | Context-aware hub - calls `get_next_steps`, highlights commands for current phase | -         |

### Specification & Planning

| Command                           | Description                                | Arguments          |
| --------------------------------- | ------------------------------------------ | ------------------ |
| `/create-product-requirement-doc` | Create System PRD from SOW+                | `[project-name]`   |
| `/create-milestone-prd`           | Create Milestone PRD from System PRD       | `[milestone-id]`   |
| `/create-prd-tickets`             | Create JSON PRD with tickets for milestone | `[milestone-name]` |
| `/breakdown-milestone`            | Break milestone into atomic tasks          | `[milestone-name]` |

### Sprint Planning - Sprints

| Command            | Description                                                                                                                        | Arguments                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `/sprint-complete` | After a sprint ends - sprint outcomes vs plan + full **`project_status`**-style report; one **`save_report`** under **`reports/`** | `[sprint-name-or-number]` |

### PMO - management loop (active project)

When Sprint Planning planning exists and the project is in **ongoing** delivery, use these (load via `get_slash_command` or Agent Skills; not in the curated `ce://commands` index except where noted).

| Command               | Description                                                                                  | Arguments |
| --------------------- | -------------------------------------------------------------------------------------------- | --------- |
| `/pmo-manage`         | Session start: orient, gap + drift (specs vs Jira), next-command menu                        | -         |
| `/sprint-checkin`     | Start of sprint: carry-over, goals, blockers, sprint plan artifact update                    | -         |
| `/lightweight-change` | Minor edits to **existing** specs (ACs, copy) only - not new scope or new tickets            | -         |
| `/milestone-review`   | Mid- or end-milestone: Jira vs Milestone PRD, update PRD                                     | -         |
| `/pmo-status`         | On-demand full project status to `reports/` (Jira, artifacts, quality, traceability, tokens) | -         |

### Quality & Validation

| Command             | Description                         | Arguments          |
| ------------------- | ----------------------------------- | ------------------ |
| `/quality-gate`     | Run phase transition checklist      | `[phase-name]`     |
| `/spec-validate`    | Validate specification completeness | `[spec-file-path]` |
| `/milestone-status` | Get comprehensive milestone status  | `[milestone-id]`   |

### Jira & Backlog Change (CE Change Workflow)

Run `/new-ticket` to start. For user stories, pass-a and pass-b run automatically; then run `/change-apply` to apply. See `Docs/GUIDELINES.md`.

| Command          | Description                                                                     | Arguments |
| ---------------- | ------------------------------------------------------------------------------- | --------- |
| `/new-ticket`    | Ask type (task/bug/story); quick for tasks+bugs; full workflow for user stories | -         |
| `/change-pass-a` | Change impact analysis, approval checklist (auto-run by `/new-ticket`)          | -         |
| `/change-pass-b` | Generate updated-epics-and-tickets.md (auto-run by `/new-ticket`)               | -         |
| `/change-apply`  | Dry-run then apply to Jira, agent-docs, and output-docs                         | -         |

### Project bootstrap

| Command         | Description                                                                                                                                                                                        | Arguments |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `/new-project`  | **Cowork:** New project - **`init_project`**, then **`setup_project`** / Jira / GitHub / optional Drive (`ce://commands/new-project`).                                                             | -         |
| `/init-project` | **Dev client:** Development - run **`init_project`** before development (`ce://commands/init-project`). Cowork onboarding uses **`/new-project`** (same tool; this playbook is developer-focused). | -         |

### Project Config

| Command          | Description                                    | Arguments              |
| ---------------- | ---------------------------------------------- | ---------------------- |
| `/update-config` | Update .ce-project.json (hooks, CI, agentDocs) | `[section e.g. hooks]` |

### MCP prompts (not slash commands)

Invoke via the MCP client’s **prompts** list (**`ListPrompts`** / **`GetPrompt`**), not `/{name}`.

| Prompt           | Description                                                                                                                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project_status` | Cross-phase status - **Jira board first** (`jira_snapshot` with snapshot JSON in `reports/`), then artifacts, quality, traceability, **token usage**; optional GitHub. Final markdown via **`save_report`** under **`reports/`**. |

---

## Commands by CE Phase

### SOW+

- `/create-product-requirement-doc` - after SOW+ is approved, create the System PRD

### PRD - PRD

- `/create-product-requirement-doc` - create System PRD (if not already done)
- `/create-milestone-prd` - create per-milestone PRDs from System PRD
- `/spec-validate` - validate PRD completeness and quality
- `/quality-gate prd` - PRD approval checklist

### Milestones - Milestones

- `/breakdown-milestone` - decompose a milestone into atomic, testable tasks
- `/create-prd-tickets` - generate the ticket JSON file for a milestone
- `/milestone-status` - track milestone progress and surface blockers
- `/quality-gate milestone` - milestone approval checklist

### Epics–V - Epics & Tasks

- `/spec-validate` - validate epic and task spec completeness
- `/quality-gate epic` - epic approval checklist
- `/quality-gate task` - task approval checklist

### Sprint Planning - Sprints

- **`/sprint-complete`** - after sprint review or when the sprint closes: combined sprint-outcome summary and full project status report (same tooling as **`project_status`**); save to **`reports/`**
- **`/sprint-checkin`** - at sprint **start** (complements **`/sprint-complete`** at sprint end)

### PMO - management loop (any time after initial planning is underway)

- **`/pmo-manage`** - orient and get a recommended next PMO action
- **`/lightweight-change`** - small fixes to **existing** planning docs only; new work → **`/new-ticket`**
- **`/milestone-review`** - align a Milestone PRD with Jira for that milestone
- **`/pmo-status`** - full status report in **`reports/`** (slash workflow; or use MCP prompt **`project_status`**)

### Scope Changes and Ticket Creation (any phase)

- `/new-ticket` - create a task/bug (quick) or user story (full workflow: auto-runs pass-a + pass-b, then `/change-apply`). See `Docs/GUIDELINES.md`.

---

## Command Anatomy

Commands use YAML frontmatter for configuration:

```markdown
---
description: What the command does
argument-hint: [optional-argument]
allowed-tools: Bash(git:*)
model: opus # optional: use specific model
---

## Task

Instructions for the command...
```

### Frontmatter Options

| Field           | Description                             | Example                         |
| --------------- | --------------------------------------- | ------------------------------- |
| `description`   | Short description shown in command list | `"Create System PRD from SOW+"` |
| `argument-hint` | Placeholder for required/optional args  | `[milestone-id]`                |
| `allowed-tools` | Restrict which tools can be used        | `Bash(git:*)`                   |
| `model`         | Use specific model (opus, sonnet)       | `opus`                          |

---

## Creating Custom Commands

1. Create a `.md` file in `.claude/commands/`
2. Add frontmatter with `description`
3. Write task instructions in markdown
4. Use `$ARGUMENTS` to reference user input

Example:

```markdown
---
description: My custom planning command
argument-hint: [milestone-id]
---

## Task

Do something with $ARGUMENTS.

## Steps

1. First step
2. Second step
```

---

## Tips

- Run `/spec-validate` on any artifact before presenting it for HITL approval
- Use `/quality-gate` at every phase transition - don't skip gates
- For scope changes at any phase: `/new-ticket` (user story path) → review summary → `/change-apply` (follow `Docs/GUIDELINES.md`)
- **Management loop (active project):** start with `/pmo-manage` or `/pmo-status`; use `/sprint-checkin` at sprint start; `/sprint-complete` at sprint end
- Chain naturally: `/create-product-requirement-doc` → `/create-milestone-prd` → `/breakdown-milestone` → `/create-prd-tickets`
