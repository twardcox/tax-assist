---
description: Create a System PRD from SOW+ and architecture template
argument-hint: [project-name]
---

## Task

Create a System PRD (system overview) that serves as the central document linking all milestone PRDs.

## Required Inputs

1. **SOW+** - Framework Statement of Work (internal spec) with business objectives
2. **Architecture Template** - Tech stack and infrastructure decisions

## Process

### Step 1: Gather Context

Ask for or locate:

- SOW+ document
- Architecture template

If these are not found locally, use `list_artifacts` then `read_artifact` to fetch from the MCP server (server storage or workspace `agent-docs/` - not Google Drive).

- Number of milestones planned
- Key stakeholders

### Step 2: Extract Core Elements

From SOW+:

- Vision and purpose
- Success metrics
- Constraints and assumptions
- Stakeholders

From Architecture:

- Tech stack summary
- Data models
- Integration points

### Step 3: Create Document

```markdown
# System Overview: [Project Name]

## Version History

| Version | Date   | Author | Changes |
| ------- | ------ | ------ | ------- |
| 1.0     | [Date] | [Name] | Initial |

---

## 1. Vision

[2-3 sentences from SOW+ describing core purpose]

---

## 2. Success Metrics

| Metric      | Target   | Measurement | Timeline |
| ----------- | -------- | ----------- | -------- |
| [From SOW+] | [Target] | [Method]    | [When]   |

---

## 3. Milestone Map

### 3.1 Overview

| ID  | Name   | Duration | Depends On | Delivers  | PRD Link             |
| --- | ------ | -------- | ---------- | --------- | -------------------- |
| M1  | [Name] | X weeks  | -          | [Outputs] | [milestone-1-prd.md] |
| M2  | [Name] | X weeks  | M1         | [Outputs] | [milestone-2-prd.md] |
| M3  | [Name] | X weeks  | M1, M2     | [Outputs] | [milestone-3-prd.md] |

### 3.2 Dependency Graph

[Mermaid diagram]

---

## 4. Shared Context

### 4.1 Tech Stack Reference

[Link to Architecture Template]

### 4.2 Data Models (Canonical)

[Core entities shared across milestones]

### 4.3 API Contracts (Shared)

[APIs used across multiple milestones]

### 4.4 Glossary

| Term   | Definition   | Used In      |
| ------ | ------------ | ------------ |
| [Term] | [Definition] | [Milestones] |

---

## 5. Cross-Cutting Concerns

### 5.1 Security

### 5.2 Performance

### 5.3 Accessibility

### 5.4 Compliance

---

## 6. Risks & Assumptions

[From SOW+ with additions]

---

## 7. Stakeholders

[RACI Matrix]

---

## 8. Milestone PRD Links

| Milestone | PRD                  | Status |
| --------- | -------------------- | ------ |
| M1        | [milestone-1-prd.md] | Draft  |
| M2        | [milestone-2-prd.md] | Draft  |

---

## 9. Approvals

| Role          | Name | Date | Status |
| ------------- | ---- | ---- | ------ |
| Product Owner |      |      | ☐      |
| Tech Lead     |      |      | ☐      |
```

### Step 4: Validate

- [ ] All SOW+ objectives represented
- [ ] Milestones cover full scope
- [ ] Dependencies are logical
- [ ] Shared context complete
- [ ] Glossary comprehensive

## Output

Save to: `docs/prd/system-prd.md`
