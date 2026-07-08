# CE Slash Commands (Command Playbooks)

Cross-tool slash-command playbooks for **Coherence Engine** in the tool-agnostic `.agents/` convention (readable by Gemini CLI, GitHub Copilot CLI, Codex, `gh skill`, and any tool that follows it).

**These files are the single source of truth.** The skill stubs in `../skills/` load them by path; when a project needs Claude Code (`.claude/commands/`) or Cursor (`.cursor/commands/`) copies, copy from here and keep them in sync via `/sync`.

**Tracker-neutral:** steps that mention Jira are conditional - run them only when the project configures a tracker in `.ce-project.json`; otherwise note the skip and continue (see `../rules/default.md`).

**Hub commands:** **`/ce`** is the **static** entry point - shows all commands grouped by phase (no live status check). **`/ce-status`** inspects the repo, prints a **short** phase/status summary, then suggests next commands.

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

When sprint planning exists and the project is in **ongoing** delivery, use these (invoke via Agent Skills or read the playbook file directly).

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

Run `/new-ticket` to start. For user stories, pass-a and pass-b run automatically; then run `/change-apply` to apply. Change workflow: the project's `Docs/GUIDELINES.md` when it exists, otherwise `../../Change Workflow/README.md`.

| Command          | Description                                                                     | Arguments |
| ---------------- | ------------------------------------------------------------------------------- | --------- |
| `/new-ticket`    | Ask type (task/bug/story); quick for tasks+bugs; full workflow for user stories | -         |
| `/change-pass-a` | Change impact analysis, approval checklist (auto-run by `/new-ticket`)          | -         |
| `/change-pass-b` | Generate updated-epics-and-tickets.md (auto-run by `/new-ticket`)               | -         |
| `/change-apply`  | Dry-run then apply to Jira, agent-docs, and output-docs                         | -         |

### Project bootstrap

| Command         | Description                                                                                                                                                                                        | Arguments |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `/new-project`  | New project onboarding: planning layout, config, instruction files, optional tracker/GitHub wiring                                                                                                 | `[project-name]` |
| `/init-project` | Adopt the CE bundle into the current repo: copy skills, rules, scripts, CI, hooks; create config and instruction files                                                                             | `[path-to-master-bundle]` |

### Project Config

| Command          | Description                                    | Arguments              |
| ---------------- | ---------------------------------------------- | ---------------------- |
| `/update-config` | Update .ce-project.json (hooks, CI, agentDocs) | `[section e.g. hooks]` |

### MCP prompts (optional server only)

Only relevant when a project connects the optional CE MCP server; invoke via the MCP client's **prompts** list, not `/{name}`. Without the server, use `/pmo-status` or `/project-status-report` instead.

| Prompt           | Description                                                                                                                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project_status` | Cross-phase status - tracker board first, then artifacts, quality, traceability; report saved under `reports/`. |

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

- `/new-ticket` - create a task/bug (quick) or user story (full workflow: auto-runs pass-a + pass-b, then `/change-apply`). See `../../Change Workflow/README.md`.

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
- For scope changes at any phase: `/new-ticket` (user story path) → review summary → `/change-apply` (follow the change workflow in `../../Change Workflow/README.md`)
- **Management loop (active project):** start with `/pmo-manage` or `/pmo-status`; use `/sprint-checkin` at sprint start; `/sprint-complete` at sprint end
- Chain naturally: `/create-product-requirement-doc` → `/create-milestone-prd` → `/breakdown-milestone` → `/create-prd-tickets`
