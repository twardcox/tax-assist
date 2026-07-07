# CE AI Skills Review

**Scope:** `D:\programs\tax-assist\ce` — full tree
**Date:** 2026-07-07
**Reviewer:** AI systems architecture / prompt engineering / documentation quality review pass
**Companion documents:** [skill-inventory.md](../skill-index/skill-inventory.md) · [ce-ai-skills-improvement-summary.md](ce-ai-skills-improvement-summary.md)

---

## 1. Executive summary

This directory contains **two distinct layers** that must be treated differently:

1. **A vendored copy of the Coherence Engine (CE) framework** — an AI-augmented software-delivery methodology (SOW+ → PRD → Milestones → Epics → User Stories → Sprints → Dev → Test → Review → CI/CD). It includes 43 command playbooks (`.agents/commands/`), 45 machine-generated skill loader stubs (`.agents/skills/*/SKILL.md`), 6 cross-tool rules (`.agents/rules/`), 10 agent persona definitions (`agents/`), phase guideline folders, and document templates. Upstream source: `github.com/assembleinc/coherence-engine`; playbook bodies are canonically served from a CE MCP server.
2. **Five project-local skills** (`skills/*.md`) specific to the **tax-assist** application: The Planner, The Bug Hunter, The Honest Advisor, Security Sweep, The Setup. These are 6–7 lines each, dense with hard-won, high-value domain knowledge (tax-parameter integrity rules, IRS listed-transaction boundaries, test-suite gotchas, auth precedents) but had **no structure**: no triggers, inputs, outputs, safety sections, failure handling, or tests.

**Overall assessment:** The vendored framework is *better than most AI operating frameworks* — it has explicit human-in-the-loop gates (`Output Approved.`), separation of duties between agents (PMO writes specs, Developer reads-only, Gate-Check owns approval), per-phase quality-gate checklists, and structured escalation. The main framework problems are **local integrity defects** (empty referenced template, empty folders, broken links, one command/skill naming mismatch), **auth-walled external references** (Google Docs / Atlassian links an AI agent cannot read), and **MCP-server dependence** without a fully self-contained local fallback for the skill stubs. The main **project** problem was that the five local skills — which carry the real tax-domain guardrails — were unstructured, untested, and undiscoverable.

**Actions taken in this pass:** the 5 local skills were rewritten to a full skill template (all original domain knowledge preserved verbatim in intent); safe local defects were repaired (empty milestone-PRD template filled, missing `User Stories/task-template.md` created, empty folders given READMEs, stale links in `agents/developer-assistant.md` fixed); 8 reusable templates, 8 skill tests, a skill inventory, and this report were created. The 45 generated `SKILL.md` stubs and the vendored command playbooks were **deliberately not hand-edited** — see §24 and §26 for why and for the recommended upstream changes.

---

## 2. Current folder/file structure

```
ce/
├── README.md                      # Framework overview (CE methodology)
├── SHARED-GUIDELINES.md           # Phase checkpoint protocol, HITL rules, progress comms
├── .agents/
│   ├── commands/    (43 playbooks + README)   # Authoring copies of command playbooks
│   ├── rules/       (6 rules + README)        # Cross-tool agent rules
│   └── skills/      (45 SKILL.md stubs + README)  # GENERATED MCP loader stubs — do not hand-edit
├── .github/workflows/  (ci-checks, e2e-tests, lighthouse)
├── .husky/             (git hooks + README)
├── agents/
│   ├── README.md, pmo-assistant.md, developer-assistant.md,
│   │   gate-check.md, ambient-assistant.md, design-assistant.md
│   └── council/  (README, adversary, developer, pmo, designer, reporter)
├── CI-CD/, Code Review/, Development/, Testing/   # Phase guidelines (some stubs)
├── Epics/, Milestones/, PRD/, SOW/, Sprints/      # Phase guidelines + templates
├── User Stories/       # WAS EMPTY (referenced by README) — now has README + task-template
├── Change Workflow/    # WAS EMPTY — now has README pointer
├── PRD/milestone-prd-template.md   # WAS EMPTY (0 bytes) — now filled
├── lib/, scripts/      # CJS support scripts (hooks, ai-review prompt gen, validators)
├── skills/             # PROJECT-LOCAL tax-assist skills (5 files) — restructured this pass
├── templates/          # CLAUDE/GEMINI/AGENTS/copilot project-instruction templates
└── docs/               # NEW this pass: process-review/, templates/, skill-tests/, skill-index/
```

