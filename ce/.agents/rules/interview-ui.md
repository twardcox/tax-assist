# Interview & Question UI

When asking the user structured or multiple-choice questions - including phase interviews, clarifying questions, routing decisions, or any choice with 2+ discrete options - use your client’s **structured question UI** (e.g. multiple-choice widgets) when available, instead of writing options only as prose or a markdown list.

## When to use structured choices

- Interview questions at phase checkpoints (planning-phase review & interview step)
- Routing or scoping decisions ("Which ticket do you want to work on?")
- Any question where the answer is one of a known set of options
- Gathering requirements when options are enumerable (e.g. "Which bump type applies?")

## When to use plain text

- Open-ended questions with no bounded option set ("What are your project goals?")
- Follow-up questions that depend on a previous free-form answer
- Single clarifying questions that read naturally as a sentence

## Example

```text
// BAD - writing choices only as prose
"Would you like to (a) continue to PRD, (b) revise the SOW+, or (c) add more research?"

// GOOD - present discrete options via the client’s structured UI (labels map to option ids)
```

Semantics align with the framework’s Cursor and Claude rule files for the same topic (`interview-ui`).
