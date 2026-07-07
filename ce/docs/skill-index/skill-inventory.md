# CE Skill Inventory

**Scope:** `D:\programs\tax-assist\ce` · **Last updated:** 2026-07-07 · **Maintained by:** anyone changing a skill/rule/command (update the row in the same change).

Column legend — **HR?** = human review required for the skill's output · **Tests** = test coverage status (file under `docs/skill-tests/` or `none`) · **Status** = keep / revise / merge / split / archive. "Revise (upstream)" = improvement belongs in the coherence-engine repo, not local edits (vendored/generated file); details in [ce-ai-skills-review.md §24](../process-review/ce-ai-skills-review.md).

---

## A. Project-local skills (`skills/`) — tax-assist domain

| File | Name | Purpose | Trigger / use case | Inputs | Outputs | Tools | Safety / guardrails | HR? | Tests | Overlaps | Improvements | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `skills/the-planner.md` | The Planner | Spec → plan → TDD execution discipline | Any non-trivial feature/change before coding | Change request; the real code it touches | Spec + plan files under `docs/superpowers/{specs,plans}/`; per-task commits | File read/write, git, test runner | Read real code before planning; no "TBD" steps | Plan approval before execution | `skill-test-the-planner.md` | Framework `/start-ticket` agent-led HITL flow | Restructured this pass (template-complete) | **Keep (revised)** |
| `skills/the-bug-hunter.md` | The Bug Hunter | Debug + validation loop with known repo traps | Any bug report, failing test, or regression | Repro steps or failing test; seeded user | Root-cause fix in shared function + regression test + green validation chain | Test runner, lint, build, Playwright, form-verify scripts | Never trust markitdown extraction for forms; grep all callers of fixed function | Reviewer on PR (framework gate) | `skill-test-the-bug-hunter.md` | Framework `/pre-flight`, `/test-coverage` | Restructured this pass | **Keep (revised)** |
| `skills/the-honest-advisor.md` | The Honest Advisor | Tax-accuracy and anti-abuse rules for all tax content | Any output touching tax parameters, strategies, eligibility, or recommendations | Tax question/feature; `taxParams.generated.ts`; playbook YAML | Tax logic/content with cited primary sources; `review_required` flags | Params pipeline (`npm run update:tax-params`), pinning tests | **Never invent tax parameters**; IRS-listed strategies modeled with abuse boundaries, never recommended; deterministic scanner (no AI eligibility) | **Yes — CPA/attorney for high-risk entries; hard gate** | `skill-test-the-honest-advisor.md` | None (unique domain guardrail) | Restructured; source-grounding made binding; escalation added | **Keep (revised)** |
| `skills/security-sweep.md` | Security Sweep | Trust-boundary review for tax-assist routes and secrets | Before PR on any route/auth/input change; periodic sweep | Diff or route list; `.env` conventions | Findings list; fixes (auth, zod validation); private escalation for live vulns | grep/read, route inspection | Every mutating route authenticated; secrets never committed; no invented external-API auth | Yes — live vulnerability → private maintainer report | `skill-test-security-sweep.md` | `/council adversary`, `quality-gate` security items (generic vs. local) | Restructured; escalation + secrets handling added | **Keep (revised)** |
| `skills/the-setup.md` | The Setup | Dev-environment bootstrap for tax-assist | New clone, new session, or env confusion | `.env` with DATABASE_URL etc. | Running backend (8001) + frontend (5173); seeded user | shell, npm, tsx scripts | **`npm test` wipes shared dev DB — warn first**; re-seed after any test run | No | `skill-test-the-setup.md` | Framework `/init-project`, `/troubleshoot-setup` (framework vs. app env) | Restructured; destructive-command gate added | **Keep (revised)** |
| `skills/README.md` | Local skills index | Discoverability + maintenance rules | Session start in tax-assist work | — | — | — | Points to inventory + review gates | — | n/a | — | **New this pass** | **Keep** |

## B. Agent rules (`.agents/rules/`) — always-on