## 3. Files reviewed

All 162 files were enumerated; the following were read in full or in representative depth:

- **Framework core:** `README.md`, `SHARED-GUIDELINES.md`
- **Rules (all 6 + README):** `default.md`, `agent-invocation.md`, `project-rules.md`, `data-dictionary-maintenance.md`, `interview-ui.md`, `ambient-agent.md`
- **Skill stubs:** `.agents/skills/README.md` + representative `SKILL.md` (all 45 are generator-identical except name/description; verified by line counts and sampling)
- **Commands:** `README.md`, `ai-review.md`, `quality-gate.md`, `start-ticket.md`, `create-milestone.md` (sampled headers/sizes for the rest; all 43 catalogued in the inventory)
- **Agents (all):** `README.md`, `pmo-assistant.md`, `developer-assistant.md`, `gate-check.md`, `ambient-assistant.md`, plus `council/README.md` and `council/adversary.md` in depth
- **Phase guidelines:** `Testing/`, `CI-CD/`, `Code Review/` GUIDELINES (stubs), spot checks of `Development/`, `PRD/`, `Epics/`, `Milestones/`, `Sprints/`, `SOW/`
- **Project templates:** `templates/CLAUDE-project.md` (and siblings, which are parallel)
- **Local skills (all 5):** `skills/the-planner.md`, `the-bug-hunter.md`, `the-honest-advisor.md`, `security-sweep.md`, `the-setup.md`
- **Support scripts (headers):** `scripts/*.cjs`, `lib/*.cjs` — not modified (application code out of scope per instructions)

## 4. Identified AI skills and instructions

| Category | Location | Count | Nature |
|---|---|---|---|
| Local domain skills | `skills/` | 5 | Hand-authored tax-assist skills (highest-value, least structured) |
| Command playbooks | `.agents/commands/` | 43 | Operational step-by-step agent workflows |
| Skill loader stubs | `.agents/skills/*/SKILL.md` | 45 | **Generated** MCP loaders (`disable-model-invocation: true`) |
| Agent rules | `.agents/rules/` | 6 | Always-on behavioral rules (workflow, invocation, data hygiene, UI) |
| Agent personas | `agents/` + `agents/council/` | 10 | Role definitions with scope, tools, HITL boundaries |
| Phase guidelines | `*/GUIDELINES.md` | 9 | Phase-transition procedures (3 are stubs) |
| Document templates | `PRD/`, `SOW/`, `Epics/`, `Milestones/`, `Sprints/`, `templates/` | 14 | Artifact and project-instruction templates |

## 5. Skill inventory table

Maintained as a standalone living document: **[docs/skill-index/skill-inventory.md](../skill-index/skill-inventory.md)** (one row per file with purpose, triggers, I/O, tools, safety, review, test coverage, overlaps, and keep/revise/merge/split/archive status). Summary of statuses:

- **Keep as-is:** 52 files (framework files that are good and vendored)
- **Revised this pass:** 10 files (5 local skills, milestone-prd template, developer-assistant links, 2 empty-folder READMEs + task template)
- **Revise upstream (documented, not edited):** ~12 framework files (see §24)
- **Archive candidates:** 0 (nothing is dead weight; empty folders were repaired rather than removed because the README references them)

## 6. Skill purpose summary

- **Local skills** encode how to work safely on the tax-assist codebase: planning discipline (TDD, spec-first), debugging/validation loops with known test-suite traps, **tax-accuracy guardrails** (no invented tax parameters; IRS-flagged strategies modeled with abuse boundaries, never recommended), security trust boundaries (auth on mutating routes, zod validation, secrets), and dev-environment setup (including the destructive `npm test` DB-wipe trap).
- **Framework commands** operationalize the CE delivery pipeline: spec creation (`create-product-requirement-doc`, `create-milestone`), decomposition (`breakdown-milestone`, `create-prd-tickets`), delivery (`start-ticket`, `commit`, `pull-request`, `merge-pr`, `complete-ticket`), quality (`quality-gate`, `spec-validate`, `ai-review`, `test-coverage`, `architecture-check`, `design-review`, `council`), change management (`new-ticket`, `change-pass-a/b`, `change-apply`, `lightweight-change`), and status/PMO loops.
- **Agents** enforce separation of duties; **rules** enforce always-on hygiene; **templates** standardize artifacts.

