---
description: Move Jira ticket to Done, switch to main, and pull from origin
argument-hint: [main-branch]
allowed-tools: all
---

## Task

Complete the current ticket workflow: transition the Jira ticket (from the branch name) to the correct column, switch to the main branch, and pull from origin.

## Process

### Step 1: Get Current Branch and Extract Ticket

1. Get the current branch: `git branch --show-current` or use `github_get_current_branch`.
2. Extract the Jira ticket key from the branch name. Use the ticket pattern from `.ce-project.json` (`toolkit.jira.ticketPattern`) if configured; otherwise use the default pattern `[A-Z][A-Z0-9]+-[0-9]+` (e.g. `PROJ-123` from `feature/PROJ-123-add-login`).

### Step 2: Validate Context

- **If already on main/master:** Stop and inform the user: "You are already on the main branch. Nothing to complete."
- **If no ticket found in branch name:** Stop and inform the user: "No Jira ticket found in branch name. Branch should follow pattern: feature/PROJ-123-description or fix/PROJ-456-bug-fix."

### Step 3: Transition Jira Ticket to Done

Call `jira_transition_issue` with:

- `issue_key`: the extracted ticket key
- `transition_name`: `"Done"` (or `toolkit.jira.transitions.pr_merged` from `.ce-project.json` if configured)

If the transition fails (Jira not configured, ticket already Done, invalid status), log a
warning and continue with the git steps - do not block.

### Step 4: Switch to Main and Pull

1. Determine the main branch:
   - Use the argument if provided (e.g. `/complete-ticket master`).
   - Otherwise use **main**.
2. Run:
   ```bash
   git checkout main
   git pull origin main
   ```
   (Use the actual main branch name if different, e.g. `git checkout master && git pull origin master`.)

### Step 5: Confirm

Output a summary:

- Ticket transitioned: `PROJ-123` → Done
- Switched to `main`
- Pulled latest from `origin/main`

### Step 6: Optional cleanup

- **Remote branch:** If the merged feature branch still exists on **origin** and your team deletes branches after merge, run `git push origin --delete <branch-name>` (or suggest it for the user). Skip if the branch was already deleted or policy keeps it.
- **Co-authored commits:** For paired work, mention that commits can include `Co-authored-by:` trailers - [GitHub docs](https://docs.github.com/en/pull-requests/committing-changes-to-your-project/creating-and-editing-commits/creating-a-commit-with-multiple-authors).

## Rules

- Run from the project root.
- Ensure Jira credentials are configured (`.env` or `.env.local`) if Jira transitions are desired.
- If the local transition tool is unavailable, instruct the user to run the equivalent status transition manually in their tracker.
