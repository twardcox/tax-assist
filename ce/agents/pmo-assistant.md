---
description: AI support for PM/PO work: specs, requirements, and planning. Setup loop (planning phases) and management loop (active project).
prompt: pmo_agent
---

# PMO Assistant Agent

AI support for PM/PO work: specs, requirements, and planning. **Recommended planning client: Cowork** (or any MCP-capable AI assistant) - the PMO owns **all** PM-facing documentation regardless of “which phase” the project is in; scope or requirement changes that touch multiple documents are handled here.

**Audience: humans** - for understanding and designing PMO agent behavior.

**Prompt:** `pmo_agent`

---

## Two operating loops

The PMO has **two** modes (the `pmo_agent` prompt auto-detects from `list_artifacts`; entry is usually through slash commands and Agent Skills):

### 1. Setup loop (planning phases)

- **When:** New greenfield project or planning not yet complete (no sprint plan and not skip-planning with `contextResolvedAt`). For **skip-planning** adoption, setup means uploading `research/` and running **`resolve_project_context`** — not SOW+ through Sprint Planning.
- **What:** Walk **linearly** through SOW+ → PRD → Milestones → Epics → User stories → Sprint planning, with **HITL at each step** (Gate-Check is agent of record for `Output Approved.`).
- **How:** `/new-project` for bootstrap, then phase prompts and playbooks like `/create-product-requirement-doc`, `/breakdown-milestone`, `/sprint-complete` at the end of Sprint Planning planning.

### 2. Management loop (active / ongoing)

- **When:** Sprint plan exists in `agent-docs/` **or** skip-planning adoption completed (`contextResolvedAt` set after `resolve_project_context`).
- **What:** **Repeatable**, event-driven work: track tickets vs specs, add missing detail, add tickets via `/new-ticket` (task/bug quick path, or user story with change pass-a/b → `/change-apply`), tweak **existing** specs with `/lightweight-change`, run `/sprint-checkin` and `/sprint-complete`, review milestones with `/milestone-review`, and get a full picture with `/pmo-manage` or `/pmo-status` (MCP: `project_status` is similar, different UX).
- **How:** Start with `get_next_steps` and `/pmo-manage` to orient; pick the right playbook for the current need.

Do not confuse **lightweight** spec edits (no new ticket work for new scope) with **new** user stories - new stories that change scope go through `/new-ticket` (user story) and the change runbook.

---

## Role

The PMO agent assists with:

- SOW+ and PRD creation and revision
- Milestone and epic breakdown and updates
- Acceptance criteria and testability
- Requirements clarity and consistency
- Cross-cutting edits that affect **any** planning artifact (`agent-docs/`, `output-docs/`, ticket planning sync, change requests)

---

## Oversight (Limited Scope)

**PMO oversees only:**

- Spec content quality (SOW+, PRD, milestones, epics)
- Requirements clarity and consistency
- Ticket creation and sync
- Stakeholder alignment on scope and acceptance criteria

**PMO does NOT oversee:**

- Document validation, security scanning, or input readiness - Gate-Check
- Phase gates, HITL presentation, or `Output Approved.` - Gate-Check
- Application code, tests, PRs, or production implementation - Developer (implementation client)

---

## Inputs

- Project context (SOW+, constraints)
- Stakeholder input or change requests
- Existing specs (for updates or extensions)

---

## Outputs

- PRD sections
- Milestone or epic structures
- Acceptance criteria
- Ticket-ready descriptions

---

## Tool Access

- PRD templates and structure
- Milestone/epic templates
- CE PM workflows and slash commands
- `save_artifact`, `read_artifact`, `list_artifacts`
- **Hand off to Gate-Check** for `phase_checkpoint` - PMO does NOT call phase_checkpoint; Gate-Check owns HITL
- `jira_sync_specs`, `jira_status`, `jira_snapshot`

---

## Human-in-the-Loop

- PM/PO approves and revises all spec content (PMO's domain)
- Stakeholder sign-off on requirements
- No autonomous creation of production specs
- **Phase gates:** Hand off to Gate-Check after each artifact; Gate-Check owns HITL. PMO does not run `phase_checkpoint` or accept `Output Approved.`

---

## See Also

- [PM Workflows](https://github.com/assembleinc/coherence-engine)
- [council/pmo.md](./council/pmo.md) - spec-traceability review role when invoked via `/council pmo`
- [agents/README.md](./README.md)
