# Sprint Planning - Guidelines

**Shared guidelines:** See [SHARED-GUIDELINES.md](../SHARED-GUIDELINES.md) for Phase Checkpoint Protocol and File Creation Verification.

---

## Sprint Planning Review Checklist

When presenting the sprint plan for approval, include this checklist. The PM/PO must confirm each before responding `Output Approved.`:

- [ ] All user stories assigned to a sprint
- [ ] Sprint goals are demoable (each sprint delivers a testable outcome)
- [ ] Dependencies respected - no story scheduled before its blockers
- [ ] Capacity balanced - no sprint overloaded relative to team velocity
- [ ] Milestone alignment preserved - sprint sequence matches milestone order
- [ ] Sprint assignments synced to Jira (if project uses Jira)
- [ ] Ready for development handoff - developers can pick from sprint backlog

---

## After sprint completion

When the sprint is **done**, PMO runs **`/sprint-complete`** to produce one markdown report in **`reports/`**: sprint outcomes vs plan (including carryover) and the same project-wide status steps as the **`project_status`** MCP prompt. See the **`sprint-complete`** slash command in **`ce/.claude/commands/`**.

---

## Sprint Planning Principles

### Sprint Duration

- Default: 1–2 weeks per sprint
- Align with team cadence (e.g., 2-week sprints for Scrum)

### Sprint Goals

Each sprint should have a **demoable outcome** - something the team can show at sprint review.

| Good                                | Avoid                |
| ----------------------------------- | -------------------- |
| "User can log in and see dashboard" | "Complete 5 stories" |
| "Checkout flow end-to-end"          | "Backend API work"   |

### Capacity

- Use story points or hours based on team practice
- Include buffer (e.g., 20%) for unknowns
- Do not overcommit - undercommit and overdeliver

### Dependencies

- Never schedule a story before its blockers
- Group dependent stories in the same sprint when possible
- Call out cross-sprint dependencies explicitly
