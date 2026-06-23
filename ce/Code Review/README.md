# Testing - Code Review

**Owner:** Developer (Peer Reviewer)
**AI Role:** Code Analysis Assistant

## Purpose

Ensure code quality, correctness, security, and maintainability before merging.

## AI-Assisted Activities

### 1. Automated Code Review

```
AI Prompt Template (for reviewer):
"Review this pull request:

Code changes: [paste diff or link]
Task requirements: [paste acceptance criteria]
Project standards: [link to style guide]

Analyze for:
1. Correctness: Does it meet all acceptance criteria?
2. Code Quality: Is it clean, readable, maintainable?
3. Security: Any vulnerabilities?
4. Performance: Any concerns?
5. Testing: Adequate test coverage?
6. Documentation: Sufficient comments and docs?
7. Edge Cases: All handled?
8. Error Handling: Comprehensive?
9. Type Safety: Properly typed?
10. Best Practices: Follows project patterns?

Provide specific feedback with line numbers where applicable."
```

### 2. Security Vulnerability Scan

```
AI Prompt Template:
"Analyze this code for security vulnerabilities: [paste code]

Check for:
1. SQL injection risks
2. XSS vulnerabilities
3. Authentication/authorization issues
4. Sensitive data exposure
5. Insecure dependencies
6. Race conditions
7. Input validation gaps
8. CSRF vulnerabilities
9. Insecure cryptography
10. Information disclosure

For each issue found, provide severity, location, and suggested fix"
```

### 3. Performance Analysis

```
AI Prompt Template:
"Review this code for performance issues: [paste code]

Check for:
1. N+1 query problems
2. Unnecessary loops/iterations
3. Inefficient algorithms
4. Memory leaks
5. Blocking operations
6. Missing indexes (database)
7. Large payload sizes
8. Missing caching opportunities
9. Redundant computations
10. Excessive dependencies

Suggest optimizations with expected impact."
```

### 4. Suggestion Generation

```
AI Prompt Template:
"For this code: [paste code section]

Suggest improvements for:
1. Readability
2. Maintainability
3. Testability
4. Performance
5. Error handling

Provide specific refactored code examples."
```

## Review Checklist

### Functional Review

- [ ] All acceptance criteria implemented
- [ ] Edge cases handled per task specification
- [ ] Error handling matches requirements
- [ ] Security requirements met
- [ ] Performance requirements met
- [ ] Integration points work correctly

### Code Quality

- [ ] Code is readable and well-organized
- [ ] Naming is clear and consistent
- [ ] Functions are single-purpose and appropriately sized
- [ ] No code duplication (DRY principle)
- [ ] Follows project conventions and style guide
- [ ] No unnecessary complexity
- [ ] Uses appropriate design patterns
- [ ] Proper separation of concerns

### Testing

- [ ] All required tests present (unit, integration, E2E)
- [ ] Tests are comprehensive and meaningful
- [ ] Tests follow AAA pattern (Arrange, Act, Assert)
- [ ] Edge cases have tests
- [ ] Error cases have tests
- [ ] Test names are descriptive
- [ ] No flaky or intermittent tests
- [ ] Coverage meets or exceeds threshold

### Security

- [ ] No hardcoded secrets or credentials
- [ ] Input validation implemented
- [ ] Output encoding/sanitization present
- [ ] Authentication checks in place
- [ ] Authorization checks in place
- [ ] Sensitive data not logged
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevented
- [ ] CSRF protection (if applicable)
- [ ] Rate limiting implemented (if applicable)

### Performance

- [ ] No obvious performance bottlenecks
- [ ] Database queries optimized
- [ ] Appropriate caching used
- [ ] Resource cleanup (connections, files, memory)
- [ ] Asynchronous operations where appropriate
- [ ] No blocking operations in critical paths

### Documentation

- [ ] Code comments explain "why" not "what"
- [ ] Complex logic has explanatory comments
- [ ] API functions documented (JSDoc/etc.)
- [ ] README updated (if applicable)
- [ ] API documentation updated (if applicable)
- [ ] No commented-out code

### Dependencies

- [ ] Only necessary dependencies added
- [ ] Dependency versions specified
- [ ] No vulnerable dependencies
- [ ] License compatibility checked

### Type Safety

- [ ] All functions typed (parameters and returns)
- [ ] No use of `any` without justification
- [ ] Interfaces/types properly defined
- [ ] Type inference used appropriately
- [ ] No type casting without validation

### Git Hygiene

- [ ] Commit messages follow conventions
- [ ] Commits are logical and atomic
- [ ] No merge commits (rebased or squashed)
- [ ] No unrelated changes included
- [ ] Branch name follows convention

## Review Process

### Step 1: Initial Review

1. Read PR description and linked task
2. Understand what should be implemented
3. Review code changes in logical order
4. Run automated code review with AI
5. Note initial observations

### Step 2: Local Testing

```bash
git fetch origin
git checkout feature/TASK-XXX
pnpm install
pnpm test
pnpm run type-check
pnpm run lint
pnpm run dev
```

### Step 3: Detailed Review

For each file changed:

1. Understand the changes and their purpose
2. Check against acceptance criteria
3. Look for potential issues
4. Verify tests cover the changes
5. Check for security concerns
6. Consider maintainability

### Step 4: Provide Feedback

Use conventional comment prefixes:

- **MUST:** Critical issue that blocks merge
- **SHOULD:** Important improvement needed
- **CONSIDER:** Suggestion for discussion
- **NIT:** Minor style/formatting preference
- **QUESTION:** Clarification needed
- **PRAISE:** Positive feedback on good practices

### Step 5: Final Decision

