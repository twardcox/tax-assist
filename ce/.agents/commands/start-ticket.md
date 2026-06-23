---
description: List ticket options (assigned or unassigned), then three questions - ticket, self vs agent, branch base
argument-hint: '[TICKET-KEY]'
allowed-tools: all
---

## Task

Run the **Development - Start Ticket** flow so the developer can pick up a ticket and get a branch ready.

## What to do

1. **Invoke the framework prompt** \`development_start_ticket\`. If the user ran \`/start-ticket PROJ-123\`, pass that ticket key as context - the prompt uses an explicit key when given (otherwise it searches To Do per the prompt body). **Call \`show_project_config\` in the first turn** (do not ask the user to paste config). Use \`toolkit.jira.projectKey\` from the tool result for JQL; do not ask for the Jira key when the tool already returned it.
2. The prompt will:
   - Build **ticket options** from Jira: **Story, Bug, Task**, and other dev-work types your project uses - adjust JQL to match (see \`development_start_ticket\` on the server).
   - Show **assigned** vs **unassigned** lists per the prompt: if the developer has **no** assignable tickets in the **assigned** search, show **only** the **unassigned** list; otherwise show **only** the **assigned** list. Each line includes **key**, **issue type**, and **title**.
   - **First reply ends with exactly three questions** (and nothing after them): (1) which **ticket key** to complete, (2) **agent** or **do it yourself**, (3) branch from **current** or **main**. **No branch** until all three are answered.
   - After answers: detail pass, then if **yourself**: frame the task and suggest files. If **agent**: they invoke \`development\` with the ticket key **after** the branch exists.
   - Create branch from the chosen base; transition to **In Progress**; then **Next Steps** handoff.
3. **Follow the prompt’s steps** using the MCP tools (\`jira_search_issues\`, \`jira_get_issue\`, \`github_get_current_branch\`, \`github_validate_branch_name\`, \`github_create_branch\`, \`jira_transition_issue\`, etc.).
4. **If the prompt is not available**, run the same flow manually:
   - If a key was given: \`jira_get_issue\`; else run **assigned** and **unassigned** searches and show **one** list per the prompt rule. Optionally \`list_artifacts\` / \`read_artifact\` for epic and file hints **after** the user picks a ticket.
   - **End the first message** with the **three questions** above - no branching yet.
   - After answers: short detail pass; if self: task description and suggested files. If agent: \`development\` after the branch exists.
   - Branch from current or main; resolve base, tell the user to update the base (\`git fetch\` / \`git pull\`), then \`github_validate_branch_name\` and \`github_create_branch\` with \`feature/TICKET-123-short-name\`; then \`jira_transition_issue\` → **In Progress**.

## Rules

- Only one ticket per run; create one feature branch with the ticket number in the name.
- If no matching To Do issues are found, say so and suggest checking Jira or sprint assignment.

### Jira assignee and “my tickets”

Searches use the Jira user behind the server’s **`JIRA_API_TOKEN`**. In JQL, **`currentUser()`** is that account - often a **shared integration user**, not the human developer. To filter by a **specific person**, use an explicit **`assignee = "email@company.com"`** (or Jira account ID) that the developer confirms, or have them pass a **ticket key** so you call **`jira_get_issue`** directly. Do not promise “assigned to you” unless the token is personal or assignee is explicit.

On the **hosted server**, the project is already namespaced (SSE **`?project_key=`** / **`?CE_PROJECT_KEY=`** or **`initialize`**, and repo **`.env`** may set **`CE_PROJECT_KEY`** for scripts). **Call `show_project_config` first** - if **`toolkit.jira.projectKey`** is set, use it for JQL; **do not** ask the user for the key in that case. If the key is still unknown or wrong, call **`list_jira_projects`** and **`select_project`**.

## Agent-led implementation (human-in-the-loop)

When the developer chose **agent** (or follows **`development`** after the branch exists), the implementing agent **must**:

1. **Plan (HITL)** - Present a concise numbered plan and **ask for approval** in one short line. Revise until confirmed; **no implementation until then**.
2. **Per-step diff (HITL)** - For **each** plan step: do **only** that step → **show the diff** → **wait** for approval or change requests → fix if needed → then the **next** step.
3. **Summary** - After all steps pass their diff checkpoints, a **short** wrap-up (delivered work, files, tests, follow-ups).
4. **Pre-PR gate** - Then run **`/pre-flight`** → **`/test-coverage`** → **`/architecture-check`** → **`/design-review`** (if applicable) → **`/ai-review`**. Then **`/pull-request`** (or **`/pr-description`** + open PR). Re-run **`/pre-flight`** if any gate step changes code.

## After Branch Is Created: Transition Ticket

Immediately after the feature branch is created:

1. Extract the issue key from the branch name using the pattern `[A-Z][A-Z0-9]+-[0-9]+`
   (e.g. `PROJ-123` from `feature/PROJ-123-add-login`).
2. Call `jira_transition_issue` with:
   - `issue_key`: the extracted key
   - `transition_name`: `"In Progress"`
     (Do not assign the ticket to the Jira integration user - transitions never change assignee.)
3. If the transition fails (e.g. ticket is already In Progress, Jira is not configured),
   log a warning and continue - do not block.

**Product note (known behavior):** Moving to **In Progress** when the branch is created can leave work items In Progress if the developer abandons the branch before pushing. The server does **not** (today) transition only on first push - correct status in Jira manually if pickup was wrong or work stopped.

## Next Steps (after branch is created)

Once the branch is created, present a **Next Steps** block tailored to the ticket's work type. Always lead with tests-from-ACs as step 1 unless the task type makes that inappropriate (e.g. pure docs or config-only changes).

**Account for auxiliary work** - the numbered blocks below are the **primary** path. You must also surface **auxiliary** steps when they apply (discovery, config, framework sync, agent workflow, post-PR automation, merge cleanup). Do not hand off **only** the numbered steps; merge auxiliary items into the same Next Steps output (or add a dedicated **Auxiliary** subsection). Use the checklist.

### Auxiliary checklist (include when applicable)

| Auxiliary                       | When to include                                                     | Action                                                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Jira**                        | After branch create                                                 | Transition to **In Progress** is already required above - confirm it succeeded or note the warning.                                                                           |
| **Design readiness**            | UI/Story ticket (component, page, screen, layout, design, frontend) | **`/design-review`** or **`design_validate_ticket`** before coding — **READY FOR DEVELOPMENT** or logged override. Escalate **NOT READY** gaps to PMO.                        |
| **Discovery**                   | Unfamiliar modules, legacy code, or unclear call graph              | **`/council`** before or during implementation - not optional if the developer is unsure where to change code.                                                                |
| **Project config**              | Missing Figma file key, hooks, CI toggles, or paths for this ticket | **`/update-config`** (often pairs with UI or integration work).                                                                                                               |
| **Framework bundle**            | Rules, `.ce/scripts`, CI, or hooks may lag the server               | **`/sync`** after a framework upgrade or when drift is suspected.                                                                                                             |
| **First-time dev client setup** | New clone or never ran init                                         | **`/init-project`** once before heavy work (if not already done).                                                                                                             |
| **Agent workflow**              | Developer chose **agent**                                           | **`development`**: approve plan → each step + **diff** checkpoint → summary → pre-PR gate (see Agent-led section).                                                            |
| **Pre-PR gate**                 | Before every PR (human or agent)                                    | **`/pre-flight`** → **`/test-coverage`** → **`/architecture-check`** → **`/design-review`** (if applicable) → **`/ai-review`**. Re-run **`/pre-flight`** if anything changes. |
| **Post-PR (GitHub)**            | After the PR exists                                                 | Automation (e.g. **Bugbot**) reviews on GitHub - separate from **`/ai-review`**.                                                                                              |
| **After merge**                 | PR merged to main                                                   | **`/complete-ticket`** (Jira Done + back to main).                                                                                                                            |

### Determine work type

Inspect the ticket's labels, components, summary, and description to classify:

| Work type       | Signal words / labels                            |
| --------------- | ------------------------------------------------ |
| Feature / story | new functionality, "As a user", API endpoint, UI |
| Bug fix         | bug, regression, defect, "fix", "broken"         |
| Refactor        | refactor, cleanup, performance, no new behavior  |
| Config / infra  | CI, env, wrangler, terraform, secrets, deploy    |
| Docs / copy     | docs, README, copy, content, markdown-only       |

### Step blocks by work type

**Feature / story (default)**

```
Next Steps for [TICKET-KEY] - [Ticket Title]

