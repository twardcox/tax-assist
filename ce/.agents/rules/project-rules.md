# Project Rules Template

This file is the **baseline** for CE projects. It is copied from the framework during init - you can edit it for project-specific overrides.

**To add project-specific rules:** Create a project-specific rules file alongside the `ce/` rules in your agent or IDE's rules directory. Your client loads both the framework baseline and any project-specific overrides.

## Spec artifacts (implementation client - read only)

When implementing in the IDE, treat framework planning docs as **read-only**:

- **Read** `agent-docs/` and `output-docs/` with `list_artifacts` and `read_artifact` only.
- **Do not** call `save_artifact`, `apply_scope_changes`, or `jira_sync_specs` - PMO owns those in **Cowork** and may update any planning document at any time.
- If implementation reveals a spec gap, document it in the ticket/PR and ask PMO to update artifacts in Cowork.

Projects typically customize:

- Architecture constraints (stack, patterns, folder structure)
- Data layer conventions (caching, pagination, error handling)
- Testing requirements
- Environment variable usage
- Code quality standards

## CHANGELOG

- **Every commit** updates **`CHANGELOG.md`** in the **same commit** as the work (not a later housekeeping commit).
- Add a bullet under the unreleased section (or follow the file’s existing format - [Keep a Changelog](https://keepachangelog.com/) is common). User-facing changes note behavior; internal-only work can use a short “Internal: …” line.
- If the repo has no `CHANGELOG.md`, add one with an **Unreleased** section and link any org-wide release process if applicable.

## Data Dictionary and Patterns

Keep these files current as you learn about the project:

- **`docs/DATA_DICTIONARY.md`** - Document tables, columns, data sources, and data quality notes.
- **`docs/PATTERNS.md`** - Document TypeScript patterns, caching strategies, and architectural decisions.

> "Future you should be able to understand the data and code without re-discovering everything from scratch."
