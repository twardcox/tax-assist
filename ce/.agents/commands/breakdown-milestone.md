---
description: Break a milestone down into atomic, committable tasks with tests and validation
argument-hint: [milestone-name-or-prd-path]
---

## Task

Break this milestone down into implementation-ready tasks.

## Requirements

Every task/ticket should be:

- **Atomic**: A single, committable piece of work
- **Testable**: Include tests (or validation criteria if tests don't make sense)
- **Clear**: Technical and specific enough to implement without ambiguity
- **Small**: Composable into larger sprint goals

## Output Structure

For each sprint:

1. Sprint goal (demoable outcome)
2. Tasks with:
   - Task ID
   - Description
   - Acceptance criteria
   - Test/validation approach
   - Status field (pending/in_progress/complete)
   - Dependencies (if any)

## Process

1. Analyze the milestone requirements. If the milestone PRD is not found at the provided path, use `list_artifacts` then `read_artifact` to fetch from the MCP server (server storage or workspace `agent-docs/` - not Google Drive).
2. Identify natural breakpoints and dependencies
3. Group into sprints (each sprint = demoable software)
4. Create exhaustive task list
5. **Self-review**: Spawn a subagent to review and suggest improvements
6. Write final tasks to `docs/milestones/[milestone-name]/`

## Example Task Format

```markdown
### TASK-M1-001: Implement user registration endpoint

**Description:** Create POST /api/v1/auth/register endpoint

**Acceptance Criteria:**

- Accepts email, password, name
- Validates email format
- Hashes password with bcrypt
- Returns JWT token on success
- Returns appropriate error codes

**Tests:**

- Unit: validation logic
- Integration: full registration flow
- Edge cases: duplicate email, weak password

**Status:** pending
**Dependencies:** TASK-M1-000 (database schema)
```
