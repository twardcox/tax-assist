# Development - Development

**Owner:** Developer
**AI Role:** Implementation Assistant

## Purpose

Implement the task according to specification.

## First-time setup - `init_project`

**Run once per project** (first time you open the repo in your dev IDE for Development). Do not run before every session - it is only needed once to get the right structure and automations in place:

- **init_project** (SOW+, PM/PO via planning client) creates `output-docs/`, `research/`, and `reports/` locally and `agent-docs/`, `specs/tasks/`, and `.ce-project.json` on the server; `CLAUDE.md` (local).
- **`init_project`** (Development, Developer via dev IDE) when local ensures `.ce-project.json` exists and copies the Development bundle; when using server storage, config is stored only on the server and file copy is skipped - use **`get_init_files`** / **`/sync`**. Does NOT create research/, output-docs/, agent-docs/, or CLAUDE.md from scratch (those come from the planning client **`init_project`** / **`/new-project`** when needed). Copies `.cursor/rules/ce`, `.cursor/skills`, `.claude/skills`, `.ce/scripts` + `.ce/lib` (development scripts), `.github` (CI workflows), and `.husky` (git hooks) into the project when writable locally. Add project-specific rules alongside to augment the base ruleset.
- Ensures the repo layout matches the CE spec and that developers get clear instructions for **MCP setup** in their client (same server URL and auth; tools and playbooks load from the CE MCP server).

If the project was created via the framework from SOW+, these directories may already exist. Init is idempotent and safe to re-run if something is missing, but you do not need to run it every session.

### Refreshing copied framework files

When the MCP server (or this framework repo) is updated, your project’s **copies** of rules, scripts, `.github`, and `.husky` can drift. Run **`sync_init_files`** with **`apply: true`** to pull server versions into your tree (or follow **`/sync`** for hosted: HTTP zip or **`get_init_files`** JSON). Optionally use **`diff_init_files`** first to preview drift. Re-running **`init_project`** (local workspace) is still valid for a full copy.

## Starting Development - Pick a Ticket and Branch

To improve the initial developer experience, use the **start-ticket** flow before implementing:

1. **Pick a ticket** - In your dev IDE (e.g. Cursor), run `/start-ticket` or invoke the \`development_start_ticket\` prompt. The framework will:
   - List **ticket options** from your tracker (**To Do**: Story, Bug, Task, and other dev types your project uses). If you have **assigned** work in that search, you see **only** that list; if you have **none**, you see **only** **unassigned** tickets. Each line shows **key**, **type**, and **title**.
   - **End the first reply with three questions** (nothing after them): which **ticket key** to complete, **agent** or **yourself**, and branch from **current** or **main**.
2. **After you answer** - The framework shows ticket detail, then either path below.
3. **If you implement yourself** - The framework frames the task with a short description and suggests **relevant files to open** so you can start coding with context.
4. **If you work with an agent** - After the branch exists, invoke \`development\` with the ticket key. The agent asks you to **approve a concise plan** first, then for **each** plan step implements it, **shows the diff**, and waits for your approval or changes before the next step, then gives a **short summary**. After that, run the **pre-PR gate** including **`/ai-review`**. See the prompt for details.
5. **Branch** - Created after the three answers; the base is updated (you run `git fetch` / `git pull` as instructed), then a new branch includes the ticket number (e.g. `feature/PROJ-42-user-login`).

After the branch is created, implement (yourself or with the agent), run the **pre-PR gate**, then open the PR (see Validation and Slash Commands below). When **`/start-ticket`** outputs **Next Steps**, it includes **auxiliary** items (e.g. **`/council`**, **`/update-config`**, **`/sync`**, post-PR bots, **`/complete-ticket`**) alongside the primary numbered steps - account for both.

## AI-Assisted Activities

### 1. Implementation

**Agent-led work (HITL):** Use \`development\` after \`development_start_ticket\` has created the branch. The agent must: **(1)** present a **concise plan** and get **approval** before coding; **(2)** for **each** step: implement → **show the diff** → wait for approval or revisions → next step; **(3)** **final summary**; **(4)** **pre-PR gate** (including **`/ai-review`**).

**Self-led or ad-hoc assistant use:**

```
AI Prompt Template (for developer):
"Implement this task: [paste task specification]

