# PRD - Product Requirements Document (PRD)

**Owner:** PM/PO
**AI Role:** Researcher & Spec Writer

## Purpose

Translate business objectives into detailed product requirements. PRD produces a **project PRD** (intermediate) from SOW+, then uses it to create the **System PRD** and **Milestone PRDs**. Only the System PRD and Milestone PRDs are required for the next phase (Milestone creation).

---

## Document Structure

### PRD Flow

```
SOW+ (+ Architecture)  →  project PRD (prd-template.md)  →  System PRD + Milestone PRDs
       (SOW+)              (intermediate)                    (PRD deliverables)
                                                                        ↓
                                                          Milestones: Milestone Planning
                                                          (uses only System PRD + Milestone PRDs)
```

### Hierarchical PRD Architecture (PRD deliverables)

```
System PRD (Central - Stable; system overview)
│
├── Project Vision & Goals
├── Milestone Map & Dependencies
├── Shared Context (Tech Stack, Data Models, Glossary)
├── Cross-cutting Concerns
│
└── Links to Milestone PRDs
    ├── milestone-1-prd.md (Milestone 1 - Detailed, Iterable)
    ├── milestone-2-prd.md (Milestone 2 - Detailed, Iterable)
    └── milestone-3-prd.md (Milestone 3 - Detailed, Iterable)
```

### Why This Structure?

| Problem                        | Solution                                |
| ------------------------------ | --------------------------------------- |
| Single PRD causes context rot  | Split into focused Milestone PRDs       |
| Multiple PRDs lose big picture | System PRD maintains relationships      |
| Duplicated context across docs | Shared context defined once, referenced |
| Unclear milestone dependencies | Impact analysis in each Milestone PRD   |

---

## Templates

| Template                                     | Purpose                                                                           | When to Use                     |
| -------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------- |
| [Project PRD](./prd-template.md)             | Single-doc PRD from SOW+ (intermediate; used to generate System + Milestone PRDs) | PRD, Part A (one per project)   |
| [System PRD](./system-prd-template.md)       | Overarching PRD (system overview) with milestone relationships                    | PRD, Part B (one per project)   |
| [Milestone PRD](./milestone-prd-template.md) | Detailed requirements for single milestone                                        | PRD, Part B (one per milestone) |

---

## Workflow

### Step 1: Complete Architecture First

Before creating PRDs, ensure [Architecture Template](../SOW/architecture-template.md) is complete with:

- Tech stack decisions
- Database choices
- CI/CD configuration
- Testing framework selections

### Step 2: Create Project PRD (intermediate)

Create a single-document project PRD from SOW+ (and architecture if available) using [prd-template.md](./prd-template.md). This is the **intermediate artifact**; it is not required for Milestones. Save to e.g. `agent-docs/project-prd.md`.

- Overview and purpose, success metrics, user stories (Given/When/Then), functional and non-functional requirements, user flows, data requirements, integration requirements.

### Step 3: Create System PRD and Milestone PRDs (PRD deliverables)

Using the project PRD (and SOW+ if needed), create:

**System PRD** (use [system-prd-template.md](./system-prd-template.md)): vision, success metrics, milestone map, dependency graph, shared context (tech stack, data models, glossary, cross-cutting concerns), links to each Milestone PRD. Save to `agent-docs/system-prd.md`.

**One Milestone PRD per milestone** (use [milestone-prd-template.md](./milestone-prd-template.md)): only that milestone’s requirements and user stories; reference System PRD for shared context; document impact on other milestones.
Save to `agent-docs/milestone-1-prd.md`, `agent-docs/milestone-2-prd.md`, etc.

Only the System PRD and Milestone PRDs are required for **Milestone creation** (Milestones).

**Per-milestone prompt** (for each Milestone PRD):

```
AI Prompt Template:
"Create Milestone PRD for M[X]: [Milestone Name]

Context:
- System PRD (system overview): [paste relevant sections]
- Previous Milestone: [what M[X-1] delivers]
- Next Milestone: [what M[X+1] needs]

Include:
1. Milestone objective and scope
2. Impact on other milestones (dependencies & provisions)
3. User stories with Given/When/Then acceptance criteria
4. Functional requirements prioritized as Must/Should/Could
5. Technical specifications (APIs, data models)
6. UI/UX requirements
7. Testing strategy
8. Epic breakdown for Epics"
```

### Step 4: Validate impact relationships