| File | Name | Purpose | Trigger | Inputs | Outputs | Tools | Safety | HR? | Tests | Overlaps | Improvements | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `default.md` | Framework rules | Dev workflow + data hygiene baseline | Always (dev client) | Jira ticket | Branch, implementation, updated docs | MCP CE tools, git | Quality gate before finish | PR review | none | `project-rules.md` | Fine as-is | **Keep** |
| `agent-invocation.md` | Agent invocation | Route work to correct agent by context | Always | Session context | Correct agent activation | `get_next_steps` | Dev read-only on specs | — | covered via `skill-test-gate-check` | `agents/README.md`, project templates | Single-source matrix (upstream) | **Keep** |
| `project-rules.md` | Project rules baseline | CHANGELOG-per-commit, spec read-only, data dictionary | Always | — | — | git | Spec artifacts read-only in IDE | — | none | `default.md` | Fine | **Keep** |
| `data-dictionary-maintenance.md` | Data dictionary | When/how to update DATA_DICTIONARY.md | On discovering schema/data facts | Discovery | Updated dictionary | file write | — | — | none | `default.md` §Data Hygiene | Fine | **Keep** |
| `interview-ui.md` | Interview UI | Structured-choice vs prose questions | Any multi-option question to user | Question + options | Structured UI question | client question UI | — | — | none | SHARED-GUIDELINES §Review & Interview | Fine | **Keep** |
| `ambient-agent.md` | Ambient rule | Greeting/check-in handling without hijacking work | Social cue at session start | User cue | ≤5-bullet context preamble | read-only orientation tools | Explicit must-not-call write-tool list | — | none | `agents/ambient-assistant.md` (near-duplicate) | Define "near session start"; single-source cue table (upstream) | **Keep** |

## C. Agent personas (`agents/`)

| File | Name | Purpose | Trigger | Inputs | Outputs | Tools | Safety | HR? | Tests | Overlaps | Improvements | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `pmo-assistant.md` | PMO | All PM docs; setup + management loops | Planning client sessions | SOW+, change requests, specs | PRDs, milestones, ACs, tickets | save/read artifacts, Jira sync | No autonomous production specs; hands HITL to Gate-Check | Yes (PM/PO approves all) | none | — | Fine | **Keep** |
| `developer-assistant.md` | Developer | Implementation, tests, PRs; read-only on specs | Dev client sessions | Approved specs, tickets, codebase | Code, PRs, docs, escalations | read-only artifact tools + dev tools | No `save_artifact`; no autonomous merges | Yes (PR review) | none | — | Stale links **fixed this pass**; rest fine | **Keep (revised)** |
| `gate-check.md` | Gate-Check | Compliance check, security scan, HITL of record | Pre-SOW+ and every phase transition | Artifact path, research/ | Gaps/Notes report, checkpoint, override log | validate/scan/checkpoint/report tools | Blocks on Gaps; logged overrides only | **Is** the HR mechanism | `skill-test-gate-check.md` | — | Add secrets-pattern scan (upstream) | **Keep** |
| `ambient-assistant.md` | Ambient | Social-cue project context | Session-start cues | Cue + project state | Brief preamble | read-only orientation | Must-not-call write list; non-interference | — | none | rules/ambient-agent.md | Single-source cue table (upstream) | **Keep** |
| `design-assistant.md` | Design | Design-spec readiness before UI work | `/design-review`; UI epics/tickets | Epic/ticket, Figma refs | READY/NOT-READY verdict, gaps to PMO | Figma MCP, read-only artifacts | Read-only; escalates, doesn't edit specs | PMO acts on gaps | none | council/designer.md (review vs readiness) | Fine | **Keep** |
| `council/reporter.md` | Council Reporter | Orchestrates specialist reviews | `/council [scope]` | Scope | Combined findings report + gate verdict | dispatch + review skills | — | Findings reviewed by dev | none | — | Fine | **Keep** |
| `council/adversary.md` | Adversary | Isolated-context attack review with runnable proofs | `/council adversary` | Code only (+ CLAUDE.md) | Severity-rated findings + adversarial tests | `adversarial_critique` (Gemini judge), test writer | **Must not** read specs/ACs; must attempt judge call, never silently skip | Blocking findings gate shippability | none | security-sweep (local, narrower) | Fine — exemplary design | **Keep** |
| `council/developer.md` | Council Developer | Craft/architecture-conformance review | `/council developer` | Diff/scope | Named findings | read tools | — | dev acts on findings | none | `/architecture-check` | Fine | **Keep** |
| `council/pmo.md` | Council PMO | Spec-traceability review | `/council pmo` | Specs + implementation | AC→code map, gaps | read tools | — | — | none | `spec-validate` | Fine | **Keep** |
| `council/designer.md` | Council Designer | Design-system conformance review | `/council design` | UI code, Figma, tokens | Findings | Figma MCP, Storybook | — | — | none | design-assistant (readiness vs review) | Fine | **Keep** |

