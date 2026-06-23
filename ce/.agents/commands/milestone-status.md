---
description: Get comprehensive status of current milestone including progress, blockers, and next steps
argument-hint: [milestone-id]
---

## Task

Generate a comprehensive status report for the specified milestone using live Jira ticket data.

## Process

### Step 1: Confirm project and load milestone artifact

1. Call `show_project_config` to confirm the active project and Jira project key.
2. Call `list_artifacts` to find the matching milestone artifact (e.g. `M1-*` or matching the
   argument). Then call `read_artifact` to load its content. If no local path
   (`docs/milestones/[milestone]/`) exists, use the MCP server artifact.

### Step 2: Fetch Jira data

**Always attempt Jira tool calls.** Do not skip this step or write placeholder ticket data.

Call `jira_search_issues` using the Jira project key from Step 1. Filter to this milestone's
tickets using the best available signal (try in order, stop at first match):

1. **Epic children** — if the milestone maps to a Jira epic:
   `"Epic Link" = EPIC_KEY ORDER BY status ASC`
2. **Sprint** — if a sprint name matches the milestone:
   `sprint = "Sprint Name" ORDER BY status ASC`
3. **Label** — if a milestone label exists:
   `labels = "milestone-N" ORDER BY status ASC`
4. **Project fallback** — if none of the above apply:
   `project = PROJECT_KEY ORDER BY updated DESC` (max_results: 50)

If Jira is not configured or all calls fail, state that clearly under **### Jira status** and
continue with local artifact data only. In that case, prompt the user to verify Jira credentials
via `show_project_config` rather than writing placeholder ticket values.

### Step 3: Calculate metrics from Jira results

Count issues by status category from the `jira_search_issues` response:

- **Completed** — statusCategory = "Done"
- **In Progress** — statusCategory = "In Progress"
- **Blocked** — issues with non-empty `blockedBy` field
- **Remaining** — statusCategory = "To Do" and not blocked

### Step 4: Identify issues

From the Jira results, extract:

- Blocked tickets and their blockers (from `blockedBy` fields)
- Dependencies not yet resolved
- Scope changes since sprint start
- Resource constraints visible from assignee/unassigned tickets

### Step 5: Derive next steps from real Jira data

Populate **Next Steps** in priority order from actual ticket data:

1. **Unblock** — one action item per blocked ticket, naming the blocker
2. **In Progress** — highest-priority in-progress tickets not yet complete
3. **Start next** — highest-priority To Do tickets to begin after blockers clear

Do **not** write generic placeholder next steps. If Jira data is unavailable, tell the user
explicitly so they can resolve the integration rather than receiving invented data.

## Output Format

All ticket keys, summaries, and statuses must come from Jira. Replace the examples below with
real data.

```markdown
# Milestone Status: [Milestone Name]

**Generated:** [Date]
**Sprint:** [Current sprint name from Jira, or "—" if none]

## Progress Overview

[██████████░░░░░░░░░░] 50% Complete

| Metric        | Value |
| ------------- | ----- |
| Total Tickets | X     |
| Completed     | Y     |
| In Progress   | Z     |
| Blocked       | A     |
| Remaining     | B     |

## Jira Status

(From `jira_search_issues`: status counts, blockers, sprint if active. If Jira was unavailable,
state that here and explain how to reconnect.)

## Ticket Breakdown

### ✅ Completed (Y)

- [x] PROJ-101: [real ticket summary from Jira]
- [x] PROJ-102: [real ticket summary from Jira]

### 🔄 In Progress (Z)

- [ ] PROJ-103: [real ticket summary] (assignee if known)
- [ ] PROJ-104: [real ticket summary]

### 🚫 Blocked (A)

- [ ] PROJ-105: [real ticket summary]
  - **Blocker:** [actual blocker from Jira blockedBy field]

### 📋 Remaining (B)

- [ ] PROJ-106: [real ticket summary]
- [ ] PROJ-107: [real ticket summary]

## Velocity

| Sprint          | Planned | Completed | Velocity |
| --------------- | ------- | --------- | -------- |
| [sprint name 1] | X       | Y         | Z%       |
| [current]       | X       | Y         | Z%       |

**Average Velocity:** Z%
**Projected Completion:** [Date calculated from velocity]

## Blockers & Risks

| Issue                             | Impact | Owner    | ETA    |
| --------------------------------- | ------ | -------- | ------ |
| [blocker from Jira or known risk] | High   | [person] | [date] |

## Recent Activity

From `progress.txt` and git log (if available):

- [Date]: [actual recent activity]

## Next Steps

(Derived from Jira data — do not invent)

1. [ ] [Action to unblock PROJ-105: description of blocker resolution]
2. [ ] [Continue PROJ-103: what remains]
3. [ ] [Start PROJ-106: next highest-priority To Do ticket]

## Notes for Stakeholders

[Summary suitable for status meeting, based on real data above]
```
