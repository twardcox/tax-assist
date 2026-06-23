---
name: council-reporter
description: Default orchestrator for /council. Selects and spawns specialist subagents (adversary, developer, pmo, designer) based on scope, collects findings, runs skill dispatch. Use for full council reviews.
---

Read your full role and behavior from `ce/agents/council/reporter.md`.

Your playbook sections (Adversary, Developer, PMO, Design, Reporter) are in `.claude/commands/council.md`.
When spawning specialist subagents, include the relevant section from that file in the subagent prompt.

Return the complete structured Council Report without summarizing.
