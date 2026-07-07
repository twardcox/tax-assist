# tax-assist Copilot Instructions

## Local Workflow Setup

- Use [CLAUDE.md](../CLAUDE.md) as the shared project context, and treat [ce/](../ce/) as the local agent/workflow bundle.
- For agent behavior and workflow guidance, prefer [ce/README.md](../ce/README.md), [ce/agents/](../ce/agents/), and [ce/templates/](../ce/templates/) over any external framework docs.
- Keep the setup tracker-neutral: do not depend on Jira-specific workflows, ticket transitions, or integration scripts unless they are explicitly added back.
- When writing or reviewing agent instructions, use the local repo files first and keep the guidance consistent with the current codebase.

## Working Style

- Keep changes focused and minimal.
- Prefer existing repo conventions.
- If a task touches the agent bundle, update the corresponding docs in `ce/` and keep Claude and Copilot instructions aligned.
## Session handoff (2026-07-07)
Read HANDOFF-COPILOT.md at repo root, then ce/skills/*.md (the-setup, the-planner, the-honest-advisor, the-bug-hunter, security-sweep). Next task: execute docs/superpowers/plans/2026-07-06-obbba-deductions.md.