[IF UI TICKET - include this block, otherwise omit]
0. Check Figma designs before writing code
   Call show_project_config and inspect toolkit.figma.fileKey.
   - If a fileKey is set: use the Figma MCP get_design_context tool
     (fileKey from config; nodeId from any Figma URL in the ticket).
     Review component specs, spacing, color tokens, and interaction states.
     Use Code Connect snippets or design tokens from the response directly.
   - If no fileKey: run /update-config to set toolkit.figma.fileKey, or paste
     a Figma URL here so the agent can read the design. Do not start
     implementation until the design is reviewed.
[END IF UI]

1. Write failing tests from ACs
   Open the relevant test file (or create tests/<feature>.test.ts).
   For each acceptance criterion, write one or more test cases - they should
   fail right now because the feature doesn't exist yet.
   Run: pnpm test -- --testPathPattern=<feature>

2. Implement to make tests pass
   Work through the ACs one by one. Refer to the suggested files above and
   follow patterns in src/<relevant>/. For UI tickets, implement against the
   Figma specs retrieved in step 0.

3. Pre-PR gate (in order; TDD is default - use test-coverage to recover if tests lagged)
   /pre-flight → /test-coverage → /architecture-check → /design-review
   (`/design-review` invokes **Design Agent** — delivery mode at pre-PR; skip when clearly N/A, e.g. markdown-only.)
   Then /ai-review - address or document findings.
   Re-run /pre-flight if any step changed code.

