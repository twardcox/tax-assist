---
description: Project workflow status - installation, config snapshot, current phase, and suggested next commands
argument-hint:
allowed-tools: all
---

## Task

The user invoked **`/ce-status`**. Show a status dashboard for the CE workflow in this repository and suggest the next command. All checks are local - no server call.

## Steps (strict order)

1. **Installation:** confirm `ce/` (or `.ce/`) bundle, `.agents/skills/` (and `.claude/skills/` when present), and hooks. Note anything missing (fix: `/init-project` or `/troubleshoot-setup`).

2. **Config:** read `.ce-project.json` if present and display it in a fenced JSON block. If absent, say defaults are in effect (tracker-neutral, hooks enabled).

3. **Infer the current phase** from what exists on disk:

   | Signal | Phase |
   |--------|-------|
   | No `research/` inputs, no SOW+ | Pre-SOW → `/quality-gate pre-sow`, then SOW+ |
   | SOW+ exists, no System PRD | PRD → `/create-product-requirement-doc` |
   | System PRD, missing milestone PRDs | PRD → `/create-milestone-prd` |
   | Milestone PRDs, no tickets/tasks | Milestones → `/breakdown-milestone`, `/create-prd-tickets` |
   | Tickets/specs exist, work ongoing | Development → `/start-ticket`, `/pmo-manage` |
   | Feature branch with commits | In flight → `/pre-flight`, `/pull-request` |

   Check `agent-docs/`, `specs/tasks/`, `reports/`, and `git status`/`git log` for these signals. If the project skipped the planning phases deliberately (many do), say so neutrally - the dev-loop commands stand alone.

4. **Present the dashboard:**

   ```
   Coherence Engine - Status
   ── Installation   bundle / skills / hooks: ✅ or issue
   ── Config         .ce-project.json snapshot (or "defaults")
   ── Tracker        configured tracker + pattern, or "none (tracker-neutral)"
   ── Phase          inferred phase + evidence
   ── Next steps     1-3 concrete commands, most relevant first
   ```

## Rules

- Base every line on files/commands actually inspected this session - no cached assumptions.
- If installation is broken, stop at step 1 and point to `/troubleshoot-setup`.
