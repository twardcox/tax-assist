---
description: Kick off a new CE project - directory layout, config, instruction files, and optional tracker/GitHub wiring
argument-hint: [project-name]
allowed-tools: all
---

## Task

Onboard a **brand-new project** onto the CE workflow. This is the planning-side companion to `/init-project` (which installs the developer bundle). Standalone - no MCP server required.

## Steps

1. **Run `/init-project` first** if the bundle isn't in the repo yet (it copies `ce/`, skills, rules, scripts, hooks, and creates `.ce-project.json`).

2. **Create the planning layout** at the project root:

   - `research/` - SOW+ inputs (briefs, architecture notes, interviews)
   - `agent-docs/` - spec artifacts (SOW+, PRDs, milestones, epics)
   - `output-docs/` - polished documents for human sign-off
   - `reports/` - status reports, traceability, audits
   - `specs/tasks/` - per-ticket implementation specs

3. **Create the instruction file(s)** from `ce/templates/` for the AI tools the project will use, and fill in the project specifics (stack, commands, structure).

4. **Tracker (optional).** If the project uses Jira/GitHub Issues/Linear/etc., record it in `.ce-project.json` (`toolkit.jira.projectKey`, `ticketPattern`, and set `toolkit.hooks.commitMsg.requireTicket: true` if commits must reference tickets). If there is no tracker, skip - specs in `agent-docs/` and `specs/tasks/` are the backlog of record.

5. **GitHub (optional).** Confirm `gh auth status` works if the workflow will open PRs with `gh`. Copy the CI workflows from `ce/.github/workflows/` if wanted, adjusting package-manager commands.

6. **Start the spec chain:** put inputs in `research/`, then run `/quality-gate pre-sow` and begin the SOW+ per `ce/SOW/GUIDELINES.md`.

## Rules

- Planning artifacts live in the repo (`agent-docs/`, `output-docs/`) unless the team explicitly chooses another store.
- Do not invent extra layout directories - the five above are the standard set.
- The full phase order and templates are indexed in `ce/README.md`.
