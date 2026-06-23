---
description: After a sprint ends - sprint outcomes vs plan plus full CE project status; save one report to reports/
argument-hint: [sprint-name-or-number]
---

## Task

When a **sprint is complete** (after sprint review or when the team closes the sprint), generate **one** markdown report that:

1. Summarizes **this sprint**: planned goal and stories vs actual delivery, carryover, and short retrospective notes.
2. Runs the **same pipeline as the `project_status` MCP prompt** (cross-phase artifacts, quality, traceability, token usage; Jira first when enabled; optional GitHub).

Persist everything in a **single** file via **`save_report`** under **`reports/`**.

Use **`$ARGUMENTS`** when the user names a sprint (name, number, or Jira sprint id). If **`$ARGUMENTS`** is empty, infer the sprint from the latest closed sprint in Jira, or from **`agent-docs/`** sprint plan documents (`sprint-plan.md`, `sprint-N-plan.md`).

## Process

### A. Sprint closure context

1. Resolve which sprint this report covers (from **`$ARGUMENTS`**, or Jira **`jira_list_sprints`** / board context, or the sprint plan artifact that matches the current cadence).
2. Load the **sprint plan** for that sprint: **`list_artifacts`** then **`read_artifact`** for the relevant file in **`agent-docs/`** (e.g. `sprint-plan.md` or `sprint-3-plan.md`). If only a combined `sprint-plan.md` exists, extract the section for this sprint.
3. If Jira is configured: use **`jira_search_issues`** (or data from **`jira_snapshot`** in the next section) to list Story issues tied to this sprint and compare **planned vs Done** vs **carryover** (not completed in this sprint).
4. Draft these **sprint-only** sections (you will prepend them to the full report in section C):
   - **Sprint identity** - name, dates if known, link to plan artifact path.
   - **Goal vs outcome** - sprint goal from the plan vs what shipped (from Jira statuses and plan).
   - **Stories** - table or list: key, summary, planned, final status; **carryover** called out explicitly.
   - **Lightweight retrospective** - bullets: goals met?, blockers, risks, dependencies for the **next** sprint.

### B. Full project status (same order as `project_status`)

Follow the **`project_status`** MCP prompt - **Jira first** when including Jira, then artifacts, audits, token usage, optional GitHub.

**Rules**

- **Jira is proactive:** Call **`jira_snapshot`** with **`save_to_file: true`** before other steps (after you have sprint context). Lead the report with **### Jira status** using the snapshot breakdown. If **`jira_snapshot`** fails, try **`jira_status`** once; if Jira is unavailable, state that under **### Jira status** and continue.
- **Persist:** Use **`save_report`** once at the end with the **full** combined markdown (sprint sections + project status outline below).

**Steps (order matters)**

1. **Jira first:** **`jira_snapshot`** with **`save_to_file: true`** (JSON under **`reports/`** when successful). Optionally **`get_slash_command`** (`command_name`: **`milestone-status`**) for narrative milestone context if useful.
2. **`list_artifacts`**
3. **`generate_spec_quality_audit`**
4. **`generate_traceability_report`**
5. **`get_token_usage`** - include in report
6. If including GitHub: **`github_list_open_prs`**, then **`github_get_ci_status`**

(Use **`include_jira`** / **`include_github`** semantics as in **`GetPrompt`** **`project_status`**: default both on unless the user asks to skip.)

### C. Single combined report and save

Merge **A** (sprint closure) **above** the standard outline from **`project_status`**:

**Report outline**

- **### Sprint complete** - (from step A: identity, goal vs outcome, stories, carryover, retrospective bullets)
- **### Jira status** - (from **`jira_snapshot`**; mention **`reports/jira-snapshot-*.json`** when **`save_to_file`** was true)
- **### Phase Completion**
- **### Spec Quality**
- **### Traceability**
- **### Token Usage**
- **### GitHub** - (if applicable)
- **### Next Actions**

Call **`save_report`** with:

- **`filename`:** e.g. **`sprint-<n>-complete-YYYY-MM-DD.md`** (use the resolved sprint number or a slug from the sprint name)
- **`content`:** the full merged markdown

## Output

In chat, give a short summary and the path under **`reports/`** where the file was saved.
