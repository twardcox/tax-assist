---
description: Create a Milestone PRD from System PRD context
argument-hint: [milestone-id: M1|M2|M3|...]
---

## Task

Create a focused Milestone PRD for the specified milestone, referencing the System PRD for shared context.

## Required Inputs

1. **System PRD** - Central document with milestone map
2. **Milestone ID** - Which milestone to detail (M1, M2, etc.)
3. **Architecture Template** - For technical specifications

## How to Load Inputs

If System PRD or Architecture Template are not found locally, use `list_artifacts` then `read_artifact` to fetch from the MCP server (server storage or workspace `agent-docs/` - not Google Drive).

## Process

### Step 1: Load Context

From System PRD:

- Milestone objective
- Dependencies (what this milestone needs)
- Provisions (what this milestone provides to others)
- Relevant shared context

### Step 2: Gather Requirements

Ask clarifying questions:

1. What are the primary user stories for this milestone?
2. Are there specific technical constraints?
3. What's the testing strategy?
4. Any known risks or uncertainties?

### Step 3: Create Document

````markdown
# milestone-[X]-prd: [Milestone Name]

## Version History

| Version | Date   | Author | Changes |
| ------- | ------ | ------ | ------- |
| 1.0     | [Date] | [Name] | Initial |

---

## Quick Reference

| Attribute        | Value     |
| ---------------- | --------- |
| **Milestone ID** | M[X]      |
| **System PRD**   | [Link]    |
| **Duration**     | [X weeks] |
| **Status**       | Planning  |

---

## 1. Milestone Objective

### 1.1 Purpose

[What user/business value does this deliver?]

### 1.2 Scope

**In Scope:**

- [Feature 1]
- [Feature 2]

**Out of Scope:**

- [Excluded item]

### 1.3 Success Criteria

| Criterion   | Target   | Measurement    |
| ----------- | -------- | -------------- |
| [Criterion] | [Target] | [How measured] |

---

## 2. Impact on Other Milestones

### 2.1 Dependencies (What This Needs)

| Milestone | Dependency      | Type      |
| --------- | --------------- | --------- |
| [M-Prev]  | [What's needed] | Hard/Soft |

### 2.2 Provisions (What This Provides)

| Milestone | Provision         | Type      |
| --------- | ----------------- | --------- |
| [M-Next]  | [What's provided] | Hard/Soft |

---

## 3. User Stories

### 3.1 [Feature Area]

#### Story M[X].1: [Title]

**As a** [user type]
**I want to** [action]
**So that** [benefit]

**Acceptance Criteria:**

```gherkin
Given [context]
When [action]
Then [outcome]
```
````

**Edge Cases:**
| Scenario | Expected |
|----------|----------|
| [Edge case] | [Behavior] |

---

## 4. Functional Requirements

| ID          | Requirement   | Priority | Story  |
| ----------- | ------------- | -------- | ------ |
| FR-M[X]-001 | [Requirement] | Must     | M[X].1 |

---

## 5. Technical Specifications

### 5.1 Data Models

[Milestone-specific entities]

### 5.2 API Specifications

[New/modified endpoints]

### 5.3 Database Changes

[Migrations needed]

---

## 6. User Experience

### 6.1 User Flows

### 6.2 Wireframes

### 6.3 UI Requirements

---

## 7. Testing Strategy

### 7.1 Coverage Requirements

### 7.2 Test Scenarios

---

## 8. Epic Breakdown

| Epic ID     | Name   | Stories        | Priority |
| ----------- | ------ | -------------- | -------- |
| EP-M[X]-001 | [Name] | M[X].1, M[X].2 | P0       |

---

## 9. Risks

| Risk   | Probability | Impact | Mitigation |
| ------ | ----------- | ------ | ---------- |
| [Risk] | H/M/L       | H/M/L  | [Strategy] |

---

## 10. Approvals

| Role          | Name | Date | Status |
| ------------- | ---- | ---- | ------ |
| Product Owner |      |      | ☐      |
| Tech Lead     |      |      | ☐      |

```

### Step 4: Validate

- [ ] References System PRD correctly
- [ ] Impact analysis complete
- [ ] All user stories have acceptance criteria
- [ ] Technical specs detailed
- [ ] Epic breakdown ready for Epics

## Output

Save to: `docs/prd/milestone-[X]-prd.md`
```