## 7. Strengths

1. **Real human-in-the-loop architecture.** The `Output Approved.` exact-match gate, a dedicated Gate-Check agent as "agent of record," and a logged Gap-override protocol (`Override: [gap] - [justification]`) are stronger HITL mechanics than most frameworks ship.
2. **Separation of duties is explicit and enforced by tool restrictions**, not just prose: Developer is read-only on planning artifacts (must not call `save_artifact`); Ambient agent has an explicit must-not-call tool list; PMO cannot run `phase_checkpoint`.
3. **The Adversary council agent is genuinely well-designed:** deliberately isolated context (no specs), named findings with severity and runnable proofs, an independent second-model judge (`adversarial_critique`), and an explicit "do not silently skip the tool call" failure rule.
4. **Non-interference rules exist** (ambient agent skip conditions) — a class of bug most frameworks discover in production.
5. **Per-phase quality-gate checklists** with named approvers and a structured output format (pass/warn/block + recommendation).
6. **Honest product notes:** e.g. `start-ticket` documents a known behavior gap (tickets left In Progress on abandoned branches) rather than hiding it.
7. **The local skills contain rare, concrete, earned knowledge** — e.g. "`npm test` wipes the shared dev DB," "§643(b) untaxed corpus trust = Dirty Dozen scam (IR-2023-65) — debunk, never recommend," "vitest parity greps for literal `id: \"<rule-id>\"`." This is exactly the domain knowledge the quality bar says to preserve.
8. **Generated stubs are honest about their nature** (header comment: managed configuration + regenerate command), preventing well-meaning hand edits.

## 8. Gaps

1. **The five local skills had no structure** — no triggers, no when-not-to-use, no I/O contracts, no failure handling, no tests, no index. *(Fixed this pass.)*
2. **No skill inventory or index existed** anywhere; discoverability depended on knowing the folders. *(Fixed.)*
3. **No skill tests existed** for anything — no way to verify a skill's instructions produce the intended behavior. *(8 created.)*
4. **`PRD/milestone-prd-template.md` was empty (0 bytes)** yet referenced by `README.md` as a key template — an agent following the README would load a blank file and improvise the most important artifact in the pipeline. *(Fixed.)*
5. **`User Stories/` and `Change Workflow/` were empty folders**; `README.md` links `User Stories/task-template.md` (404) and commands cite `Docs/GUIDELINES.md` which does not exist locally (fallback `ce://docs/change-runbook` exists but only with MCP connectivity). *(Repaired locally.)*
6. **Auth-walled external references:** README role guidance, CI-CD templates, and Code Review standards point to Google Docs / Atlassian pages an AI agent (and any offline human) cannot read. Content should be summarized locally or explicitly marked "human-only reference."
7. **MCP single-point-of-failure:** the 45 skill stubs instruct "Do not assume a local copy of this playbook" even though `.agents/commands/` *is* a local authoring copy of the same playbooks. When the server is down, agents are told not to use the fallback sitting next to them. (Upstream recommendation — see §24.)
8. **No project-level bridge doc** tying the two layers together (when to use CE framework skills vs. tax-assist local skills). *(Skill inventory now serves this role; a root `skills/README.md` was added.)*
9. **Testing/CI-CD/Code Review GUIDELINES are stubs** deferring entirely to the shared checklist plus an external doc.

## 9. Duplicates or overlapping instructions

