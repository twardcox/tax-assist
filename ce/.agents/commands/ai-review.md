---
description: Pre-PR structured review from diff/spec - before opening the PR (GitHub bots e.g. Bugbot review after)
argument-hint: [--output <file>] [--clipboard]
allowed-tools: all
---

## Task

Run the AI review prompt script, read the file it writes, then **perform the full code review in this conversation**. Use this **before** opening a PR - not as a substitute for GitHub PR review. After the PR exists, **GitHub** automation (e.g. **Bugbot**) typically reviews there; that is separate from this command.

Do not stop after generating the prompt.

## What to do

1. **Generate the prompt file** from the project root:

   ```bash
   node .ce/scripts/ai-review-prompt.cjs --output .ai-review-prompt.md
   ```

   - Use `--output <file>` when the user passed a path; otherwise default to `.ai-review-prompt.md`.
   - `--clipboard` is optional (user convenience only); the agent should still use the `--output` file as the source of truth.

2. **Read the generated file** - It contains:

   - Ticket and branch info (if the branch matches the Jira pattern)
   - Changed files list
   - Spec / acceptance criteria (`specs/tasks/` on disk, server task spec via MCP `read_task_spec` when applicable, or Drive `specs/tasks/<KEY>.md` when linked)
   - Diff (truncated to 500 lines; open changed files when you need more context)
   - Embedded review instructions (spec compliance, quality, security, testing, edge cases)

3. **Perform the review here** - Using the prompt file **and** direct reads of the repo as needed (the diff may be truncated):

   - Map changes to acceptance criteria; call out gaps or untested ACs.
   - Flag bugs, security issues, and performance concerns; name them by severity (blocking / should-fix / nice-to-have).
   - Note test coverage and missing cases.
   - Keep the tone constructive; reference files and symbols concretely.

4. **Optional persistence** - If the user or project expects a written record, save the same review to `reports/ai-review-<ticket-or-branch>.md` (create `reports/` if needed). Skip if not requested.

## Rules

- Stage changes first (`git add`) for best results; the script falls back to an unstaged diff if nothing is staged.
- Put Jira credentials in `.env.local` if ticket extraction from the branch name is required.
- If the prompt is huge, prioritize reading changed files over pasting the whole diff into the reply.
