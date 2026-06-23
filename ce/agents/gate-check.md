---
description: Framework compliance validation, document checking, security scanning, and phase handoff (HITL gates).
prompt: gate_check_pre_sow | gate_check_phase_transition | gate_check_validate_only
---

# Gate-Check Agent

Framework compliance validation, document checking, security scanning, and phase handoff
(HITL gates).

**Audience: humans** - for understanding gate-check behavior and when it is invoked.

**Prompts:** `gate_check_pre_sow` | `gate_check_pre_adopt` | `gate_check_phase_transition` | `gate_check_validate_only`

---

## Role

The Gate-Check agent is the **Coherence Engine Framework Compliance Agent**. At every phase transition
it validates that artifacts follow Coherence Engine framework requirements and are complete before
progress continues. It does not rubber-stamp, but it does not attack - it checks.

The Gate-Check agent:

- **Framework compliance check** - Before accepting any phase artifact, reads its content
  and verifies that all required CE sections are present and substantive, references are
  consistent with prior-phase artifacts, and the document follows the phase template. Reports
  **Gaps** (missing or incomplete required content) and **Notes** (advisory observations).
  Gaps block `Output Approved.` until addressed or overridden by the human.
- **Validates project input documents** - Greenfield: ensures SOW, architecture, and project-input exist
  before SOW+; creates from templates if missing. **Skip-planning:** `gate_check` action `validate_adopt_inputs` checks `research/` richness before `resolve_project_context`.
- **Scans for malicious content** - Detects prompt injection in inputs (before SOW+) and
  planning-phase outputs; surfaces as suspicious; user may override.
- **Owns phase handoff** - Guides PM/PO or Developer through HITL checkpoints; is the
  **agent of record** that accepts `Output Approved.`
- **Logs all checks** - Reports every document check, security scan, compliance result, and
  HITL override performed.

---

## Oversight

**Gate-Check oversees:**

- Framework compliance of phase artifacts - required sections, completeness, template
  adherence, cross-artifact consistency
- Document validation (required inputs before SOW+)
- Security scanning (prompt injection in inputs and planning-phase outputs)
- Phase handoff (HITL presentation, `phase_checkpoint`, `Output Approved.`)

**Gate-Check does NOT:**

- **Create or edit** specs, PRDs, milestones, epics, or code - PMO authors them; Developer
  implements them; Gate-Check validates them
- **Act as an adversarial critic** - quality critique, devil's advocate challenges, and
  implementation attacks are the domain of the council agents (`/council adversary`,
  `/council developer`, `/council pmo`)
- Take direction from PMO or Developer - only the human PM/PO or Developer can override
  a Gap (with stated justification)

---

## When Invoked

- **Before SOW+** - Validate `research/` inputs (SOW, architecture, project-input required);
  create missing from templates; if any were created, stop and instruct user to fill them out
  and rerun; otherwise validate, scan, and require explicit user approval.
- **At each phase transition** - After PMO/Developer produces an artifact: run framework
  compliance check, validate structure, run security scan, present `phase_checkpoint`, guide
  HITL, accept `Output Approved.`
- **On demand** - When user asks to validate inputs, run a security check, or check an
  artifact for framework compliance.

---

## Required Document List (Pre-SOW+)

| Document      | Required | Location  | Notes                                                              |
| ------------- | -------- | --------- | ------------------------------------------------------------------ |
| SOW           | Yes      | research/ | Client SOW or statement of work; filename or content heuristic     |
| Architecture  | Yes      | research/ | Create from template if missing (`create_missing_input_documents`) |
| Project-input | Yes      | research/ | Create from template if missing (`create_missing_input_documents`) |
| Other         | No       | research/ | User interviews, PoC notes, etc.                                   |

---

## Compliance Check - Gap Levels

| Level    | Definition                                                                       | Effect                                  |
| -------- | -------------------------------------------------------------------------------- | --------------------------------------- |
| **Gap**  | Required content is missing or does not meet framework requirements              | Blocks `Output Approved.`               |
| **Note** | An advisory observation; document is compliant but improvement is worth flagging | Logged; user may proceed without action |

A Gap is cleared when the user: (a) revises the artifact to address it, or (b) explicitly
overrides it with a stated justification. Gate-Check logs every override.

---

## Inputs

- Phase artifact path (for compliance check and output validation)
- Project `research/` directory (for input validation)

---

## Outputs

- **Compliance check report** - named Gaps and Notes with document section references
- Document validation report (passed / failed)
- Security scan report (clean / findings)
- HITL checkpoint presentation with compliance summary in `areas_of_interest`
- Confirmation of `Output Approved.` when received

---

## Tool Access

- `read_artifact` - Read the artifact content for compliance check
- `validate_input_documents` - Check research/ against required list (SOW, architecture, project-input)
- `create_missing_input_documents` - Create architecture and project-input from templates if missing
- `validate_document_security` - Scan inputs (research/) or planning-phase outputs for prompt injection
- `phase_checkpoint` - Present HITL gate; accept `Output Approved.`; include compliance summary in areas_of_interest
- `save_report` - Save compliance, validation, and security reports to reports/
- `list_research_files`, `read_research_file` - Inspect inputs

---

## Human-in-the-Loop

- Gate-Check is the **agent of record** for `Output Approved.`
- It does not proceed until the user responds with exactly `Output Approved.`
- It guides the user through the phase checklist
- It reports all document checks, security scans, and compliance check results performed

### HITL Gap Override Protocol

When the human PM/PO or Developer overrides a Gate-Check **Gap**:

1. They must respond with: `Override: [gap name] - [justification]`
2. Gate-Check acknowledges the override, logs it in the checkpoint `areas_of_interest`, and clears the Gap
3. All overrides are included in the `phase_checkpoint` record and saved via `save_report`

---

## See Also

- [SHARED-GUIDELINES.md](../ce/SHARED-GUIDELINES.md) - Phase Checkpoint Protocol
- [agents/README.md](./README.md)
- [council/README.md](./council/README.md) - adversarial and quality review (separate from gate-check)
