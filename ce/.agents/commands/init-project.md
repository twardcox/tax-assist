---
description: Adopt the CE bundle into the current project - copy skills, rules, scripts, CI, hooks, and create config
argument-hint: [path-to-master-bundle]
allowed-tools: all
---

## Task

Set up **this repository** to use the CE workflow bundle. The bundle is self-contained: no MCP server, Jira, or external service is required. Everything the agent needs lives in local files.

**Source of truth:** the user's master bundle - the `ce/` directory in the repo where the canonical copy is maintained. If `$ARGUMENTS` gives a path, use it; otherwise ask the user where their master bundle lives.

## Steps

1. **Copy the bundle** into the project root as `ce/` (docs, playbooks, templates) - the whole directory, preserving structure.

2. **Install the tool-facing pieces** at the project root:

   - `ce/.agents/skills/` → `.agents/skills/` (cross-tool Agent Skills)
   - `ce/.agents/skills/` → `.claude/skills/` when the project uses Claude Code (same content; Claude Code reads `.claude/`)
   - `ce/.agents/rules/` → the client's rules directory (e.g. `.claude/rules/` or `.cursor/rules/ce/`)
   - `ce/.github/workflows/` → `.github/workflows/` **only if wanted** - review each workflow and adjust the package-manager commands to the project first
   - `ce/.husky/` → `.husky/` **only if the project uses husky** - the hooks locate `ce/scripts/hook-runner.cjs` (or `.ce/scripts/` if you install the scripts there) automatically

3. **Create `.ce-project.json`** at the project root (or run `/update-config`). Minimal tracker-neutral config:

   ```json
   {
     "toolkit": {
       "hooks": {
         "preCommit": { "enabled": true, "lintStaged": false },
         "commitMsg": { "enabled": true, "requireTicket": false },
         "prePush": { "enabled": true }
       }
     }
   }
   ```

   Ticket enforcement (`requireTicket`, `branchPattern`) is **opt-in** - only add `toolkit.jira` when the project actually uses a tracker.

4. **Create the project instruction file** from `ce/templates/` (`CLAUDE-project.md` → `CLAUDE.md`, `copilot-instructions.md` → `.github/copilot-instructions.md`, etc. as fits the tools in use). Fill in the project specifics.

5. **Instantiate the local skills.** Copy `ce/skills/` and fill in each skill's **Project Facts** block with this project's real values (ports, commands, credentials-by-name, domain policies). Delete skills that don't apply; add project skills using `ce/docs/templates/ai-skill-template.md`.

6. **Verify:**
   - `node ce/scripts/pre-flight-check.cjs` runs (checks may fail on a fresh repo - the script itself must execute)
   - a test commit passes the hooks (or hooks report "not found - skipping" if intentionally not installed)
   - `/ce` lists the catalog

## Rules

- Do not point the project at any external CE server; the local bundle is canonical.
- Copy, don't symlink - each project owns its copy and may customize it. Improvements worth keeping flow back to the master bundle by hand (see `/sync`).
- Never overwrite an existing `CLAUDE.md`, `.ce-project.json`, or customized skill without showing a diff and confirming.

## Optional: CE MCP server

If a project does connect the upstream Coherence Engine MCP server, its `init_project` / `get_init_files` tools can perform the copy instead. That path is optional and never required by this bundle.
