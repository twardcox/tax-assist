# Sprint Planning - Sprint Planning

**Owner:** PM/PO with Developer Input
**AI Role:** Sprint Planner & Capacity Allocator

## Purpose

Create sprint plans from milestones, epics, and user stories. Assign stories to sprints with capacity, goals, and dependencies. Output sprint plan documents and optionally sync sprint assignments to Jira.

## Inputs

| Source           | Content                                           |
| ---------------- | ------------------------------------------------- |
| **Milestones**   | Milestone execution plans, timeline, dependencies |
| **Epics**        | Epic specs with user stories                      |
| **User Stories** | Jira Story tickets (one per user story)           |

## AI-Assisted Activities

### 1. Sprint Plan Creation

```
Process:
1. Read milestone plans (Milestones) - timeline, epic breakdown, dependencies
2. Read epic specs (Epics) - user stories per epic
3. Read Jira Story tickets (User Stories) - keys, priorities, blockers
4. Group stories into sprints (1–2 weeks each) respecting:
   - Milestone boundaries
   - Dependencies and blockers
   - Team capacity and velocity
   - Demoable outcomes per sprint
5. Produce sprint-plan.md (or sprint-1-plan.md, sprint-2-plan.md, etc.)
```

### 2. Capacity Allocation

```
AI Prompt Template:
"Given these milestones: [paste milestone plans]
And these epics/stories: [paste epic specs + Jira keys]

Create sprint plans that:
1. Map each milestone to a sprint sequence
2. Assign stories to sprints with capacity (story points or hours)
3. Ensure each sprint has a clear goal (demoable outcome)
4. Respect dependencies - no story before its blockers
5. Balance load across sprints
6. Include buffer for unknowns"
```

### 3. Jira Sprint Sync (Optional)

```
After sprint plan approval:
1. Use jira_list_boards and connect_jira_project with board_id
2. Use jira_list_sprints to see existing sprints
3. Create sprints via Jira Agile API if needed (jira_create_sprint if exposed)
4. Use jira_assign_issues_to_sprint to assign Story tickets
5. Update jira-structure markdown with [sprint: Sprint Name] tags for traceability
```

## Deliverable

Sprint plan document(s) in `agent-docs/`:

- **sprint-plan.md** - Single document with all sprints, or
- **sprint-1-plan.md**, **sprint-2-plan.md**, … - One file per sprint

Use [sprint-plan-template.md](./sprint-plan-template.md) as the scaffold.

## Templates

| Template                                             | Purpose                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| [sprint-plan-template.md](./sprint-plan-template.md) | Sprint plan scaffold - goals, stories, capacity, dependencies |

## Quality Gate: Sprints Ready for Development

**Checklist:**

- [ ] All user stories assigned to a sprint
- [ ] Sprint goals are demoable
- [ ] Dependencies respected (no story before blockers)
- [ ] Capacity balanced across sprints
- [ ] Milestone alignment preserved
- [ ] Sprint assignments synced to Jira (if using Jira)
- [ ] PM/PO has validated sprint plan

---

## After each sprint

When a sprint **ends** (after sprint review or when the sprint is closed in Jira), PMO runs **`/sprint-complete`** from the planning client (e.g. Cowork). That playbook builds a **single** report: sprint outcomes vs the sprint plan (carryover, short retrospective notes) plus the full cross-phase status pipeline aligned with the **`project_status`** MCP prompt (Jira snapshot first, then artifacts, quality, traceability, token usage; optional GitHub). The report is saved under **`reports/`** via **`save_report`** (e.g. `sprint-<n>-complete-YYYY-MM-DD.md`).

---

**Handoff to Development:** Run **`init_project`** (or **`/init-project`** in the dev IDE) **once the first time** the developer opens the project for Development - sets up `.ce-project.json` and MCP setup instructions. Not required before every dev session. Then hand off with the CE MCP server URL (see tool output).

## Related Documentation

- [Milestones - Milestones](../Milestones/) - Milestone plans (upstream)
- [Epics - Epics](../Epics/) - Epic specs (upstream)
- [User Stories - User Stories](../User%20Stories/) - Jira Story tickets (upstream)
- [Development - Development](../Development/) - Implementation (downstream)
