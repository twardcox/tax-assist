# Epic: [Epic Name]

## Epic ID: EP-XXX

**Milestone:** [Which milestone this belongs to]
**Priority:** Must Have / Should Have / Could Have
**Status:** Draft / Ready / In Progress / Done

## Overview

### Business Value

[Why are we building this? What problem does it solve?]

### User Impact

[Who benefits and how?]

### Success Metrics

| Metric     | Target   | How Measured |
| ---------- | -------- | ------------ |
| [Metric 1] | [Target] | [Method]     |

## User Stories

<!--
  Each story MUST use `- [ ] Story:` as a trackable checkbox item.
  The `- Key:` sub-item starts as `TBD`; update to the real Jira ticket key (e.g. PROJ-123)
  once User Stories creates the Story ticket. This enables dashboard completion tracking and
  automatic Jira sync via "Sync from Jira" in the project dashboard.

  Acceptance criteria are plain list items (not checkboxes) — the Story checkbox is the
  unit of completion tracked at this level.
-->

- [ ] Story: [As a user type, I want action, so that benefit]
  - Key: TBD
  - Summary: [One-line summary]
  - Acceptance Criteria:
    - Given [context], when [action], then [result]
    - Given [context], when [action], then [result]
  - Edge Cases:
    - [Edge case 1]: [Expected behavior]
  - Risks/Deps: [Any blockers or dependencies for this story]

- [ ] Story: [As a user type, I want action, so that benefit]
  - Key: TBD
  - Summary: [One-line summary]
  - Acceptance Criteria:
    - Given [context], when [action], then [result]
  - Risks/Deps: [Any blockers or dependencies]

## User Flow

### Primary Flow

```

1. User starts at [location]
2. User performs [action]
3. System validates [data]
4. System displays [result]
5. User proceeds to [next step]

```

### Alternative Flows

**Alt Flow 1: [Scenario]**

```

1. User starts at [location]
2. User performs [action]
3. System detects [error condition]
4. System displays [error message]
5. User [recovery action]

```

## Data Requirements

### Data Models

```json
{
  "entity": {
    "id": "string (UUID)",
    "field1": "string (required, max 100 chars)",
    "field2": "number (required, min 0)",
    "field3": "boolean (optional, default false)",
    "createdAt": "timestamp (auto-generated)",
    "updatedAt": "timestamp (auto-updated)"
  }
}
```

### Validation Rules

| Field  | Rules                   | Error Message                                         |
| ------ | ----------------------- | ----------------------------------------------------- |
| field1 | Required, max 100 chars | "Field1 is required and must be under 100 characters" |
| field2 | Required, >= 0          | "Field2 must be a positive number"                    |

### Data Sources

- [Where this data comes from]
- [Any transformations needed]

## API Requirements

### Endpoint 1: Create [Resource]

**Method:** POST
**Path:** `/api/v1/[resource]`
**Authentication:** Required (JWT)
**Authorization:** [Who can access]

**Request Body:**

```json
{
  "field1": "string",
  "field2": number
}
```

**Success Response (201):**

```json
{
  "id": "uuid",
  "field1": "string",
  "field2": number,
  "createdAt": "timestamp"
}
```

**Error Responses:**

- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Missing/invalid token
- `403 Forbidden`: Insufficient permissions
- `429 Too Many Requests`: Rate limit exceeded

**Example Request:**

```bash
curl -X POST https://api.example.com/api/v1/resource \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"field1": "value", "field2": 123}'
```

### Endpoint 2: [Another endpoint]

[Same structure]

## UI Requirements

### Ticket granularity (UI / Atomic Design)

When this epic is UI-heavy, split work into **multiple user stories** (each syncs to **one Jira Story** with all its ACs - not Tasks per AC). Order stories from **reusable primitives and blocks** toward **composed screens or flows**; adapt Atomic Design levels to your codebase. Prefer **reusing or lightly extending** existing components; document reuse in **Components** or **Dependencies**. Extend shared components only while the result stays **readable and maintainable** - otherwise introduce a **new focused component** and reference it here.

### Screen 1: [Screen Name]

**Purpose:** [What user accomplishes here]

**Components:**

- [Component 1]: [Description and behavior]
- [Component 2]: [Description and behavior]

**Interactions:**

- [User action] → [System response]

**Validation:**

- [Field] validated [when/how]
- Error displayed [where/how]

**States:**

- Loading: [How displayed]
- Error: [How displayed]
- Empty: [How displayed]
- Success: [How displayed]

### Screen 2: [Screen Name]

[Same structure]

## Security Requirements

### Authentication

- [What authentication is required]
- [How tokens are managed]

### Authorization

- [Who can perform which actions]
- [How permissions are checked]

### Data Protection

- [What data needs encryption]
- [What data needs masking]
- [What data needs audit logging]

### Rate Limiting

- [Limits per endpoint]
- [How limits are enforced]

## Performance Requirements

### Response Time

- [Endpoint/Action]: [Target time] for [percentile]
- Example: GET /api/users: < 200ms for 95th percentile

### Throughput

- [Endpoint/Action]: [Target requests per second]

### Data Volume

- [Expected data size and growth]

## Error Handling

### User-Facing Errors

| Error Scenario | User Message       | Recovery Action    |
| -------------- | ------------------ | ------------------ |
| [Scenario]     | [Friendly message] | [What user can do] |

### System Errors

| Error Type | Logging       | Alerting        | Recovery         |
| ---------- | ------------- | --------------- | ---------------- |
| [Error]    | [What to log] | [When to alert] | [How to recover] |

## Test Scenarios

### Test 1: Happy Path - [Scenario]

**Preconditions:**

- [Condition 1]
- [Condition 2]

**Steps:**

1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result:**
[What should happen]

### Test 2: Error Case - [Scenario]

[Same structure]

### Test 3: Edge Case - [Scenario]

[Same structure]

## Dependencies

### Prerequisites

- [What must exist before this epic can be implemented]

### Blockers

- [What is currently blocking progress]

### Integration Points

- [What other systems/epics this integrates with]

## Assumptions

- [Assumption 1]
- [Assumption 2]

## Open Questions

| Question   | Owner  | Status        | Resolution Date |
| ---------- | ------ | ------------- | --------------- |
| [Question] | [Name] | Open/Resolved | [Date]          |

## Design Assets

- [Link to wireframes]
- [Link to mockups]
- [Link to prototypes]

## Technical Notes

[Area for developers to add technical considerations, architecture decisions, etc.]

## Change Log

| Date   | Change         | Author | Reason |
| ------ | -------------- | ------ | ------ |
| [Date] | [What changed] | [Name] | [Why]  |
