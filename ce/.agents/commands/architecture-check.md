---
description: Validate proposed changes against the project's architecture template
argument-hint: [change-description]
---

## Task

Validate the proposed changes against the project's Architecture Template to ensure consistency and alignment.

## Process

### Step 1: Load Architecture Context

Look for architecture documentation:

- `docs/architecture-template.md`
- `ARCHITECTURE.md`
- `docs/adr/` (Architecture Decision Records)

If not found locally, use `list_artifacts` then `read_artifact` to fetch architecture documents from the MCP server (server storage or workspace `agent-docs/` - not Google Drive).

### Step 2: Analyze Proposed Changes

Identify what areas the changes affect:

- [ ] Tech stack (languages, frameworks)
- [ ] Frontend architecture
- [ ] Backend architecture
- [ ] Database/data layer
- [ ] Infrastructure/hosting
- [ ] CI/CD pipeline
- [ ] Testing approach
- [ ] Monitoring/observability
- [ ] Security

### Step 3: Validate Against Architecture

For each affected area, check:

| Area   | Architecture Says  | Change Proposes | Compatible? |
| ------ | ------------------ | --------------- | ----------- |
| [Area] | [Defined approach] | [New approach]  | ✅/⚠️/❌    |

### Step 4: Identify Concerns

**Compatibility Issues:**

- [Issue 1]
- [Issue 2]

**Missing ADRs:**

- [Decision that needs documentation]

**Recommended Actions:**

- [Action 1]
- [Action 2]

## Output Format

```markdown
# Architecture Validation: [Change Description]

## Summary

[One paragraph summary of validation results]

## Affected Areas

- ✅ Frontend: Compatible with React/Next.js stack
- ⚠️ Database: New table, needs migration review
- ❌ Security: Violates auth pattern - needs ADR

## Compatibility Matrix

| Area       | Status | Notes                           |
| ---------- | ------ | ------------------------------- |
| Tech Stack | ✅     | Uses approved libraries         |
| Data Layer | ⚠️     | New index needed                |
| Security   | ❌     | Custom auth bypasses middleware |

## Required Actions

### Before Implementation

- [ ] Create ADR for auth exception
- [ ] Review migration with DBA
- [ ] Update architecture doc section 5.2

### Architecture Debt

- [ ] [Technical debt item to track]

## Recommendation

[PROCEED / PROCEED WITH CAUTION / BLOCK]

[Explanation of recommendation]
```
