---
description: AI support for implementation and architecture conformance in the implementation client. Reads specs from PMO; escalates design spec gaps to Design Agent / PMO.
prompt: developer_agent
---

# Developer Assistant Agent

AI support for implementation, design review, and architecture **conformance** in the implementation client (recommended: Cursor). Spec and architecture **content** is owned by PMO in the planning client - developers read artifacts only.

**Audience: humans** - for understanding and designing developer behavior.

**Prompt:** `developer_agent`

---

## Role

The Developer agent assists with:

- Implementation from specs and tickets
- Code generation and refactoring
- Test creation and maintenance
- Code review assistance
- **Architecture decisions** - technology selection, NFR mapping, risk and mitigation notes
- **Architecture conformance** - check code against architecture template during review

---

## Oversight (Limited Scope)

**Developer oversees only:**

- Code quality, tests, and PR content
- Architecture conformance (`/architecture-check`)
- Branch naming, commits, and quality gates
- Jira ticket transitions (To Do → In Progress → Done)

**Developer does NOT oversee:**

- Phase gates, HITL presentation, or `Output Approved.` - Gate-Check
- Document validation or security scanning - Gate-Check
- Design spec readiness (`/design-review`, Design Agent) - **Design Agent**; PMO updates specs when NOT READY
- Creating or editing files in `agent-docs/` or `output-docs/` (SOW, PRD, milestones, epics, architecture, .docx review copies) - **PMO in the planning client**
- Epic/story structure sync (`jira_sync_specs`) or scope-change application - **PMO in the planning client**
- Framework templates, guidelines, or commands - Maintainer

---

## Inputs

- Approved PRD, epic, or task specs
- Codebase context (files, patterns)
- Ticket descriptions and acceptance criteria
- Architecture template or draft (for architecture conformance)
- System overview or PRD (for architecture decisions)

---

## Outputs

- Code changes (features, fixes, tests)
- PR descriptions
- Technical documentation updates
- Review feedback on others' code
- Architecture decisions with rationale
- Escalation notes when Design Agent reports NOT READY (PMO updates specs)

---

## Tool Access

- Work-on-PRD and related slash commands (read specs; do not rewrite planning artifacts)
- Spec validation and quality-gate tools
- Project-specific IDE rules (e.g. `.cursor/rules/` when using Cursor)
- `architecture-check` - architecture conformance; **`/design-review`** invokes **Design Agent** (not Developer) for spec readiness
- `list_artifacts`, `read_artifact` - **only** for loading specs; do **not** use `save_artifact` or `apply_scope_changes`

---

## Human-in-the-Loop

- Developer reviews and approves all code (Developer's domain)
- PRs require human review before merge
- No autonomous merges or deploys
- Architecture decisions require Tech Lead sign-off before development begins
- Design readiness is owned by **Design Agent** (`/design-review`); escalate spec gaps to PMO
- **Phase gates:** Hand off to Gate-Check when a phase artifact is ready; Gate-Check owns HITL. Developer does not run `phase_checkpoint` or accept `Output Approved.`

---

## See Also

- [SOW+ Architecture](../SOW/architecture-template.md)
- [Development phase](../Development/)
- [design-assistant.md](./design-assistant.md) - spec and design-system readiness (`/design-review`)
- [council/developer.md](./council/developer.md) - craft review role when invoked via `/council developer`
- [agents/README.md](./README.md)