## D. Command playbooks (`.agents/commands/`) — 43 files

All are triggered by explicit slash invocation (`disable-model-invocation` on their stubs); all assume the CE MCP server; none require human review beyond the gates named in their own steps. Rows grouped by phase; per-row cells kept to deltas.

| File | Purpose | Inputs | Outputs | Tools | Safety / notes | Tests | Status |
|---|---|---|---|---|---|---|---|
| `ce.md` / `ce-status.md` | Static / live command hub | — / project state | Catalog / phase-aware menu | `get_next_steps` | read-only | none | **Keep** |
| `new-project.md` / `init-project.md` | Bootstrap (planning / dev client) | Project info | Configured project | `init_project`, `setup_project` | — | none | **Keep** |
| `create-product-requirement-doc.md` | System PRD from SOW+ | Approved SOW+ | System PRD artifact | artifact tools | HITL via Gate-Check | none | **Keep** |
| `create-milestone.md` | Milestone PRD from System PRD | Milestone id | Milestone PRD | artifact tools | **Name mismatch with `/create-milestone-prd`** | none | **Revise (upstream rename)** |
| `create-prd-tickets.md` / `breakdown-milestone.md` | Ticket JSON / atomic task decomposition | Milestone | tickets JSON / task list | artifact + Jira tools | — | none | **Keep** |
| `spec-validate.md` | Spec completeness check | Spec path | Validation report | read tools | run before HITL | none | **Keep** (add filled example, upstream) |
| `quality-gate.md` | Phase-transition checklist | Phase name + artifact | Pass/warn/block report | artifact read | Named approvers per phase | `skill-test-quality-gate.md` | **Keep** (specify coverage metric, upstream) |
| `milestone-status.md` / `project-status-report.md` / `pmo-status.md` / `project-snapshot.md` | Status reporting family | Project/Jira state | Reports to `reports/` | Jira/GitHub/status tools | read-only | none | **Keep** (snapshot lacks output shape — upstream) |
| `pmo-manage.md` / `sprint-checkin.md` / `sprint-complete.md` / `milestone-review.md` / `lightweight-change.md` | PMO management loop | Project state / sprint | Updated plans, reports | artifact + Jira tools | lightweight-change = existing specs only, never new scope | none | **Keep** |
| `new-ticket.md` / `change-pass-a.md` / `change-pass-b.md` / `change-apply.md` | Change workflow | Change request | Impact analysis → updated epics/tickets → applied | Jira + artifact tools | Depends on `Docs/GUIDELINES.md` or `ce://docs/change-runbook`; **undefined if both missing** | none | **Keep** (define double-failure path, upstream) |
| `jira-reconcile-docs.md` | Jira ↔ docs drift repair | Jira + artifacts | Reconciliation report | Jira tools | — | none | **Keep** |
| `start-ticket.md` | Ticket pickup → branch → In Progress → next steps | Ticket key or lists | Branch, transition, tailored next-steps | Jira, GitHub, config tools | HITL plan/diff protocol for agent path; known In-Progress-abandonment behavior documented | `skill-test-start-ticket.md` | **Keep** (assignee wording, upstream) |
| `commit.md` / `sequential-commit.md` | Conventional commits (auto-sequential ≥15 paths) | Staged work | Commits | git | CHANGELOG-per-commit rule applies | none | **Keep** |
| `pre-flight.md` / `test-coverage.md` / `architecture-check.md` / `design-review.md` / `ai-review.md` | Pre-PR gate family | Diff/branch | Gate reports | test/lint/build, `ai-review-prompt.cjs` | ai-review `allowed-tools: all` too broad (upstream) | none | **Keep** |
| `council.md` | Review-panel orchestration (597 lines) | Scope | Combined findings + verdict | sub-agent dispatch, `adversarial_critique` | Adversary isolation preserved | none | **Keep** (largest file; consider split per sub-agent, upstream) |
| `pull-request.md` / `pr-description.md` / `merge-pr.md` / `complete-ticket.md` | PR lifecycle | Branch/PR | PR, description, merge, Done transition | GitHub + Jira tools | Human PR review required (persona rule) | none | **Keep** |
| `reimplement-clean-branch.md` | Clean-history reimplementation | Messy branch | Clean branch | git | destructive-adjacent: verify before discarding work | none | **Keep** (add explicit checkpoint, upstream) |
| `ci-status.md` / `sync.md` / `update-config.md` / `troubleshoot-setup.md` / `pre-flight.md` | Env/config/CI utilities | — | Status/config updates | CI, config tools | — | none | **Keep** |

