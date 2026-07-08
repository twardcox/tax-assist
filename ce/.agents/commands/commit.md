---
description: Commit current changes with a concise, conventional commit message (auto-switches to sequential-commit when 15+ paths)
allowed-tools: Bash(git:*)
---

## Task

Commit your work with a concise summary following conventional commit format.

## Process

### 0. Automatic threshold (sequential vs single commit)

**CE uses a fixed threshold of 15 paths.** Do not guess-count and route.

1. Count paths in scope for this commit:
   - If anything is staged: `git diff --cached --name-only | wc -l` (each line is one path).
   - If nothing is staged: `git status --short | wc -l` (each line is one path among modified, deleted, untracked, etc.).
2. If the count is **15 or more**: **do not** use the single-commit steps below. Instead, read **`ce/.agents/commands/sequential-commit.md`** and follow that playbook end-to-end. Tell the user one line: e.g. "15+ paths in scope-using sequential commits per CE threshold."
3. If the count is **14 or fewer**: continue with the steps below.

### Single commit (14 or fewer paths)

1. Review staged changes: `git diff --staged`
2. If nothing staged, review unstaged: `git status`
3. Determine commit type:
   - `feat`: New feature
   - `fix`: Bug fix
   - `docs`: Documentation
   - `style`: Formatting (no code change)
   - `refactor`: Code change (no feature/fix)
   - `test`: Adding tests
   - `chore`: Maintenance
4. Write commit message: `type(scope): concise description`
5. Execute commit

## Commit Message Format

```
type(scope): subject (max 50 chars)

[optional body - wrap at 72 chars]
- Detail 1
- Detail 2

[optional footer]
Refs: TASK-XXX
```

## Rules

- Subject line: imperative mood ("Add" not "Added")
- No period at end of subject
- Body explains "what" and "why", not "how"
- Reference task/issue if applicable
