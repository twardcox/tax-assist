---
description: Council of specialist agents - Reporter is default (smart orchestrator); or named agent (adversary, developer, pmo, design, full)
argument-hint: [[file-or-glob] | full [file-or-glob] | adversary [file-or-glob] | developer [file-or-glob] | pmo [file-or-glob] | design [file-or-glob] | area-of-interest]
---

## Agent roster

| Agent     | Invoke with                  | Purpose                                                                                                                                                             |
| --------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reporter  | `/council [scope]`           | **Default** - smart orchestrator: analyzes scope, selects needed specialists, invokes them, collects findings, dispatches CE review skills, returns combined report |
| Adversary | `/council adversary [scope]` | Penetration-tester - attacks code on first principles; bugs, security, async hazards, no spec context                                                               |
| Developer | `/council developer [scope]` | Craft review - architecture conformance, abstraction quality, AI slop, naming, convention consistency                                                               |
| PMO       | `/council pmo [scope]`       | Spec traceability - maps every AC and business requirement to the implementation; finds gaps and scope drift                                                        |
| Design    | `/council design [scope]`    | Design-system review - Figma spec fidelity, token usage, Storybook coverage, regressions, outdated patterns                                                         |
| Full      | `/council full [scope]`      | Reporter dispatch mode - forces all four specialists; combined report with individual verdicts and overall gate verdict                                             |

## Routing

Check the argument:

