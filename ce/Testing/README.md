# Development - Testing

**Owner:** Developer (with QA if applicable)
**AI Role:** Test Case Generator & Bug Finder

## Purpose

Verify implementation meets all requirements through automated and manual testing.

## AI-Assisted Activities

### 1. Test Coverage Analysis

```
AI Prompt Template:
"Analyze test coverage for this code: [paste code]
Current tests: [paste tests]
Task requirements: [paste acceptance criteria]

Identify:
1. Code paths not covered by tests
2. Edge cases not tested
3. Error scenarios not tested
4. Integration points not tested
5. Missing assertions in existing tests
Generate additional tests to achieve 100% coverage of critical paths"
```

### 2. Test Data Generation

```
AI Prompt Template:
"For these test scenarios: [paste scenarios]
Generate realistic test data including:
1. Valid data for happy paths
2. Invalid data for error cases
3. Boundary values for edge cases
4. Large datasets for performance tests
5. Malicious inputs for security tests
Format as [JSON/fixtures/factories/etc.]"
```

### 3. Bug Prediction

```
AI Prompt Template:
"Review this implementation: [paste code]
And requirements: [paste acceptance criteria]

Predict potential bugs by analyzing:
1. Race conditions
2. Memory leaks
3. Off-by-one errors
4. Null pointer exceptions
5. Input validation gaps
6. Concurrency issues
7. Resource management issues
For each potential bug, suggest how to test for it"
```

### 4. E2E Test Scenario Generation

```
AI Prompt Template:
"For this feature: [description]
Generate E2E test scenarios that:
1. Cover primary user workflows
2. Include authentication/authorization flows
3. Test multi-step processes
4. Verify data persistence
5. Check error recovery
Format as [Playwright/Cypress/etc.] tests"
```

## Testing Levels

### Level 1: Unit Testing

- Test individual functions/methods
- Follow Arrange-Act-Assert pattern
- Include happy path, error, and edge case tests

### Level 2: Integration Testing

- Test workflows across multiple components
- Verify data flows and side effects
- Test API/database interactions

### Level 3: E2E Testing

- Test complete user workflows
- Verify UI interactions
- Test multi-step processes

### Level 4: Manual Testing

- Execute manual test plan from task
- Test in production-like environment
- Verify UI/UX requirements
- Test browser/platform compatibility

## Process

### Step 1: Automated Test Execution

```bash
pnpm test                        # Run full test suite
pnpm run test:coverage           # Run with coverage
pnpm test path/to/test           # Run specific test
pnpm run test:integration        # Run integration tests
pnpm run test:e2e                # Run E2E tests
```

### Step 2: Test Results Analysis

Review test results and coverage reports. Identify gaps and add tests as needed.

### Step 3: Manual Test Execution

1. Follow manual test plan from task
2. Test in environment matching production
3. Verify UI/UX requirements
4. Test browser compatibility (if applicable)
5. Test mobile responsiveness (if applicable)
6. Document any issues found

### Step 4: Bug Documentation

If bugs found, document with:

- Bug ID and severity
- Steps to reproduce
- Expected vs. actual behavior
- Screenshots/videos
- Console errors
- Proposed fix (if obvious)

### Step 5: Regression Testing

For bug fixes, verify:

- Bug is fixed
- Fix doesn't break existing functionality
- Related features still work
- Tests added to prevent regression

## Deliverable

**Test Report:**

```markdown
# Test Report: TASK-XXX

## Summary

- Total Tests: [X]
- Passed: [Y]
- Failed: [Z]
- Coverage: [%]

## Status

Ready for Code Review / Blocked / Needs Revision
```

## Quality Gate: Testing Complete

**Checklist:**

- [ ] All automated tests passing
- [ ] Code coverage meets threshold (80%+)
- [ ] Manual test plan executed completely
- [ ] All test cases passed
- [ ] Performance requirements met
- [ ] Security requirements validated
- [ ] No critical or high-severity bugs
- [ ] Medium/low bugs documented and triaged
- [ ] Test report generated
- [ ] Ready for code review

---

## Slash Commands

| Command              | Description                                 |
| -------------------- | ------------------------------------------- |
| `/test-coverage`     | Analyze coverage and generate missing tests |
| `/quality-gate test` | Run testing completion checklist            |

---

## Related Documentation

- [AI Knowledge Base - Migrated Docs](https://docs.google.com/document/d/16n6lfJJYGHlLxUk702-2Xk6ooq_7KK5gCtnTN7whO14/edit?tab=t.0)
