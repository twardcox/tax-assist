# Strategy Stacks (Multi-Rule Tax Combinations) — Design

Date: 2026-07-06 · Branch: `audit` · Status: approved

## Problem

The scanner evaluates 59 benefits one at a time. Real planning value often comes from
*combinations* — e.g. a business owner pairing §162-family deductions and §179/§168(k)
expensing with charitable vehicles (§170 + DAF, §664 CRUT) and entity/trust structures
(§831(b) captive, dynasty trust). The user wants a system that (1) searches out which
combinations apply to their facts and (2) instructs how to apply them, step by step.

Two of the requested structures sit in IRS enforcement crosshairs and must be modeled
with explicit abuse boundaries (approved decision, conservation-easement precedent):

- **§831(b) micro-captives**: legitimate when there is real insurance risk; certain
  configurations are **listed transactions / transactions of interest** under the final
  regs (T.D. 10029, Jan 2025) and a perennial Dirty Dozen item.
- **"§643(b) dynasty trust"** as promoted online (income allocated to corpus escapes
  tax) is **a scam** — §643(b) merely defines fiduciary-accounting income; §641 taxes
  the trust regardless. IRS warned in the 2023 Dirty Dozen (IR-2023-65). The *real*
  planning tool is the GST-exempt dynasty trust (estate/GST, not income elimination),
  plus narrow non-grantor uses (SALT-cap/QSBS multiplication, constrained by §643(f)).

## Decisions made with the user

- Deliverable: an engine feature — curated **strategy stacks** discovered by the
  scanner from the user's facts, each with an authored application playbook.
- Flagged items are modeled fully with abuse boundaries, not excluded and not
  presented as clean recommendations.
- Discovery is deterministic (roll-up of per-benefit rule results). No emergent
  graph search, no AI-generated combinations. Instructions are hand-authored YAML.

## Architecture

A stack is **a pure function of member benefit results**. The existing scan runs
unchanged; a new pass loads `tax_library/stacks/*.yaml`, looks up each member's
`ScanResult`, and rolls them up into a `StackResult` with the authored playbook
attached. No evaluation logic is duplicated; a stack can never disagree with the
per-benefit scan.

## Components

### 1. Four new benefit YAMLs + rule functions

New entries in `tax_library/federal/`, each with a matching rule function in
`backend-ts/src/domain/scanner/rules.ts` (same `rules[id]` registry pattern), and
each following the existing YAML schema including `stacking_rules`, `risk_level`,
`planning_notes`, `review_required`.

| id | Section(s) | Core modeling | Risk framing |
|---|---|---|---|
| `831b-microcaptive` | §831(b), §162 | Captive insurance co. electing tax only on investment income; premiums deductible to operating business under §162; 2025 premium ceiling $2.85M (indexed); ≤20% of premiums from any one policyholder | `high`. Abuse boundary: T.D. 10029 listed-transaction / transaction-of-interest factors (low loss ratios, circular financing); requires genuine risk distribution & arm's-length pricing; cpa+attorney |
| `crut-664` | §664, §170 | Charitable remainder unitrust: contribute appreciated assets, no gain on trust's sale, 5–50% unitrust payout, 10% remainder test, §170 deduction = PV of remainder (AGI ceilings by charity type), §664(b) four-tier distribution taxation | `medium`. Legitimate; boundary notes on abusive early-termination and dealer-property schemes; cpa+attorney |
| `donor-advised-fund` | §170, §4966 | DAF at sponsoring org: immediate §170 deduction (60% AGI cash / 30% appreciated LT stock at FMV), grant timing decoupled ("bunching" against the standard deduction), §4966/§4967 excise boundaries | `low`. Legitimate; note pending payout-requirement proposals |
| `nongrantor-dynasty-trust` | §§641–643, GST ch. 13 | The honest entry: dynasty trust = GST-exemption leverage ($13.99M 2025) for estate/GST planning; non-grantor trusts pay compressed-bracket income tax (37% ≈ $15.6k); narrow legitimate income-tax uses (SALT-cap/QSBS multiplication) constrained by §643(f) anti-multiplication | `high`. The entry's planning_notes explicitly debunk the promoted "§643(b) untaxed corpus" scheme as the 2023 Dirty Dozen scam it is; cpa+attorney |

No new generic §162 entry: the library already covers the §162 family
(home-office, business-vehicle, augusta-rule, s-corp-election); stacks reference those.

### 2. Stack YAML schema — new `tax_library/stacks/` directory

```yaml
id: appreciated-asset-charitable-stack
kind: strategy_stack
name: Appreciated-Asset Charitable Stack (§170 + DAF + CRUT)
jurisdiction: federal
target_profile: |
  Who this fits: concentrated appreciated positions, charitable intent,
  high-income years (exit, bonus, Roth conversion).
members:
  - benefit_id: charitable-contribution-deduction
    role: "Foundation: itemized §170 deduction and AGI ceilings"
    required: true
  - benefit_id: donor-advised-fund
    role: "Bunch multiple years of giving; donate stock at FMV, gain never realized"
    required: true
  - benefit_id: crut-664
    role: "For positions too large for one year's AGI ceiling: defer gain, spread income"
    required: false
interactions: |
  Authored prose: deduction ordering, AGI-ceiling math across members,
  what feeds what, sequencing constraints.
sequence:
  - step: 1
    action: "Identify long-term appreciated positions (>1yr holding) and this year's AGI"
    timing: "Q3"
    professional: none
  - step: 2
    action: "Open DAF; transfer shares in-kind BEFORE any sale agreement"
    timing: "before 12/31"
    professional: cpa
  # …
combined_value: "Text estimate with basis, per conservation-easement style"
risk_level: low|medium|high      # max of members' levels
abuse_boundary: |
  Present when any member is flagged; rendered prominently in UI.
review_required: { cpa: true, attorney: true }
```

