# Development - Guidelines

**Shared guidelines:** See [SHARED-GUIDELINES.md](../SHARED-GUIDELINES.md) for Phase Checkpoint Protocol and File Creation Verification.

---

## 10. Iteration & Feedback Loop

### When Implementation Reveals Spec Gaps

```
1. Developer documents gap
2. Gap reviewed with PM/PO
3. Spec updated (with change log entry)
4. Affected tasks re-estimated if needed
5. Continue implementation
```

### Spec Change Log Format

```markdown
## Change Log

| Date       | Change                           | Author | Reason                           |
| ---------- | -------------------------------- | ------ | -------------------------------- |
| 2026-01-30 | Added edge case for offline mode | Dev    | Discovered during implementation |
```

---

## 11. Design Considerations

Design readiness is owned by the **Design Agent**, not the Developer Agent. Before implementation,
run **`/design-review`** (or invoke `design_validate_ticket` / `design_agent`) so specs and
the design language system are complete — developers should not invent error states, empty states,
labels, or token usage at coding time.

**Canonical sources (do not duplicate checklists in this file):**

| Resource                                                              | Purpose                                                                      |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [`ce://agents/design`](../agents/design-assistant.md)                 | Role, **Design Readiness Checklist** (seven dimensions), verdicts, overrides |
| [`ce://commands/design-review`](../.cursor/commands/design-review.md) | Invocation playbook — epic, ticket, and delivery modes                       |
| [`/architecture-check`](../.cursor/commands/architecture-check.md)    | Architecture template conformance (separate from spec readiness)             |
| [`/council design`](../agents/council/designer.md)                    | **After code exists** — implementation vs Figma/tokens (not spec gaps)       |

Load agent and command content via MCP (`resources/read` or `get_slash_command`) in the project client.

### When design review is required

| Task type                        | Design review required?                                          |
| -------------------------------- | ---------------------------------------------------------------- |
| New feature with UI              | **Yes** — Design Agent ticket mode                               |
| API endpoint changes             | **Yes** — `/design-review` supplemental + architecture as needed |
| Database schema changes          | **Yes** — `/design-review` supplemental                          |
| New integration                  | **Yes** — `/design-review` + `/architecture-check`               |
| Bug fix (no structural change)   | No                                                               |
| Refactoring (no behavior change) | Optional                                                         |
| Performance optimization         | **Yes** — architecture / integration review                      |

### Design review workflow

```
1. Read task spec + linked epic (read_task_spec, read_artifact)
2. Invoke Design Agent
   └─→ /design-review  OR  design_validate_ticket  OR  design_agent (mode: ticket)
3. Verdict: READY FOR DEVELOPMENT  |  NOT READY
   └─→ If NOT READY: PMO updates spec in planning client (or Override: [gap] - [justification])
4. Optional: Figma MCP get_design_context when toolkit.figma.fileKey is set
5. Document significant decisions (mini-ADR below) if needed
6. Proceed to implementation (Developer Agent)
7. Pre-PR: /design-review delivery mode; optional /council design for code fidelity
```

**Modes:** **epic** (UI epic before Gate-Check, planning client) · **ticket** (pre-implementation) · **delivery** (pre-PR second pass).

### 11.1 Design Agent checklist (reference)

The full checklist lives in **`ce://agents/design`**. Summary of the seven dimensions (each finding is blocking, should-fix, or nice-to-have):

1. **Spec completeness** — screens, flows, failure paths; no in-scope `[TBD]`
2. **Interaction states** — default, hover, focus, disabled, loading, error, empty/zero-content
3. **Accessibility contract** — labels, keyboard path, WCAG level, focus/contrast
4. **Design language system** — tokens/components vs one-offs; missing DS primitives flagged
5. **Figma ↔ spec alignment** — frames for required states when Figma MCP is available
6. **API / data ↔ UI** — errors, empty lists, validation copy mapped to UI
7. **Copy and content** — errors, empty CTAs, headlines specified

**Verdict:** `READY FOR DEVELOPMENT` or `NOT READY`. Save gaps to `reports/design-readiness-{scope}-{date}.md` via `save_report`.

### 11.2 Technical design at implementation time

For API contracts, data models, component architecture, and integrations, use the **supplemental**
sections in **`ce://commands/design-review`** (same command, ticket or delivery mode) and
**`/architecture-check`** when validating against the architecture template. Do not maintain
parallel checklists in this guidelines file.

### 11.3 Design decision documentation

For significant design decisions, document using a mini-ADR format:

