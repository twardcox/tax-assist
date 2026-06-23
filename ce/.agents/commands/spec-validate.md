---
description: Validate specification completeness and quality for any CE artifact
argument-hint: [spec-file-path]
---

## Task

Validate the completeness and quality of an CE specification document.

## How to Read the Spec

- **If a path is provided** (e.g. `specs/tasks/BA1631-247.md`): Try reading from the filesystem first.
- **If the file does not exist locally** or the argument is a ticket key (e.g. `BA1631-247`): Use `list_artifacts` to see available artifacts, then `read_artifact` with the filename (e.g. `BA1631-247.md`). This reads from server storage or workspace `agent-docs/` only (not Google Drive).
- **If no argument is provided**: Use `list_artifacts` to list available specs, then `read_artifact` for the one to validate.

## Validation Criteria

### Structure Check

- [ ] All required sections present
- [ ] Follows template format
- [ ] Consistent formatting
- [ ] No placeholder text remaining

### Content Quality

- [ ] Requirements are specific and measurable
- [ ] Acceptance criteria use Given/When/Then
- [ ] No ambiguous language ("should", "might", "etc.")
- [ ] Edge cases documented
- [ ] Dependencies clearly stated

### Traceability

- [ ] Links to parent documents
- [ ] References to related specs
- [ ] Glossary terms used consistently

### Testability

- [ ] Each requirement is testable
- [ ] Test scenarios included
- [ ] Success criteria measurable

## Validation by Spec Type

### SOW+

- [ ] Executive summary present
- [ ] Business objectives clear
- [ ] Success criteria quantifiable
- [ ] Scope boundaries defined
- [ ] Constraints listed
- [ ] Risks identified

### System PRD

- [ ] Vision articulated
- [ ] Milestones mapped
- [ ] Dependencies graphed
- [ ] Shared context complete
- [ ] Glossary defined

### Milestone PRD

- [ ] Objective stated
- [ ] Impact analysis complete
- [ ] User stories with criteria
- [ ] Functional requirements prioritized
- [ ] Technical specs detailed
- [ ] Epic breakdown present

### Epic

- [ ] User stories complete
- [ ] API contracts defined
- [ ] Data models detailed
- [ ] UI requirements specified
- [ ] Test scenarios listed

### Task

- [ ] Acceptance criteria specific
- [ ] Dependencies resolved
- [ ] Estimate included
- [ ] Test approach defined
- [ ] No ambiguity

## Output

```markdown
# Spec Validation: [Document Name]

**Type:** [SOW+/PRD/Epic/Task]
**Date:** [Date]
**Version:** [Version]

## Validation Summary

| Category     | Score | Status   |
| ------------ | ----- | -------- |
| Structure    | X/Y   | ✅/⚠️/❌ |
| Content      | X/Y   | ✅/⚠️/❌ |
| Traceability | X/Y   | ✅/⚠️/❌ |
| Testability  | X/Y   | ✅/⚠️/❌ |

**Overall Score:** X/100

## Issues Found

### 🔴 Critical (Must Fix)

1. [Issue]: [Location] - [Recommendation]

### 🟡 Warnings (Should Fix)

1. [Issue]: [Location] - [Recommendation]

### 🔵 Suggestions (Nice to Have)

1. [Suggestion]: [Location]

## Ambiguous Language Detected

| Term     | Location    | Suggested Replacement |
| -------- | ----------- | --------------------- |
| "should" | Section 3.2 | "must" or "may"       |
| "etc."   | Section 4.1 | List specific items   |

## Missing Sections

- [ ] [Section name] - Required for [reason]

## Recommendation

[APPROVED / NEEDS REVISION / MAJOR REWORK]

## Next Steps

1. [ ] Address critical issues
2. [ ] Review warnings
3. [ ] Re-validate after changes
```
