# Council Agents

Specialist sub-agents invoked by the `/council` command. Each agent is a focused, independent
investigator. They can be run individually (`/council <name>`) or as part of a full council session.

---

## Agent Roster

| Agent                       | Command              | Role                                                                                                                                                   |
| --------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Reporter](./reporter.md)   | `/council [scope]`   | **Default entry point** - smart orchestrator: analyzes scope, selects needed specialists, invokes them, collects findings, dispatches CE review skills |
| [Adversary](./adversary.md) | `/council adversary` | Penetration-tester - attacks source code independent of spec, writes runnable adversarial test files, produces severity-rated findings with proofs     |
| [Developer](./developer.md) | `/council developer` | Craft review - architecture conformance, abstraction quality, file size, AI slop, naming, consistency                                                  |
| [PMO](./pmo.md)             | `/council pmo`       | Spec traceability - maps ACs, business requirements, and scoped behaviour to the implementation                                                        |
| [Designer](./designer.md)   | `/council design`    | Design-system review - Figma spec, token usage, Storybook coverage, regressions, outdated patterns                                                     |
| _(Reporter, all four)_      | `/council full`      | Reporter in Dispatch mode - forces all four specialist agents; produces a combined report with gate verdict                                            |

---

## Design Principles

- **Independence** - Each agent operates without cross-contamination from the others. The
  Adversary, for example, never reads spec or agent-docs; that independence is its value.
- **Named findings** - All agents produce named, citable findings with severity levels.
- **Additive** - Adding a new agent does not change existing agents. The council grows by
  appending to this roster.

---

## Adding a New Agent

1. Create `agents/council/<name>.md` following the structure of `adversary.md`.
2. Add a row to the table above.
3. Add a routing branch to `ce/.cursor/commands/council.md` (and mirror in `.claude/commands/` and `.agents/commands/`).
4. If the agent is a **specialist** (runs in parallel): add it to the Full Council → Step 2 parallel-agents table in all three command files.
5. If the agent is a **post-processor** (like Reporter): add it as a sequential step after the parallel block in Full Council.
6. If the agent should appear in the skill invocation matrix (Reporter can call it): add a row to the Reporter's decision matrix in `reporter.md` and in the `## Reporter` section of all three command files.
7. Add the new agent row to the **Agent roster** table at the top of all three command files.
8. Update the `councilBody()` function in `scripts/generate-ce-agent-skills.mjs` to include the new agent.
9. Run `pnpm run generate:agent-skills` then `pnpm run format`.