```markdown
### Design Decision: [Title]

**Date:** [Date]
**Task:** [TASK-XXX]
**Status:** [Proposed / Accepted / Superseded]

**Context:**
[Why is this decision needed?]

**Options Considered:**

1. [Option A] - [Pros/Cons]
2. [Option B] - [Pros/Cons]
3. [Option C] - [Pros/Cons]

**Decision:**
[Which option and why]

**Consequences:**

- [What this enables]
- [What this constrains]
- [Technical debt introduced, if any]
```

### 11.4 Design review triggers

Run **`/design-review`** (Design Agent) when the task includes:

- New UI component or page
- API endpoint creation or modification
- Database migration
- External service integration
- Performance-critical or security-sensitive surface area
- Changes affecting multiple milestones

See **`ce://commands/design-review`** for when to skip delivery mode (e.g. copy-only tickets).

### 11.5 Design review vs code review vs council design

| Aspect        | Design Agent (`/design-review`)                      | Council design (`/council design`) | Code review (Code Review / PR) |
| ------------- | ---------------------------------------------------- | ---------------------------------- | ------------------------------ |
| **When**      | Before implementation (ticket); pre-PR delivery pass | After implementation               | After implementation           |
| **Focus**     | Spec and design-system readiness                     | Code vs Figma/tokens/Storybook     | AC coverage, correctness       |
| **Owner**     | Design Agent                                         | Council Designer                   | Developers / reviewers         |
| **Output**    | READY / NOT READY report                             | PASS / BLOCK design report         | Approved PR                    |
| **Spec gaps** | Escalate to PMO                                      | N/A                                | N/A                            |

---

## 12. Working on PRD Tickets

When working on tickets from a Milestone PRD:

### Single Ticket Workflow

```
1. Read the Milestone PRD and progress.txt files
2. Find the highest priority feature to work on
   - Use YOUR judgment on priority, not just list order
   - Consider dependencies and blockers
3. Work ONLY on that single feature/ticket
4. Verify:
   - Types check (e.g., `pnpm tsc`)
   - Related tests pass
5. Update the PRD with work completed
6. Append progress to progress.txt
   - Leave notes for the next person
7. Make a git commit for the feature
8. If PRD is complete, notify the team
```

### Progress File Format

```markdown
# progress.txt

## [Date] - [Developer Name]

### Completed

- TASK-XXX: [Brief description of what was done]

### Notes for Next Person

- [Important context or gotchas]
- [Decisions made and why]
- [Known issues or TODOs]

### Blockers

- [Any blocking issues]
```

---

## 13. Codebase Exploration (Council Pattern)

When exploring an unfamiliar codebase or investigating a complex area:

### Multi-Agent Exploration

```
1. Identify the area of interest
2. Gather general information:
   - Keywords and terminology
   - Architecture overview
   - File structure patterns

3. Spawn multiple investigation threads (n=10 recommended):
   - Some focused on core patterns
   - Some exploring edge cases
   - Some "out of the box" for variance

4. Synthesize findings:
   - Common patterns discovered
   - Inconsistencies noted
   - Architecture decisions understood

5. Use information to:
   - Create implementation plan
   - Identify risks and unknowns
   - Make informed design decisions
```

### AI Prompt Template

```
"Based on [area of interest], please:

1. Dig around the codebase to gather:
   - Relevant keywords and naming conventions
   - Architecture overview for this area
   - Related files and their relationships

2. Spawn investigation threads to explore:
   - Core implementation patterns
   - Edge cases and error handling
   - Integration points with other systems
   - Testing approaches used
   - Some unexpected/tangential areas for variance

3. Synthesize findings into:
   - Summary of how this area works
   - Key patterns to follow
   - Risks and unknowns identified
   - Recommended approach for implementation"
```

---

## 14. Commit Strategies

### Single Feature Commit

For atomic changes:

```bash
# After completing a feature
git add [specific files]
git commit -m "feat(scope): concise description

- Detailed change 1
- Detailed change 2

Refs: TASK-XXX"
```

### Sequential Logical Commits

When you have multiple uncommitted changes that should be grouped logically:

```
1. Review all uncommitted changes: git status
2. Group changes by area of concern/pattern:
   - Feature additions
   - Bug fixes
   - Refactoring
   - Tests
   - Documentation

3. Commit each group separately:
   - Stage files for first logical group
   - Commit with appropriate message
   - Repeat for each group

4. Result: Clean, logical commit history
```

### Commit Message Convention

```
type(scope): subject

[optional body]
[optional footer]

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting (no code change)
- refactor: Code change (no feature/fix)
- test: Adding tests
- chore: Maintenance
```