```
AI Prompt Template:
"Review these Milestone PRDs: [M1, M2, M3]
Verify:
1. All dependencies are satisfied (M2 needs what M1 provides)
2. No circular dependencies exist
3. Impact analysis is complete in each PRD
4. Shared context references are consistent
5. No conflicting requirements across milestones"
```

---

## AI-Assisted Activities

### 1. User Research Synthesis

```
AI Prompt Template:
"I have user research data: [paste interviews/surveys/analytics].
Help me:
1. Identify key user needs and pain points
2. Group similar needs into themes
3. Prioritize by frequency and severity
4. Suggest features that address these needs
5. Recommend milestone groupings for phased delivery"
```

### 2. User Story Generation

```
AI Prompt Template:
"Based on this business objective: [objective]
And this user need: [need]
For milestone: [M1/M2/M3]

Generate user stories in the format:
'As a [user type], I want to [action] so that [benefit]'

Include:
- Given/When/Then acceptance criteria
- Edge cases with expected behavior
- Dependencies on other user stories
- Milestone impact (what this enables for future milestones)"
```

### 3. Inter-Milestone Dependency Analysis

```
AI Prompt Template:
"Analyze these milestone summaries for dependencies:
M1: [summary]
M2: [summary]
M3: [summary]

Identify:
1. Hard dependencies (must complete before starting)
2. Soft dependencies (can start but not finish)
3. Data dependencies (models/APIs needed)
4. Feature dependencies (capabilities needed)
5. Critical path through milestones

Output as dependency graph (Mermaid format)"
```

### 4. Completeness Check

```
AI Prompt Template:
"Review this Milestone PRD draft: [paste PRD]
Against System PRD: [paste overview sections]

Identify:
1. Missing requirements
2. Ambiguous statements
3. Conflicting requirements with other milestones
4. Gaps in user flows
5. Missing edge cases
6. Unclear success criteria
7. Undefined impact on other milestones
8. Missing references to shared context"
```

### 5. Cross-Milestone Consistency Check

```
AI Prompt Template:
"Review all Milestone PRDs for consistency:
- milestone-1-prd: [paste]
- milestone-2-prd: [paste]
- milestone-3-prd: [paste]

Check for:
1. Consistent terminology (match glossary)
2. Compatible data model definitions
3. Non-conflicting API contracts
4. Aligned success metrics
5. Proper dependency chains
6. No scope gaps between milestones"
```

---

## Quality Gates

### System PRD Approval

**Checklist:**

- [ ] Vision clearly articulated
- [ ] All milestones identified with clear objectives
- [ ] Dependency graph complete and validated
- [ ] Shared context fully defined (tech stack, data models, glossary)
- [ ] Cross-cutting concerns documented
- [ ] Architecture template referenced correctly
- [ ] All milestone PRD links included
- [ ] Stakeholder approval obtained

### Milestone PRD Approval

**Checklist:**

- [ ] Impact on other milestones documented
- [ ] All user stories have Given/When/Then acceptance criteria
- [ ] Edge cases identified and addressed
- [ ] Non-functional requirements specified with metrics
- [ ] Data requirements reference canonical models
- [ ] APIs documented with request/response formats
- [ ] Integration points documented
- [ ] Epic breakdown complete for Epics
- [ ] No conflicting requirements with other milestones
- [ ] Technical feasibility validated with developers
- [ ] Stakeholder approval obtained

---

## Slash Commands

| Command                           | Description                                  |
| --------------------------------- | -------------------------------------------- |
| `/create-product-requirement-doc` | Create System PRD from SOW+ and Architecture |
| `/create-milestone-prd`           | Create Milestone PRD from System PRD         |
| `/spec-validate`                  | Validate PRD completeness and quality        |
| `/quality-gate prd`               | Run PRD approval checklist                   |

---

## Related Documentation

- [GUIDELINES](./GUIDELINES.md) - Detailed guidelines for PRD creation
- [Architecture Template](../SOW/architecture-template.md) - Tech stack inventory
- [AI Knowledge Base - Migrated Docs](https://docs.google.com/document/d/16n6lfJJYGHlLxUk702-2Xk6ooq_7KK5gCtnTN7whO14/edit?tab=t.0)
- [Milestones - Milestones](../Milestones/) - Milestone planning (downstream)
- [Epics - Epics](../Epics/) - Epic specifications (downstream)
