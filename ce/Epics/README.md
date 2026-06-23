# Epics - Epic Specification

**Owner:** PM/PO
**AI Role:** Detail Expander & Test Case Generator

## Purpose

Group related features and define them in detail for implementation.

## AI-Assisted Activities

### 1. Epic Breakdown

```
AI Prompt Template:
"For this feature from the PRD: [paste feature description]
Break it down into an Epic specification that includes:
1. Epic overview and user value
2. All related user stories
3. Acceptance criteria for the epic
4. User flows
5. Data requirements
6. API contracts (if applicable)
7. UI requirements (if UI-heavy: multiple user stories from primitives/blocks through screens, Atomic Design–style, with dependencies)
8. Error handling scenarios
9. Edge cases"
```

### 2. Test Scenario Generation

```
AI Prompt Template:
"For this epic: [paste epic description]
Generate test scenarios including:
1. Happy path tests
2. Error/exception tests
3. Edge case tests
4. Security tests (if applicable)
5. Performance tests (if applicable)
6. Accessibility tests (if applicable)

Format each as:
- Scenario description
- Preconditions
- Steps
- Expected result"
```

### 3. API Contract Definition

```
AI Prompt Template:
"For this epic requiring [description of data/functionality]:
Define API contracts including:
1. Endpoint paths and methods
2. Request parameters and body
3. Response format and status codes
4. Error responses
5. Authentication requirements
6. Rate limiting
7. Example requests and responses"
```

### 4. Data Flow Mapping

```
AI Prompt Template:
"For this epic: [description]
Map the data flow:
1. Where does data originate?
2. How is it processed?
3. Where is it stored?
4. Who can access it?
5. How is it validated?
6. What are the data dependencies?"
```

## Deliverable Template

[Epic Template](./epic-template.md)

## Quality Gate: Epic Approval

**Checklist:**

- [ ] All user stories have complete acceptance criteria
- [ ] User flows documented for primary and alternative paths
- [ ] Data models defined with validation rules
- [ ] API contracts specified (if applicable)
- [ ] UI requirements detailed with states and interactions
- [ ] Security requirements identified
- [ ] Performance requirements specified with metrics
- [ ] Error handling documented
- [ ] Test scenarios cover happy path, errors, and edge cases
- [ ] Dependencies identified
- [ ] Technical feasibility validated with developers
- [ ] Design assets available
- [ ] PM/PO approval obtained

---

## Slash Commands

| Command              | Description                              |
| -------------------- | ---------------------------------------- |
| `/spec-validate`     | Validate epic specification completeness |
| `/quality-gate epic` | Run epic approval checklist              |

---

## Related Documentation

- [AI Knowledge Base - Migrated Docs](https://docs.google.com/document/d/16n6lfJJYGHlLxUk702-2Xk6ooq_7KK5gCtnTN7whO14/edit?tab=t.0)
- [Template](./epic-template.md)