- **No argument** → run the [Reporter](#reporter) in **Orchestrator mode** (analyzes scope automatically)
- **A file path or glob** (e.g. `/council src/features/auth/`) → run the [Reporter](#reporter) in **Orchestrator mode** with that explicit scope
- **`full`** (optionally followed by a file path or glob) → run the [Reporter](#reporter) in **Dispatch mode - all four specialists**
- **`adversary`** (optionally followed by a file path or glob) → run the [Reporter](#reporter) in **Dispatch mode - Adversary**
- **`developer`** (optionally followed by a file path or glob) → run the [Reporter](#reporter) in **Dispatch mode - Developer**
- **`pmo`** (optionally followed by a file path or glob) → run the [Reporter](#reporter) in **Dispatch mode - PMO**
- **`design`** (optionally followed by a file path or glob) → run the [Reporter](#reporter) in **Dispatch mode - Design**
- **A topic or area-of-interest string** (not a file path, not a known agent name) → run the [Exploration Council](#exploration-council)
- **Unknown named agent** → report which agents are available (see `ce/agents/council/README.md`)

---

## Adversary

> **Agent definition:** `ce/agents/council/adversary.md` > **Purpose:** Attack source code independent of spec and context. Find bugs, security issues,
> error handling gaps, async hazards, and other code-level flaws on first principles.

### Step 1 - Determine scope

- If an argument follows `adversary` (e.g. `/council adversary src/tools/`), use those paths.
- Otherwise, run `git diff --cached --name-only` to get staged files.
- If nothing is staged, fall back to `git diff --name-only HEAD`.
- Filter to source code files only. Exclude: `*.d.ts`, lock files, generated files,
  fixture snapshots, migration files.

### Step 2 - Read the code (spec-free)

Read the files in scope. **Do not** read `agent-docs/`, `specs/`, `research/`, task specs, PRDs,
or acceptance criteria. The adversary's independence from spec context is the source of its value.

### Step 3 - Apply adversary analysis

Interrogate every file across all eight dimensions:

| Dimension                 | What to look for                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Logic bugs**            | Wrong conditions, inverted branches, off-by-one, incorrect operator precedence, always-true/false predicates                                 |
| **Null/undefined**        | Unguarded array access, missing null checks, optional chaining gaps, unchecked return values                                                 |
| **Error handling**        | Empty or swallowed `catch` blocks, missing async error propagation, unhandled Promise rejections, misleading error messages                  |
| **Security**              | Injection sinks without sanitisation, sensitive data in logs or responses, hardcoded secrets, path traversal, auth bypass, insecure defaults |
| **Type safety**           | `as any`, unchecked `!` non-null assertions, missing runtime validation at external boundaries (HTTP input, env vars)                        |
| **Async hazards**         | Missing `await`, concurrent mutation of shared state, race conditions, unguarded parallel writes                                             |
| **Resource leaks**        | Unclosed streams/connections, event listeners not removed, timers not cleared                                                                |
| **Dead/unreachable code** | Branches that cannot execute, always-true conditions, shadowed variables, redundant fallbacks                                                |

### Step 4 - Report findings

Use this format exactly:

```
## Adversary Report

**Scope:** [files reviewed]

---

### Findings

#### [ADV-1] [Finding name]

**Severity:** blocking | should-fix | nice-to-have
**File:** `path/to/file.ts:line`
**What:** [Precise description of the flaw]
**Why it matters:** [Downstream risk - crash, exploit, silent data corruption, etc.]

#### [ADV-2] ...

---

### Verdict

PASS - No blocking findings.
- or -
BLOCK - [N] blocking finding(s). Address before proceeding.

[1–2 sentence overall assessment.]
```

**Severity definitions:**

- **Blocking** - will cause a bug in production, a security vulnerability, or data loss
- **Should-fix** - likely causes problems under certain conditions; fix before merging
- **Nice-to-have** - code smell or fragility; does not immediately break anything

**Verdict:**

- **PASS** - zero blocking findings
- **BLOCK** - one or more blocking findings; resolve or explicitly override before merging

---

## Developer

> **Agent definition:** `ce/agents/council/developer.md` > **Purpose:** Craft review - evaluate code against the project's established architectural
> patterns, abstraction standards, file-size discipline, and developer conventions. Catches
> AI slop, convention drift, and structural problems that a bug-hunter misses.

### Step 1 - Determine scope

- If an argument follows `developer` (e.g. `/council developer src/tools/`), use those paths.
- Otherwise, run `git diff --cached --name-only` to get staged files.
- If nothing is staged, fall back to `git diff --name-only HEAD`.
- Filter to source code files only. Exclude: `*.d.ts`, lock files, generated files,
  fixture snapshots, migration files.

### Step 2 - Load project conventions

Before reading the code, check for and read these files if they exist:

- `docs/PATTERNS.md` - project-specific coding patterns (primary reference)
- `ARCHITECTURE.md` or `docs/architecture-template.md` - layer boundaries, tech decisions
- `docs/DATA_DICTIONARY.md` - data model conventions

Note which files were found. If none exist, apply general senior-developer craft standards.
**Do not** read spec artifacts, `agent-docs/`, `specs/`, PRDs, or acceptance criteria.

### Step 3 - Apply developer analysis

Evaluate every file in scope across all eight dimensions:

| Dimension                    | What to look for                                                                                                                                                                                                                                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture conformance** | Layer boundaries violated (handler containing business logic, tool calling tool directly); imports across forbidden boundaries; patterns from `docs/PATTERNS.md` not followed                                                                                                                                              |
| **Abstraction quality**      | Over-abstraction - interfaces with one implementation, generics adding no safety; under-abstraction - copy-paste logic, repeated inline patterns that belong in a helper; business logic in a utility or I/O in a pure function                                                                                            |
| **File and function size**   | Source files over ~300 lines that should be split; functions over ~50 lines; classes doing more than one thing; deeply nested logic that should be extracted                                                                                                                                                               |
| **AI slop**                  | Comments that restate the code (`// increment counter`, `// return result`); unnecessary docblocks on trivial functions; over-engineered solutions to simple problems; excessive defensive guards around things that cannot fail; `data`, `result`, `temp`, `obj` as variable names; five lines of code that should be one |
| **Naming**                   | Misleading names; inconsistent conventions within the same module; names so vague they convey no intent; boolean flags named `flag`, `check`, `value`                                                                                                                                                                      |
| **Coupling and cohesion**    | Functions taking more than 4–5 arguments; hidden dependencies on global state; modules that know too much about their callers; exports that are never consumed externally                                                                                                                                                  |
| **Convention consistency**   | Multiple error-handling strategies in the same module; async done multiple incompatible ways; divergence from the pattern in neighbouring files                                                                                                                                                                            |
| **Dead structure**           | Empty interfaces or types, unused imports, exported symbols with no external consumers, commented-out code, stale `TODO`/`FIXME` comments                                                                                                                                                                                  |

### Step 4 - Report findings

Use this format exactly:

```
## Developer Report

**Scope:** [files reviewed]
**Patterns loaded:** [docs/PATTERNS.md - found | not found], [ARCHITECTURE.md - found | not found]

---

### Findings

#### [DEV-1] [Finding name]

**Severity:** blocking | should-fix | nice-to-have
**File:** `path/to/file.ts:line`
**What:** [Precise description of the issue]
**Fix:** [Concrete, actionable remediation]

#### [DEV-2] ...

---

### Verdict

PASS - No blocking findings.
- or -
BLOCK - [N] blocking finding(s). Address before proceeding.

[1–2 sentence overall assessment of code craft and conformance.]
```

**Severity definitions:**

- **Blocking** - architectural violation, abstraction inverted in a way that cascades, or structural problem that will compound with every future change
- **Should-fix** - convention drift, AI slop, or sizing issue that degrades maintainability; fix before merging
- **Nice-to-have** - minor inconsistency with no near-term consequence

**Verdict:**

- **PASS** - zero blocking findings
- **BLOCK** - one or more blocking findings; resolve or explicitly override before merging

---

## PMO

> **Agent definition:** `ce/agents/council/pmo.md` > **Purpose:** Spec traceability - verify that the implementation satisfies every acceptance
> criterion, business requirement, and scoped behaviour defined in the task spec, Jira ticket,
> or PRD. Finds gaps, partial implementations, and out-of-scope additions.

### Step 1 - Determine code scope

- If an argument follows `pmo` (e.g. `/council pmo src/features/auth/`), use those paths.
- Otherwise, run `git diff --cached --name-only` to get staged files.
- If nothing is staged, fall back to `git diff --name-only HEAD`.
- Filter to source code files only. Exclude: `*.d.ts`, lock files, generated files,
  fixture snapshots, migration files.

### Step 2 - Load spec (required)

Try each source in order; stop at the first hit:

1. **Branch → task spec on disk** - Run `git branch --show-current`, extract the Jira ticket
   key (e.g. `PROJ-123`), look for `specs/tasks/PROJ-123.md` locally.
2. **MCP task spec** - Call `read_task_spec` with the ticket key if the MCP server is connected.
3. **Jira ticket** - Call `jira_get_issue` with the ticket key if Jira credentials are present.
4. **Epic spec** - Look in `agent-docs/` for the relevant epic (`EP-00X-*.md`).
5. **PRD** - Fall back to `agent-docs/system-prd.md` or a milestone PRD.

**If no spec is found after all five steps:** Stop and report - "Spec not found. Provide a task
spec path, Jira ticket key, or agent-docs artifact path before running `/council pmo`."

### Step 3 - Read the code

Read the files in scope. Understand what they implement. **Do not** evaluate craft or hunt
for bugs - that is the Developer's and Adversary's job respectively.

### Step 4 - Apply PMO analysis

Evaluate across all six dimensions:

| Dimension                          | What to look for                                                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **AC traceability**                | Every acceptance criterion mapped to a specific code location; ACs with no corresponding implementation are a blocking gap                |
| **Business requirement alignment** | Higher-level goals from the PRD or epic are reflected; a feature that passes its ACs but misses the stated business intent is still a gap |
| **Scope - missing**                | Behaviour explicitly defined in the spec that is absent or incomplete in the implementation                                               |
| **Scope - added**                  | Behaviour present in the code that was not specified; flag for PMO review - may be acceptable, may be scope creep                         |
| **Edge case specification**        | Edge cases and error states defined in the ACs (e.g. "when X is empty, show Y") have corresponding handling                               |
| **Data and contract fidelity**     | API shapes, field names, validation rules, and response formats match what the spec defines                                               |

### Step 5 - Report findings

Use this format exactly:

```
## PMO Report

**Scope:** [files reviewed]
**Spec loaded:** [source - e.g. specs/tasks/PROJ-123.md | jira:PROJ-123 | agent-docs/EP-001-name.md]
**Ticket:** [PROJ-123 - ticket title, if available]

---

### AC Coverage

| # | Acceptance Criterion | Status | Evidence |
|---|----------------------|--------|----------|
| 1 | [AC text] | ✅ Implemented | `path/file.ts:line` |
| 2 | [AC text] | ⚠️ Partial | [what is missing] |
| 3 | [AC text] | ❌ Missing | [no evidence found] |

---

### Findings

#### [PMO-1] [Finding name]

**Severity:** blocking | should-fix | nice-to-have
**AC / Requirement:** [Which AC or requirement this relates to]
**What:** [Description of the gap or misalignment]
**Evidence:** [What the spec says vs what the code does]

#### [PMO-2] ...

---

### Verdict

PASS - All ACs implemented and no blocking gaps found.
- or -
BLOCK - [N] blocking gap(s). Address before proceeding.

[1–2 sentence overall assessment of spec coverage and business alignment.]
```

**Severity definitions:**

- **Blocking** - an AC is missing or a business requirement is unmet; the feature cannot be accepted
- **Should-fix** - partial AC implementation or data contract divergence; technically present but incomplete
- **Nice-to-have** - out-of-scope addition worth noting, or minor wording divergence with no functional impact

**Verdict:**

- **PASS** - all ACs implemented; no blocking gaps
- **BLOCK** - one or more ACs missing or business requirement unmet; resolve before acceptance

---

## Design

> **Agent definition:** `ce/agents/council/designer.md` > **Purpose:** Design-system review - check the implementation against Figma specs, design
> tokens, and Storybook. Identify regressions in shared components, flag outdated patterns,
> and surface opportunities to improve design system adoption.

### Step 1 - Determine scope

- If an argument follows `design` (e.g. `/council design src/components/`), use those paths.
- Otherwise, run `git diff --cached --name-only` to get staged files.
- If nothing is staged, fall back to `git diff --name-only HEAD`.
- Focus on: component files (`*.tsx`, `*.jsx`, `*.vue`, `*.svelte`), style files
  (`*.css`, `*.scss`, `*.module.*`), stories (`*.stories.*`), Code Connect (`*.figma.*`).

### Step 2 - Load design context

Try each source; note which are available:

1. **Figma** - if the Figma MCP server is connected, call `get_design_context` with any
   Figma URLs found in the code, stories, or project docs. If no URL is available or Figma
   is not connected, note "Figma not accessible" and proceed.
2. **Code Connect files** - look for `*.figma.ts` / `*.figma.js`; check prop mappings
   against the current component API for staleness.
3. **Storybook stories** - read `*.stories.*` files for components in scope.
4. **Design tokens** - look for `theme.ts`, `tokens.ts`, `tailwind.config.*`, `vars.css`,
   `_tokens.scss`. These define the canonical design vocabulary.
5. **`docs/PATTERNS.md`** - project UI and design system conventions.

### Step 3 - Apply design analysis

Evaluate every file in scope across all eight dimensions:

| Dimension                        | What to look for                                                                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Figma spec conformance**       | Implementation diverges from Figma design - wrong colors, spacing, typography, component structure, interaction states                                    |
| **Design system adoption**       | Hardcoded hex values, magic spacing/sizing numbers, one-off styles that duplicate existing design system tokens or components                             |
| **Regressions**                  | Changes to shared components (buttons, inputs, layouts, typography) that alter their visual or behavioral contract for all consumers                      |
| **Storybook coverage**           | Changed components lacking stories; existing stories no longer representing current states and variants; stories using hardcoded values instead of tokens |
| **Code Connect alignment**       | `*.figma.ts` prop mappings that no longer match the component API; Figma/code component name drift                                                        |
| **Outdated patterns**            | Deprecated design system APIs, old CSS methodologies superseded by the token system, patterns marked legacy in `docs/PATTERNS.md`                         |
| **Accessibility (design-level)** | Color contrast issues, text below minimum readable size, interactive elements missing visible focus states, icon-only buttons missing accessible labels   |
| **Improvement opportunities**    | Places where a design system component could replace a custom implementation; inconsistent spacing or color that would benefit from tokenisation          |

### Step 4 - Report findings

Use this format exactly:

```
## Design Report

**Scope:** [files reviewed]
**Context loaded:** [Figma - accessible | not accessible], [Stories - N found],
                   [Tokens - found | not found], [Code Connect - N files found]

---

### Findings

#### [DES-1] [Finding name]

**Severity:** blocking | should-fix | nice-to-have
**File:** `path/to/Component.tsx:line`
**What:** [Precise description of the design issue]
**Reference:** [Figma node, token name, story name, or design system component]

#### [DES-2] ...

---

### Verdict

PASS - No blocking findings.
- or -
BLOCK - [N] blocking finding(s). Address before proceeding.

[1–2 sentence overall assessment of design fidelity and design system health.]
```

**Severity definitions:**

- **Blocking** - spec divergence visible to users, regression in a shared component, or complete bypass of the design system
- **Should-fix** - token drift, missing stories for changed components, stale Code Connect mapping
- **Nice-to-have** - improvement opportunity, minor inconsistency, advisory design system adoption note

**Verdict:**

- **PASS** - zero blocking findings
- **BLOCK** - one or more blocking findings; resolve or explicitly override before merging

---

## Full Council

> **Purpose:** Reporter in Dispatch mode - all four specialists. Invokes all four specialist
> agents, collects their findings, then runs the skill dispatch pass. Use when you want a
> complete review without letting Reporter prune the agent list.

See the [Reporter - Dispatch mode](#reporter) section. Reporter receives `full` as the
argument and runs all four specialists in parallel.

---

## Reporter

> **Agent definition:** `ce/agents/council/reporter.md` > **Default entry point for `/council` and `/council full`.** > **Purpose:** Orchestrate specialist agents and CE review skills. In Orchestrator mode,
> select and invoke the right specialists for the scope; in Dispatch mode, invoke the named
> agent(s) directly. Always follows up with the skill decision pass.

### Orchestrator mode - `/council [scope]`

**Step 1 - Determine scope**

- If a file path or glob was passed, use those paths.
- Otherwise, run `git diff --cached --name-only` to get staged files.
- If nothing is staged, fall back to `git diff --name-only HEAD`.
- Filter to source files only. Exclude: `*.d.ts`, lock files, generated files, snapshots,
  migration files.

**Step 2 - Analyze scope and select specialists**

Read the file list and apply these heuristics:

| Condition                                                                                         | Agents to invoke         |
| ------------------------------------------------------------------------------------------------- | ------------------------ |
| Always                                                                                            | Always include Adversary |
| Any `src/` files present                                                                          | Always include Developer |
| UI or design files (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss`, `.stories.*`, `.figma.*`) | Include Design           |
| A Jira ticket or task spec is traceable to the change                                             | Include PMO              |
| Scope is docs-only (`.md`, config files, no source changes)                                       | Skip Developer           |
| Spec cannot be found after a quick lookup                                                         | Skip PMO                 |
| Scope is ambiguous or cannot be categorized                                                       | Invoke all four          |

State which agents were selected and why before invoking them.

**Step 3 - Spawn selected specialists as subagents**

Spawn each selected agent as an **independent subagent** - do not run specialists inline
in this session. Subagent isolation is critical: the Adversary in particular must have no
access to spec context from the parent session.

For each agent, the subagent prompt must include:

- The scope file list from Step 1
- The agent definition path: `ce/agents/council/[name].md`
- The agent's playbook section (the corresponding named section in this file)
- Instruction to return the full structured report with no summarizing

All selected agents may be spawned in parallel. Collect each subagent's complete report
before proceeding to Step 4.

**Step 4 - Skill dispatch**

Apply the skill decision matrix (same as Dispatch mode Step 2 below). Invoke all warranted
skills, collect their full output.

**Step 5 - Combined report**

```
## Council Report

**Mode:** Orchestrator
**Scope:** [files reviewed]
**Specialists invoked:** [list] - [reason per agent]
**Specialists skipped:** [list] - [reason per agent]
**Skills invoked:** [list, or "none"]
**Date:** [YYYY-MM-DD]

---

### [Agent Name] Report

[Full agent output]

---

### Reporter Addendum

[Full skill outputs, one subsection per skill invoked]

---

### Combined Verdict

| Agent | Verdict | Blocking findings |
| --------- | ---------------------- | ----------------- |
| [Agents run only]       |            |         |

**Skills invoked:** [list, or "none"]

**Overall:** PASS - no blocking findings.
- or -
**Overall:** BLOCK - [N] total blocking finding(s). Address before merging.

[1–2 sentence summary of highest-priority issues.]
```

---

### Dispatch mode - `/council [agent-name] [scope]`

**Step 1 - Determine scope** (same as Orchestrator mode Step 1)

**Step 2 - Invoke agent(s)**

| Argument    | Action                                                                    |
| ----------- | ------------------------------------------------------------------------- |
| `adversary` | Spawn an Adversary subagent following the [Adversary](#adversary) section |
| `developer` | Spawn a Developer subagent following the [Developer](#developer) section  |
| `pmo`       | Spawn a PMO subagent following the [PMO](#pmo) section                    |
| `design`    | Spawn a Design subagent following the [Design](#design) section           |
| `full`      | Spawn all four as independent parallel subagents                          |

**Step 3 - Skill dispatch**

After agent(s) complete, apply this matrix. Invoke any triggered skill via
`get_slash_command` with `command_name: <skill-name>` (or `resources/read` with URI
`ce/.agents/commands/<skill-name>.md`). Follow each loaded playbook step by step. Capture full
output - do not summarize or filter.

| Trigger                                                        | Skill                 | Applicability guard                               |
| -------------------------------------------------------------- | --------------------- | ------------------------------------------------- |
| Any agent: one or more **blocking** findings                   | `/pre-flight`         | Always applicable                                 |
| Adversary: any **blocking** or **should-fix** security finding | `/ai-review`          | Skip if scope is docs-only                        |
| Developer: any **blocking** architecture-conformance finding   | `/architecture-check` | Skip if no architecture doc exists in the project |
| Developer or any agent: test coverage gap noted                | `/test-coverage`      | Skip if scope is docs-only or config-only         |
| Design: any **blocking** Figma spec divergence or regression   | `/design-review`      | Skip if Figma not accessible and no stories exist |
| All agents: **PASS**                                           | _(no skills invoked)_ | N/A                                               |

Rules:

- Each skill is invoked at most once, regardless of how many findings trigger it.
- Invocation order: `/pre-flight` → `/ai-review` → `/architecture-check` → `/test-coverage`
  → `/design-review`.
- If an applicability guard cannot be determined, err on the side of invocation.

**Step 4 - Combined report**

Same format as Orchestrator mode, with `**Mode:** Dispatch - [agent-name]`.

---

## Exploration Council

> **Purpose:** Deeply explore a codebase area using parallel investigator agents.

### Phase 1 - Initial Reconnaissance

Gather general information about the area:

- Relevant keywords and naming conventions
- Architecture overview
- File structure patterns
- Key entry points

### Phase 2 - Parallel Deep Dive

Spawn **n=10** task agents (unless specified otherwise) to investigate:

| Agent Focus    | Purpose                           |
| -------------- | --------------------------------- |
| Core patterns  | Main implementation approach      |
| Data flow      | How data moves through the system |
| Error handling | Edge cases and failure modes      |
| Testing        | How this area is tested           |
| Integration    | Connections to other systems      |
| Configuration  | Settings and environment          |
| Performance    | Optimization patterns             |
| Security       | Auth, validation, sanitization    |
| 2x Exploratory | "Out of the box" for variance     |

### Phase 3 - Synthesis

Combine findings into:

1. **Summary**: How this area works
2. **Patterns**: Key conventions to follow
3. **Risks**: Unknowns and potential issues
4. **Recommendations**: Suggested approach

### Output

If user is in plan mode: Use findings to create the implementation plan.
Otherwise: Present findings and await further instructions.

### Example Prompt to Agents

```
Investigate [area] in this codebase. Focus on:
- [specific focus area]
- File patterns and naming
- Dependencies and imports
- Testing approach

Return: Summary, key files, patterns found, concerns.
```
