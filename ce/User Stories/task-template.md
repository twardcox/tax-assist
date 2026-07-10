# Task: [Short imperative title]

> **Provenance:** Locally generated 2026-07-08 by intent-reconstruction from CE root README ("Task tickets for change orders or targeted work") and User Stories guidelines. Replace on upstream sync.

Tasks are for **change orders and targeted work** where a full user story is not appropriate — a bounded modification, a spec-gap fix, an operational chore with behavior risk. Tasks are **never** used to split a user story's acceptance criteria or to stand in for component-level stories that belong in an epic.

---

## Task: [Title]

- Key: TBD
- Type: [Change order | Targeted work | Spec-gap fix]
- Origin: [What triggered this — user request, review finding, incident, `/lightweight-change` reference]
- Related Story/Epic: [Key or EP-XXX, or "none — standalone"]
- Summary: [One line]
- Description: [What changes and why — enough that the implementer needs no verbal context]
- Acceptance Criteria:
  - Given [context], when [action], then [result]
- Out of Scope: [What this task must not touch]
- Risks/Deps: [Blockers; affected areas; rollback note if behavior-risky]
- Estimate: [Points or hours, if the team estimates]

---

## Rules

1. **A task changes something that already exists or fills a bounded gap.** New user-visible capability belongs in a user story under an epic.
2. **Change orders reference their origin** — the conversation, review finding, or `/lightweight-change` record that authorized them. Scope changes never enter code silently.
3. **Spec updates travel with the task**: if the task changes behavior described in an epic/story, the task includes updating that spec (with change-log entry) as an AC.
4. **Same quality bar as stories**: testable ACs, explicit out-of-scope, named dependencies.
