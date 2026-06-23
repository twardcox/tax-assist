---
description: Generate the CE cross-phase project status report (Jira, artifacts, spec quality, traceability, token usage, optional GitHub) and save to reports/
---

## Task

The user invoked `/project-status-report`. Produce a **comprehensive cross-phase status document** - equivalent to the **`project_status`** MCP prompt - and save it under `reports/`.

## Preferred: MCP prompt

1. Run the **`project_status`** prompt (**`GetPrompt`** / your client's prompts picker) with `include_jira` and `include_github` as needed (defaults: both `true`).
2. Follow the prompt **in order**.
3. Finish with **`save_report`** (e.g. `project-status-YYYY-MM-DD.md` under `reports/`).

## Fallback pipeline (if the prompt is unavailable)

Run these tools in order, then compose the report:

1. **Jira (when enabled)**

   - `jira_snapshot` with `save_to_file: true`
   - If it fails (e.g. API `400`), use `jira_search_issues` with JQL `project = <KEY> ORDER BY updated DESC` and `max_results: 50`; note that no `reports/jira-snapshot-*.json` was created

2. **Artifacts**

   - `list_artifacts` - coverage by phase; call out missing critical docs

3. **Spec quality**

   - `generate_spec_quality_audit` - summary and top issues

4. **Traceability**

   - `generate_traceability_report` - coverage gaps between specs and Jira

5. **Token usage**

   - `get_token_usage` - high-level summary; note optimization opportunities

6. **GitHub (optional)**
   - `github_list_open_prs` and `github_get_ci_status` if GitHub is in scope

## Report structure

Use the same section names as the `project_status` prompt:

- **### Jira status**
- **### Phase completion**
- **### Spec quality**
- **### Traceability**
- **### Token usage**
- **### GitHub** (if included)
- **### Next actions** - 3–7 concrete bullets (who / what / when if known)

## Save

- `save_report` with filename `project-status-YYYY-MM-DD.md` under `reports/`
- Show the first ~40 lines in chat and the full path to the saved file

## Rules

- This is a **read-only** report - do not create or modify phase artifacts, tickets, or specs.
- Run after planning phases are complete or when a cross-phase health check is needed.
- If Jira is unavailable, note it explicitly and continue with the remaining steps.