- **Approve:** Code meets all standards, ready to merge
- **Request Changes:** Critical issues must be addressed
- **Comment:** Feedback provided but neither approving nor blocking

## Deliverable

**Code Review Comments:**

- Specific, actionable feedback
- Organized by category
- Clear indication of severity
- Positive feedback where exemplary

**Review Summary:**

```markdown
# Code Review Summary: TASK-XXX

## Overall Assessment

[Approve / Request Changes / Comment]

## Key Sections

- Functional Correctness
- Code Quality
- Testing
- Security
- Performance
- Documentation

## Key Issues to Address

1. [MUST] [Specific critical issue]
2. [SHOULD] [Important improvement]

## Positive Highlights

- [Excellent implementation of X]
- [Great test coverage for Y]
```

## Quality Gate: Code Review Complete

**For Approval:**

- [ ] All acceptance criteria verified as implemented
- [ ] No critical (MUST) issues remain
- [ ] Code quality meets project standards
- [ ] Security review passed
- [ ] Test coverage adequate
- [ ] Documentation complete
- [ ] At least one approved review (or per team policy)
- [ ] All conversations resolved
- [ ] Ready to merge

**For Request Changes:**

- [ ] Critical issues documented with specific feedback
- [ ] Severity clearly indicated
- [ ] Suggestions for fixes provided
- [ ] Timeline for re-review communicated

---

## PR Description Best Practices

### Creating PR Descriptions

Write a PR outline in markdown that clearly outlines what has been done in the branch:

```markdown
# PR: [Title]

## Summary

[Brief description of what this PR accomplishes]

## Changes Made

- [Change 1]
- [Change 2]
- [Change 3]

## Related Issue/Task

Closes TASK-XXX

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that causes existing functionality to change)
- [ ] Refactoring (no functional changes)
- [ ] Documentation update

## Testing Done

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings introduced

## Screenshots (if applicable)

[Add screenshots for UI changes]

## Additional Notes

[Any additional context for reviewers]
```

### AI Prompt for PR Description

```
"Write a PR outline in markdown that outlines what has been done in this branch:

Branch: [branch name]
Changes: [paste diff or summary]
Task: [TASK-XXX]

Include:
1. Summary of changes
2. List of specific modifications
3. Testing performed
4. Any breaking changes
5. Notes for reviewers"
```

---

## Clean Branch Reimplementation

When a branch has messy commit history and needs to be cleaned for review:

### When to Reimplement

- Commit history is confusing or non-linear
- Many "WIP" or "fix" commits that should be squashed
- Commits contain unrelated changes
- History doesn't tell a clear story of the implementation

### Reimplementation Process

```
1. VALIDATE SOURCE BRANCH
   - Ensure no uncommitted changes
   - Confirm up to date with main

2. ANALYZE THE DIFF
   - Study all changes between source branch and main
   - Understand the final intended state

3. CREATE CLEAN BRANCH
   - Create new branch from main: [source-branch]-clean

4. PLAN THE COMMIT STORYLINE
   - Break implementation into logical steps
   - Each step should be self-contained
   - Think like writing a tutorial

5. REIMPLEMENT THE WORK
   - Recreate changes step by step
   - Each commit introduces a single coherent idea
   - Clear commit messages with descriptions
   - Use --no-verify for intermediate commits (hooks may fail)

6. VERIFY CORRECTNESS
   - Final state must match source branch exactly
   - Run final commit WITHOUT --no-verify
   - All checks must pass
```

### Clean Branch AI Prompt

```
"Reimplement this branch with clean commit history:

Source branch: [current branch]
Commits since main: [list of commits]
Full diff: [diff summary]

Steps:
1. Analyze all changes between source and main
2. Plan commits as a logical narrative
3. Identify dependencies between changes
4. Propose commit sequence with messages

Rules:
- Each commit must build/compile
- Each commit introduces one coherent idea
- Final state must exactly match source
- No 'fix' or 'WIP' commits"
```

### Commit Storyline Example

```
Commit 1: "Add user model and database migration"
Commit 2: "Implement user registration endpoint"
Commit 3: "Add validation for user registration"
Commit 4: "Implement login endpoint with JWT"
Commit 5: "Add authentication middleware"
Commit 6: "Update tests for auth flow"
```

---

## Slash Commands

| Command                     | Description                                 |
| --------------------------- | ------------------------------------------- |
| `/pr-description`           | Generate PR description from branch changes |
| `/reimplement-clean-branch` | Clean up messy commit history               |
| `/quality-gate review`      | Run code review checklist                   |

---

## Cursor AI Rules (.cursorrules)

The [AI Knowledge Base - Migrated Docs](https://docs.google.com/document/d/16n6lfJJYGHlLxUk702-2Xk6ooq_7KK5gCtnTN7whO14/edit?tab=t.0) includes `.cursorrules` templates that configure Cursor AI to follow your team's review standards automatically.
When you use Cursor's code review feature, it checks security vulnerabilities, code quality, type safety, testing coverage, performance, and accessibility.

**Templates available** (in CLI repo):

- `templates/.cursorrules` - Comprehensive review checklist
- `templates/.cursorrules.minimal` - Critical issues only (security, correctness, tests)
- `templates/CURSORRULES-GUIDE.md` - Complete usage guide

**CLI location:** `path/to/ce-developer-cli/templates/` (replace with your clone path)

---

## Related Documentation

- [AI Knowledge Base - Migrated Docs](https://docs.google.com/document/d/16n6lfJJYGHlLxUk702-2Xk6ooq_7KK5gCtnTN7whO14/edit?tab=t.0)
- [Development - Development](../Development/) - Implementation guidelines
- [CI/CD - CI/CD](../CI-CD/) - Deployment and merge
