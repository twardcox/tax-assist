---
description: Generate a PR description from current branch changes
allowed-tools: Bash(git:*)
---

## Task

Write a PR outline in markdown that documents what has been done in this branch.

## Context Gathering

```bash
# Branch info
git branch --show-current
git log main..HEAD --oneline

# Changes
git diff main...HEAD --stat
```

## PR Template

```markdown
# PR: [Title from branch name or commits]

## Summary

[2-3 sentence description of what this PR accomplishes]

## Changes Made

- [Change 1]
- [Change 2]
- [Change 3]

## Related Issue/Task

Closes TASK-XXX

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that causes existing functionality to change)
- [ ] Refactoring (no functional changes)
- [ ] Documentation update

## Testing Done

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Test Instructions

[How to test these changes locally]

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings introduced

## Screenshots (if applicable)

[Add screenshots for UI changes]

## Additional Notes

[Any context reviewers should know]
```

## Output

Generate the PR description and either:

1. Copy to clipboard
2. Create PR directly with `gh pr create`
3. Output to file

## After the PR Is Opened: Transition Ticket

When the PR is actually created (i.e. `gh pr create` succeeds or the user confirms the PR
was opened):

1. Extract the issue key from the current branch name using `[A-Z][A-Z0-9]+-[0-9]+`
   (e.g. `PROJ-123` from `feature/PROJ-123-add-login`).
2. Call `jira_transition_issue` with:
   - `issue_key`: the extracted key
   - `transition_name`: `"Code Review"`
3. If the transition fails (e.g. invalid status, Jira not configured), log a warning and
   continue - do not block.
