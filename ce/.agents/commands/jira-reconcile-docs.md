---
description: Reconcile Jira tickets against CE agent-docs and specs/tasks to surface out-of-band work
argument-hint: [--annotate] [--label <label>] [--save-report]
---

## Task

Identify Jira tickets that exist in the project but have **no corresponding entry** in CE documentation (`agent-docs/` or `specs/tasks/`). These are typically tickets created outside the CE workflow (manual, out-of-band). Optionally annotate them in Jira and save a reconciliation report.

## Process

### Step 1: Confirm inputs

Before running, confirm:

- The CE MCP server is connected and `jira_reconcile_docs` is available.
- A `jira-structure.md` (or equivalent) exists in `agent-docs/` (produced by a prior `jira_snapshot`). If it is missing, run `jira_snapshot` first to generate it.
- If the user provided `--label <value>`, capture it as `new_ticket_label`.
- If the user provided `--annotate`, set `annotate_new_tickets: true`.
- If the user provided `--save-report`, set `save_report: true`.

### Step 2: Run reconciliation

Call **`jira_reconcile_docs`** with:

```json
{
  "jira_structure_filename": "jira-structure.md",
  "include_specs_tasks": true,
  "save_report": <true if --save-report flag or user asked>,
  "annotate_new_tickets": <true if --annotate flag or user asked>,
  "new_ticket_label": "<label if provided, omit otherwise>"
}
```

### Step 3: Present results

Output the reconciliation report verbatim. Then add a brief summary section:

```markdown
## Reconciliation Summary

**Tickets in Jira, not in docs (out-of-band):** N

### Recommended actions

- [ ] Review each out-of-band ticket - decide: create a spec in `specs/tasks/`, move to backlog, or close as invalid.
- [ ] If annotating was not enabled and you want Jira comments + labels added, re-run with `--annotate [--label ce-needs-spec]`.
- [ ] If you need a saved copy, re-run with `--save-report` (writes to `reports/`).
```

### Step 4: Offer next steps

Ask the user if they want to:

1. **Annotate** out-of-band tickets now (add Jira comment + label) - re-run with `annotate_new_tickets: true`.
2. **Create task specs** for any of the listed tickets - use `save_artifact` to write a stub `specs/tasks/<KEY>.md`.
3. **Close or ignore** tickets that are not CE-tracked work - no action needed from the tool.

## Notes

- `jira_reconcile_docs` compares Jira's live issue list against known ticket keys derived from `jira-structure.md` **and** filenames in `specs/tasks/` (e.g. `PROJ-123.md`). Both sources are checked by default.
- Annotating tickets adds a Jira comment explaining the CE workflow and suggesting next steps; it does not transition or delete anything.
- The `new_ticket_label` (e.g. `ce-needs-spec`) makes it easy to filter out-of-band work in Jira board views.
- For periodic automated checks, the server also exposes a **`POST /reconcile`** HTTP endpoint - see [Tools reference](https://coherence-engine.fly.dev/ce/docs/tools-reference.md) for details.
