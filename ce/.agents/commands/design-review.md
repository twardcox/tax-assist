---
description: Design readiness review — spec, design system, states, and accessibility before development (Design Agent)
argument-hint: [epic-path | ticket-key | delivery]
---

## Task

Run a **Design Readiness** review via the **Design Agent**. Validates that design specs and
the design language system are complete enough for development — without inventing error states,
empty states, labels, or token usage at coding time.

## Step 0 — Activate Design Agent

Invoke the appropriate MCP prompt **before** running the checklist:

| Scope                      | Prompt                                                       | When                                                      |
| -------------------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| Epic path in `agent-docs/` | `design_validate_epic` with `artifact_path`                  | Planning — UI-heavy Epics epic before Gate-Check          |
| Jira ticket key            | `design_validate_ticket` with `ticket_key`                   | Pre-implementation — after `/start-ticket`, before coding |
| General / pre-PR           | `design_agent` with `mode`: `epic` \| `ticket` \| `delivery` | Default; use `delivery` for pre-PR second pass            |

Load `ce/agents/design-assistant.md` if not already in context.

## Modes

### Epic (planning)

- **Input:** Epic path (e.g. `agent-docs/EP-001-checkout.md`)
- **When:** After PMO drafts a UI-heavy epic; **before** Gate-Check HITL
- **Read:** `read_artifact` for the epic
- **Escalate:** PMO updates epic in planning client if **NOT READY**

### Ticket (pre-implementation)

- **Input:** Ticket key (e.g. `PROJ-123`)
- **When:** UI/Story ticket selected; before implementation
- **Read:** `read_task_spec`, `jira_get_issue`, linked epic via `read_artifact`
- **Stop:** Do not recommend coding until **READY FOR DEVELOPMENT** or explicit override

### Delivery (pre-PR)

- **Input:** Ticket key + summary of branch changes
- **When:** Pre-PR gate (after implementation)
- **Confirm:** Delivered work still matches spec intent
- **Optional:** Run `/council design` for code-level Figma/token fidelity (separate from spec readiness)
- **Skip** when ticket is out of scope (pure copy, config-only, no behavioral surface)

## How to Read Specs

- **Epic:** `read_artifact` (kind: epic, phase: 4) — not `read_task_spec`
- **Ticket:** `read_task_spec` with ticket key (server volume or Drive/local per config)
- **Figma:** `show_project_config` → `toolkit.figma`; use Figma MCP `get_design_context` when connected

## When Required

- New UI component or page
- UI-heavy epic before phase Gate-Check
- API endpoint with user-visible errors or empty states
- External service integration with loading/error UX
- Accessibility-sensitive flows

## Design Readiness Checklist

Run all seven dimensions from `ce/agents/design-assistant.md`. Classify each finding:

- **Blocking** — developer would invent UX, states, or DS primitives
- **Should-fix** — clarity or DS adoption; could proceed with assumptions
- **Nice-to-have** — advisory

### Dimensions (summary)

1. **Spec completeness** — screens, flows, failure paths; no `[TBD]` in scope
2. **Interaction states** — default, hover, focus, disabled, loading, **error**, **empty**
3. **Accessibility contract** — labels, keyboard path, WCAG level, focus/contrast
4. **Design language system** — tokens/components vs one-offs; missing DS primitives flagged
5. **Figma ↔ spec alignment** — frames for required states; links in spec
6. **API / data ↔ UI** — errors, empty lists, validation copy mapped
7. **Copy and content** — errors, empty CTAs, headlines specified

### Supplemental (non-UI tickets)

For API/schema/integration-only work, also review when applicable:

- API contract (schemas, error responses, auth)
- Data model (validation, migrations)
- Architecture/integration (failure modes, retries)

## Output — Design Readiness Report

```markdown
## Design Readiness: [Epic ID | Ticket KEY]

**Verdict:** READY FOR DEVELOPMENT | NOT READY
**Mode:** epic | ticket | delivery
**Context:** Figma [accessible | not accessible], tokens [found | not found], spec [path]

### Blocking gaps

- [DS-1] **[Title]** — [What is missing] — **Reference:** [section, Figma node, AC]

### Should-fix

- [DS-2] ...

### Nice-to-have

- [DS-3] ...

### PMO follow-ups (if NOT READY)

- [ ] [Action for planning client]

### Overrides logged

- Override: [gap] - [justification]
```

Save via `save_report` to `reports/design-readiness-{scope}-{date}.md` when gaps or overrides exist.

## Override Protocol

Human may proceed with: `Override: [gap name] - [justification]`

Log in the report. Design Agent does **not** accept `Output Approved.` (Gate-Check only).

## See Also

- `/council design` — implementation fidelity after code exists
- `/architecture-check` — architecture conformance (separate gate)
- `ce/agents/design-assistant.md` — full agent definition and severity table
