# User Stories - Guidelines

> **Provenance:** Locally generated 2026-07-08 by intent-reconstruction (see README.md in this directory). Replace on upstream sync.

**Shared guidelines:** See [SHARED-GUIDELINES.md](../SHARED-GUIDELINES.md) for Phase Checkpoint Protocol and File Creation Verification.

---

## User Stories Review Checklist

When presenting the story set for approval, include this checklist. The PM/PO must confirm each before responding `Output Approved.`:

- [ ] Every epic user story has exactly one story spec (no splits, no merges)
- [ ] Each story carries **all** of its acceptance criteria from the epic (Given/When/Then)
- [ ] Stories are INVEST-shaped: independent where possible, valuable, small enough to complete within a sprint
- [ ] Blockers/dependencies reference the stories that must land first (foundation before composition)
- [ ] Estimates (points or hours) present if the team estimates
- [ ] No Task tickets created to split ACs or stand in for user stories
- [ ] Keys updated from `TBD` in the epic specs once tickets exist (Jira projects)
- [ ] Ready for Sprint Planning: a planner could sequence these without reading the epics

---

## Workflow

```
Approved epic specs (agent-docs/epics-*.md)
        │
        ▼
1. Extract each `- [ ] Story:` item with its ACs, edge cases, risks/deps
2. Elaborate into a story spec (user-story-template.md): outcome, objective,
   success metric, scope — derived from the epic, not invented
3. Where Jira is connected: `jira_sync_specs` creates one Story per story;
   write real keys back into the epic specs (`Key: TBD` → `Key: PROJ-123`)
4. Where Jira is absent: the story-spec document in agent-docs/ is the backlog
5. Phase checkpoint → `Output Approved.` → Sprint Planning
```

## Story quality bar

- **Acceptance criteria are testable** — a reviewer can decide pass/fail without asking the author.
- **Edge cases from the epic are preserved** — they are part of the story, not lost in extraction.
- **Scope lines are explicit** — one sentence of in-scope, one of out-of-scope, when confusion is plausible.
- **Dependencies are story-level** — name the blocking story, not just the epic.

## When to use a Task instead

| Situation | Story or Task? |
| --- | --- |
| New user-visible behavior from an epic | **Story** (always) |
| Change order: small modification to shipped behavior | **Task** |
| Targeted engineering work with no epic home (e.g. dependency bump with behavior risk) | **Task** |
| An AC that feels "too big" | **Story stays whole** — if genuinely too big, split the *user story* in the epic (PMO change), never the ACs across tickets |
