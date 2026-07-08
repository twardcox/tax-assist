# Project-Local Skills (tax-assist)

Five hand-authored skills encoding tax-assist domain knowledge. These sit **alongside** the vendored Coherence Engine framework (`.agents/`, `agents/`): the framework governs *delivery process* (tickets, gates, PRs); these govern *how to work on this codebase and its tax domain safely*.

| Skill | Use when | Hard rules it owns |
|---|---|---|
| [the-planner.md](the-planner.md) | Non-trivial change, before coding | Read real code first; TDD plan, no TBD; commit per task |
| [the-bug-hunter.md](the-bug-hunter.md) | Any bug; every pre-PR validation | Root cause + grep callers; fixed validation loop; repo gotchas |
| [the-honest-advisor.md](the-honest-advisor.md) | **Always**, for any tax content | Never invent tax parameters; flagged strategies get abuse boundaries, never recommendations; CPA/attorney review gates |
| [security-sweep.md](security-sweep.md) | Route/auth/input/API changes | Auth on mutating routes; zod at boundaries; secrets hygiene; private vuln escalation |
| [the-setup.md](the-setup.md) | Session start / env issues | Ports, seeding, and the **`npm test` wipes the dev DB** warning |

## Rules of the road

1. **the-honest-advisor is a policy layer**, active over every other skill whenever tax semantics are involved.
2. **Skills follow the template** at [../docs/templates/ai-skill-template.md](../docs/templates/ai-skill-template.md). New skills copy it; edits keep all sections.
3. **Each skill has a test** under [../docs/skill-tests/](../docs/skill-tests/README.md) (`skill-test-<name>.md`). Change a skill → re-run/update its test.
4. **Keep the inventory current:** any add/rename/meaningful change updates the row in [../docs/skill-index/skill-inventory.md](../docs/skill-index/skill-inventory.md).
5. **Perishable facts get dates** (branch names, ports, credentials). If reality disagrees with a skill, trust reality, then fix the skill in the same change.

Process-review artifacts for how this set was reviewed and audited: [../docs/process-review/](../docs/process-review/).
