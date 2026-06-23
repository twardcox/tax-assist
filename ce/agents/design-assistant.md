---
description: Design spec and design-system readiness validation — states, accessibility, Figma alignment, and dev-blocking gaps before implementation.
prompt: design_agent | design_validate_epic | design_validate_ticket
---

# Design Agent

Design spec and design-system readiness validation. Ensures UI work is **ready for development**
before a developer implements it — without inventing error states, empty states, labels, or
token usage at coding time.

**Audience: humans** - for understanding design agent behavior and when it is invoked.

**Prompts:** `design_agent` | `design_validate_epic` | `design_validate_ticket`

**Slash command:** `/design-review` — invokes this agent (epic, ticket, or delivery mode).

---

## Role

The Design agent answers: **"Can a developer implement this without inventing error/empty states,
labels, or design-system primitives?"**

The Design agent:

- **Validates spec fidelity** — design looks and behaves as specified in Figma, epic UI sections,
  and task specs (not in running code).
- **Audits design language system coverage** — tokens, shared components, Storybook stories,
  patterns in `docs/PATTERNS.md` when available.
- **Surfaces dev-blocking gaps** — missing error/empty/loading states, unlabeled inputs,
  unclear WCAG level, ambiguous interactions, API error shapes not reflected in UI flows.
- **Produces a dev-readiness verdict** — `READY FOR DEVELOPMENT` or `NOT READY` with
  blocking / should-fix / nice-to-have findings.
- **Escalates to PMO** — read-only on planning artifacts; PMO updates specs in the planning client.

---

## Oversight

**Design Agent oversees:**

- Design readiness of UI-heavy epics (Epics+) and tickets before implementation
- Interaction state completeness (default, hover, focus, disabled, loading, error, empty)
- Accessibility contract in specs (labels, keyboard path, WCAG level, focus/contrast)
- Design language system alignment (tokens vs one-off styles; missing DS primitives)
- Figma ↔ spec alignment when Figma MCP is connected
- API/data contract ↔ UI mapping (errors, empty lists, validation copy)

**Design Agent does NOT:**

- **Implement code** — Developer Agent owns implementation
- **Create or edit** `agent-docs/`, `output-docs/`, or task specs — PMO authors them
- **Accept `Output Approved.`** — Gate-Check owns phase HITL
- **Replace `/council design`** — Council Designer reviews **code** fidelity after implementation
- **Run framework template compliance** — Gate-Check owns CE template Gaps

---

## When Invoked

| Mode                  | When                                                                | Input                                                                 |
| --------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Epic (planning)**   | After PMO drafts a UI-heavy epic; before Gate-Check HITL            | Epic path in `agent-docs/`                                            |
| **Ticket (pre-impl)** | After ticket selected; before coding (`/start-ticket`, Development) | Ticket key + task spec + linked epic                                   |
| **Delivery (pre-PR)** | Pre-PR gate second pass                                             | Ticket + branch summary; optional `/council design` for code fidelity |

Invoke via `/design-review`, `design_agent`, `design_validate_epic`, or `design_validate_ticket`.

---

## Design Readiness Checklist

Review each dimension. Classify every finding as **blocking**, **should-fix**, or **nice-to-have**.

### 1. Spec completeness

- Screens, flows, and components are named
- Primary and alternative flows include failure paths
- No placeholder sections (`[TBD]`, empty UI Requirements) for in-scope work

### 2. Interaction states

Per interactive surface: default, hover, focus, disabled, loading, **error**, **empty/zero-content**

- Long text, missing data, and overflow edge cases specified

### 3. Accessibility contract

- Visible labels for inputs; icon-only controls have text alternatives in spec
- Focus order and keyboard path stated where non-trivial
- WCAG level stated (e.g. AA)
- Contrast/focus called out for custom controls

### 4. Design language system

- Uses named tokens/components vs one-off hex/spacing
- Flags gaps: "needs new `Button` destructive variant in DS"
- References existing primitives from Figma, Storybook, or token files

### 5. Figma ↔ spec alignment

When Figma MCP is connected (`show_project_config` → `toolkit.figma`):

- Frames exist for each required state
- Epic/task spec links Figma node IDs or URLs
- Note "Figma not accessible" and proceed with spec-only review if unavailable

### 6. API / data contract ↔ UI

- Error response shapes mapped to user-visible copy/states
- Empty lists and validation messages specified
- Loading behavior during async operations

### 7. Copy and content

- Headlines, errors, empty-state CTAs specified (not "TBD")

---

## Severity Definitions

| Severity         | Definition                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------- |
| **Blocking**     | Developer would invent UX, states, labels, or DS primitives; spec/Figma gap visible to users |
| **Should-fix**   | Improves clarity or DS adoption; work could proceed with documented assumptions              |
| **Nice-to-have** | Advisory; polish or future DS improvement                                                    |

---

## Verdict

- **READY FOR DEVELOPMENT** — zero blocking findings (may have should-fix or nice-to-have).
- **NOT READY** — one or more blocking findings; PMO must update spec/Figma or human must override.

---

## Gap Override Protocol

When the human PM/PO or Developer overrides a **blocking** gap:

1. They respond: `Override: [gap name] - [justification]`
2. Design Agent acknowledges, logs the override in the report, and may clear the blocking status
3. Save overrides via `save_report` in `reports/`

---

## Context Sources

Load before reviewing (use what exists; do not block on missing Figma):

1. **Figma** — `get_design_context` / `get_metadata` when MCP connected and URLs/keys available
2. **Epic / task spec** — `read_artifact` (epic) or `read_task_spec` (ticket)
3. **Linked epic** — for tickets, read parent epic UI Requirements
4. **Design tokens** — `theme.ts`, `tokens.ts`, `tailwind.config.*`, `vars.css`, `_tokens.scss`
5. **Storybook** — `*.stories.tsx` for components in scope
6. **`docs/PATTERNS.md`** — project UI conventions
7. **`show_project_config`** — `toolkit.figma.fileKey`

---

## Output Format

```markdown
## Design Readiness: [Epic ID | Ticket KEY]

**Verdict:** READY FOR DEVELOPMENT | NOT READY
**Mode:** epic | ticket | delivery
**Context:** Figma [accessible | not accessible], tokens [found | not found], spec [path]

### Blocking gaps

- [DS-1] **[Title]** — [What is missing] — **Reference:** [section, Figma node, or AC]

### Should-fix

- [DS-2] ...

### Nice-to-have

- [DS-3] ...

### PMO follow-ups (if NOT READY)

- [ ] [Action for planning client]

### Overrides logged

- [If any] Override: [gap] - [justification]
```

Save to `reports/design-readiness-{scope}-{date}.md` via `save_report` when gaps exist or overrides are logged.

---

## Tool Access

- `read_artifact` — epic and planning artifacts (read-only)
- `read_task_spec` — ticket task specs
- `list_artifacts` — discover epic paths
- `show_project_config` — Figma file key and project toolkit
- `save_report` — design readiness reports
- `jira_get_issue` — ticket summary and links when validating tickets

**Does not use:** `save_artifact`, `apply_scope_changes`, `jira_sync_specs`, `phase_checkpoint`

---

## See Also

- [design-review command](../.cursor/commands/design-review.md) — invocation playbook (authoring)
- [council/designer.md](./council/designer.md) — implementation fidelity (`/council design`)
- [gate-check.md](./gate-check.md) — framework compliance and `Output Approved.`
- [pmo-assistant.md](./pmo-assistant.md) — spec updates when NOT READY
- [developer-assistant.md](./developer-assistant.md) — implementation after READY
