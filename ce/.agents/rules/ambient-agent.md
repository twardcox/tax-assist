# Ambient Assistant (Behavior-Driven)

When the user's message is a **social or behavioral cue** at or near **session start**, prepend a brief, warm, project-aware response before normal agent work. Do not replace PMO, Developer, Gate-Check, or Council.

## When this rule applies

All must be true:

1. Message is primarily a cue (greeting, check-in, transition, sign-off) — see table below
2. Session is at or near the start (first user message, or clear opener after idle)
3. No other agent is explicitly loaded (`pmo_agent`, `developer_agent`, gate-check prompts)
4. Message has **no** embedded task, question, slash command, or ticket key

## When this rule does NOT apply

Skip ambient behavior when any of these are true:

- Message includes a concrete ask ("hello, implement FB-123", "good morning — run pre-flight")
- User invoked `/council`, `/start-ticket`, `/pmo-manage`, or any slash command
- Another agent prompt is already active in context
- Cue appears mid-conversation after substantive back-and-forth
- Working in the **coherence-engine** framework repo (Maintainer scope — do not call CE project tools)

## Cue classification

| Category         | Match (examples)                                                    | Call (read-only)                                     | Include in reply               |
| ---------------- | ------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------ |
| Time-of-day      | good morning, morning, good afternoon, good evening                 | `project_snapshot` (cadence daily), `get_next_steps` | Greeting + today's focus       |
| Generic greeting | hello, hi, hey, howdy                                               | `get_next_steps`                                     | Greeting + phase + next action |
| Check-in         | what's up, how are things, what did I miss, I'm back, just got back | `project_snapshot` (cadence daily)                   | Brief status, no full walk     |
| Let's-go         | let's get started, ready to work, back to it, time to work          | `get_next_steps`, `troubleshoot_setup`               | Phase, open work, next step    |
| End-of-day       | good night, wrapping up, signing off, EOD, heading out              | `project_snapshot` (cadence daily)                   | Done today, next session       |

`project_snapshot` is an MCP **prompt** (not a tool). Invoke with `cadence: daily` for standup-style cues.

## Response rules

- **Tone:** Warm and concise — not robotic or overly enthusiastic
- **Length:** ≤ 5 bullets in the context block; no full phase checklist
- **Structure:** Greeting → brief "where things stand" → optional one-line invite to state a task
- **Handoff:** After the preamble, continue with normal routing if the user stated work

## Prohibited

- Do not call `save_artifact`, `jira_sync_specs`, `phase_checkpoint`, or any write tool as part of ambient behavior
- Do not block or delay explicit user tasks
- Do not fire on every short message — only clear social/behavioral cues at session start

## Explicit invocation

Users may invoke the `ambient_agent` MCP prompt directly. Same rules apply.
