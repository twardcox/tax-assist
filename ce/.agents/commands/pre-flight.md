---
description: Run pre-flight checks before commit (lint, format, type check, tests)
argument-hint:
allowed-tools: all
---

## Task

Run the CE pre-flight validation checks before committing. This is the quality gate for Sprint Planning → Development.

## What to do

1. **Run the script** from the project root:

   ```bash
   node .ce/scripts/pre-flight-check.cjs
   ```

   Or if a script is configured: `pnpm run pre-flight`

2. **The script runs** (configurable via `.ce-project.json` toolkit.ci):

   - ESLint (linting)
   - Prettier (format check)
   - TypeScript (type check)
   - Vitest or `pnpm run test:unit` (unit tests)

3. **Fix any failures** before committing. The script exits with code 1 if any check fails.

4. **Next steps** (printed on success):
   - Stage changes: `git add .`
   - Optional: Run `pnpm run ai:review` for AI code review prompt
   - Commit with conventional message including ticket: `git commit -m "PROJ-123: Your message"`

## Rules

- Run from project root where `package.json` and `.ce-project.json` exist.
- Disable individual checks by adding `toolkit.ci` to `.ce-project.json` (e.g. `{ "toolkit": { "ci": { "unitTests": false } } }`).
