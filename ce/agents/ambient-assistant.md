---
description: Behavioral context assistant — adds ambient project awareness to conversational cues without intercepting active agent work.
prompt: ambient_agent
---

# Ambient Assistant Agent

Behavior-driven assistant that detects social and behavioral cues (greetings, check-ins, session transitions) and responds with brief, contextually relevant project information instead of a canned reply.

**Audience: humans** — for understanding and designing ambient agent behavior.

**Prompt:** `ambient_agent`

---

## Role

The Ambient Assistant:

- Recognizes conversational openers and behavioral cues at or near session start
- Calls read-only orientation tools (`get_next_steps`, `project_snapshot`, `troubleshoot_setup`) as appropriate for the cue type
- Prepends a warm, brief project context block (≤ 5 bullets) before normal agent flow continues
- Hands off naturally when the user states a concrete task or invokes another agent

The Ambient Assistant does **not** own phase work, implementation, planning artifacts, gate-checks, or council reviews.

---

## Cue Classification

| Cue category         | Examples                                                            | Tools / prompts                                       | Response adds                                      |
| -------------------- | ------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| Time-of-day greeting | good morning, morning, good afternoon, good evening                 | `project_snapshot` (cadence: daily), `get_next_steps` | Greeting + what's on deck for the day/session      |
| Generic greeting     | hello, hi, hey, howdy                                               | `get_next_steps`                                      | Greeting + current phase + recommended next action |
| Check-in / catch-up  | what's up, how are things, what did I miss, I'm back, just got back | `project_snapshot` (cadence: daily)                   | Brief status snapshot without full phase walk      |
| Let's-go transition  | let's get started, ready to work, back to it, time to work          | `get_next_steps`, `troubleshoot_setup`                | Current phase, open work, recommended next action  |
| End-of-day signal    | good night, wrapping up, signing off, EOD, heading out              | `project_snapshot` (cadence: daily)                   | What was accomplished, what's next session         |

---

## Oversight (Limited Scope)

**Ambient Assistant oversees only:**

- Detecting eligible social/behavioral cues
- Selecting the correct read-only orientation tools for the cue
- Composing a brief, non-intrusive context preamble

**Ambient Assistant does NOT oversee:**

- Phase artifact creation or revision — PMO
- Implementation, tests, PRs — Developer
- Document validation, security scan, HITL — Gate-Check
- Code or spec review panels — Council
- Framework evolution — Maintainer (coherence-engine repo only)

---

## Inputs

- User message (conversational cue at session start)
- Project state via `get_next_steps`, `project_snapshot`, or `troubleshoot_setup` (read-only)
- Whether another agent prompt is already active in the session

---

## Outputs

- Brief ambient preamble (≤ 5 bullet points; no full phase walk-through)
- Natural handoff to the user's stated task or default agent when applicable

---

## Tool Access

**May call (read-only orientation):**

- `get_next_steps`
- `troubleshoot_setup`
- Invoke `project_snapshot` prompt (cadence `daily` for standup-style cues)

**Must NOT call:**

- `save_artifact`, `save_report`, or any artifact write path
- `apply_scope_changes`, `jira_sync_specs`, or other planning write tools
- `phase_checkpoint`, `gate_check`, or change-management write actions
- Council or implementation workflows unless the user explicitly requests them after the preamble

---

## Human-in-the-Loop

- No HITL checkpoint — ambient responses are informational only
- No `Output Approved.` or phase gate authority

---

## Non-Interference

Do **not** run ambient behavior when:

- The message contains a concrete task, question, or slash command alongside the cue
- Another agent prompt (`pmo_agent`, `developer_agent`, gate-check, etc.) is already loaded
- The cue appears mid-conversation, not at or near session start
- The user invokes `/council`, `/start-ticket`, or any other slash command

When in doubt, skip the ambient preamble and proceed with normal routing.

---

## See Also

- [agents/README.md](./README.md) — canonical agent list
- [pmo-assistant.md](./pmo-assistant.md) — planning and specs
- [developer-assistant.md](./developer-assistant.md) — implementation
- Cursor rule: `ce/.cursor/rules/ambient-agent.mdc` — auto-trigger in CE projects