Three initial stacks:

1. **`business-owner-deduction-stack`** — members: s-corp-election, home-office /
   business-vehicle / augusta-rule (§162 family), section-179 + bonus-depreciation,
   optional `831b-microcaptive`. High risk when the captive member is active.
2. **`appreciated-asset-charitable-stack`** — charitable-contribution-deduction +
   donor-advised-fund + optional crut-664 (as sketched above).
3. **`exit-estate-stack`** — crut-664 + nongrantor-dynasty-trust +
   installment-sale (existing entry), for business/property exits with estate goals.

### 3. Stack evaluator — `backend-ts/src/domain/scanner/stacks.ts`

```ts
type StackMemberResult = {
  benefit_id: string; role: string; required: boolean; status: ScanStatus;
};
type StackResult = {
  stack_id: string; name: string; status: ScanStatus;
  members: StackMemberResult[];
  blocking: string[];            // required members not yet eligible
  sequence: SequenceStep[];      // the playbook, verbatim from YAML
  interactions: string;
  combined_value: string;
  risk_level: string;
  abuse_boundary: string;
  review_required: boolean;
};
```

Roll-up rules (deterministic):
- `eligible_now` — every `required` member is `eligible_now`.
- `nearly_eligible` — no required member is `not_applicable`/`expired`, and at least
  one is `nearly_eligible`/`eligible_if_changed`/`missing facts` (`unknown`).
- `not_applicable` — any required member is `not_applicable` or `expired`.
- Stack `risk_level` = max of member risk levels (optional members included only
  when their status is not `not_applicable`).

Loader validates: `kind: strategy_stack`, every `benefit_id` exists in the benefit
library (fail loudly at startup on a dangling reference), non-empty `sequence`.
`ScanRun` gains `stacks: StackResult[]`; the scan route returns it.

### 4. UI — Strategy Stacks section on the scanner results page

Stack cards above/alongside the existing per-benefit results: roll-up status chip,
member checklist (per-member status icon + role), expandable playbook (numbered
sequence with timing + professional badges), `interactions` prose, and — whenever
`risk_level: high` — the `abuse_boundary` rendered as a prominent warning callout,
not fine print. Reuses the page's existing status-chip styling.

### 5. Testing

- Rule tests for the four new benefits in the existing `rules.test.ts` pattern:
  eligible / nearly-eligible / not-applicable fact fixtures each (captive requires a
  business with substantial revenue; CRUT/DAF require appreciated assets or
  charitable intent facts; trust entry keys on estate-scale net worth).
- `stacks.test.ts`: roll-up truth table (all-eligible, one-required-blocked,
  optional-member-ignored, not_applicable propagation, risk_level max), loader
  validation failures (dangling benefit_id, missing sequence).
- Scan-route test asserting `stacks` is present and consistent with member results.
- Miner: unit test of the pure graph/scoring function (compatibility edges,
  conflict exclusion, Jaccard ranking, dangling-id warning).

### 6. Authoring aid — candidate stack miner

`backend-ts/scripts/suggestStacks.mjs` — an offline, one-shot report for the library
author (never part of the runtime scan). Method:

1. Load every benefit YAML in `tax_library/federal/`.
2. Build an undirected compatibility graph from `stacking_rules.compatible_with`
   (edge when either side names the other), dropping pairs listed in
   `conflicts_with`.
3. Score each connected pair/cluster by **fact-profile overlap** — the Jaccard
   overlap of `required_user_facts` — since benefits sharing facts fit the same
   taxpayer profile and can actually be used together.
4. Emit ranked candidate stacks: member ids, the shared fact profile, max member
   `risk_level`, and which members already appear in an authored stack (so the
   report surfaces *new* material, not what's already curated).

Output is advisory text on stdout. A candidate becomes a real stack only by an
author writing the `tax_library/stacks/` YAML — interactions and playbooks are
never generated. The graph/scoring logic lives in one pure function with a unit
test; the script is a thin CLI over it.

Data quality note: `stacking_rules` is currently unread by any code, so some
`compatible_with` references may be stale or use inconsistent ids. The miner
warns on dangling ids rather than crashing; fixing them is part of running it
for the first time.

## Out of scope (flagged)

- Dollar-precise combined-value computation (interactions are authored text +
  per-member estimates; no second calculator).
- Runtime emergent-combination discovery (the miner is authoring-time only).
- Mechanism tagging (produces/consumes attribute metadata) on all 47 existing
  YAMLs — a future enrichment that would sharpen miner scoring; fact overlap is
  the cheap proxy for now.
- State-level stacks; scenario-engine what-if integration for stacks.
- Any modeling of the promoted §643(b) scheme as a benefit — it appears only as a
  named warning inside `nongrantor-dynasty-trust`.
