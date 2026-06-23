# Milestones - Milestone Planning

**Owner:** PM/PO with Developer Input
**AI Role:** Planner & Risk Analyzer

## Purpose

Break PRD into deliverable phases with clear objectives and timelines. Each milestone has a corresponding Milestone PRD that contains detailed requirements.

---

## Relationship to PRD Structure

```
PRD - PRD
├── System PRD (defines milestone map)
│   └── Milestone summaries & dependencies
│
├── milestone-1-prd.md (Milestone 1 detailed requirements)
├── milestone-2-prd.md (Milestone 2 detailed requirements)
└── milestone-3-prd.md (Milestone 3 detailed requirements)
        ↓
Milestones - Milestones
├── Milestone Plan (timeline, resources, risks)
├── M1 Execution Plan
├── M2 Execution Plan
└── M3 Execution Plan
        ↓
Epics - Epics (breakdown of each milestone)
```

### What Goes Where

| Document           | Content                                                          |
| ------------------ | ---------------------------------------------------------------- |
| **System PRD**     | Milestone definitions, objectives, dependencies, impact analysis |
| **Milestone PRD**  | Detailed requirements, user stories, acceptance criteria         |
| **Milestone Plan** | Timeline, resources, risks, execution strategy                   |

---

## Workflow

### Step 1: Review System PRD

Before creating milestone plans, ensure the System PRD is complete with:

- All milestones identified
- Milestone objectives defined
- Dependency graph complete
- Impact analysis for each milestone

### Step 2: Create Milestone Execution Plans

For each milestone defined in System PRD:

```
AI Prompt Template:
"Given the Milestone PRD for M[X]: [paste or summarize milestone-[X]-prd.md]

Create an execution plan that includes:
1. Timeline breakdown (week by week)
2. Resource allocation
3. Risk assessment with mitigations
4. Dependencies and blockers
5. Success criteria validation plan
6. Epic/task breakdown strategy

Consider:
- Team capacity
- Dependencies from other milestones
- External dependencies
- Technical risks identified in PRD"
```

### Step 3: Validate Timeline Against PRD

```
AI Prompt Template:
"Validate this timeline: [paste milestone plan]
Against these requirements: [paste from Milestone PRD]

Check:
1. Is time allocated sufficient for all user stories?
2. Are high-risk items scheduled early?
3. Is buffer included for unknowns?
4. Are dependencies properly sequenced?
5. Does timeline allow for design review before implementation?"
```

---

## AI-Assisted Activities

### 1. Dependency Analysis

```
AI Prompt Template:
"Given the System PRD: [paste milestone map & dependencies]
And Milestone PRDs: [paste summaries]

Analyze:
1. What are the hard dependencies between milestones?
2. What data models/APIs must M1 deliver for M2?
3. What is the critical path?
4. Which tasks can run in parallel?
5. What are the integration points between milestones?"
```

### 2. Milestone Breakdown (from PRD to Tasks)

```
AI Prompt Template:
"Break down this Milestone PRD into atomic tasks: [paste milestone-[X]-prd.md]

Requirements:
1. Each task should be an atomic, committable piece of work
2. Each task should include tests or validation criteria
3. Tasks should compose into demoable sprint deliverables
4. Every task needs a status field for tracking
5. Group tasks into logical sprints (1-2 weeks each)

Output format:
- Sprint 1: [list of tasks with estimates]
- Sprint 2: [list of tasks with estimates]
- Dependencies between tasks
- Critical path through the milestone"
```

### 3. Risk Assessment

```
AI Prompt Template:
"For Milestone [X] with these requirements: [paste from Milestone PRD]
And this timeline: [paste plan]

Identify:
1. Technical risks (complexity, unknowns, new technology)
2. Resource risks (skills, availability, dependencies)
3. Dependency risks (other milestones, external systems)
4. Timeline risks (aggressive estimates, blockers)
5. Scope risks (requirement changes, scope creep)

For each risk:
- Probability (High/Medium/Low)
- Impact (High/Medium/Low)
- Mitigation strategy
- Contingency plan"
```

### 4. Resource Planning

```
AI Prompt Template:
"For this milestone plan: [paste plan]
With these technical requirements: [paste from PRD]

Estimate:
1. Developer hours per sprint
2. Required skill sets (frontend, backend, DevOps, etc.)
3. Potential bottlenecks (single person dependencies)
4. Parallel work opportunities
5. External resources needed (design, QA, etc.)"
```

### 5. Architecture Integration

```
AI Prompt Template:
"Given the Architecture Template: [paste or link]
And Milestone PRD: [paste milestone-[X]-prd.md]

Validate:
1. Are all required technologies available in the stack?
2. Is the database schema sufficient for milestone requirements?
3. Are CI/CD pipelines configured for milestone deliverables?
4. Are testing frameworks adequate for test requirements?
5. Are deployment environments ready?

Identify gaps and add to milestone risk assessment."
```

---

## Deliverable Templates

| Template                                           | Purpose                          |
| -------------------------------------------------- | -------------------------------- |
| [Milestone Plan Template](./milestone-template.md) | Overall milestone execution plan |
| [Milestone PRD](../PRD/milestone-prd-template.md)  | Detailed requirements (PRD)      |

---

## Quality Gate: Milestone Plan Approval

**Before Milestone Plan Approval:**

- [ ] Corresponding Milestone PRD is approved
- [ ] Architecture template reviewed for completeness
- [ ] Each milestone delivers user value
- [ ] Dependencies properly sequenced (validated against System PRD)
- [ ] Timeline is realistic (validated with tech lead)
- [ ] Resource requirements identified
- [ ] Risks assessed with mitigation strategies
- [ ] Critical path identified
- [ ] Buffer included for unknowns (20-30%)
- [ ] Stakeholder buy-in on timeline
- [ ] Integration points with other milestones documented

**Before Starting Milestone:**

- [ ] Previous milestone dependencies met
- [ ] Architecture/infrastructure ready
- [ ] Team assigned and available
- [ ] Development environment set up
- [ ] Design assets available (if applicable)

---

## Slash Commands

| Command                   | Description                                   |
| ------------------------- | --------------------------------------------- |
| `/breakdown-milestone`    | Break milestone PRD into atomic tasks         |
| `/create-prd-tickets`     | Create JSON PRD with trackable tickets        |
| `/milestone-status`       | Get progress report with metrics and blockers |
| `/quality-gate milestone` | Run milestone approval checklist              |

---

## Related Documentation

- [System PRD](../PRD/system-prd-template.md) - Milestone definitions
- [Milestone PRD Template](../PRD/milestone-prd-template.md) - Detailed requirements
- [Architecture Template](../SOW/architecture-template.md) - Tech stack
- [GUIDELINES](./GUIDELINES.md) - Prioritization and validation guidance
- [Template](./milestone-template.md) - Execution plan template
- [Epics - Epics](../Epics/) - Epic breakdown (downstream)
