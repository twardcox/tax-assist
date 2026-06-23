# Jira Structure Template

**Purpose:** Use this exact format when creating epic/user-story markdown for `jira_sync_specs`. The parser requires these headings and field labels verbatim. Do not invent new fields or change labels.

**User Stories creates one Jira Story per user story.** All acceptance criteria from the epic spec are included in each Story's description - do not create separate Task tickets per AC.

For **UI-heavy** epics, define **more user stories** (each still one Jira Story) ordered from **shared components/blocks** toward **full screens or flows** (Atomic Design–style; see Epics [GUIDELINES.md](./GUIDELINES.md)). Use **Blockers** so foundation stories precede composition stories.

---

## Epic: [Epic Title] [sprint: Sprint Name]

Summary: [One-line summary of the epic]
Outcome Statement: [What success looks like]
Objective: [Primary goal]
Success Metric (Baseline → Target): [Measurable baseline and target]
Scope: [In-scope and out-of-scope items]
Risks/Deps: [Key risks and dependencies]

- [ ] Story: [User story title in "As a... I want... So that..." form]
  - Key: TBD
  - Summary: [One-line summary]
  - Outcome Statement: [What success looks like]
  - Objective: [Primary goal]
  - Success Metric (Baseline → Target): [Measurable baseline and target]
  - Scope: [In-scope items]
  - Acceptance Criteria: [All ACs for this user story - Given/When/Then format, one per line or bullet]
  - Risks/Deps: [Risks and dependencies]

---

## Field Reference

| Field                              | Required    | Notes                                                                           |
| ---------------------------------- | ----------- | ------------------------------------------------------------------------------- |
| Summary                            | Yes         | One-line description                                                            |
| Outcome Statement                  | Yes         | What success looks like                                                         |
| Objective                          | Yes         | Primary goal                                                                    |
| Success Metric (Baseline → Target) | Yes         | Use arrow → not ->                                                              |
| Scope                              | Yes         | In-scope and out-of-scope                                                       |
| Acceptance Criteria                | Yes (Story) | All ACs for this user story; include all Given/When/Then criteria from the epic |
| Risks/Deps                         | Yes         | Key risks and dependencies                                                      |
| Key                                | Per story   | Use `TBD` for new stories; real key (e.g. PROJ-123) for existing                |
| Blockers                           | Optional    | Comma-separated keys or titles                                                  |

## Format Rules

- Epic heading: `## Epic: Title [sprint: Sprint Name]`
- Story: `- [ ] Story: Title` (one Story per user story; do not create Task tickets per AC)
- Nested fields: `  - FieldName: value` (two spaces before the dash)
- Use exact labels; variations like "Success Metric (Baseline -> Target)" are normalized, but prefer `→`
