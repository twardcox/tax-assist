---
description: Run pre-flight checks before commit (lint, type check, tests)
argument-hint:
allowed-tools: all
---

## Task

Run pre-flight validation before committing. Configured via `.ce-project.json` `toolkit.ci`.

## What to do

1. **Run the checks** from the project root:

   ```bash
   npm test --prefix backend-ts && npm run lint --prefix backend-ts && npm run build --prefix backend-ts
   ```

2. **For this project** (npm monorepo, TS backend is a sub-package), run these directly if needed:

   ```bash
   npm test --prefix backend-ts
   npm run lint --prefix backend-ts
   npm run build --prefix backend-ts
   ```

3. **Fix any failures** before committing. Do not use `--no-verify` to bypass.

4. **On success**, stage and commit:

   ```bash
   git add <files>
   git commit -m "type(scope): subject"
   ```

## Disable individual checks

Edit `.ce-project.json` under `toolkit.ci`:

```json
{ "toolkit": { "ci": { "unitTests": false } } }
```
