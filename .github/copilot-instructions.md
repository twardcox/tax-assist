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

## graphify

For any question about this repo's architecture, structure, components, or how to add/modify/find
code, your first action should be `graphify query "<question>"` when `graphify-out/graph.json`
exists. Use `graphify path "<A>" "<B>"` for relationship questions and `graphify explain "<concept>"`
for focused-concept questions. These return a scoped subgraph, usually much smaller than the full
report or raw grep output.

Triggers: "how do I…", "where is…", "what does … do", "add/modify a <component>",
"explain the architecture", or anything that depends on how files or classes relate.

If `graphify-out/wiki/index.md` exists, use it for broad navigation. Read `graphify-out/GRAPH_REPORT.md`
only for broad architecture review or when query/path/explain do not surface enough context. Only read
source files when (a) modifying/debugging specific code, (b) the graph lacks the needed detail, or
(c) the graph is missing or stale.

Type `/graphify` in Copilot Chat to build or update the graph.
