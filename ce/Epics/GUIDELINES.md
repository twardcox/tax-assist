# Epics - Guidelines

**Shared guidelines:** See [SHARED-GUIDELINES.md](../SHARED-GUIDELINES.md) for Phase Checkpoint Protocol and File Creation Verification.

---

## Story Tracking Format (Mandatory)

Every user story in an epic spec **MUST** use the `- [ ] Story:` checkbox format. This is not optional — it enables dashboard completion tracking and automatic Jira sync.

```markdown
- [ ] Story: As a [user type], I want [action], so that [benefit]
  - Key: TBD
  - Summary: [One-line Jira summary]
  - Acceptance Criteria:
    - Given [context], when [action], then [result]
  - Risks/Deps: [Any blockers]
```

**Rules:**

- Start every user story with exactly `- [ ] Story:` (including the space before `Story`).
- Include `  - Key: TBD` immediately after the story title. Replace `TBD` with the real Jira key (e.g. `BA1631-42`) once User Stories creates the Story ticket.
- Acceptance criteria are **plain list items** — not checkboxes. The Story checkbox is the unit tracked at epic level.
- Do **not** use `### Story N:` headings. The heading format is not machine-readable for tracking or Jira sync.

The `- Key:` annotation is what allows the dashboard "Sync from Jira" button to automatically check off stories whose Jira ticket status is Done.

---

## Epics Review Checklist

When presenting the Epic specs for approval, include this checklist. The PM/PO (and Tech Lead) must confirm each before responding `Output Approved.`:

- [ ] Business value is clear for each epic
- [ ] Technical feasibility is confirmed
- [ ] **All user stories use `- [ ] Story:` checkbox format** with `- Key: TBD` sub-item
- [ ] User stories have Given/When/Then acceptance criteria
- [ ] API contracts and data models are defined (where applicable)
- [ ] UI requirements and states are documented
- [ ] UI-heavy epics: component/block decomposition and build order documented (see **UI work and Atomic Design** below)
- [ ] Risks and dependencies are documented
- [ ] Test scenarios (happy path, errors, edge cases) are identified

### Design readiness (UI-heavy epics)

Before requesting Gate-Check HITL on a **UI-heavy** epic, run **`/design-review`** in **epic mode**
(invokes the **Design Agent** via `design_validate_epic`). The epic should reach **READY FOR
DEVELOPMENT** — or blocking gaps must be addressed by PMO (or explicitly overridden) before
Gate-Check. This is separate from framework template compliance (Gate-Check) and from
implementation fidelity review (`/council design` after code exists).

---

## UI work and Atomic Design (Jira-ready planning)

When an epic is **UI-heavy**, plan **multiple user stories** so work can ship in **small, vertical slices** ordered from **shared building blocks** toward **full screens or flows**. Adapt [Brad Frost’s Atomic Design](https://atomicdesign.bradfrost.com/) to your stack (e.g. atoms → molecules → organisms → templates/pages, or “primitive → block → section → page”). Names and levels matter less than **clear dependencies** and **testable outcomes per story**.

**Do this in the epic spec (Epics), not by splitting ACs into Tasks in User Stories:**

- **Earlier stories:** reusable UI primitives and composed blocks (tokens, controls, cards, layout regions) with their own Given/When/Then ACs where they deliver observable value (e.g. accessible states, keyboard behavior, responsive rules).
- **Later stories:** assemble those pieces into screens, routes, or end-to-end flows; link **Blockers** / **Risks/Deps** to the stories that must merge first.
- **Reuse first:** prefer extending existing design-system or app components. Note in **UI Requirements** or **Risks/Deps** when a component is reused vs new. **Augmentation is encouraged only while the result stays readable and maintainable**; if props/slots/variants would become unwieldy, split into a new focused component and reference it in the epic.

User Stories still creates **one Jira Story per user story** with **all ACs in that Story** - granularity comes from **how many user stories** the epic defines, not from one Task per acceptance criterion.
