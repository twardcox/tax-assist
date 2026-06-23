# CE Git Hooks

**`init_project`** (Development bundle, local workspace) copies these hooks into CE projects. They provide pre-commit (lint-staged, type-check, tests), commit-msg (ticket validation), pre-push (branch validation), and post-checkout (Jira transition).

Each hook ends with `1>&2` so the Node process **stdout** is written to **stderr**. Git and many clients treat stderr as hook diagnostics; `log.cjs` uses `console.log` for several statuses, and some child tools print failures to stdout-redirecting keeps that visible on the expected stream.

## In CE Projects

After **`init_project`**, your project has `.husky` with a copy of these hooks at project root so git discovers them. Configure behavior in `.ce-project.json` under `hooks`.
