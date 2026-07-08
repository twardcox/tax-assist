# The Honest Advisor — tax accuracy rules

## Skill ID

`the-honest-advisor`

## Purpose

Binding accuracy and anti-abuse rules for **all tax content** this project produces — code, playbooks, UI copy, tests, and answers. The product's integrity depends on two invariants: tax figures are never invented, and IRS-flagged strategies are never presented as clean recommendations.

## When to Use

**Always active** whenever work touches: tax parameters or thresholds, benefit/strategy content, scanner rules or playbooks, eligibility logic, UI copy describing tax outcomes, or user-facing tax explanations. This skill is a policy layer over other skills, not an alternative to them.

## When Not to Use

- Work with **no tax semantics** — build config, logging, CI, dev tooling, UI plumbing that doesn't describe tax outcomes: this skill imposes nothing; use the skill that owns the work (`the-planner`, `the-bug-hunter`, `the-setup`).
- **Never** treat it as inactive for anything that states, computes, or displays a tax fact — even "just copy edits" to strategy descriptions are in scope.

## Inputs Required

- For any parameter: `taxParams.generated.ts`, accessed via `getTaxParams` / `getTaxParamsClosest`
- For any strategy/benefit: the hand-authored playbook YAML and its cited authorities

## Optional Inputs

- Primary sources for new content: Revenue Procedures, IRC sections, Treasury Decisions, IRS news releases

## Tools Required

- PolicyEngine parameter pipeline: `npm run update:tax-params` (regenerates `taxParams.generated.ts`)
- Pinning tests (cite Rev. Procs / OBBBA in them)

## Output

Tax logic/content in which every figure is traceable, every flagged strategy carries its abuse boundary, and high-risk items are visibly gated for professional review.

## Process

1. **Never invent tax parameters.** 2025+ params come from `taxParams.generated.ts` via `getTaxParams`/`getTaxParamsClosest` (PolicyEngine pipeline: `npm run update:tax-params`). If a needed parameter isn't there, extend the pipeline or cite a primary source — do not type a number from memory.
2. **Pin values in tests with citations** — cite Rev. Procs / OBBBA in pinning tests so future regenerations that change values are caught deliberately, not silently.
3. **Model IRS-flagged strategies WITH abuse boundaries, never as clean recommendations:**
   - **831(b) micro-captives** = T.D. 10029 listed transactions — model with the listing and its conditions front and center.
   - **"§643(b) untaxed corpus trust"** = Dirty Dozen scam (IR-2023-65) — **debunk, never recommend.** Present it only as a warning entry.
   - Follow the **conservation-easement precedent** for how a flagged strategy is represented: the abuse history and current enforcement posture are part of the content, not a footnote.
4. **Keep scanner discovery deterministic** — no AI-generated eligibility rules or strategy combinations. Playbooks are hand-authored YAML; the scanner evaluates them mechanically. This determinism **is** the project's required non-AI baseline for eligibility classification: any future AI-assisted suggestion layer must remain advisory on top of it, never replace it, and be evaluated against it.
5. **Gate high-risk entries:** set `review_required: cpa/attorney` on the entry **and say so in the UI**. The flag must be visible to the end user, not just stored.

## Source Grounding (binding)

- **No tax figure may originate from model memory.** Every number traces to `taxParams.generated.ts` or a cited primary source (Rev. Proc., IRC §, T.D., IRS news release).
- Distinguish **statute/regulation** from **interpretation** in any prose; interpretations are labeled as such.
- New playbook entries include their authorities inline in the YAML.

## Safety and Compliance

- **Prohibited outputs:** clean recommendations of listed transactions or Dirty Dozen schemes; definitive "you qualify / you owe" conclusions; invented parameters; AI-generated eligibility.
- **Instead output:** modeled scenarios with boundaries, flagged risks, and review requirements — leads and options for a professional, not conclusions.
- This project assists with tax *analysis tooling*; it does not replace a CPA/attorney, and high-risk content must carry that gate explicitly.

## Assumptions

When a fact pattern is ambiguous (e.g., filing status edge cases), state the assumption, compute under it, and flag the alternative. Never resolve ambiguity silently in the taxpayer-favorable direction.

## Failure Handling

- **Parameter missing for a year** → use `getTaxParamsClosest` only where the call site is designed for it; otherwise extend the pipeline. Never hard-code.
- **Sources conflict** (e.g., statute changed, PolicyEngine lags) → present both with citations, mark `CONFLICT`, escalate to human review; the pinning test documents which one is live and why.
- **Asked to make a flagged strategy "look better"** → decline the framing; produce the boundary-complete version and explain why (cite the listing/notice).
- **Uncertain whether a strategy is flagged** → treat as flagged until verified against IRS listed-transaction and Dirty Dozen sources; default to conservative.

## Validation

- Pinning tests pass and cite authorities.
- Grep confirms no numeric tax literals outside `taxParams.generated.ts` and cited test pins.
- High-risk playbook entries have `review_required: cpa/attorney` and corresponding UI surfacing.

## Acceptance Criteria

- [ ] Every new/changed tax figure traceable to params file or cited primary source
- [ ] Every flagged strategy carries its abuse boundary and enforcement citation
- [ ] Scanner remains deterministic (no AI eligibility paths introduced)
- [ ] `review_required` set AND shown in UI for high-risk entries
- [ ] Human professional review obtained for high-risk content before release

## Examples

**Typical:** Adding a 2026 retirement-contribution rule: value read via `getTaxParams(2026)`, pinning test cites the Rev. Proc., playbook YAML lists the authority, no literals in logic.

**Edge case (the important one):** User asks to add "§643(b) non-grantor trust strategy — clients love it." Correct behavior: add it as a **debunk entry** citing IR-2023-65 (Dirty Dozen), model why promoters' claims fail, set `review_required: cpa/attorney`, and surface the warning in UI. Refuse the clean-recommendation version.

## Related Skills

`the-planner` (specs inherit these rules) · `the-bug-hunter` (correct values during fixes) · `security-sweep` (the tax-law update route precedent) · framework Gate-Check (HITL of record for phase artifacts)

## Change Log

| Date | Change | Author |
|---|---|---|
| 2026-07-07 | Restructured to skill template; all rules preserved; grounding made binding; escalation + ambiguity defaults added | AI skills review pass |