| Overlap | Files | Assessment |
|---|---|---|
| Ambient agent behavior | `agents/ambient-assistant.md` and `.agents/rules/ambient-agent.md` | Near-duplicate cue tables. Acceptable (persona vs. rule serve different loaders) but must be kept in sync; the rule file is the operative one. Flag for upstream: single-source the cue table. |
| Pre-PR gate sequence | `start-ticket.md` (3 places), `pre-flight.md`, `quality-gate.md` dev section, `templates/*-project.md` | The sequence `/pre-flight → /test-coverage → /architecture-check → /design-review → /ai-review` is restated at least 6 times. Consistent today, but a change requires 6 edits — drift risk. Upstream: define once, reference elsewhere. |
| Agent invocation matrix | `.agents/rules/agent-invocation.md`, `agents/README.md`, `templates/CLAUDE-project.md` | Three tellings of who-does-what. Consistent; same drift risk. |
| Command catalog | `.agents/commands/README.md` vs. `/ce` and `/ce-status` server catalogs | Local table can drift from server truth (see the create-milestone mismatch in §10). |
| `security-sweep.md` (local) vs. Adversary/`quality-gate` security items | Different altitude: local skill is tax-assist-specific trust boundaries; framework is generic. Keep both; cross-reference added. |

## 10. Contradictory instructions

1. **Command/skill naming mismatch:** the commands README and skill stub advertise `/create-milestone-prd` (server name `create-milestone-prd`), but the local authoring file is `.agents/commands/create-milestone.md` (titled "Create Milestone PRD"). An agent resolving the documented name against local files misses. *(Documented; rename belongs upstream + regeneration.)*
2. **"Do not assume a local copy of this playbook" vs. reality:** stubs forbid local fallback while `.agents/commands/` contains authoring copies of every playbook. Not a safety issue, but contradictory guidance that strands agents during server outages.
3. **`start-ticket` says "transitions never change assignee"** in one place while an earlier line says "Do not assign the ticket to the Jira integration user" — the second implies the first might happen. Minor; wording should pick one claim. (Upstream.)
4. **Coverage threshold is consistent (80%)** across quality-gate, test-coverage, Development and Testing READMEs — checked because thresholds are a classic contradiction source; no conflict found.
5. No contradictions found between the five local skills and the framework rules (the local skills are stricter, which is the right direction).

## 11. Ambiguous instructions

1. **`skills/the-planner.md` (before revision):** "`audit` is current" — a point-in-time branch note with no date; an agent reading it later would branch from a stale base. *(Rewritten as a dated, explicitly perishable assumption.)*
2. **`skills/the-bug-hunter.md` (before revision):** "favicon 404 is pre-existing noise" — unclear whether this is the only tolerated console error. *(Clarified: it is the only one.)*
3. **"Near session start"** in ambient rules is undefined (first message? first N?). Tolerable for a low-stakes skill; noted for upstream.
4. **`quality-gate` "Coverage ≥ 80%"** doesn't say which metric (statements/branches/functions/lines); `test-coverage.md` implies all four. Upstream: state "all four ≥ 80% or project override."
5. **`Docs/GUIDELINES.md` references** don't say what to do if *neither* the file nor the MCP resource is reachable (currently: undefined behavior).

## 12. Missing safety boundaries

- **Local skills had no explicit safety sections.** The Honest Advisor *contained* safety content (never invent parameters; debunk scams) but nothing marked it as binding policy vs. tips; Security Sweep listed boundaries but no "stop and escalate" rule for discovered live vulnerabilities or leaked secrets. *(Both fixed: explicit Safety and Compliance sections, escalation rules, and "advice output requires CPA/attorney review" made a hard gate.)*
- **Framework:** Gate-Check covers prompt-injection scanning for planning docs, but no rule addresses **secrets in artifacts** (e.g., a PRD pasted with API keys) — recommend adding a secrets pattern to the Gate-Check scan (upstream).
- `merge-pr`/`complete-ticket` rely on PR review requirements from `developer-assistant.md` ("no autonomous merges") — the boundary exists but only in the persona, not restated in the command; acceptable, noted.

## 13. Missing tool-use rules

- Local skills named commands (`npm test`, `npx tsx scripts/...`) but never stated **which tools are required or forbidden** (e.g., The Setup runs a destructive test suite — no rule said "warn before `npm test` because it wipes the DB"). *(Fixed: each rewritten skill has Tools Required and destructive-command call-outs.)*
- Framework tool rules are generally excellent (explicit allow/deny lists per agent). Gap: `ai-review.md` allows `allowed-tools: all` — broader than needed for a read-and-review task (upstream tightening candidate).

