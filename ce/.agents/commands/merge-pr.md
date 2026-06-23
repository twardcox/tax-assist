---
description: Verify CI and reviews, merge the open PR, transition Jira to Done, switch to main
argument-hint: [squash|merge|rebase]
allowed-tools: all
---

## Task

Merge the open pull request for the current feature branch, transition the Jira ticket to **Done**, switch to `main`, and pull - combining the merge step with post-merge cleanup in one flow.

## Process

### Step 1: Identify the PR

1. Get the current branch: `git branch --show-current`.
2. Find the open PR for this branch:

   ```bash
   gh pr view --json number,title,state,isDraft,mergeable,mergeStateStatus,reviewDecision,statusCheckRollup,headRefName
   ```

3. If no open PR is found (state is not `OPEN`), stop and tell the user: "No open PR found for this branch. Run `/pull-request` first to open one."
4. If the PR is a **draft**, warn: "This PR is in draft. Merge anyway?" and wait for explicit confirmation before continuing.

### Step 2: Check readiness

Display a readiness summary and gate on blockers:

| Check           | Tool / source                         | Gate                                                                                             |
| --------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| CI status       | `statusCheckRollup` from `gh pr view` | **Block** if any required check is failing or pending (unless user overrides)                    |
| Review approval | `reviewDecision` from `gh pr view`    | **Block** if `REVIEW_REQUIRED` (no approvals) or `CHANGES_REQUESTED`; `APPROVED` or `""` is fine |
| Merge conflicts | `mergeable` from `gh pr view`         | **Block** if `CONFLICTING`; `MERGEABLE` or `UNKNOWN` is fine                                     |

If **any blocker** is present, list all blockers clearly and stop with: "Fix the above before merging, or pass `--force` explicitly if you want to override." Do not auto-override blockers.

If **all checks pass**, output: "PR #N is ready to merge - CI green, approved, no conflicts." and proceed.

### Step 3: Choose merge strategy

Determine the merge strategy:

1. **From argument:** the user can pass `squash`, `merge`, or `rebase` as the command argument.
2. **From config:** read `.ce-project.json` `toolkit.github.mergeStrategy` if set.
3. **Default:** `squash`.

Confirm the strategy with the user: "Merging PR #N with **squash** - confirm? (y/n)"

### Step 4: Merge the PR

```bash
gh pr merge <number> --<strategy> --delete-branch
```

- Use `--squash`, `--merge`, or `--rebase` based on the chosen strategy.
- `--delete-branch` automatically deletes the remote feature branch after merge. If the user explicitly wants to keep the branch, omit this flag.
- If `--squash`, `gh` will prompt for a commit message by default; pass `--subject` if a title override is needed.

If `gh pr merge` fails:

- Surface the full error.
- Do not proceed with Jira transition or git steps.
- Suggest fixing the issue and retrying.

### Step 5: Transition Jira to Done

Extract the Jira ticket key from the branch name using `.ce-project.json` `toolkit.jira.ticketPattern` when set; otherwise `[A-Z][A-Z0-9]+-[0-9]+`.

Call `jira_transition_issue` with:

- `issue_key`: the extracted ticket key
- `transition_name`: `"Done"` (or `toolkit.jira.transitions.pr_merged` from `.ce-project.json` if configured)

If the transition fails (tracker not configured, invalid status, etc.), log a warning and continue - do not block git cleanup. Suggest the equivalent local status transition command when available.

### Step 6: Switch to main and pull

1. Determine the main branch:
   - From the argument if provided (e.g. `/merge-pr master`).
   - Otherwise use `main`.
2. Run:

   ```bash
   git checkout main
   git pull origin main
   ```

3. If the local feature branch still exists (it was not deleted by `--delete-branch`), offer to delete it:

   ```bash
   git branch -d <feature-branch>
   ```

### Step 7: Summary

Output a concise summary:

- PR #N merged (`squash`) ✓
- Remote branch deleted ✓ (or skipped)
- Jira `PROJ-123` → Done ✓ (or warning if skipped)
- Switched to `main`, pulled from `origin/main` ✓

## Rules

- Never force-push or force-merge without explicit user confirmation.
- If the working tree on the feature branch has uncommitted changes before running this command, warn and ask to commit or stash first - do not proceed until the branch is clean.
- If the PR is not found or the branch has no upstream, stop early and surface the error clearly.
- Remove any temporary files (e.g. `.pr-body.md`) if present before switching to `main`.
