---
description: Sync framework files between this project and the master CE bundle
argument-hint: [path-to-master-bundle]
allowed-tools: all
---

## Task

**Sync** keeps a project's copy of the CE bundle aligned with the user's **master bundle** (the canonical `ce/` directory the user maintains and copies into every project). It works in both directions - say which one applies before touching files:

- **Pull** (default): update this project's `ce/`, `.agents/skills/`, and installed rules/scripts from the master bundle.
- **Push back**: the user improved a framework file *in this project* and wants the improvement in the master bundle so future projects get it.

If `$ARGUMENTS` gives the master bundle path, use it; otherwise ask.

## Steps (pull)

1. `git status` - require a clean tree (or explicit user OK) before overwriting framework files.
2. Diff the master bundle against the project copies: `ce/`, `.agents/skills/`, installed rules, `ce/scripts/` + `ce/lib/` (or `.ce/scripts` + `.ce/lib`), and `.husky/` if installed. Show the summary.
3. **Never overwrite project-specific files:** `ce/skills/` Project Facts, `.ce-project.json`, `CLAUDE.md`, and any file the user customized (the diff will show it - ask when unsure).
4. Copy the agreed files, then `git diff` for review and suggest a commit.

## Steps (push back)

1. Identify the improved file(s) and confirm they are **generic** (no project facts baked in).
2. Copy into the master bundle, updating any catalog/README rows there.
3. Remind the user that other projects pick this up on their next `/sync` pull.

## Rules

- Overwriting discards local edits - always diff first, and stash/commit beforehand.
- Generated or vendored files are synced whole; hand-merged only when both sides changed.

## Optional: CE MCP server

Projects connected to the upstream Coherence Engine server can use its `sync_init_files` / `get_init_files` tools or `GET {origin}/framework/init-files.zip` instead of a local master bundle. Optional - never required.