## 14. Missing input/output formats

- Local skills: none had inputs or outputs defined. *(Fixed: every rewritten skill has Inputs Required / Optional Inputs / Output sections.)*
- Framework: most commands define output formats well (quality-gate and test-coverage have full output templates). Gaps: `troubleshoot-setup` and `project-snapshot` describe behavior but not output shape (minor, upstream).

## 15. Missing examples

- Local skills had zero worked examples. *(Fixed: each rewritten skill includes one typical example and one edge/failure-case example.)*
- Framework: `start-ticket` has exemplary per-work-type output blocks; `interview-ui` has a good/bad pair. Sparse elsewhere (e.g., `spec-validate` lacks a filled example report). Upstream candidates only.

## 16. Missing validation steps

- Local skills embedded validation loops in prose (Bug Hunter's vitest→test→lint→build chain) but nothing said "the skill is not done until X." *(Fixed: Validation + Acceptance Criteria sections in every rewritten skill.)*
- Framework: strong at phase level (checkpoint protocol, file-creation verification with `ls`/`find`), adequate at command level.

## 17. Missing test cases

- **Nothing in the repo tested any skill.** *(Fixed: 8 skill tests created under `docs/skill-tests/` — the five local skills plus `quality-gate`, `start-ticket`, and `gate-check` behavior contracts. Each has objective, inputs, expected behavior/output, safety checks, failure-mode checks, and acceptance criteria.)*

## 18. Missing escalation/human-review points

- The Honest Advisor had `review_required: cpa/attorney` for high-risk entries (good) but no rule for *ambiguity* — what to do when a tax question falls between "clean" and "listed transaction." *(Fixed: default-to-conservative rule + named escalation.)*
- Security Sweep had no escalation for found-live vulnerabilities. *(Fixed: stop-work + report privately to maintainer, never in a public artifact/PR body.)*
- Framework escalation is well-covered (Gate-Check overrides, Design NOT-READY → PMO, spec gaps → PMO in Cowork).

## 19. Missing failure handling

- Local skills: none had failure paths (what if the seed script fails? what if PolicyEngine params are missing a year? what if the MCP/Jira transition fails?). *(Fixed: Failure Handling section per skill, including the pre-existing good pattern from `start-ticket` — log and continue on non-blocking Jira failures.)*
- Framework: skill stubs handle MCP read failure (retry alternate call) but then dead-end ("do not assume a local copy") — see §10.2.

## 20. Missing citations/source-grounding requirements

- **The Honest Advisor is the critical case:** it already demanded parameter provenance (`taxParams.generated.ts` via PolicyEngine; "cite Rev. Procs / OBBBA in pinning tests"). The rewrite elevates this to a binding Source Grounding section: every tax figure must trace to the generated params file or a cited primary source (Rev. Proc., IRC section, T.D., IRS news release); model answers must distinguish *statute* from *interpretation*; no tax value may originate from model memory.
- Framework planning skills ground in artifacts (`read_artifact`) — adequate. The external Google-Doc references are the anti-pattern (unverifiable ground truth); flagged in §8.6.

## 21. Missing deliverable standards

- Local skills: outputs now specified (e.g., Planner: spec + plan files under `docs/superpowers/{specs,plans}/` with naming convention; Bug Hunter: root-cause note + regression test + green validation chain).
- Framework: deliverable standards largely exist (artifact paths, `.md` + `.docx` pairs, `reports/` conventions).

## 22. Missing acceptance criteria

- Local skills: none had ACs. *(Fixed: testable ACs per skill.)*
- Framework: quality gates *are* acceptance criteria and are good; individual commands mostly imply ACs via checklists. Acceptable.

## 23. Missing reusable templates

Before this pass there was **no template for authoring a skill, rule, prompt, test, or failure-handling section** — only artifact templates (PRD, SOW, epic...). Created under `docs/templates/`:
`ai-skill-template.md`, `agent-instruction-template.md`, `workflow-template.md`, `prompt-template.md`, `skill-test-template.md`, `human-review-checklist-template.md`, `tool-use-rule-template.md`, `failure-handling-template.md`.

## 24. Recommended edits

**Done this pass (local, safe):**

| File | Edit |
|---|---|
| `skills/the-planner.md` | Rewritten to full skill template; branch assumption dated and marked perishable |
| `skills/the-bug-hunter.md` | Rewritten; gotchas preserved verbatim in intent; validation loop made an AC |
| `skills/the-honest-advisor.md` | Rewritten; source-grounding made binding; escalation and human-review gates added |
| `skills/security-sweep.md` | Rewritten; live-vulnerability escalation and secrets handling added |
| `skills/the-setup.md` | Rewritten; destructive `npm test` promoted to a warning gate |
| `skills/README.md` | **New** — index and usage rules for local skills |
| `PRD/milestone-prd-template.md` | Filled (was 0 bytes) with a milestone-PRD structure consistent with `system-prd-template.md` |
| `User Stories/task-template.md` + `User Stories/README.md` | Created (README.md referenced the template; folder was empty) |
| `Change Workflow/README.md` | Created — points to `/new-ticket`, `change-pass-a/b`, `change-apply` and the `ce://docs/change-runbook` fallback |
| `agents/developer-assistant.md` | Fixed two stale links (`../ce/Phase%20VI - Development/` → `../Development/`; `../ce/SOW/...` → `../SOW/...`) |

**Recommended upstream (coherence-engine repo — not edited here because these files are vendored/generated and the framework's own rule says framework changes belong upstream):**

1. Rename `create-milestone.md` → `create-milestone-prd.md` (or alias) to match server/skill/README naming.
2. Change the stub fallback text: after MCP retry fails, *do* fall back to the local authoring copy in `.agents/commands/` when present, with a "may be stale" caveat.
3. Single-source the pre-PR gate sequence and the agent-invocation matrix.
4. Add secrets-pattern scanning to Gate-Check's security scan.
5. Replace or summarize auth-walled Google-Doc/Atlassian references with local content; mark remaining ones "human-only."
6. Tighten `ai-review.md` `allowed-tools` from `all`.
7. Specify coverage metric(s) in the dev quality gate; define "near session start" for ambient.
8. Reconcile the assignee wording in `start-ticket.md` (§10.3).

## 25. Recommended new files

Created this pass: everything under `docs/` (this report, improvement summary, skill inventory, 8 templates, 8 skill tests) plus `skills/README.md`, `User Stories/task-template.md`, `User Stories/README.md`, `Change Workflow/README.md`, and content for `PRD/milestone-prd-template.md`.

Recommended next (not created — need owner input):

- `docs/decision-log.md` — running ADR-style log for skill/process decisions (none exists).
- `docs/risk-log.md` — the framework asks phases to document risks but gives no standing home for them.
- `skills/the-release-manager.md` — the local skill set covers plan/debug/advise/secure/setup but nothing owns release/deploy for tax-assist specifically.
- A CI check (extend `scripts/`) that lints skill files against the template's required headings.

## 26. Recommended next actions

1. **Adopt the rewritten local skills** — read `skills/README.md`, then each skill; confirm domain facts survived intact (especially The Honest Advisor — a tax practitioner should sign off on the wording of the source-grounding and review gates).
2. **Run the 8 skill tests once manually** (they are executable-by-agent checklists) and record results in the test files' status blocks.
3. **File the upstream issues** from §24 against `assembleinc/coherence-engine` (est. 8 small PRs; the naming mismatch and stub-fallback items are the highest value).
4. **Wire the inventory into maintenance:** when any skill/command/rule changes, update its row in `docs/skill-index/skill-inventory.md` (added as a rule in `skills/README.md`).
5. **Decide the Google-Docs question:** either vendor summaries of the external playbook content into `CI-CD/` and `Code Review/`, or explicitly mark those links human-only so agents stop attempting them.
6. **Schedule a second pass** after 2–4 weeks of real use to review which skills fired, which were ignored, and which failure-handling paths were actually exercised (see improvement summary §10).