Context files: [list relevant files]
Project conventions: [link to conventions or paste key ones]

Requirements:

1. Follow the acceptance criteria exactly
2. Include all specified tests (prefer TDD: failing tests first)
3. Ensure type safety per requirements
4. Implement security checks specified
5. Handle all edge cases documented
6. Follow project coding standards

Start by outlining your implementation approach, then proceed with code."
```

### 2. Test Generation

```
AI Prompt Template:
"For this implementation: [paste code]
And these test requirements: [paste from task]

Generate complete test suite including:

1. Unit tests for each function/method
2. Integration tests for workflows
3. Edge case tests
4. Error handling tests
5. Use [testing framework] syntax
6. Include setup/teardown as needed
7. Add descriptive test names and comments"
```

### 3. Code Review Preparation

```
AI Prompt Template:
"Review this code I implemented: [paste code]
Against these requirements: [paste acceptance criteria]

Check for:

1. All acceptance criteria met
2. Code quality issues
3. Potential bugs
4. Security vulnerabilities
5. Performance concerns
6. Missing error handling
7. Insufficient testing
8. Type safety issues
9. Documentation gaps
   Suggest improvements for any issues found."
```

### 4. Documentation Generation

```
AI Prompt Template:
"Generate documentation for: [paste code]

Include:

1. Function/method descriptions
2. Parameter descriptions with types
3. Return value descriptions
4. Usage examples
5. Error conditions and handling
6. Performance considerations (if any)
   Format in [JSDoc / Docstring / etc.] style"
```

## Process

### Step 1: Task Intake

1. **Optional:** Run `/start-ticket` (or \`development_start_ticket\`) to list ticket options, answer the three questions, then create the branch (see "Starting Development" above).
2. Or pick a ticket manually: review the board, then create feature branch: `feature/TASK-XXX-descriptive-name`.
3. Review task specification thoroughly.
4. Clarify any ambiguities with PM/PO.
5. Verify dependencies are complete and set up local environment.

### Step 2: Design Review (when required)

Before implementation, run **`/design-review`** (invokes the **Design Agent**). Do not start coding on UI work until the verdict is **READY FOR DEVELOPMENT** or a gap override is logged.

See [GUIDELINES.md §11](./GUIDELINES.md#11-design-considerations) for workflow, when review is required, and links to canonical checklists (`ce://agents/design`, `ce://commands/design-review`).

**Quick path (UI tickets):**

1. Invoke `design_validate_ticket` with the ticket key, or run **`/design-review`** in ticket mode.
2. Load **`ce://agents/design`** — full seven-dimension checklist and report format.
3. If **NOT READY**, escalate spec gaps to PMO in the planning client (or `Override: [gap] - [justification]`).
4. When Figma is configured: `show_project_config` → `toolkit.figma.fileKey` → **Figma MCP** `get_design_context` (see Design Agent boot sequence).
5. For API/schema/integration scope, use supplemental sections in **`ce://commands/design-review`** and **`/architecture-check`** as needed.
6. Pre-PR: run **`/design-review`** again in **delivery** mode; optional **`/council design`** for code-level fidelity.

### Step 3: Implementation

1. Write failing tests first (TDD approach recommended)
2. Implement functionality to pass tests
3. Refactor for code quality
4. Add documentation
5. Verify all acceptance criteria met

### Step 4: Validation (pre-PR gate)

