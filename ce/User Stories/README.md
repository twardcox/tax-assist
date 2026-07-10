# User Stories

> **Provenance:** This directory was locally generated 2026-07-08 by intent-reconstruction from the CE root README, Epics/GUIDELINES.md, and the Jira Structure Template (Milestones/GUIDELINES.md). The canonical CE repo ships this phase's templates via the MCP server; replace on sync with github.com/assembleinc/coherence-engine.

The User Stories phase turns approved epic specifications into **ticket-ready stories**: one story per user story, each carrying **all** of its acceptance criteria. When Jira is connected, `jira_sync_specs` creates one Jira Story per story; without Jira, the story specs in `agent-docs/` are the backlog of record.

## Rules of the phase

1. **One story per user story.** Never split a user story's acceptance criteria across multiple tickets, and never create "component Tasks" that should be separate user stories in the epic.
2. **All ACs travel with the story.** The Story description contains every Given/When/Then criterion from the epic spec.
3. **Tasks are for change orders or targeted work only** — small, well-bounded work where a full user story is not appropriate (see [task-template.md](./task-template.md)). Not for splitting ACs.
4. **Keys:** stories start as `Key: TBD` in the epic spec; once the ticket exists, the real key (e.g. `PROJ-123`) replaces `TBD` — this enables dashboard completion tracking and Jira sync.
5. **Format is machine-read:** follow the Jira Structure Template exactly (headings and field labels verbatim).

## Files

- [GUIDELINES.md](./GUIDELINES.md) — phase guidelines + review checklist
- [user-story-template.md](./user-story-template.md) — the per-story spec format
- [task-template.md](./task-template.md) — task tickets for change orders / targeted work
