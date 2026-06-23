---
description: Group uncommitted changes logically and commit them in sequence
allowed-tools: Bash(git:*)
---

## Task

Go through all uncommitted changes, group them logically by area of concern/pattern, and commit them accordingly.

**When to use this playbook:** The user invoked **`/sequential-commit`**, **or** they invoked **`/commit`** and **15 or more paths** were in scope (staged paths if anything is staged; otherwise all paths with working-tree changes)-the **`/commit`** playbook routes here automatically at that threshold.

## Process

### Step 1: Analyze Changes

```bash
git status
git diff --stat
```

### Step 2: Identify Logical Groups

Common groupings:

- **Feature additions**: New functionality
- **Bug fixes**: Corrections to existing code
- **Refactoring**: Code improvements (no behavior change)
- **Tests**: Test additions/modifications
- **Documentation**: Comments, README, docs
- **Configuration**: Config files, environment
- **Dependencies**: Package updates
- **Styling**: Formatting, linting fixes

### Step 3: Plan Commit Sequence

Order commits logically:

1. Infrastructure/config changes first
2. Core implementation
3. Supporting code
4. Tests
5. Documentation

### Step 4: Execute Commits

For each logical group:

1. Stage relevant files: `git add [files]`
2. Review staged changes: `git diff --staged`
3. Commit with appropriate message
4. Repeat for next group

## Commit Message Format

```
type(scope): subject

- Detail 1
- Detail 2
```

## Example Output

```
Analyzing uncommitted changes...

Found 12 modified files across 4 logical groups:

1. Database schema (2 files)
   - migrations/001_users.sql
   - src/db/schema.ts

2. User authentication (4 files)
   - src/auth/register.ts
   - src/auth/login.ts
   - src/middleware/auth.ts
   - src/routes/auth.ts

3. Tests (3 files)
   - tests/auth/register.test.ts
   - tests/auth/login.test.ts
   - tests/middleware/auth.test.ts

4. Documentation (3 files)
   - README.md
   - docs/api/auth.md
   - src/auth/README.md

Proceeding with commits...
```
