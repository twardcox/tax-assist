---
description: On-demand holistic project status (Jira, artifacts, quality, traceability, tokens, GitHub) - save to reports/
---

## Task

The user invoked `/pmo-status`. Produce a **single** holistic status document for the PMO **management loop**, similar in depth to the **`project_status`** MCP prompt but as a **slash-driven** session. Save the result under **`reports/`** via `save_report`.

## Pipeline (in order)

1. **Jira (when enabled)**

   - `jira_snapshot` with `save_to_file: true` if the tool supports it, under `reports/` (or the path that matches your org’s `jira_snapshot` convention)
   - If the snapshot call fails, use `jira_search_issues` with JQL `project = <KEY> ORDER BY updated DESC` and `max_results: 50` (or `jira_status`) and note the failure reason

2. **Artifacts**

   - `list_artifacts` - list coverage by phase; call out missing critical docs

3. **Spec quality**

   - `generate_spec_quality_audit` - include summary and top issues

4. **Traceability**

   - `generate_traceability_report` - summarize coverage gaps between specs and Jira (or work items)

5. **Token usage (framework health)**

   - `get_token_usage` - high-level summary; optional optimization tips from the report

6. **GitHub (optional)**
   - If the project uses GitHub: `github_list_open_prs` and, if useful, `github_get_ci_status` for default branch

## Report structure

Use the same **section** names as the `project_status` prompt for consistency (adapt if your prompt differs):

- **### Jira status**
- **### Phase / artifact completion** (or **### Phase completion**)
- **### Spec quality**
- **### Traceability**
- **### Token usage**
- **### GitHub** (if included)
- **### Next actions** - 3–7 concrete bullets (who / what / when if known)

## Save

- `save_report` with filename like `pmo-status-YYYY-MM-DD.md` under `reports/`
- Show the first ~40 lines in chat and the full path to the file

## Not in scope

- Do not run Gate-Check `phase_checkpoint` unless the user is explicitly at a phase transition
- **STOP** after saving unless the user asks for `/pmo-manage` for follow-up commands
