# PRD - Guidelines

**Shared guidelines:** See [SHARED-GUIDELINES.md](../SHARED-GUIDELINES.md) for Phase Checkpoint Protocol and File Creation Verification.

---

## PRD Review Checklist

When presenting the PRD(s) for approval, include this checklist. The PM/PO must confirm each before responding `Output Approved.`:

- [ ] User stories are complete with clear acceptance criteria
- [ ] Acceptance criteria are specific and testable (no ambiguity)
- [ ] No conflicts between System PRD and Milestone PRDs
- [ ] Milestone dependencies and impact analysis are documented
- [ ] Shared context (glossary, data models, tech stack) is defined
- [ ] Cross-cutting concerns (security, performance) are addressed

---

## 2. Hierarchical PRD Structure

**Problem:** One large PRD causes context rot; milestone-only PRDs cause fragmentation and lose sight of the big picture.

**Solution:** PRD creates a **project PRD** (intermediate) from SOW+, then a **System PRD** (overarching) + focused **Milestone PRDs**. Only System PRD and Milestone PRDs are the phase deliverables; the project PRD is not required for Milestones.

### Document Hierarchy

```
SOW+
├── sow-template.md (Business problem & objectives)
└── architecture-template.md (Tech stack inventory)
         ↓
PRD - PRD
├── prd-template.md → project-prd.md (intermediate; from SOW+)
│         ↓
├── system-prd-template.md → system-prd.md (Central - Stable)
│   ├── Vision & Goals
│   ├── Milestone Map with PRD Links
│   ├── Dependency Graph
│   ├── Shared Context
│   │   ├── Tech Stack Reference → architecture-template.md
│   │   ├── Data Models (canonical)
│   │   └── Glossary
│   ├── Cross-cutting Concerns
│   └── Inter-Milestone Relationships
│
├── milestone-1-prd.md (Milestone 1 - Detailed, Iterable)
├── milestone-2-prd.md (Milestone 2 - Detailed, Iterable)
└── milestone-3-prd.md (Milestone 3 - Detailed, Iterable)
         ↓
Milestones - Milestones (uses only system-prd.md + milestone-*-prd.md) → Epics - Epics → User Stories - User Stories
```

### System PRD (Overarching)

**Purpose:** Single source of truth for project-wide context and milestone relationships.

**Contains:**

- Vision and success metrics
- Milestone map with dependencies
- Dependency graph (visual)
- Shared context (tech stack reference, canonical data models, glossary)
- Cross-cutting concerns (security, performance, accessibility)
- Inter-milestone impact analysis
- Links to all Milestone PRDs

**Stability:** Central doc is stable. Changes require explicit approval and impact assessment on all milestone PRDs.

**Template:** [system-prd-template.md](./system-prd-template.md)

### Milestone PRDs

**Purpose:** Detailed requirements for a single milestone, focused on "what" needs to be delivered.

**Contains:**

- Milestone objective and scope
- **Impact on other milestones** (what it needs, what it provides)
- User stories with acceptance criteria
- Functional requirements
- Technical specifications (APIs, data models specific to milestone)
- UI/UX requirements
- Testing strategy
- Epic breakdown (what feeds into Epics)

**Stability:** Milestone PRDs are iterable. Can evolve during development within approved scope.

**Template:** [milestone-prd-template.md](./milestone-prd-template.md)

### What Lives Where

| System PRD (Central)             | Milestone PRDs                             |
| -------------------------------- | ------------------------------------------ |
| Vision, overall success metrics  | Milestone-specific success criteria        |
| Milestone summaries              | Full user stories with acceptance criteria |
| Inter-milestone dependency graph | Impact analysis (what it needs/provides)   |
| Tech stack reference             | Milestone-specific technical specs         |
| Canonical data models            | Entity modifications for this milestone    |
| Glossary (single source)         | References to glossary                     |
| Cross-cutting concerns           | Milestone-specific non-functional reqs     |
| Project-wide risks               | Milestone-specific risks                   |

### Workflow

1. **Start with Architecture**: Complete `architecture-template.md` in SOW+
2. **Create project PRD**: Use `prd-template.md` with SOW+ (and architecture) → save `project-prd.md` (intermediate)
3. **Create System PRD**: Use `system-prd-template.md` from project PRD (+ SOW+ if needed) → save `system-prd.md`
4. **Create Milestone PRDs**: One `milestone-[X]-prd.md` per milestone using `milestone-prd-template.md`; reference System PRD
5. **Cross-reference**: Each Milestone PRD includes "Impact on Other Milestones" section
6. **Approve incrementally**: Approve System PRD first, then individual Milestone PRDs
7. **PRD deliverables for Milestones**: Only `system-prd.md` and `milestone-*-prd.md`; project PRD is not required for Milestone creation

### Benefits

| Benefit                | How                                               |
| ---------------------- | ------------------------------------------------- |
| No context rot         | Each Milestone PRD is focused (3-5 pages)         |
| Single source of truth | System PRD for relationships & shared context     |
| No duplication         | Milestone PRDs reference shared context via links |
| Incremental approval   | Approve M1 PRD, start work while M2 PRD finalizes |
| Clear dependencies     | Impact analysis in each Milestone PRD             |
| Isolated changes       | Changes to M2 don't require re-reviewing M1       |
| Architecture alignment | Tech stack defined once in architecture template  |

### Rules

1. **Reference, don't duplicate** - Milestone PRDs link to System PRD for shared context
2. **System PRD is stable** - Changes require explicit approval and impact assessment
3. **Milestone PRDs are iterable** - Can evolve during development within scope
4. **One glossary** - Terms defined in System PRD, referenced by Milestone PRDs
5. **Architecture first** - Complete architecture template before detailed PRD work
6. **Impact analysis required** - Every Milestone PRD must document impact on other milestones

### Migration from Single PRD

If migrating from a single monolithic PRD:

1. Extract vision, success metrics, and shared context → System PRD
2. Extract milestone-specific requirements → Individual Milestone PRDs
3. Identify cross-milestone dependencies → Dependency graph in System PRD
4. Document impact relationships in each Milestone PRD
5. Reference architecture template for tech stack details
