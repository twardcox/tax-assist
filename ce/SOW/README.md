# SOW+ - Statement of Work (SOW)

**Owner:** PM/PO
**AI Role:** Analyst & Drafter

**Prerequisite:** Run **init_project** (SOW+) to create output-docs/, research/, and reports/ locally and agent-docs/, specs/tasks/, and .ce-project.json on the server; CLAUDE.md (local). Do this before starting.

## Purpose

Define the business problem, objectives, and high-level approach. This phase produces the framework’s **SOW+** (internal spec), distinct from the client contract SOW.

**Possible inputs for SOW+ (not limited to):** Architecture doc, SOW (client contract), User Interviews, Parallax screenshot, PoC. The **project-input document** is the input for **Proof of Concept (PoC) only**.

## AI-Assisted Activities

### 1. Problem Analysis

```
AI Prompt Template:
"I'm working on a project to [business objective].
Here's the context: [situation].
Help me analyze:
1. What is the core problem we're solving?
2. Who are the stakeholders?
3. What are potential solutions?
4. What are the risks and constraints?
5. What similar projects exist to learn from?"
```

### 2. SOW+ drafting

```
AI Prompt Template:
"Based on this analysis [paste analysis], draft the SOW+ (framework Statement of Work) including:
1. Executive Summary
2. Business Objectives
3. Success Criteria
4. Scope (In/Out)
5. Constraints
6. Assumptions
7. Stakeholders
8. High-Level Timeline"
```

### 3. Competitive Analysis

```
AI Prompt Template:
"Analyze how [competitor 1], [competitor 2], and [competitor 3]
approach [problem domain]. What are their strengths and weaknesses?"
```

## Deliverable Templates

| Template                                            | Purpose                      |
| --------------------------------------------------- | ---------------------------- |
| [SOW Template](./sow-template.md)                   | Statement of Work definition |
| [Architecture Template](./architecture-template.md) | Technical stack inventory    |

### Architecture Template

The Architecture Template should be completed alongside or shortly after the SOW+. It captures:

- **Tech Stack**: Languages, frameworks, libraries
- **Data Layer**: Databases, caching, file storage
- **Infrastructure**: Hosting, CI/CD, deployment
- **Testing**: Frameworks, coverage requirements
- **Monitoring**: Logging, metrics, alerting
- **Security**: Authentication, authorization, compliance

**AI Prompt for Architecture Template:**

```
"Based on this SOW+: [paste SOW+]
And these technical requirements: [list requirements]

Help me complete the Architecture Template including:
1. Technology stack recommendations with rationale
2. Database selection based on data requirements
3. CI/CD pipeline configuration
4. Testing framework selection
5. Monitoring and observability setup
6. Security considerations

Consider:
- Team expertise
- Scalability requirements
- Budget constraints
- Timeline constraints"
```

---

## Quality Gate: SOW+ & Architecture Approval

**SOW+ checklist:**

- [ ] Business problem clearly defined
- [ ] Success criteria are measurable
- [ ] Scope is bounded (in/out defined)
- [ ] Constraints documented
- [ ] Stakeholders identified
- [ ] Risks assessed

**Architecture Checklist:**

- [ ] Tech stack decisions documented with rationale
- [ ] Database selection justified
- [ ] CI/CD pipeline defined
- [ ] Testing strategy outlined
- [ ] Security requirements identified
- [ ] Team has expertise or learning plan

---

## Slash Commands

| Command                           | Description                           |
| --------------------------------- | ------------------------------------- |
| `/create-product-requirement-doc` | Create System PRD from completed SOW+ |
| `/architecture-check`             | Validate architecture decisions       |

---

## Related Documentation

- [AI Knowledge Base - Migrated Docs](https://docs.google.com/document/d/16n6lfJJYGHlLxUk702-2Xk6ooq_7KK5gCtnTN7whO14/edit?tab=t.0)
- [SOW Template](./sow-template.md)
- [Architecture Template](./architecture-template.md)
- [PRD - PRD](../PRD/) - Next phase (downstream)
