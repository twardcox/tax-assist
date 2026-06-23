---
description: Analyze test coverage and generate missing tests for a file or feature
argument-hint: [file-path-or-feature]
allowed-tools: Bash(pnpm:*), Bash(jest:*), Bash(vitest:*)
---

## Task

Analyze test coverage for the specified file/feature and generate missing tests.

## Process

### Step 1: Analyze Current Coverage

```bash
# Run coverage report
pnpm test --coverage [file-pattern]

# Or for specific file
pnpm test --coverage --collectCoverageFrom='[file-path]'
```

### Step 2: Identify Gaps

Parse coverage report to find:

- Uncovered lines
- Uncovered branches
- Uncovered functions
- Edge cases not tested

### Step 3: Categorize Missing Tests

| Category    | Priority | Description            |
| ----------- | -------- | ---------------------- |
| Happy Path  | P0       | Core functionality     |
| Error Cases | P0       | Error handling         |
| Edge Cases  | P1       | Boundary conditions    |
| Integration | P1       | Component interactions |
| Performance | P2       | Load/stress scenarios  |

### Step 4: Generate Tests

For each gap, generate test following project conventions:

```typescript
describe('[Component/Function]', () => {
  describe('[Method/Feature]', () => {
    // Happy path
    it('should [expected behavior] when [condition]', () => {
      // Arrange
      // Act
      // Assert
    });

    // Error cases
    it('should throw [error] when [invalid condition]', () => {
      // Arrange
      // Act & Assert
    });

    // Edge cases
    it('should handle [edge case]', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

## Output Format

````markdown
# Test Coverage Analysis: [Target]

## Current Coverage

| Metric     | Current | Target | Status |
| ---------- | ------- | ------ | ------ |
| Statements | X%      | 80%    | ✅/❌  |
| Branches   | X%      | 80%    | ✅/❌  |
| Functions  | X%      | 80%    | ✅/❌  |
| Lines      | X%      | 80%    | ✅/❌  |

## Uncovered Code

### File: [path]

**Uncovered Lines:** 45-52, 78-85
**Uncovered Branches:** Line 23 (else), Line 67 (catch)
**Uncovered Functions:** `handleError`, `validateInput`

## Recommended Tests

### Priority 0 (Must Have)

1. **Test: [description]**
   - Covers: Lines 45-52
   - Type: Error handling
   ```typescript
   it('should handle network errors gracefully', () => {
     // Test code
   });
   ```
````

2. **Test: [description]**
   - Covers: Branch at line 23
   - Type: Edge case

### Priority 1 (Should Have)

[Additional tests...]

## Generated Test File

```typescript
// [filename].test.ts

import { [exports] } from './[filename]';

describe('[Component]', () => {
  // Generated tests here
});
```

## Next Steps

1. [ ] Review generated tests
2. [ ] Add to test suite
3. [ ] Run coverage again
4. [ ] Verify threshold met

```

## Rules

- Follow existing test patterns in the project
- Use project's testing framework (Jest/Vitest/etc.)
- Include setup/teardown as needed
- Mock external dependencies appropriately
- Use descriptive test names
```