Before opening a PR - **human or agent** - run the **slash playbooks** in **order** (from Cursor; bodies load from \`ce://commands/{name}\`):

1. **`/pre-flight`** - lint, format, type check, tests (or \`node .ce/scripts/pre-flight-check.cjs\` / \`pnpm run pre-flight\`)
2. **`/test-coverage`** - confirm coverage; TDD is the default - use this if tests were added late
3. **`/architecture-check`** - validate against architecture
4. **`/design-review`** - pre-PR pass: confirm implementation matches design (skip only when clearly N/A)
5. **`/ai-review`** - structured **pre-PR** review in your dev IDE (e.g. Cursor) from diff and spec (not a substitute for GitHub PR bots such as **Bugbot**, which run after the PR is open)

Re-run **`/pre-flight`** if any step changes code.

### Step 5: Manual Verification

1. Follow manual verification steps from task
2. Test in dev environment
3. Verify UI/UX (if applicable)
4. Test error scenarios
5. Document any deviations from spec

### Step 6: Prepare for Review

1. Complete the **pre-PR gate** (Step 4), including **`/ai-review`**
2. Commit with conventional commit messages (if not already committed)
3. Push feature branch
4. Open PR - **`/pull-request`** in your dev IDE, or **`/pr-description`** and create in GitHub
5. Fill out PR checklist and request review

## Deliverable

**Pull Request with:**

- Implemented code
- Comprehensive tests
- Updated documentation
- Passing CI checks
- PR description mapping to acceptance criteria

## Quality Gate: Ready for Code Review

**Automated Checks (must pass):**

- [ ] All tests passing
- [ ] Type checking clean (0 errors)
- [ ] Linter passing
- [ ] Code coverage meets threshold (80%+)
- [ ] Security scan clean (no high/critical issues)
- [ ] Build succeeds

**Developer Self-Review:**

- [ ] All acceptance criteria implemented
- [ ] All edge cases handled
- [ ] Error handling comprehensive
- [ ] Code follows project conventions
- [ ] Documentation complete and accurate
- [ ] No debug code or console.logs left
- [ ] No commented-out code
- [ ] No TODO comments without ticket reference
- [ ] Manual verification steps completed
- [ ] PR description complete

---

## Development Scripts (Development–IX)

After **`init_project`** has copied the Development bundle (or you used **`get_init_files`**), the following scripts are available in `.ce/scripts/`:

| Script                    | Purpose                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `pre-flight-check.cjs`    | Run lint, format check, type check, and unit tests before commit                        |
| `ai-review-prompt.cjs`    | Generate an AI code review prompt from your git diff (for Code Review)                  |
| `validate-branch.cjs`     | Validate branch name against the configured ticket pattern (used by pre-push)          |
| `validate-commit-msg.cjs` | Validate commit message includes ticket reference (used by commit-msg)                  |
| `hook-runner.cjs`         | Git hook dispatcher (pre-commit, commit-msg, pre-push, post-checkout)                   |

**Add to package.json** (recommended):

```json
{
  "scripts": {
    "pre-flight": "node .ce/scripts/pre-flight-check.cjs",
    "ai:review": "node .ce/scripts/ai-review-prompt.cjs --clipboard"
  }
}
```

**Optional: Husky hooks** - Configure husky to call `.ce/scripts/hook-runner.cjs` for pre-commit, commit-msg, pre-push, and post-checkout. Add a `toolkit` section to `.ce-project.json` to enable/disable individual hooks.

---

## Slash Commands

| Command              | Description                                                                      |
| -------------------- | -------------------------------------------------------------------------------- |
| `/start-ticket`      | Ticket options, three questions (ticket, self/agent, branch), then create branch |
| `/council`           | Multi-agent codebase exploration for unfamiliar areas                            |
| `/design-review`     | Validate design before implementation; pre-PR verification of delivery           |
| `/commit`            | Commit with conventional message; **15+ paths in scope → sequential-commit**     |
| `/sequential-commit` | Group uncommitted changes and commit logically (or auto-routed from `/commit`)   |
| `/pr-description`    | Generate PR description markdown from branch diff                                |
| `/pull-request`      | After pre-PR gate + `/ai-review`, push, `gh pr create`, ticket → Code Review      |
| `/test-coverage`     | Analyze coverage and generate missing tests                                      |

---

## Related Documentation

- [Sprint Planning - Sprints](../Sprints/) - Sprint planning (upstream)
- [Testing - Testing](../Testing/) - Testing (downstream)
- [AI Knowledge Base - Migrated Docs](https://docs.google.com/document/d/16n6lfJJYGHlLxUk702-2Xk6ooq_7KK5gCtnTN7whO14/edit?tab=t.0)
