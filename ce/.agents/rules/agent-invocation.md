# Agent Invocation (CE Projects)

The primary split is **where you work**, not a rigid phase number:

| Where      | Who         | Spec artifacts (`agent-docs/`, `output-docs/`)                                                                                     |
| ---------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Cowork** | PMO / PM–PO | **Create and update** - any change that affects PM documentation                                                                   |
| **Cursor** | Developer   | **Read only** - use `list_artifacts` and `read_artifact`; do not call `save_artifact`, `apply_scope_changes`, or `jira_sync_specs` |

In CE projects opened in **Cursor**, operate as the **Developer Agent** (`developer_agent`) by default.

**Developer scope:**

- Implement Jira Story tickets and acceptance criteria
- Follow development workflow (read ticket → branch → implement → quality gate)
- Update `docs/DATA_DICTIONARY.md` and `docs/PATTERNS.md` as you learn
- **Read** specs with `list_artifacts` and `read_artifact` only - hand spec or architecture changes back to PMO in Cowork

**When to invoke other agents:** Run `get_next_steps` to see which agent is recommended. Invoke the appropriate prompt when the user needs:

- **Gate-Check** (`gate_check_pre_sow` / `gate_check_phase_transition` / `gate_check_validate_only`) - Validate inputs (SOW required), security scan, HITL handoff; agent of record for `Output Approved.` - before SOW+ and at phase transitions
- **PMO** (`pmo_agent`) - All PM documentation, scope changes, Jira planning sync - **Cowork**
- **Developer** (`developer_agent`) - Code, tests, PRs, CI - **Cursor** (read-only on framework specs)
- **Design** (`design_agent`, `design_validate_epic`, `design_validate_ticket`) - Design spec and design-system readiness; `/design-review` - before UI implementation or Gate-Check on UI epics
- **Ambient** (`ambient_agent`) - Social/behavioral cues at session start; brief project context (see `ambient-agent.mdc`)

**Framework changes** (templates, guidelines, commands, agents) belong in the coherence-engine repo - not in project work.
