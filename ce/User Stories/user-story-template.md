# User Story: [Title in "As a… I want… so that…" form]

> **Provenance:** Locally generated 2026-07-08 by intent-reconstruction from the Jira Structure Template (Milestones/GUIDELINES.md) field reference. Replace on upstream sync.

Use the exact field labels below — the `jira_sync_specs` parser requires them verbatim. One document section (or one Jira Story) per user story; **all** acceptance criteria included.

---

## Story: [As a user type, I want action, so that benefit]

- Key: TBD
- Epic: [EP-XXX — Epic name]
- Milestone: [MX]
- Summary: [One-line summary]
- Outcome Statement: [What success looks like when this story is done]
- Objective: [Primary goal]
- Success Metric (Baseline → Target): [Measurable baseline and target — use the arrow →]
- Scope: [In-scope items; out-of-scope in one line where confusion is plausible]
- Acceptance Criteria:
  - Given [context], when [action], then [result]
  - Given [context], when [action], then [result]
  - [Every AC from the epic spec — no omissions, no splits]
- Edge Cases:
  - [Case]: [Expected behavior]
- Risks/Deps: [Blocking stories by title or key; external dependencies]
- Estimate: [Points or hours, if the team estimates]

---

## Field Reference

| Field | Required | Notes |
| --- | --- | --- |
| Key | Yes | `TBD` until the ticket exists; then the real key (e.g. PROJ-123) |
| Epic / Milestone | Yes | Traceability up the spec chain |
| Summary | Yes | One line |
| Outcome Statement | Yes | What success looks like |
| Objective | Yes | Primary goal |
| Success Metric (Baseline → Target) | Yes | Use `→`, not `->` |
| Scope | Yes | In-scope (and out-of-scope when useful) |
| Acceptance Criteria | Yes | All Given/When/Then criteria from the epic |
| Edge Cases | When present in epic | Preserved verbatim or tightened, never dropped |
| Risks/Deps | Yes | Story-level blockers first |
| Estimate | Optional | Team convention |
