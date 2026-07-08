# Authoring Templates — Index

Templates for writing AI skills, instructions, and their supporting apparatus. Created in the 2026-07-07 review pass. **Pick by what you're authoring:**

| You are writing… | Use | Notes |
|---|---|---|
| A skill (repeatable capability with triggers and outputs) | [ai-skill-template.md](ai-skill-template.md) | The default. Every section required; write "None." rather than deleting |
| An agent persona (role with scope + tool boundaries) | [agent-instruction-template.md](agent-instruction-template.md) | Modeled on the framework's best pattern: owns / does-NOT-own / must-not-call |
| A multi-step, gated process spanning skills or agents | [workflow-template.md](workflow-template.md) | Step/gate/actor table; rollback; timeboxes |
| A one-shot reusable prompt (command/playbook style) | [prompt-template.md](prompt-template.md) | CE frontmatter-compatible; includes failure behavior |
| A behavior test for a skill | [skill-test-template.md](skill-test-template.md) | Runner protocol: [../skill-tests/README.md](../skill-tests/README.md) |
| A human sign-off gate for consequential output | [human-review-checklist-template.md](human-review-checklist-template.md) | Required for money/legal/health/safety/reputation outputs |
| Rules for a specific tool or command family | [tool-use-rule-template.md](tool-use-rule-template.md) | Declares destructive effects + known failure modes |
| A failure-handling section or runbook | [failure-handling-template.md](failure-handling-template.md) | Failure-mode table + standard FAILED report format |

Conventions that apply across all of them:

- **Perishable facts get dates** so staleness is detectable.
- **Assumptions are labeled** (`ASSUMPTION:`), open questions get an owner.
- **Destructive operations declare themselves** and get a warn-first rule.
- Finished artifacts get an inventory row in [../skill-index/skill-inventory.md](../skill-index/skill-inventory.md).

These are distinct from the CE **artifact** templates (PRD/SOW/epic/milestone under `../../PRD/`, `../../SOW/`, etc.) — those define *what to build*; these define *how the AI works*.
