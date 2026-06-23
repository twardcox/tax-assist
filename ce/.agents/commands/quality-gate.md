---
description: Run quality gate checklist for phase transitions in Coherence Engine framework
argument-hint: [phase-name: sow|prd|milestone|epic|task|dev|test|review|deploy]
---

## Task

Run the quality gate checklist for the specified CE phase transition.

## How to Read the Artifact

When evaluating an artifact (SOW+, PRD, milestone, epic, task), use `list_artifacts` then `read_artifact` if the document is not found locally - this reads from server storage or workspace `agent-docs/` only (not Google Drive).

## Phase Checklists

### SOW+ → PRD

```markdown
## Quality Gate: SOW+ Approval

- [ ] Business problem clearly defined
- [ ] Success criteria are measurable
- [ ] Scope is bounded (in/out defined)
- [ ] Constraints documented
- [ ] Stakeholders identified
- [ ] Risks assessed
- [ ] Architecture template started

**Approvers:** Product Owner, Stakeholders
```

### PRD → Milestones

```markdown
## Quality Gate: PRD Approval

### System PRD

- [ ] Vision clearly articulated
- [ ] All milestones identified
- [ ] Dependency graph complete
- [ ] Shared context defined
- [ ] Cross-cutting concerns documented
- [ ] Architecture template referenced

### Milestone PRDs

- [ ] Impact on other milestones documented
- [ ] All user stories have acceptance criteria
- [ ] Edge cases identified
- [ ] Non-functional requirements specified
- [ ] Epic breakdown complete

**Approvers:** Product Owner, Tech Lead
```

### Milestones → Epics

```markdown
## Quality Gate: Milestone Plan Approval

- [ ] Corresponding Milestone PRD approved
- [ ] Timeline realistic (validated with tech)
- [ ] Resource requirements identified
- [ ] Risks assessed with mitigations
- [ ] Critical path identified
- [ ] Buffer included (20-30%)
- [ ] Dependencies documented

**Approvers:** Tech Lead, PM
```

### Epics → Tasks

```markdown
## Quality Gate: Epic Approval

- [ ] All user stories complete
- [ ] Acceptance criteria in Given/When/Then
- [ ] API contracts documented
- [ ] Data models detailed
- [ ] Test scenarios comprehensive
- [ ] Dependencies identified

**Approvers:** Tech Lead
```

### Tasks → Development

```markdown
## Quality Gate: Task Ready

- [ ] Acceptance criteria clear
- [ ] Dependencies resolved
- [ ] Design readiness complete (if UI work) — `/design-review` epic mode; **READY FOR DEVELOPMENT** or overrides logged
- [ ] Test approach defined
- [ ] Estimate validated

**Approvers:** Tech Lead
```

### Development → Code Review

```markdown
## Quality Gate: Ready for Review

**Automated Checks:**

- [ ] All tests passing
- [ ] Type checking clean
- [ ] Linter passing
- [ ] Coverage ≥ 80%
- [ ] Security scan clean
- [ ] Build succeeds

**Self-Review:**

- [ ] All acceptance criteria implemented
- [ ] Edge cases handled
- [ ] Error handling complete
- [ ] No debug code left
- [ ] PR description complete

**Approvers:** Peer Developer
```

### Code Review → Deploy

```markdown
## Quality Gate: Merge Ready

- [ ] All review comments resolved
- [ ] At least one approval
- [ ] CI pipeline green
- [ ] No merge conflicts
- [ ] Documentation updated

**Approvers:** Code Reviewer
```

## Output

```markdown
# Quality Gate: [Phase] → [Next Phase]

**Date:** [Date]
**Artifact:** [Document/PR being evaluated]

## Checklist Results

| Item     | Status | Notes       |
| -------- | ------ | ----------- |
| [Item 1] | ✅     | Verified    |
| [Item 2] | ⚠️     | Minor issue |
| [Item 3] | ❌     | Blocking    |

## Summary

- Passed: X/Y
- Warnings: Z
- Blocking: A

## Recommendation

[APPROVE / APPROVE WITH NOTES / BLOCK]

## Required Actions

- [ ] [Action to resolve blocking items]
```
