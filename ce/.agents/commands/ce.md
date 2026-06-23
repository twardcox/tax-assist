---
description: CE skills help - lists all available Agent Skills (like --help for the framework)
argument-hint:
allowed-tools: all
---

## Task

The user invoked **`/ce`**. Show the full CE Agent Skills catalog - like running `tool --help`.

## Steps

1. Call **`resources/read`** with URI **`ce://skills`** to get the live skills index.
2. Present the catalog grouped by category (see groupings below).
3. For each skill, show the **name** (as `/name`) and the **description** from the index.
4. If the user has a specific goal, point them to the one most relevant skill.

## Catalog groupings

Use these categories when displaying the skills. Match by name prefix/pattern:

**CE**

| Skill        | Purpose                                 |
| ------------ | --------------------------------------- |
| `/ce`        | This help screen                        |
| `/ce-status` | Server and project configuration status |

**Setup and config**

| Skill                 | Purpose                                                   |
| --------------------- | --------------------------------------------------------- |
| `/init-project`       | Development init - copy rules, skills, scripts, CI, hooks |
| `/sync`               | Pull framework bundle and update repo files               |
| `/update-config`      | Edit `.ce-project.json`                                   |
| `/new-project`        | Create a new CE project (Cowork / planning client)        |
| `/troubleshoot-setup` | Diagnose server setup issues                              |

**Planning (planning phases)**

| Skill                             | Purpose                          |
| --------------------------------- | -------------------------------- |
| `/create-product-requirement-doc` | System PRD from SOW+             |
| `/create-milestone-prd`           | Milestone PRDs                   |
| `/breakdown-milestone`            | Milestone → tasks                |
| `/create-prd-tickets`             | Ticket JSON for a milestone      |
| `/quality-gate`                   | Phase transition checklist       |
| `/spec-validate`                  | Validate specs before HITL       |
| `/milestone-status`               | Milestone progress               |
| `/sprint-complete`                | Sprint wrap-up                   |
| `/sprint-checkin`                 | Start-of-sprint check-in         |
| `/pmo-manage`                     | PMO management session           |
| `/pmo-status`                     | Full project status report       |
| `/milestone-review`               | Milestone mid/end review         |
| `/lightweight-change`             | Edits to existing spec docs only |

**Tickets and scope change**

| Skill            | Purpose                                                            |
| ---------------- | ------------------------------------------------------------------ |
| `/new-ticket`    | Create task/bug (quick) or user story (full scope-change workflow) |
| `/change-apply`  | Apply reviewed scope changes to Jira + docs                        |
| `/change-pass-a` | Scope-change step: impact analysis                                 |
| `/change-pass-b` | Scope-change step: updated backlog proposal                        |

**Development (Phases VII–IX)**

| Skill                 | Purpose                                     |
| --------------------- | ------------------------------------------- |
| `/start-ticket`       | Pick next ticket, branch, scope             |
| `/council`            | Multi-agent exploration of unfamiliar code  |
| `/pre-flight`         | Lint, format, types, tests                  |
| `/test-coverage`      | Improve or add tests                        |
| `/architecture-check` | Validate against architecture               |
| `/design-review`      | Pre-implementation and pre-PR design review |
| `/ai-review`          | Pre-PR structured code review               |

**Git and PR**

| Skill                       | Purpose                                                   |
| --------------------------- | --------------------------------------------------------- |
| `/commit`                   | Conventional commit (auto sequential-commit at 15+ paths) |
| `/sequential-commit`        | Split work into logical commits                           |
| `/pr-description`           | Generate PR body text                                     |
| `/pull-request`             | Pre-flight, push, open PR, Jira transition                |
| `/merge-pr`                 | Verify CI + reviews and merge                             |
| `/reimplement-clean-branch` | Replay messy branch with clean history                    |
| `/complete-ticket`          | After merge - Done, back to main                          |

**CI/CD (CI/CD)**

| Skill        | Purpose                                    |
| ------------ | ------------------------------------------ |
| `/ci-status` | GitHub Actions pass/fail, logs, next steps |

**Reporting**

| Skill                    | Purpose                         |
| ------------------------ | ------------------------------- |
| `/project-snapshot`      | Daily/weekly PR + Jira snapshot |
| `/project-status-report` | Full cross-phase status report  |

**Jira utilities**

| Skill                  | Purpose                   |
| ---------------------- | ------------------------- |
| `/jira-reconcile-docs` | Reconcile Jira vs CE docs |

## After presenting the catalog

Offer one primary next step. If the user is mid-flow or unsure what to do next, suggest `/ce-status` to check the current project state.

## If the resource read fails

Call **`get_slash_command`** with **`command_name: ce`** or display the static groupings above directly.