4. Generate docs (optional)
   Generate JSDoc for `src/<feature>/*.ts` using your AI tool of choice

5. Open a PR
   /pull-request - or /pr-description then push and create the PR in GitHub.

6. Auxiliary wrap-up (if applicable)
   Post-PR: expect GitHub review bots on the PR. After merge: /complete-ticket.
   Include any items from the Auxiliary checklist that were not already covered above.
```

**Bug fix**

```
Next Steps for [TICKET-KEY] - [Ticket Title]

1. Write a failing regression test
   Reproduce the bug in a test first so you can confirm the fix later.

2. Fix the root cause
   Trace through the stack and apply the minimal correct fix.

3. Pre-PR gate: /pre-flight → /test-coverage → /architecture-check → /design-review (if applicable) → /ai-review
   Re-run /pre-flight after fixes.

4. Note the fix in the PR description (/pr-description or /pull-request).

5. Auxiliary wrap-up (if applicable)
   Post-PR: GitHub bots; after merge: /complete-ticket. /council if unfamiliar area.
```

**Refactor**

```
Next Steps for [TICKET-KEY] - [Ticket Title]

1. Verify existing test coverage before touching code
   pnpm test -- --coverage --testPathPattern=<module>
   If coverage is thin, add characterization tests first.

2. Refactor incrementally - keep tests green after each change.

3. Pre-PR gate: /pre-flight → /test-coverage → /architecture-check → /design-review (if applicable) → /ai-review

4. Open a PR with /pull-request or /pr-description.

5. Auxiliary wrap-up (if applicable)
   Post-PR: GitHub bots; after merge: /complete-ticket.
```

**Config / infra**

```
Next Steps for [TICKET-KEY] - [Ticket Title]

Auxiliary: /update-config for secrets, env, or hooks; /council if touching unknown infra;
  /sync if framework copies may be stale; /init-project if repo never initialized.

1. Make the config change and validate locally if possible.

2. Pre-PR gate (adapt to change size): /pre-flight → /test-coverage or targeted tests →
   /architecture-check if architecture docs exist → /design-review if N/A → /ai-review if code changed.

3. Document the change in the PR description (/pull-request or /pr-description).

4. Auxiliary wrap-up: post-PR GitHub bots; after merge /complete-ticket.
```

**Docs / copy**

```
Next Steps for [TICKET-KEY] - [Ticket Title]

Auxiliary: /council only if repo layout for docs is unfamiliar; /sync rarely.

1. Make the content changes.

2. Run markdownlint if editing .md files: `pnpm run lint` (or `pnpm exec markdownlint <file>`).

3. Pre-PR gate (light): /pre-flight - include markdownlint if your pre-flight covers it.
   If only docs: /test-coverage and /architecture-check often N/A - say so explicitly.

4. Open a PR with /pr-description or /pull-request.

5. Auxiliary wrap-up: post-PR bots; after merge /complete-ticket.
```

### Presentation rules

- Output the **matching block** only - do not show all five blocks - **but** always merge in **applicable rows from the Auxiliary checklist** (or a short **Auxiliary** subsection). Never present only the primary numbered steps when an auxiliary item applies (e.g. unfamiliar code without `/council`, missing config without `/update-config`, agent path without HITL, or merge without `/complete-ticket`).
- Substitute real values for `[TICKET-KEY]`, `[Ticket Title]`, and `<feature>` / `<module>` placeholders using information from the ticket.
- If the ticket has AC bullet points, list them explicitly under step 1 as a quick reference so the developer doesn't have to re-open Jira.
- For Feature / story blocks: include step 0 (Figma check) only when the ticket involves UI. Signal words: "component", "page", "screen", "layout", "UI", "design", "visual", "style", "theme", "icon", or labels like `ui`, `frontend`, `design`.
- When including step 0, immediately call `show_project_config` to resolve the Figma file key - surface the result inline so the developer doesn't have to run it themselves.
