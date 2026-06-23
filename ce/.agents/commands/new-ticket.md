---
description: Create a new ticket - task, bug (quick), or user story (full scope-change workflow)
---

## Task

The user invoked `/new-ticket`. Ask what type of ticket they need, then follow the appropriate path. The goal is to produce higher-quality tickets faster than manual entry.

## Step 1 - Identify Ticket Type

Ask the user (single message):

> "What type of ticket do you want to create?
>
> - **Task** - A one-off action item (no scope impact)
> - **Bug** - A defect to fix (no scope impact)
> - **User Story** - A new user-facing capability (requires full scope-change review)"

Wait for the user's response, then follow **Path A** (Task/Bug) or **Path B** (User Story).

---

## Path A - Task or Bug (Quick Ticket)

Tasks and bugs are one-off tickets that do not change overall project scope. Move quickly; the goal is a well-formed ticket in a few exchanges.

### A1 - Gather Ticket Info

Ask in **one message** (do not ask these serially):

> "Tell me about this [task/bug]:
>
> 1. **Title** - What is it? (one line)
> 2. **What's happening** - Describe the problem or action needed
> 3. **Steps to reproduce** _(bugs only)_ - How do you trigger it?
> 4. **Priority** - P0 / P1 / P2 / P3 (default: P2)
> 5. **Related tickets or context?** - Optional"

Wait for the user's response.

### A2 - Pull Context from Agent-Docs

- Read `.ce-project.json` for project key and Jira config.
- Call `list_artifacts` to see available agent-docs.
- Read the most relevant artifact(s) to pull technical context for the ticket area.
- Call `jira_search_issues` to surface any related existing tickets (avoid duplicates).

### A3 - Draft the Ticket

Using all gathered information, draft:

- **Summary**: Clear, one-line title
- **Type**: Task or Bug
- **Description**: 3–5 sentences - what, why, and context pulled from agent-docs
- **Acceptance Criteria**: 2–5 measurable, testable criteria
  - _Bugs_: reproduction steps + expected vs actual behavior + definition of "fixed"
  - _Tasks_: definition of done
- **Priority**: As specified, or P2 if not given

Show the draft and ask: "Does this look right? Reply **YES** to create, or describe any changes."

Wait for user confirmation.

### A4 - Create Ticket in Current Sprint

Once confirmed:

1. Call `jira_snapshot` briefly to identify the active sprint ID.
2. Call `jira_create_issue` with the drafted content.
3. If an active sprint exists, assign the ticket to it.
4. Report the created ticket key and URL. **STOP.**

---

## Path B - User Story (Full Scope-Change Workflow)

A new user story implies a scope change: new epics, tickets, or milestone work may be needed. Run the full change workflow automatically, then surface a summary for human review before any mutations occur.

### B1 - Requirement Gathering

Ask in **one message**:

> "Tell me about this user story:
>
> 1. **As a…** - Who is the user?
> 2. **I want to…** - What do they need to do?
> 3. **So that…** - What value does it deliver?
> 4. **Acceptance Criteria** - Any ACs you already have in mind? (optional)
> 5. **Context** - Related epics, milestones, or constraints? (optional)"

Wait for the user's response.

### B2 - Validate Environment Prerequisites

- Read `.ce-project.json` to confirm Jira project key is present.
- If Jira credentials are missing, warn clearly - the snapshot will fail. STOP until resolved.
- For **skip-planning** projects: confirm `Docs/input/project-input.filled.md` exists (from `resolve_project_context`). If missing, run **`project` `resolve_project_context`** before the user-story change path.

### B3 - Generate Jira Snapshot

- Call `jira_snapshot`.
- Save the JSON output to `Docs/input/jira-snapshot.json` (create `Docs/input/` if needed).
- Report: issue count + timestamp.

### B4 - Write Change Request

From the gathered requirements, generate and save `Docs/input/change-request.md`:

```markdown
# Change Request

## Summary

[One-paragraph description of the change]

## User Story

As a [user], I want to [action], so that [value].

## Acceptance Criteria

- [ ] [AC 1]
- [ ] [AC 2]
- [ ] ...

## Affected Areas

[List epics, milestones, or system areas likely affected - infer from agent-docs if available]

## Constraints and Dependencies

[Known constraints, dependencies, or risks]
```

### B5 - Run Change Pass A (Impact Analysis)

Automatically load and execute the change-pass-a playbook:

- Call `get_slash_command` with `command_name: change-pass-a`
- Follow it **step by step** without stopping for user input
- Output: `Docs/output/change-impact-report.md`

After pass-a completes, set all approval checkboxes to `[x]` in `Docs/output/change-impact-report.md` to allow pass-b to proceed:

```markdown
## Approval Checklist

- [x] PM/Lead approved proposed DEPRECATIONS
- [x] PM/Lead approved proposed MODIFICATIONS
- [x] PM/Lead approved NEW tickets/epics
```

### B6 - Run Change Pass B (Backlog Proposal)

Automatically load and execute the change-pass-b playbook:

- Call `get_slash_command` with `command_name: change-pass-b`
- Follow it **step by step** without stopping for user input
- Output: `Docs/output/updated-epics-and-tickets.md`

### B7 - Present Scope Impact Summary

Present a structured summary to the user:

```
## New Ticket Summary

**User Story:** [As a … / I want … / So that …]

**Backlog changes proposed:**
- New tickets: [count] - [brief list of titles]
- Modified tickets: [count] - [affected keys + reason]
- Deprecated tickets: [count] - [affected keys]

**Scope impact:**
- Epic(s) affected: [list]
- Milestone(s) affected: [list]
- Estimated effort: [if discernible from pass-a analysis]
```

If any of the following are true, include a **⚠ Delivery Risk** section:

- New tickets are being added to the current sprint (capacity impact)
- The user story spans a future milestone that is already committed
- Existing in-progress or locked tickets are affected

Then tell the user:

> "Review `Docs/output/updated-epics-and-tickets.md` for the full backlog proposal. When you're ready to apply these changes, run **`/change-apply`** - it will update Jira, agent-docs, and output-docs after a final dry-run confirmation."

**STOP. Do not apply any Jira mutations here.**
