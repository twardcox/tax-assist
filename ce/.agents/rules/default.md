# Coherence Engine Framework Rules

## Navigation

- See `ce://guidelines/project-rules` for project-specific rules and conventions.
- Use CE MCP tools: `list_artifacts`, `read_artifact`, `save_artifact`, etc.

## Development (Development) Workflow

1. Read the Jira Story ticket - it contains all acceptance criteria for the user story.
2. Create feature branch: `feature/PROJ-123-descriptive-name`
3. Implement using acceptance criteria from the ticket.
4. Quality gate: run tests, type-check, and lint per project conventions (e.g. `pnpm test && pnpm run typecheck && pnpm run lint`).
5. Check for linter errors on edited paths before finishing.

## Data Hygiene

Two files in `docs/` must be kept current as agents learn about the project:

- **`docs/DATA_DICTIONARY.md`** - Update when discovering new tables, columns, data sources, or data quality issues.
- **`docs/PATTERNS.md`** - Update when encountering TypeScript issues, caching patterns, pagination, or architectural decisions.

Create `docs/` and these files if they do not exist.

See `data-dictionary-maintenance.md` in this directory for detailed guidelines.
