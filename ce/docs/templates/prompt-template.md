# Prompt Name

<!-- For reusable prompt templates (one-shot instructions to an AI, e.g. review prompts,
     generation prompts). Compatible with CE command frontmatter. -->

---
description: One-line description shown in command lists
argument-hint: [args-if-any]
allowed-tools: # narrowest set that works — avoid `all` unless the task truly needs it
---

## Task

One paragraph: what the AI must produce this run. State the deliverable first, context second.

## Context Provided

What the prompt consumer will inject: `$ARGUMENTS`, file contents, diffs, config. Note truncation behavior (e.g., "diff truncated at 500 lines — open files for more").

## Instructions

1. Numbered, imperative steps.
2. Include *reading* steps explicitly ("read X before writing Y").
3. End with the output step.

## Output Format

Exact structure expected (headings, table columns, JSON schema). Include a skeleton the model can fill.

## Constraints

- What not to do (scope limits, prohibited claims, tone rules)
- Grounding rule: which sources may be cited/used; what must never come from memory
- Uncertainty rule: how to mark low-confidence content (e.g., `UNCERTAIN:` prefix)

## Failure Behavior

If required context is missing or a tool fails: say exactly what the model should output instead of guessing (e.g., a named error block listing what's missing).

## Example Invocation and Output

One realistic filled example. For risky domains, also one example showing correct refusal/escalation.
