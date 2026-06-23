---
description: Check GitHub Actions CI status for the current branch or PR; surface failing checks and next steps
argument-hint: [--watch]
allowed-tools: all
---

## Task

Check the GitHub Actions CI status for the current branch and surface any failures with actionable next steps. This is the CI/CD entry point - use it after pushing a branch or while a PR is open to see pass/fail, get failure logs, and know what to do next.

## Process

### 1. Identify the current context

```bash
git branch --show-current
```

Then check whether a PR exists for this branch:

```bash
gh pr view --json number,title,state,url 2>/dev/null
```

### 2. Get CI status

**If a PR exists - use PR checks (preferred):**

```bash
gh pr checks
```

Or with structured JSON for table output:

```bash
gh pr view --json statusCheckRollup --jq \
  '.statusCheckRollup[] | "\(.name)\t\(.state)\t\(.conclusion // "pending")\t\(.detailsUrl // "")"'
```

**If no PR - list recent runs on the branch:**

```bash
gh run list --branch "$(git branch --show-current)" --limit 5
```

Pick the most recent run:

```bash
gh run view <run-id>
```

### 3. Fetch failure details

For each failing or errored check, fetch the relevant log excerpt (last 100 lines per job - do not dump the full log):

```bash
gh run view <run-id> --log-failed
```

Or for a specific job:

```bash
gh run view <run-id> --job <job-id> --log | tail -100
```

Use `gh run list --json databaseId,name,status,conclusion,url` to find run IDs when needed.

### 4. Report

Output a concise summary structured as:

- **Branch / PR:** branch name + PR URL if open
- **Overall status:** ✅ All passing | ⏳ Checks pending | ❌ Failures
- **Checks table:** `| name | status | conclusion | link |`
- **Failing checks:** for each failure, show check name + last N lines of relevant log
- **Next steps** (based on status):
  - All passing → ready to merge; run `/pull-request` if PR is not yet open, or approve + merge if PR exists; then `/complete-ticket`
  - Pending → list which checks are still running; suggest re-running `/ci-status` once they complete
  - Failing → list each failure and its likely cause; suggest fixing and re-pushing, or run `/pre-flight` locally to reproduce the issue before pushing

### 5. Watch mode (optional)

If the user passes `watch` or `--watch` as an argument, poll until all checks complete or 5 minutes elapse:

**With a PR open:**

```bash
gh pr checks --watch
```

**Without a PR (branch-level run):**

```bash
gh run watch <run-id>
```

After watching completes, output the same report format from Step 4.

## Rules

- This is a **read-only** status command - do not commit, push, or modify files.
- Always show the PR URL when one exists.
- Limit log output to the last 50–100 lines per failing job to stay within context.
- If `gh` is not authenticated, warn and direct the user to run `gh auth login`.
- If there are no recent runs and no PR, note that and suggest pushing the branch and/or opening a PR first.
