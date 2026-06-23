# Shared Phase Guidelines

---

Shared content referenced by all phase-specific `GUIDELINES.md` files.

## 0. Progress Communication

Planning phases can take several minutes. Keep the user informed throughout so they know what is happening and when to expect completion.

### Phase Start Announcement

At the beginning of every phase, before any tool call or drafting, post a brief plan:

```
Starting Phase [N] - [Phase Name]
Plan: (1) [Step description] → (2) [Step description] → … → (N) Save + Checkpoint
This will take approximately [X–Y minutes / a few moments]. I'll update you as each step completes.
```

### Step-Level Updates

Before each major step begins, post a one-line status so the user can track progress:

```
[Phase N - Step X/Y] [What you're doing]…
```

Examples:

```
[PRD - Step 1/4] Analyzing SOW+ and drafting Project PRD…
[PRD - Step 2/4] Extracting shared context into System PRD…
[PRD - Step 3/4] Drafting Milestone PRDs (3 milestones)…
[PRD - Step 4/4] Saving artifacts and running phase checkpoint…
```

### When It's Taking Longer Than Expected

If a step is notably slow (e.g. saving multiple large files), add a brief note:

```
Still working - saving Milestone PRD 2 of 3…
```

### Rules

- **Always post the start announcement.** Never begin silently.
- **Post before each step, not after.** The user should know what's happening, not learn about it when it's done.
- **Keep updates brief.** One line per step - no padding.
- **Do not merge the start announcement with the first step.** They serve different purposes.

---

## 1. Phase Checkpoint Protocol

After completing each phase, **before stopping for HITL approval**:

### Required Actions

1. **Progress Indicator**

   ```
   Step X of Y: [Phase Name]
   ```

2. **Output Files** - Link to both artifacts (.md and .docx) so the PM/PO can review them. When you call `phase_checkpoint` with `artifact_path`, the server includes the full artifact content in the response so the PM/PO can review it in the chat without asking.

   ```
   **Output (Markdown):** agent-docs/[filename].md  (or server `/data/<project>/agent-docs/` when using server storage - canonical for agents)
   **Output (Review Copy):** output-docs/[filename].docx  - or Drive **output-docs/** when linked (Google Drive is for research, output-docs, and reports only; **agent-docs** and project config stay on the server)
   ```

   (The artifact content is appended automatically when `artifact_path` is provided. **agent-docs** and **.ce-project.json** are server-side; **output-docs** `.docx` may be project disk or Drive - not on the server volume.)

3. **Review Checklist** - Include the phase-specific checklist from that phase's `GUIDELINES.md` under `ce/{SOW,PRD,...}/`.

4. **Areas of Interest** - Highlight (for context during review):
   - Decisions that could go multiple ways
   - Sections needing more detail
   - Assumptions made
   - Risks or blockers

5. **Review & Interview** - Do not ask predefined clarifying questions. Instead, invite the PM/PO to review the output file, then conduct a short interview to uncover:
   - Outstanding questions
   - Gaps or missing detail
   - Concerns or objections
   - Priority trade-offs or scope boundaries

   For planning phases (through User Stories), use both **open-ended** and **multiple choice** questions as needed:
   - **Open-ended:** "What stands out?" "Any concerns?" "Anything missing?"
   - **Multiple choice:** When options are known (e.g., from Areas of Interest), offer 2–4 choices (e.g., "For E1.5: A) Privileged, B) Device mapping, C) Need more info")

### To Progress to the Next Phase

**The PM/PO MUST respond with exactly: `Output Approved.`**

- The **Gate-Check Agent** is the agent of record that accepts this message. At phase transitions, Gate-Check validates documents, runs security scans, presents the checkpoint, and guides the user through the HITL review.
- Do **not** proceed to the next phase until this exact response is received.
- If the PM/PO requests changes, make the revisions, re-save the artifact, and run `phase_checkpoint` again.
- Only after receiving `Output Approved.` may the agent advance to the next phase.

### Example Checkpoint

```
---
Step 2 of 5: Epic Specifications

**Output (Markdown):** agent-docs/2025-02-27-epic-specs-m1-m3.md
**Output (Review Copy):** output-docs/2025-02-27-epic-specs-m1-m3.docx

### Review Checklist (Epics)
- [ ] Business value clear for each epic
- [ ] Technical feasibility confirmed
- [ ] User stories have Given/When/Then acceptance criteria
- [ ] API contracts and data models defined
- [ ] Risks and dependencies documented

Areas needing attention:
- E1.5 (Docker): Privileged mode vs device mapping?
- E2.2 (Proximity): Default RSSI thresholds may need calibration

**Review & Interview** - Please review the artifact above using the checklist. I'll ask follow-up questions to uncover any remaining gaps, concerns, or outstanding questions before we proceed.

**To continue:** Respond with `Output Approved.` when ready to proceed to the next phase.
---
```

---

## 2. File Creation Verification

**After every file write, verify it exists before proceeding.**

```bash
# Single file
ls -la [filepath]

# Batch operations
find [output_dir] -type f | wc -l
# Confirm count matches expected
```

_Used by: Development, Testing, CI/CD_
