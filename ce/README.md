# Coherence Engine

An AI-augmented software delivery methodology where specifications drive development and AI amplifies human capabilities at every step.

> **This directory contains documentation and reference material for CE.** The framework's operational tooling (MCP server, Claude Code slash commands, scripts) lives at [github.com/assembleinc/coherence-engine](https://github.com/assembleinc/coherence-engine).

---

## Quick Start

**Using the framework?** See the [CE MCP Server](https://github.com/assembleinc/coherence-engine) to install and configure the tooling.

**Starting a new project?** See [CE Documentation](https://coherence-engine.fly.dev/) for setup options and configuration guidance.

**New to this framework?** Start here based on your role:

| I am a...               | Start with...                                                                                                                     | Then explore...                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **PM / Product Owner**  | [AI Knowledge Base - Migrated Docs](https://docs.google.com/document/d/16n6lfJJYGHlLxUk702-2Xk6ooq_7KK5gCtnTN7whO14/edit?tab=t.0) | PM workflows and tooling                  |
| **Developer**           | [AI Knowledge Base - Migrated Docs](https://docs.google.com/document/d/16n6lfJJYGHlLxUk702-2Xk6ooq_7KK5gCtnTN7whO14/edit?tab=t.0) | Developer workflows and tooling           |
| **Team Lead / Manager** | [AI Knowledge Base - Migrated Docs](https://docs.google.com/document/d/16n6lfJJYGHlLxUk702-2Xk6ooq_7KK5gCtnTN7whO14/edit?tab=t.0) | Framework overview and SDLC visualization |

---

## Core Concept

```
PM/PO Creates:                    Developer Executes:
SOW+ + Architecture → PRD: project PRD → System PRD & Milestone PRDs → Milestones → Epics → User Stories → Design → Code → Tests → Deploy
(SOW+ = framework spec)   (PRD: prd-template then system-prd + milestone-prds; only latter feed Milestones)   (Implementation)

AI Assists at Every Step
```

**Key Principles:**

1. **Specification-First** - No development without specification
2. **Architecture-Driven** - Tech stack decisions inform all work
3. **Hierarchical PRDs** - System PRD (overview) + focused Milestone PRDs
4. **Design Before Code** - Validate design decisions before implementation
5. **Role Clarity** - PM/PO owns "what and why", Developer owns "how"
6. **AI-Augmented** - AI assists but humans decide
7. **Quality Gates** - Validation at every transition

---

## Key Templates

### Foundation Templates (SOW+)

| Template                                                | Purpose                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------- |
| [SOW+ template](./SOW/sow-template.md)                  | Business problem & objectives                               |
| [Architecture Template](./SOW/architecture-template.md) | Tech stack inventory (languages, DBs, CI/CD, testing, etc.) |

### PRD Templates

| Template                                         | Purpose                                                                          |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| [Project PRD](./PRD/prd-template.md)             | Intermediate: single-doc PRD from SOW+; used to generate System + Milestone PRDs |
| [System PRD](./PRD/system-prd-template.md)       | Overarching PRD (system overview) with milestone relationships                   |
| [Milestone PRD](./PRD/milestone-prd-template.md) | Focused requirements for single milestone                                        |

PRD produces project PRD → then System PRD + Milestone PRDs. **Only System PRD and Milestone PRDs are required for Milestone planning.**

### Specification Templates (Milestones → Sprint Planning)

| Template                                                       | Purpose                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| [Milestone Template](./Milestones/milestone-template.md)       | Execution plan with timeline & resources                      |
| [Epic Template](./Epics/epic-template.md)                      | Epic specification with user stories                          |
| [Task Template](./User%20Stories/task-template.md)             | Task tickets for change orders or targeted work               |

---

## Documentation Map

### Core Guides

| Document                                                                                              | Purpose                       | Audience |
| ----------------------------------------------------------------------------------------------------- | ----------------------------- | -------- |
| [AI Playbook](https://assembleinc.atlassian.net/wiki/spaces/ASMAI/pages/1649476834/ASMBL+AI+Playbook) | Setup, workflows, methodology | Everyone |

### Phase Directories

Each workflow phase has its own directory with templates, guidelines, and documentation. Order matters for dependencies, but projects select and reorder phases via preset config (see `src/phases/manifest.ts`).

| Phase               | Directory                                | Key Contents                                                                                                          |
| ------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Agents**          | [agents/](./agents/)                     | Canonical agent definitions (pmo, developer, gate-check, maintainer, council) served as `ce://agents/*`               |
| **SOW+**            | [SOW/](./SOW/)                           | SOW+ template, Architecture template                                                                                  |
| **PRD**             | [PRD/](./PRD/)                           | Project PRD (prd-template) → System PRD + Milestone PRDs; only latter for Milestones                                  |
| **Milestones**      | [Milestones/](./Milestones/)             | Milestone planning, PRD-to-milestone mapping                                                                          |
| **Epics**           | [Epics/](./Epics/)                       | Epic specification template                                                                                           |
| **User Stories**    | [User Stories/](./User%20Stories/)       | User story creation - one story per user story with all ACs                                                           |
| **Sprint Planning** | [Sprints/](./Sprints/)                   | Sprint planning - create sprint plans; **`/sprint-complete`** after each sprint for combined status report            |
| **Development**     | [Development/](./Development/)           | Design considerations, implementation, commit strategies                                                              |
| **Testing**         | [Testing/](./Testing/)                   | Testing strategy, validation procedures                                                                               |
| **Code Review**     | [Code Review/](./Code%20Review/)         | Review checklist, PR descriptions, clean branch workflow                                                              |
| **CI/CD**           | [CI-CD/](./CI-CD/)                       | Pipeline configuration, deployment procedures                                                                         |

### Tooling & Workflows by Role

Workflows, tooling guides, and Cowork docs: [AI Knowledge Base - Migrated Docs](https://docs.google.com/document/d/16n6lfJJYGHlLxUk702-2Xk6ooq_7KK5gCtnTN7whO14/edit?tab=t.0)

---

## Workflow Overview

### Planning: PM/PO Drives Specification

1. **SOW+** - Define business problem and objectives
2. **Architecture** - Define tech stack, databases, CI/CD, testing frameworks
3. **PRD** - Project PRD (from SOW+) → System PRD + Milestone PRDs; only System PRD and Milestone PRDs feed Milestones
4. **Milestones** - Execution plans with timelines
5. **Epics** - Group related features with details; UI-heavy epics split into **several user stories** from components/blocks through composition (Atomic Design–style), with dependencies where needed
6. **User Stories** - Create one story per user story, with all ACs included. Use **Tasks** for change orders or targeted work when a full User Story isn't appropriate - not for splitting ACs or for “component Tasks” that should be separate user stories.
7. **Sprint Planning** - Create sprint plans from milestones, epics, and user stories. Assign stories to sprints with capacity and goals.

### Development: Developer Drives Implementation

8. **Development** - Design review → Implementation → Commit
9. **Testing** - Validate with automated and manual tests
10. **Code Review** - Human + AI review, clean history
11. **CI/CD** - Deploy with quality gates

---

## What's New

### Hierarchical PRD Structure

Instead of one large PRD, use:

```
System PRD (Central - Stable; system overview)
├── Vision & Goals
├── Milestone Map & Dependencies
├── Shared Context (Tech Stack, Data Models, Glossary)
│
└── Milestone PRDs (Detailed - Iterable)
    ├── milestone-1-prd.md → Milestones (Milestone 1)
    ├── milestone-2-prd.md → Milestones (Milestone 2)
    └── milestone-3-prd.md → Milestones (Milestone 3)
```

**Benefits:** No context rot, single source of truth, incremental approval, clear dependencies.

### Architecture Template

Comprehensive inventory of your tech stack including:

- Languages & Frameworks
- Databases & Caching
- CI/CD & Deployment
- Testing Frameworks
- Monitoring & Observability
- Security & Compliance

### Design Considerations

Development design readiness is owned by the **Design Agent** (`/design-review`, `ce://agents/design`). See [Development/GUIDELINES.md](./Development/GUIDELINES.md#11-design-considerations) for workflow; full checklists are on the server, not duplicated in phase guidelines.

---

## AI Tool Strategy

| Tool            | Primary Use        | Best For                        |
| --------------- | ------------------ | ------------------------------- |
| **Cursor**      | Implementation     | Writing code from specs         |
| **Claude Code** | Automation         | Multi-file operations, testing  |
| **Claude.ai**   | Reasoning          | Complex decisions, architecture |
| **Cowork**      | Document workflows | Spec creation, analysis         |

---

## Claude Code Slash Commands

The framework includes pre-built slash commands for Claude Code. Commands are organized by CE phase and are part of the **CE MCP Server** repository.

👉 See [github.com/assembleinc/coherence-engine](https://github.com/assembleinc/coherence-engine) for the full command reference and installation instructions.

Example commands:

```
/start-ticket
/council authentication-system
/quality-gate prd
```

---

## Getting Started Checklist

### Step 1: Foundation

- [ ] Read the guide for your role (PM/PO or Developer)
- [ ] Review the Architecture Template structure
- [ ] Understand the hierarchical PRD approach
- [ ] Set up your AI tools (Cursor, Claude, etc.)

### Step 2: Practice

- [ ] Create a sample SOW+ + Architecture Template
- [ ] Complete PRD: project PRD → System PRD + at least one Milestone PRD
- [ ] Try AI-assisted drafting or implementation
- [ ] Get feedback from a teammate

### Step 3: Apply

- [ ] Use the framework on a real task
- [ ] Document what works and what doesn't
- [ ] Share learnings with your team

---

## Quick Reference

### Quality Gate Checklist (Every Phase Transition)

- [ ] Required artifacts complete
- [ ] Automated checks passed (if applicable)
- [ ] Human review completed
- [ ] Risks identified and documented
- [ ] Approver sign-off obtained

### When AI Struggles, Check These First

1. **Vague specifications** - Add more detail to the task
2. **Missing context** - Reference related code/docs
3. **Ambiguous requirements** - Clarify acceptance criteria
4. **Complex dependencies** - Break into smaller tasks
5. **Missing architecture** - Complete the Architecture Template first

---

## Need Help?

- **Can't find something?** Use this README's tables to navigate
- **Template missing fields?** Check the template in the relevant [phase directory](#phase-directories)
- **AI giving poor results?** Review prompt templates in role-specific guides
- **Process unclear?** See [AI Knowledge Base - Migrated Docs](https://docs.google.com/document/d/16n6lfJJYGHlLxUk702-2Xk6ooq_7KK5gCtnTN7whO14/edit?tab=t.0) for diagrams
- **Architecture questions?** Start with the [Architecture Template](./SOW/architecture-template.md)
- **PRD structure questions?** See [PRD GUIDELINES](./PRD/GUIDELINES.md)

---

_This framework is living documentation. Update it based on team learnings._
