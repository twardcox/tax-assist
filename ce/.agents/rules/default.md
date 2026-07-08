# Coherence Engine Framework Rules

## Navigation

- Project-specific rules and conventions: `ce/.agents/rules/project-rules.md` (baseline) plus any project overrides alongside it.
- All command playbooks live in `ce/.agents/commands/` - the local files are the single source of truth. (`ce://` URIs only resolve when the optional CE MCP server is connected; never require it.)

## Tracker-neutral operation

The workflow works with or without a ticket tracker:

- Steps that mention Jira (or any tracker) are **conditional**: run them when the project's `.ce-project.json` configures a tracker; otherwise note the skip in one line and continue - never block on a missing tracker.
- Without a tracker, specs under `agent-docs/` and `specs/tasks/` are the backlog of record, and commit messages need no ticket reference.

## Development Workflow

1. Read the ticket or task spec - it contains the acceptance criteria for the work.
2. Create a feature branch with a descriptive name (include the ticket key when the project uses one, e.g. `feature/PROJ-123-descriptive-name`).
3. Implement using the acceptance criteria.
4. Quality gate: run the project's test, type-check, and lint commands (use the project's package manager - check the lockfile; do not assume pnpm).
5. Check for linter errors on edited paths before finishing.

## Data Hygiene

Two files in `docs/` must be kept current as agents learn about the project:

- **`docs/DATA_DICTIONARY.md`** - Update when discovering new tables, columns, data sources, or data quality issues.
- **`docs/PATTERNS.md`** - Update when encountering TypeScript issues, caching patterns, pagination, or architectural decisions.

Create `docs/` and these files if they do not exist.

See `data-dictionary-maintenance.md` in this directory for detailed guidelines.
