# Milestone PRD: [M#] - [Milestone Name]

<!-- NOTE: This file was empty (0 bytes) while being referenced by README.md as the Milestone
     PRD template. Filled 2026-07-07 during the AI-skills review pass, consistent with
     system-prd-template.md and PRD/GUIDELINES.md. If an upstream coherence-engine version of
     this template exists, prefer syncing that over this local reconstruction. -->

## Version History

| Version | Date | Author | Changes |
| ------- | ---- | ------ | ------- |
| 0.1     |      |        | Initial draft |

## 1. Milestone Context

### 1.1 Purpose

What this milestone delivers and why now. One paragraph.

### 1.2 Position in System

- **System PRD:** [link to system-prd]
- **Depends on:** [M#s and what specifically]
- **Enables:** [M#s and what specifically]
- **Impact on other milestones:** [what changes for them if this slips or changes shape]

### 1.3 Success Criteria

Measurable statements — the milestone is done when these are demonstrably true.

## 2. Scope

### 2.1 In Scope

### 2.2 Out of Scope

Explicit non-goals, especially anything a reader might reasonably assume is included.

## 3. User Stories

One subsection per story. Every story carries **all** its acceptance criteria (one Jira story per user story — do not split ACs across tickets).

### 3.1 [Story ID] - [Story Name]

**As a** [user], **I want** [capability], **so that** [outcome].

**Acceptance Criteria (Given/When/Then):**

- Given … When … Then …

**Edge cases:**

## 4. Functional Requirements

Numbered, testable requirements for this milestone only. Reference System PRD shared context rather than restating it.

## 5. Non-Functional Requirements

Only the NFRs this milestone moves: performance, security, accessibility, compliance. Reference System PRD §6 for the system-wide baseline.

## 6. Data and API Impact

- **Data model changes:** [deltas against System PRD §5.2 canonical models]
- **API contract changes:** [deltas against System PRD §5.3]
- **Migrations required:**

## 7. Epic Breakdown

| Epic | Name | Stories | Dependencies | Notes |
| ---- | ---- | ------- | ------------ | ----- |

## 8. Assumptions and Open Questions

Label assumptions explicitly; open questions get an owner and a needed-by date.

## 9. Risks

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |

## 10. Approvals

| Role | Name | Date | Status |
| ---- | ---- | ---- | ------ |
| Product Owner |  |  |  |
| Tech Lead |  |  |  |

Gate: proceeds to Milestone planning only after `Output Approved.` at the phase checkpoint (see SHARED-GUIDELINES.md).
