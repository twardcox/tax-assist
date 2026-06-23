---
description: Create a JSON PRD file with tickets for a milestone
argument-hint: [milestone-name]
---

## Task

Create a JSON PRD file containing all tickets for the supplied milestone.

## Process

1. Understand the milestone scope. If the milestone PRD is not found locally, use `list_artifacts` then `read_artifact` to fetch from the MCP server (server storage or workspace `agent-docs/` - not Google Drive).
2. Ask clarifying questions if needed
3. Break work into digestible chunks
4. Create tickets in JSON format
5. Output to `docs/milestones/[milestone]/prd.json`

## Ticket Schema

```json
{
  "milestone": "M1: Foundation",
  "tickets": [
    {
      "id": "M1-001",
      "category": "functional",
      "title": "User registration endpoint",
      "description": "Create POST /api/v1/auth/register",
      "steps": [
        "Create endpoint handler",
        "Add input validation",
        "Implement password hashing",
        "Generate JWT token",
        "Add error responses"
      ],
      "acceptance_criteria": [
        "Accepts email, password, name",
        "Returns 201 with token on success",
        "Returns 400 for validation errors",
        "Returns 409 for duplicate email"
      ],
      "priority": "P0",
      "estimate": "4h",
      "dependencies": [],
      "passes": false
    }
  ]
}
```

## Categories

- `functional`: Feature implementation
- `technical`: Infrastructure, refactoring
- `testing`: Test coverage
- `documentation`: Docs, comments
- `bugfix`: Bug fixes
- `security`: Security-related

## Questions to Ask

Before creating tickets:

1. What is the milestone's primary deliverable?
2. Are there specific technical constraints?
3. What's the team size/velocity?
4. Are there external dependencies?
5. What's the testing strategy?