## E. Generated skill stubs (`.agents/skills/*/SKILL.md`) — 45 files

One consolidated row: every stub is generator-output (`scripts/generate-ce-agent-skills.mjs` upstream), 26–44 lines, frontmatter + "load `ce://commands/{name}` from MCP" body. **Purpose:** cross-tool loader. **Trigger:** explicit `/{name}`. **Tools:** MCP `resources/read` / `get_slash_command`. **Safety:** `disable-model-invocation: true`. **HR?:** per underlying command. **Tests:** n/a (generated). **Overlap:** 1:1 with command playbooks. **Improvement:** fallback-to-local-copy wording (upstream generator change). **Status: keep — do not hand-edit** (header says regenerate; edits would be overwritten).

## F. Guidelines, templates, and instruction docs

| File | Purpose | Notes | Status |
|---|---|---|---|
| `README.md` (root) | Framework map + workflow overview | Auth-walled Google-Doc role links | **Keep** (vendor summaries, upstream) |
| `SHARED-GUIDELINES.md` | Checkpoint protocol, `Output Approved.` gate, progress comms, file-write verification | Core HITL contract — strong | **Keep** |
| `Development/GUIDELINES.md` + `README.md` | Dev workflow detail | — | **Keep** |
| `PRD/GUIDELINES.md`, `prd-template.md`, `system-prd-template.md` | PRD phase | — | **Keep** |
| `PRD/milestone-prd-template.md` | Milestone PRD template | **Was empty (0 bytes) — filled this pass** | **Keep (revised)** |
| `Epics/`, `Milestones/`, `Sprints/`, `SOW/` guidelines + templates | Phase artifacts | — | **Keep** |
| `User Stories/task-template.md`, `README.md` | Task-ticket template | **Created this pass** (was empty folder, broken README link) | **Keep (new)** |
| `Change Workflow/README.md` | Pointer to change commands | **Created this pass** (was empty folder) | **Keep (new)** |
| `Testing/`, `CI-CD/`, `Code Review/` GUIDELINES | Phase stubs → shared guidelines + external docs | External deps unreadable by agents | **Revise (upstream)** |
| `templates/CLAUDE-project.md` + GEMINI/AGENTS/copilot variants | Per-tool project instruction templates | Consistent guardrails across variants | **Keep** |
| `.agents/commands/README.md` | Command catalog | Contains the create-milestone naming drift | **Revise (upstream)** |
| `agents/README.md`, `agents/council/README.md` | Agent rosters + add-an-agent procedure | — | **Keep** |

---

### Maintenance rule

Any PR that adds, renames, or meaningfully changes a file in sections A–D **must** update its row here (and add/update a test under `docs/skill-tests/` for section-A skills). This file is the discoverability layer; if it drifts, it becomes noise.
