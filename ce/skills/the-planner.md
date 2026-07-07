# The Planner — spec → plan → execute

1. Brainstorm/design first; save specs to `docs/superpowers/specs/YYYY-MM-DD-<name>.md`, plans to `docs/superpowers/plans/`.
2. Plans are bite-sized TDD tasks: failing test → run to see it fail → minimal code → run green → commit. Exact file paths, complete code in every step, no "TBD".
3. Before planning, read the real code the change touches (loader recursion, test-parity greps, etc. have bitten before). The smallest diff in the wrong place is a second bug.
4. Execute task-by-task, committing per task on a feature branch (`audit` is current).
