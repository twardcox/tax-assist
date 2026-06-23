---
description: After pre-PR gate (pre-flight → test-coverage → architecture-check → design-review → ai-review), push branch, open GitHub PR, transition Jira to Code Review
argument-hint: [draft]
allowed-tools: all
---

## Task

Take the current feature branch from “ready to ship” to **an open pull request on GitHub**, with Jira moved to **Code Review** when the PR is created. Combine checks, PR body quality, and automation in one flow.

## Process

### 1. Pre-PR gate (required before this command)

Run these **in order** for **every** PR - whether the human or the agent did the implementation. Load each playbook from **`ce://commands/{name}`** (or use **`get_slash_command`**) and follow it.

| Order | Slash                 | Purpose                                                                                                                 |
| ----- | --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 0     | `/pre-flight`         | Lint, format, type check, tests                                                                                         |
| 1     | `/test-coverage`      | Confirm tests and coverage; **TDD is the default** - use this to close gaps if tests were deferred or coverage is short |
| 2     | `/architecture-check` | Validate the change against documented architecture                                                                     |
| 3     | `/design-review`      | Second pass: implementation vs intended design (UI, API, data) - skip only when clearly not applicable (e.g. docs-only) |

Then run **`/ai-review`** (structured review from diff and task spec). Address findings or record accepted exceptions.

**If any step changes code** (including test or doc fixes), **re-run `/pre-flight`** before continuing.

If any gate fails, **stop**, summarize failures, and do not open a PR until the user fixes them.

### 2. Branch and remote

1. Confirm you are **not** on `main` / `master` / `develop` (unless the user explicitly wants a PR from that branch).
2. Show unpushed commits: `git log @{u}..HEAD --oneline 2>/dev/null || git log origin/$(git branch --show-current)..HEAD --oneline` (adapt if no upstream - see next step).
3. If there are unpushed commits or no upstream is set, push after the user confirms:

   ```bash
   git push -u origin HEAD
   ```

### 3. PR title and body

**Full body:** **`/pull-request`** builds the same sections and depth as **`/pr-description`** (below). You can run **`/pr-description`** alone first if you only need the markdown; otherwise this command produces the body before `gh pr create`.

Build the PR **using the same sections and depth** as `/pr-description`:

- Summary, changes, related Jira key, type of change, testing done, test instructions, checklist, screenshots if UI, notes.
- Extract the ticket key from the branch name using `.ce-project.json` `toolkit.jira.ticketPattern` when present; otherwise `[A-Z][A-Z0-9]+-[0-9]+`.

Write the body to a short-lived file in the repo root (e.g. `.pr-body.md`) so `gh pr create --body-file` works reliably with multiline content. Add `.pr-body.md` to `.gitignore` only if the project already uses a pattern for temp PR files; otherwise delete the file after a successful `gh pr create`.

### 4. Open the PR (GitHub CLI)

If `gh` is available and authenticated:

```bash
gh pr create --title "<concise title>" --body-file .pr-body.md
```

Use `--draft` if the user passed `draft` or asks for a draft PR.

If `gh` is missing or fails, output the title and full body for manual creation in the browser and **skip** the Jira transition until the user confirms the PR exists.

### 5. After the PR is opened - Jira (and GitHub review bots)

When `gh pr create` succeeds (or the user confirms the PR URL):

**GitHub:** Automated PR reviewers (e.g. **Bugbot**) run on the PR after it exists - that is **not** a replacement for **`/ai-review`**, which you complete **before** opening the PR.

1. Extract `issue_key` from the branch name (same pattern as above).
2. Call `jira_transition_issue` with:
   - `issue_key`
   - `transition_name`: `"Code Review"` (or `toolkit.jira.transitions.pr_opened` from `.ce-project.json` when set)
3. If the tool fails, warn only - do not block. Suggest the equivalent local status transition command when available.

### 6. After merge (human or agent)

- Run **`/complete-ticket`** so Jira moves to **Done** and you return to **main** with **`git pull`** (see **`/complete-ticket`** playbook).
- **Delete the remote feature branch** if your team policy allows (keeps the repo tidy):

  ```bash
  git push origin --delete "$(git branch --show-current)"
  ```

  (Only after the PR is merged and you are done with that branch.)

- **Pairing / co-author:** To attribute multiple authors on commits, use a `Co-authored-by:` trailer per [GitHub: Creating a commit with multiple authors](https://docs.github.com/en/pull-requests/committing-changes-to-your-project/creating-and-editing-commits/creating-a-commit-with-multiple-authors).

## Rules

- Never force-push unless the user explicitly asks.
- If the working tree has uncommitted changes, warn and ask whether to commit, stash, or abort before pushing.
- Remove or gitignore `.pr-body.md` after success so it is not committed by mistake.
