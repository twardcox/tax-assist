---
description: Diagnose CE workflow setup in this project - reports what is configured, missing, and exact fix steps
allowed-tools: all
---

## Task

The user invoked `/troubleshoot-setup`. Run a local diagnostic of the CE workflow installation in this repository and surface every fix needed. No server is involved - every check is a local file or command.

## Checks (run all, report ✅/⚠️/❌ per row)

| # | Check | How | Fix if failing |
|---|-------|-----|----------------|
| 1 | Bundle present | `ce/` (or `.ce/`) exists with `.agents/commands/`, `scripts/`, `lib/` | Run `/init-project` |
| 2 | Skills installed | `.agents/skills/` and/or `.claude/skills/` exist and match `ce/.agents/skills/` (spot-check 2-3 stubs) | Re-copy from the bundle; stale MCP-era stubs mention `ce://` URIs - replace them |
| 3 | Node available | `node --version` ≥ 18 | Install Node / fix PATH |
| 4 | Scripts run | `node ce/scripts/pre-flight-check.cjs` executes (individual checks may fail on a dirty repo - the script itself must not crash) | Check the error; `ce/lib/` must sit next to `ce/scripts/` |
| 5 | Config parses | `.ce-project.json` absent (defaults OK) or valid JSON | Fix JSON; see `/update-config` |
| 6 | Hooks wired | If `.husky/` exists: hook files call `hook-runner.cjs` and `git config core.hooksPath` points at `.husky` | Reinstall from `ce/.husky/`; run the project's husky setup |
| 7 | Ticket enforcement intentional | If `toolkit.hooks.commitMsg.requireTicket` is `true` or `toolkit.jira.branchPattern` is set: confirm the project really uses that tracker convention | Set `requireTicket: false` / remove the pattern for tracker-less projects |
| 8 | Instruction file | `CLAUDE.md` (or the client's equivalent) exists and mentions the `ce/` bundle | Create from `ce/templates/` |
| 9 | Local skills instantiated | `ce/skills/*.md` Project Facts blocks contain real values, not template placeholders | Fill them in per `/init-project` step 5 |
| 10 | GitHub CLI (only if PR flow used) | `gh auth status` | `gh auth login` |

## Output

List every ❌ and ⚠️ with its exact fix. If all green: "🎉 All systems ready" and suggest `/ce-status`.

## Rules

- Do not assume anything is configured - run the checks.
- Do not proceed with phase work while ❌ items remain for things the current task depends on.
- Optional integrations (tracker, Drive, MCP server) are ⚠️ at worst - never ❌ - when simply absent.
