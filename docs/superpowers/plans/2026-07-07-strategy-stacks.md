# Strategy Stacks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Curated multi-benefit "strategy stacks" discovered deterministically by the scanner from per-benefit results, each with a hand-authored application playbook, rendered as cards on the Dashboard.

**Architecture:** Four new benefit YAMLs + rule functions join the existing `rules[id]` registry. A new `tax_library/stacks/*.yaml` directory holds authored stack definitions; `backend-ts/src/domain/scanner/stacks.ts` rolls member `ScanResult`s up into `StackResult`s inside `runScan` (a stack is a pure function of member results — no duplicated eligibility logic). An offline miner script ranks candidate stacks for the library author.

**Tech Stack:** TypeScript/Fastify (`backend-ts`), vitest, js-yaml, React/Tailwind frontend (`frontend`), tsx for scripts.

**Spec:** `docs/superpowers/specs/2026-07-06-strategy-stacks-design.md`

## Global Constraints

- All backend commands run from `backend-ts/` (PowerShell: `cd backend-ts` first, or use the paths shown).
- Rule tests MUST live in `backend-ts/test/rules.test.ts` — the "rules parity" test greps that exact file for `id: "<rule-id>"` strings and fails if a registry rule has no test there.
- New rule functions MUST match the parity-test regex: the registry entry must be written exactly as `"<id>": (_benefit, facts) => {` (id in double quotes, `(_benefit, facts)` literal).
- Benefit YAMLs go in `tax_library/federal/` named `federal-<slug>.yaml`; ids are kebab-case and must be unique across the library.
- Stack YAMLs go in `tax_library/stacks/` with `kind: strategy_stack`. `loadBenefitLibrary()` walks ALL of `tax_library/` recursively — it must skip `kind: strategy_stack` files (Task 5 adds this guard) or stacks would be evaluated as benefits.
- Discovery is deterministic. No AI-generated combinations. Playbooks (`sequence`, `interactions`) are hand-authored YAML only.
- The promoted "§643(b) untaxed corpus" scheme is NEVER modeled as a benefit — it appears only as a debunking warning inside `nongrantor-dynasty-trust` and the exit-estate stack's `abuse_boundary` (IR-2023-65, 2023 Dirty Dozen).
- 2025 figures used in copy: §831(b) premium ceiling **$2.85M**; GST/estate exemption **$13.99M** per person (2025), **$15M** from 2026 under OBBBA; trust top bracket starts ≈ **$15,650**; CTC/standard-deduction figures come from `getTaxParamsClosest` — do not hardcode new ones.
- Validation loop (per CLAUDE.md): focused vitest → `npm test` → `npm run lint` → `npm run build`, all in `backend-ts`.
- Commit after every task, on the current `audit` branch. End commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

**Existing benefit ids referenced by stacks (all have registry rules already):** `s-corp-election`, `home-office-deduction`, `business-vehicle-deduction`, `augusta-rule`, `section-179-expensing`, `bonus-depreciation`, `charitable-contribution-deduction`, `installment-sale`.

**Status roll-up rules (used in Tasks 5–6, from the spec):**
- `not_applicable` — any required member is `not_applicable` or `expired`.
- `eligible_now` — every required member is `eligible_now`.
- `nearly_eligible` — everything else (covers required members in `nearly_eligible`, `eligible_if_changed`, `unknown`, `future_opportunity`, `high_risk`).
- `risk_level` = max member risk (required members always counted; optional members counted only when their status is not `not_applicable`/`expired`). Risk names normalize: `low`=0, `medium`/`moderate`=1, `high`/`aggressive`/`high_review_required`=2; output names are `low`/`medium`/`high`.

---

### Task 1: Donor-Advised Fund benefit (YAML + rule + tests)

**Files:**
- Create: `tax_library/federal/federal-donor-advised-fund.yaml`
- Modify: `backend-ts/src/domain/scanner/rules.ts` (add one entry to the `rules` registry, e.g. after `"charitable-contribution-deduction"` around line 1235)
- Test: `backend-ts/test/rules.test.ts` (append inside the existing `describe("rules parity", ...)` block or a new `describe`)

**Interfaces:**
- Consumes: `facts.hasAppreciatedTaxableStock(): boolean`, `facts.itemizing(): boolean | null` (both already exist in `userFacts.ts`).
- Produces: registry rule `"donor-advised-fund"`; benefit YAML id `donor-advised-fund` (Task 6's charitable stack references it).

- [ ] **Step 1: Write the failing tests** — append to `backend-ts/test/rules.test.ts`:

```ts
describe("strategy-stack benefit rules", () => {
  const minimalBenefit = (id: string, name: string) => ({
    id,
    name,
    category: "individual_deduction",
    jurisdiction: "federal",
    risk_level: "low",
    required_forms: [],
    required_documents: [],
    review_required: {}
  });

  test("donor-advised-fund eligible now with appreciated stock", () => {
    const result = evaluateBenefit(
      minimalBenefit("donor-advised-fund", "Donor-Advised Fund"),
      makeFacts({
        investments: { taxable_accounts: [{ unrealized_gains: 80000 }] }
      })
    );
    expect(result.status).toBe("eligible_now");
    expect(result.next_steps.length).toBeGreaterThan(0);
  });

  test("donor-advised-fund eligible now when itemizing without appreciated stock", () => {
    const result = evaluateBenefit(
      minimalBenefit("donor-advised-fund", "Donor-Advised Fund"),
      makeFacts({ household: { itemizing_deductions: true } })
    );
    expect(result.status).toBe("eligible_now");
  });

  test("donor-advised-fund nearly eligible with no facts", () => {
    const result = evaluateBenefit(
      minimalBenefit("donor-advised-fund", "Donor-Advised Fund"),
      makeFacts({})
    );
    expect(result.status).toBe("nearly_eligible");
    expect(result.missing_facts).toContain("household.itemizing_deductions");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (from `backend-ts/`): `npx vitest run test/rules.test.ts -t "donor-advised-fund"`
Expected: 3 FAIL — status is `"unknown"` (no rule registered yet). The parity test `every direct regression test targets a current scanner rule id` will also FAIL when running the whole file — expected until Step 4.

- [ ] **Step 3: Create the benefit YAML** — `tax_library/federal/federal-donor-advised-fund.yaml`:

```yaml
id: donor-advised-fund
name: Donor-Advised Fund (DAF) — §170 / §4966
category: individual_deduction
jurisdiction: federal

authority:
  irc_section: "170; 4966"
  irs_publication: "526"
  form_instruction: "Instructions for Form 8283"
  state_source: null

status: active
benefit_type: deduction

summary: |
  A donor-advised fund at a sponsoring organization gives an immediate §170
  deduction (60% of AGI for cash, 30% for long-term appreciated stock at full
  FMV) while grants to operating charities happen on your own schedule. The
  timing decoupling enables "bunching" several years of giving into one
  deduction year to clear the standard deduction, and donating appreciated
  shares in-kind means the capital gain is never realized.

estimated_value:
  typical_range: "$5,000 – $100,000+/year depending on giving levels and appreciation"
  calculation_basis: "Contribution × marginal rate, plus capital-gains tax avoided on donated shares"
  depends_on: [donation_amount, unrealized_gains, itemizing, marginal_rate]

eligibility_rules:
  - rule: "Contribution to a sponsoring organization's DAF is a completed gift — irrevocable"
  - rule: "Cash contributions: 60% of AGI ceiling; long-term appreciated securities: 30% of AGI at FMV"
  - rule: "Securities held ≤1 year deduct at basis, not FMV — hold past one year before donating"
  - rule: "Non-cash gifts over $500 require Form 8283; publicly traded securities need no appraisal"
  - rule: "§4966/§4967 excise taxes on taxable distributions and donor benefit — grants must be to public charities with no personal benefit"

phaseouts:
  - rule: "Excess over AGI ceilings carries forward 5 years"

required_user_facts:
  - fact: "household.itemizing_deductions"
  - fact: "household.estimated_agi"
  - fact: "investments.taxable_accounts[*].unrealized_gains"

required_documents:
  - document: "DAF sponsoring-organization contribution confirmation"
  - document: "Brokerage in-kind transfer confirmation for donated shares"
  - document: "Form 8283 for non-cash gifts over $500"

required_forms:
  - form: "Schedule A (itemized deductions)"
  - form: "Form 8283 (non-cash charitable contributions over $500)"

deadlines:
  - deadline: "Contribution must be completed (shares received by sponsor) by December 31"
  - deadline: "Start in-kind transfers by November — year-end brokerage queues run weeks"

stacking_rules:
  compatible_with: [charitable-contribution-deduction, crut-664, capital-gains-harvesting]
  conflicts_with:
    - rule: "A QCD cannot go to a DAF — QCDs require an operating charity"

risk_level: low

planning_notes: |
  - Bunching: contribute 2-3 years of planned giving in one high-income year, grant it out over time
  - Always donate long-term appreciated shares in-kind rather than cash from selling them
  - Legislative watch: payout-requirement proposals for DAFs recur in Congress; none enacted as of 2025
  - Sponsor fees (typically 0.6%/yr tiers) are the cost of the timing flexibility

qualification_pathways:
  - "If using the standard deduction: bunch giving via a DAF to exceed it in alternating years"
  - "If holding long-term appreciated stock: donate shares in-kind for FMV deduction plus gain avoidance"

review_required:
  cpa: false
  attorney: false

last_verified: 2026-07-07
next_review: 2027-07-01
```

- [ ] **Step 4: Add the rule** — in `backend-ts/src/domain/scanner/rules.ts`, immediately after the `"charitable-contribution-deduction"` entry's closing `},`:

```ts
  "donor-advised-fund": (_benefit, facts) => {
    if (facts.hasAppreciatedTaxableStock()) {
      return {
        status: "eligible_now",
        message:
          "Appreciated positions in taxable accounts — donate long-term shares to a DAF in-kind at full fair market value (30% AGI ceiling): the gain is never realized and grants can be spread over years.",
        next_steps: [
          "Open a DAF at a sponsoring organization (most major brokerages offer one)",
          "Contribute long-term appreciated shares in-kind, not cash from selling them",
          "Bunch 2-3 years of planned giving into one contribution to clear the standard deduction",
          "Grant to operating charities on your own schedule"
        ]
      };
    }

    if (facts.itemizing() === true) {
      return {
        status: "eligible_now",
        message:
          "Itemizing confirmed — a DAF takes the full §170 deduction this year (60% AGI ceiling for cash) while grants to charities follow on your schedule.",
        next_steps: ["Consider bunching future years' planned giving into the current-year DAF contribution"]
      };
    }

    return {
      status: "nearly_eligible",
      message:
        "A DAF pays off when you have appreciated stock to donate or enough giving to itemize — record unrealized gains and itemization status.",
      missing_facts: [
        "investments.taxable_accounts[*].unrealized_gains",
        "household.itemizing_deductions"
      ]
    };
  },
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run test/rules.test.ts`
Expected: PASS, including both parity tests (rule + tests now both exist).

- [ ] **Step 6: Commit**

```powershell
git add tax_library/federal/federal-donor-advised-fund.yaml backend-ts/src/domain/scanner/rules.ts backend-ts/test/rules.test.ts
git commit -m "feat(scanner): donor-advised-fund benefit + rule"
```

---

### Task 2: CRUT §664 benefit (accessor + YAML + rule + tests)

**Files:**
- Create: `tax_library/federal/federal-crut.yaml`
- Modify: `backend-ts/src/domain/scanner/userFacts.ts` (add `totalUnrealizedTaxableGains()` next to `hasAppreciatedTaxableStock()` ~line 498)
- Modify: `backend-ts/src/domain/scanner/rules.ts`
- Test: `backend-ts/test/rules.test.ts`

**Interfaces:**
- Consumes: `facts.hasAppreciatedTaxableStock()` (existing).
- Produces: `UserFacts.totalUnrealizedTaxableGains(): number` (sums `investments.taxable_accounts[*].unrealized_gains`); registry rule `"crut-664"`; benefit id `crut-664` (referenced by both the charitable and exit-estate stacks in Task 6).

- [ ] **Step 1: Write the failing tests** — append inside the `describe("strategy-stack benefit rules", ...)` block from Task 1:

```ts
  test("crut-664 eligible now with large unrealized gains", () => {
    const result = evaluateBenefit(
      minimalBenefit("crut-664", "Charitable Remainder Unitrust"),
      makeFacts({
        investments: { taxable_accounts: [{ unrealized_gains: 400000 }] }
      })
    );
    expect(result.status).toBe("eligible_now");
    expect(result.message).toContain("400,000");
  });

  test("crut-664 not applicable when gains are below setup-cost threshold", () => {
    const result = evaluateBenefit(
      minimalBenefit("crut-664", "Charitable Remainder Unitrust"),
      makeFacts({
        investments: { taxable_accounts: [{ unrealized_gains: 50000 }] }
      })
    );
    expect(result.status).toBe("not_applicable");
  });

  test("crut-664 not applicable with no appreciated assets", () => {
    const result = evaluateBenefit(
      minimalBenefit("crut-664", "Charitable Remainder Unitrust"),
      makeFacts({})
    );
    expect(result.status).toBe("not_applicable");
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/rules.test.ts -t "crut-664"`
Expected: FAIL — status `"unknown"`.

- [ ] **Step 3: Create the benefit YAML** — `tax_library/federal/federal-crut.yaml`:

```yaml
id: crut-664
name: Charitable Remainder Unitrust (CRUT) — §664
category: estate
jurisdiction: federal

authority:
  irc_section: "664; 170"
  irs_publication: "526; 4302"
  form_instruction: "Instructions for Form 5227"
  state_source: null

status: active
benefit_type: deferral

summary: |
  Contribute appreciated assets to a charitable remainder unitrust: the trust
  sells without recognizing gain, pays you 5–50% of trust value annually for
  life or a term of years, and the remainder passes to charity. You get an
  immediate §170 deduction equal to the present value of the charitable
  remainder (which must be at least 10% of the contribution). Distributions
  are taxed under the §664(b) four-tier ordering: ordinary income first, then
  capital gain, then other income, then tax-free corpus.

estimated_value:
  typical_range: "$25,000 – $500,000+ in deferred capital-gains tax plus a PV-of-remainder deduction"
  calculation_basis: "Gain deferred on trust's sale + PV of charitable remainder × marginal rate"
  depends_on: [unrealized_gains, payout_rate, term, section_7520_rate, agi]

eligibility_rules:
  - rule: "Unitrust payout must be between 5% and 50% of annually revalued trust assets"
  - rule: "Present value of charitable remainder must be ≥10% of contributed value (§664(d)(2)(D))"
  - rule: "§170 deduction for appreciated property to a public-charity remainder: 30% of AGI ceiling, 5-year carryforward"
  - rule: "Assets must be transferred BEFORE any binding sale agreement — prearranged sales are taxed to the donor (assignment of income)"
  - rule: "No self-dealing (§4941); dealer property / inventory is unsuitable funding"

phaseouts:
  - rule: "Deduction limited to 30% of AGI (appreciated property, public charity remainder); excess carries forward 5 years"

required_user_facts:
  - fact: "investments.taxable_accounts[*].unrealized_gains"
  - fact: "household.estimated_agi"
  - fact: "goals.primary_goals.transfer_wealth_to_heirs"

required_documents:
  - document: "Executed trust instrument drafted by an attorney"
  - document: "Qualified appraisal for non-publicly-traded contributed assets"
  - document: "Brokerage transfer confirmations for funded assets"

required_forms:
  - form: "Form 5227 (Split-Interest Trust Information Return) — every year"
  - form: "Form 8283 (non-cash charitable contribution)"
  - form: "Schedule A (deduction year)"

deadlines:
  - deadline: "Trust must be drafted, executed, and funded before any binding sale agreement"
  - deadline: "Form 5227 due April 15 following each trust year"

stacking_rules:
  compatible_with: [charitable-contribution-deduction, donor-advised-fund, installment-sale, nongrantor-dynasty-trust]
  conflicts_with:
    - rule: "Assets inside a CRUT cannot also fund other transfer vehicles — decide the split first"

risk_level: medium

planning_notes: |
  - Legitimate and long-established; the flagged variants are early terminations engineered
    to strip the charity's remainder and funding with dealer property — both draw IRS
    enforcement attention
  - Model the 10% remainder test at the current §7520 rate before drafting — low rates
    make lifetime CRUTs for young donors fail the test
  - NIMCRUT / flip-CRUT variants control distribution timing for illiquid assets
  - Pair with a DAF: DAF for ceiling-sized gifts, CRUT for the concentrated block

qualification_pathways:
  - "If holding a concentrated position too large for one year's AGI ceilings: fund a CRUT before sale"
  - "If charitably inclined with a liquidity event coming: draft 60-90 days ahead"

review_required:
  cpa: true
  attorney: true

last_verified: 2026-07-07
next_review: 2027-07-01
```

- [ ] **Step 4: Add the accessor and rule**

In `backend-ts/src/domain/scanner/userFacts.ts`, directly after `hasAppreciatedTaxableStock()`:

```ts
  totalUnrealizedTaxableGains(): number {
    const investments = toObject(this.data.investments);
    const taxableAccounts = toObjectArray(investments.taxable_accounts);
    return taxableAccounts.reduce((sum, account) => sum + toNumber(account.unrealized_gains), 0);
  }
```

In `backend-ts/src/domain/scanner/rules.ts`, after the `"donor-advised-fund"` entry:

```ts
  "crut-664": (_benefit, facts) => {
    if (!facts.hasAppreciatedTaxableStock()) {
      return {
        status: "not_applicable",
        message: "A CRUT is built around appreciated assets — no unrealized gains recorded in taxable accounts."
      };
    }

    const gains = facts.totalUnrealizedTaxableGains();
    if (gains < 250000) {
      return {
        status: "not_applicable",
        message: `Unrealized gains $${gains.toLocaleString()} are below the ~$250,000 level where CRUT drafting and annual administration costs are justified — consider a donor-advised fund instead.`
      };
    }

    return {
      status: "eligible_now",
      message: `$${gains.toLocaleString()} of unrealized gains could fund a charitable remainder unitrust: no gain recognized when the trust sells, a 5–50% unitrust payout, and a §170 deduction equal to the present value of the charity's remainder (must be ≥10% of the contribution).`,
      next_steps: [
        "Model payout rate and term — the remainder must pass the 10% present-value test at the current §7520 rate",
        "Deduction is capped at 30% of AGI for appreciated property to a public charity (5-year carryforward)",
        "Distributions are taxed under §664(b) four-tier ordering — ordinary income first, then capital gain",
        "Fund the trust BEFORE any binding sale agreement exists — a prearranged sale collapses the deferral",
        "Engage an estate attorney to draft and a CPA for the annual Form 5227"
      ]
    };
  },
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run test/rules.test.ts`
Expected: PASS including parity tests.

- [ ] **Step 6: Commit**

```powershell
git add tax_library/federal/federal-crut.yaml backend-ts/src/domain/scanner/userFacts.ts backend-ts/src/domain/scanner/rules.ts backend-ts/test/rules.test.ts
git commit -m "feat(scanner): crut-664 benefit + rule + unrealized-gains accessor"
```

---

### Task 3: §831(b) micro-captive benefit (accessor + YAML + rule + tests)

**Files:**
- Create: `tax_library/federal/federal-831b-microcaptive.yaml`
- Modify: `backend-ts/src/domain/scanner/userFacts.ts` (add `firstBusinessGrossRevenue()` next to `firstBusinessNetProfit()` ~line 351)
- Modify: `backend-ts/src/domain/scanner/rules.ts`
- Test: `backend-ts/test/rules.test.ts`

**Interfaces:**
- Consumes: `facts.businesses()` (existing).
- Produces: `UserFacts.firstBusinessGrossRevenue(): number` (reads `businesses.businesses[0].financials.gross_revenue`); registry rule `"831b-microcaptive"`; benefit id `831b-microcaptive` (business-owner stack member in Task 6).

Note: the captive's ceiling status is `nearly_eligible`, never `eligible_now` — the scanner cannot verify an existing captive with genuine risk distribution, so "structure work remains" is always true. This is a deliberate deviation from a plain eligible/nearly/NA ladder; the stack lists it as an optional member so it never blocks stack eligibility.

- [ ] **Step 1: Write the failing tests** — append inside the same describe block:

```ts
  test("831b-microcaptive nearly eligible for a high-revenue business", () => {
    const result = evaluateBenefit(
      minimalBenefit("831b-microcaptive", "Micro-Captive Insurance"),
      makeFacts({
        businesses: {
          businesses: [{ entity_type: "s_corp", financials: { gross_revenue: 3000000 } }]
        }
      })
    );
    expect(result.status).toBe("nearly_eligible");
    expect(result.message).toContain("T.D. 10029");
  });

  test("831b-microcaptive nearly eligible with business but no revenue recorded", () => {
    const result = evaluateBenefit(
      minimalBenefit("831b-microcaptive", "Micro-Captive Insurance"),
      makeFacts({
        businesses: { businesses: [{ entity_type: "llc_single" }] }
      })
    );
    expect(result.status).toBe("nearly_eligible");
    expect(result.missing_facts).toContain("businesses.financials.gross_revenue");
  });

  test("831b-microcaptive not applicable below revenue threshold", () => {
    const result = evaluateBenefit(
      minimalBenefit("831b-microcaptive", "Micro-Captive Insurance"),
      makeFacts({
        businesses: {
          businesses: [{ entity_type: "sole_prop", financials: { gross_revenue: 400000 } }]
        }
      })
    );
    expect(result.status).toBe("not_applicable");
  });

  test("831b-microcaptive not applicable with no business", () => {
    const result = evaluateBenefit(
      minimalBenefit("831b-microcaptive", "Micro-Captive Insurance"),
      makeFacts({})
    );
    expect(result.status).toBe("not_applicable");
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/rules.test.ts -t "831b"`
Expected: 4 FAIL — status `"unknown"`.

- [ ] **Step 3: Create the benefit YAML** — `tax_library/federal/federal-831b-microcaptive.yaml`:

```yaml
id: 831b-microcaptive
name: Micro-Captive Insurance Company — §831(b)
category: business_deduction
jurisdiction: federal

authority:
  irc_section: "831(b); 162"
  irs_publication: "T.D. 10029 (Reg. §§1.6011-10, 1.6011-11)"
  form_instruction: "Instructions for Form 8886"
  state_source: null

status: active
benefit_type: deduction

summary: |
  A captive insurance company electing §831(b) is taxed only on investment
  income, while premiums the operating business pays it are deductible under
  §162 — IF the arrangement is insurance in the commonly accepted sense: real
  risk shifting, real risk distribution, arm's-length actuarial pricing, and
  claims actually paid. The 2025 premium ceiling is $2.85M (indexed), with a
  diversification requirement (no more than 20% of net written premiums from
  any one policyholder, or the ownership look-through alternative).

estimated_value:
  typical_range: "$50,000 – $1,000,000+/year of premium moved to a 0%-on-underwriting vehicle"
  calculation_basis: "Deductible premium × marginal rate, less formation/admin costs ($50k–$100k+/yr)"
  depends_on: [gross_revenue, insurable_risks, premium_pricing, loss_ratio]

eligibility_rules:
  - rule: "Must be a genuine insurance company: risk shifting + risk distribution (Avrahami, Syzygy, Caylor line of cases)"
  - rule: "§831(b) election: net written premiums ≤ $2.85M (2025, indexed)"
  - rule: "Diversification: ≤20% of net written premiums from any one policyholder, or spouse/lineal-descendant ownership look-through"
  - rule: "Premiums must be actuarially determined at arm's length — never reverse-engineered from a deduction target"
  - rule: "Claims process must be real and used; policies must cover plausible, non-duplicative risks"

phaseouts:
  - rule: "Election unavailable above the indexed premium ceiling; graduate to §831(a) taxation"

required_user_facts:
  - fact: "businesses.financials.gross_revenue"
  - fact: "businesses.entity_type"

required_documents:
  - document: "Independent feasibility study identifying real uninsured risks"
  - document: "Actuarial premium-pricing report"
  - document: "Captive domicile license and policies issued"
  - document: "Form 8886 disclosures if T.D. 10029 factors are met"

required_forms:
  - form: "Form 1120-PC (captive's return) with §831(b) election"
  - form: "Form 8886 (Reportable Transaction Disclosure) when required"

deadlines:
  - deadline: "Premiums deductible only once coverage is bound — 6-9 month formation lead time"
  - deadline: "Form 8886 due with the return for each year of participation in a reportable transaction"

stacking_rules:
  compatible_with: [s-corp-election, section-179-expensing]
  conflicts_with:
    - rule: "Circular financing (captive lending reserves back to the insured or its owners) is a listed-transaction factor"

risk_level: high

planning_notes: |
  ABUSE BOUNDARY (the reason this entry is flagged): under T.D. 10029 (final regs,
  January 2025), a §831(b) captive is a LISTED TRANSACTION when its loss ratio is
  under 30% (10-year window) and financing flows back to insureds/owners, and a
  TRANSACTION OF INTEREST when the loss ratio is under 60%. Listed status means
  mandatory Form 8886/8918 disclosure, promoter penalties, and near-certain exam.
  Micro-captives are a perennial IRS Dirty Dozen item; the IRS record in Tax Court
  (Avrahami, Syzygy, Caylor) is built on premiums priced to the deduction, duplicate
  coverage, and no claims. The legitimate version exists — manufacturers, contractors,
  medical groups with real uninsured exposure — but only with independent actuaries
  and real claims. Never buy from a turnkey promoter.

qualification_pathways:
  - "If revenue ~$1M+ with genuine uninsured risks: commission an independent feasibility study"

review_required:
  cpa: true
  attorney: true

last_verified: 2026-07-07
next_review: 2027-07-01
```

- [ ] **Step 4: Add the accessor and rule**

In `backend-ts/src/domain/scanner/userFacts.ts`, directly after `firstBusinessNetProfit()`:

```ts
  firstBusinessGrossRevenue(): number {
    const biz = this.firstBusiness();
    const financials = toObject(biz.financials);
    return toNumber(financials.gross_revenue);
  }
```

In `backend-ts/src/domain/scanner/rules.ts`, after the `"crut-664"` entry:

```ts
  "831b-microcaptive": (_benefit, facts) => {
    if (facts.businesses().length === 0) {
      return {
        status: "not_applicable",
        message: "Micro-captive insurance requires an operating business — none recorded."
      };
    }

    const revenue = facts.firstBusinessGrossRevenue();
    if (revenue <= 0) {
      return {
        status: "nearly_eligible",
        message: "Has a business — record gross revenue to assess whether captive economics can make sense.",
        missing_facts: ["businesses.financials.gross_revenue"],
        next_steps: ["Record gross revenue under business financials"]
      };
    }

    if (revenue < 1000000) {
      return {
        status: "not_applicable",
        message: `Business revenue $${revenue.toLocaleString()} is below the ~$1M level where captive formation and annual administration costs (typically $50k–$100k/year) can be justified by genuine insurance needs.`
      };
    }

    return {
      status: "nearly_eligible",
      message: `Business revenue $${revenue.toLocaleString()} could support a §831(b) captive (2025 premium ceiling $2.85M) — but only with real insurance risk. CAUTION: low-loss-ratio and circular-financing configurations are listed transactions / transactions of interest under T.D. 10029 (Jan 2025).`,
      next_steps: [
        "Commission an independent feasibility study identifying real, material, uninsured business risks",
        "Premiums must be actuarially priced at arm's length — never reverse-engineered from a deduction target",
        "Verify diversification: ≤20% of net written premiums from any one policyholder",
        "Expect Form 8886 disclosure obligations if loss-ratio or financing factors under T.D. 10029 are met",
        "Engage both a CPA and an attorney experienced in captives — avoid turnkey promoters"
      ]
    };
  },
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run test/rules.test.ts`
Expected: PASS including parity tests.

- [ ] **Step 6: Commit**

```powershell
git add tax_library/federal/federal-831b-microcaptive.yaml backend-ts/src/domain/scanner/userFacts.ts backend-ts/src/domain/scanner/rules.ts backend-ts/test/rules.test.ts
git commit -m "feat(scanner): 831b-microcaptive benefit + rule with T.D. 10029 abuse boundary"
```

---

### Task 4: Non-grantor dynasty trust benefit (schema field + accessor + YAML + rule + tests)

**Files:**
- Create: `tax_library/federal/federal-nongrantor-dynasty-trust.yaml`
- Modify: `frontend/src/schemas/household.js` (add `estimated_net_worth` currency field directly after the `prior_year_agi` field, ~line 94)
- Modify: `backend-ts/src/domain/scanner/userFacts.ts` (add `estimatedNetWorth()` next to `estimatedAgi()` ~line 152)
- Modify: `backend-ts/src/domain/scanner/rules.ts`
- Test: `backend-ts/test/rules.test.ts`

**Interfaces:**
- Consumes: `facts.transferWealthGoal(): boolean | null` (existing).
- Produces: `UserFacts.estimatedNetWorth(): number` (reads `household.estimated_net_worth`); registry rule `"nongrantor-dynasty-trust"`; benefit id `nongrantor-dynasty-trust` (exit-estate stack member); new My Data field `household.estimated_net_worth`.

- [ ] **Step 1: Write the failing tests** — append inside the same describe block:

```ts
  test("nongrantor-dynasty-trust eligible now at estate-scale net worth", () => {
    const result = evaluateBenefit(
      minimalBenefit("nongrantor-dynasty-trust", "Non-Grantor Dynasty Trust"),
      makeFacts({ household: { estimated_net_worth: 18000000 } })
    );
    expect(result.status).toBe("eligible_now");
    expect(result.next_steps.join(" ")).toContain("IR-2023-65");
  });

  test("nongrantor-dynasty-trust nearly eligible with wealth-transfer goal but no net worth", () => {
    const result = evaluateBenefit(
      minimalBenefit("nongrantor-dynasty-trust", "Non-Grantor Dynasty Trust"),
      makeFacts({ goals: { primary_goals: { transfer_wealth_to_heirs: true } } })
    );
    expect(result.status).toBe("nearly_eligible");
    expect(result.missing_facts).toContain("household.estimated_net_worth");
  });

  test("nongrantor-dynasty-trust not applicable below estate-exemption territory", () => {
    const result = evaluateBenefit(
      minimalBenefit("nongrantor-dynasty-trust", "Non-Grantor Dynasty Trust"),
      makeFacts({ household: { estimated_net_worth: 2000000 } })
    );
    expect(result.status).toBe("not_applicable");
  });

  test("nongrantor-dynasty-trust not applicable with no goal and no net worth", () => {
    const result = evaluateBenefit(
      minimalBenefit("nongrantor-dynasty-trust", "Non-Grantor Dynasty Trust"),
      makeFacts({})
    );
    expect(result.status).toBe("not_applicable");
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/rules.test.ts -t "dynasty"`
Expected: 4 FAIL — status `"unknown"`.

- [ ] **Step 3: Create the benefit YAML** — `tax_library/federal/federal-nongrantor-dynasty-trust.yaml`:

```yaml
id: nongrantor-dynasty-trust
name: GST-Exempt Dynasty Trust (Non-Grantor) — §§641–643, Ch. 13
category: estate
jurisdiction: federal

authority:
  irc_section: "641-643; 2631"
  irs_publication: "IR-2023-65 (Dirty Dozen warning)"
  form_instruction: "Instructions for Forms 709 and 1041"
  state_source: null

status: active
benefit_type: exclusion

summary: |
  The honest version: a dynasty trust is an ESTATE/GST tool, not an income-tax
  eliminator. Allocating GST exemption ($13.99M per person in 2025; $15M from
  2026 under OBBBA) to a long-duration trust removes the assets AND all their
  future growth from estate and generation-skipping tax for as many generations
  as state law allows. A non-grantor dynasty trust pays its own income tax at
  compressed brackets (the 37% bracket starts around $15,650), which is a COST,
  accepted in exchange for narrow benefits: its own SALT deduction and its own
  QSBS §1202 exclusion — both constrained by the §643(f) anti-multiplication rule.

estimated_value:
  typical_range: "$1M – $10M+ of estate/GST tax avoided on sheltered growth (40% × appreciation)"
  calculation_basis: "Future appreciation removed from the taxable estate × 40% estate/GST rate"
  depends_on: [net_worth, expected_growth, gst_exemption_remaining, state_situs]

eligibility_rules:
  - rule: "Meaningful only when net worth approaches the estate/GST exemption ($13.99M single / $27.98M married, 2025)"
  - rule: "GST exemption must be affirmatively allocated (Form 709) at funding"
  - rule: "Trust must be drafted in a state permitting long/perpetual trusts (SD, NV, DE, AK, etc.)"
  - rule: "Non-grantor status requires giving up grantor powers — no revocability, no swap powers"
  - rule: "§643(f): multiple trusts with substantially the same grantors and beneficiaries and a principal purpose of tax avoidance are aggregated"

phaseouts:
  - rule: "Exemption is per-person and use-it-or-lose-it against lifetime gifts; OBBBA set $15M from 2026"

required_user_facts:
  - fact: "household.estimated_net_worth"
  - fact: "goals.primary_goals.transfer_wealth_to_heirs"

required_documents:
  - document: "Executed irrevocable trust instrument"
  - document: "Form 709 gift-tax return with GST exemption allocation"
  - document: "Appraisals for hard-to-value funded assets"

required_forms:
  - form: "Form 709 (gift/GST) in the funding year"
  - form: "Form 1041 (trust income tax) annually"

deadlines:
  - deadline: "Form 709 due April 15 following the funding year"
  - deadline: "Fund before major appreciation events — pre-exit valuations shelter more growth per exemption dollar"

stacking_rules:
  compatible_with: [crut-664, installment-sale, annual-gift-tax-exclusion, qsbs-exclusion]
  conflicts_with:
    - rule: "Assets funded into a CRUT cannot also fund the dynasty trust"

risk_level: high

planning_notes: |
  SCAM WARNING (the reason this entry is flagged): the "§643(b) trust" promoted
  online — claiming income allocated to corpus escapes taxation — is a fraud the
  IRS named in the 2023 Dirty Dozen (IR-2023-65). §643(b) merely defines
  fiduciary-accounting income; §641 taxes the trust's taxable income regardless
  of what the deed labels corpus. Promoters sell these as "non-grantor complex
  discretionary spendthrift trusts" with copyright/mineral-rights garnish; buyers
  face back taxes, fraud penalties, and promoter-client privilege does not exist.
  This entry NEVER recommends that scheme. The legitimate tools are: GST-exemption
  leverage for estate tax, plus narrow non-grantor income-tax uses (a trust-level
  SALT deduction, per-trust QSBS §1202 capacity) that survive §643(f) only with
  genuinely different beneficiaries or non-tax purposes.

qualification_pathways:
  - "If net worth approaches the exemption with transfer goals: engage an estate attorney before the next liquidity event"

review_required:
  cpa: true
  attorney: true

last_verified: 2026-07-07
next_review: 2027-07-01
```

- [ ] **Step 4: Add the schema field, accessor, and rule**

In `frontend/src/schemas/household.js`, directly after the `prior_year_agi` field object:

```js
        {
          key: "estimated_net_worth",
          label: "Estimated Net Worth",
          type: "currency",
          description: "Rough total of everything you own minus everything you owe. Only used to flag estate-scale planning (the estate/GST exemption is $13.99M per person in 2025).",
          source: "Add up accounts, real estate, and business value; subtract mortgages and other debts. A rough estimate is fine.",
        },
```

In `backend-ts/src/domain/scanner/userFacts.ts`, directly after `estimatedAgi()`:

```ts
  estimatedNetWorth(): number {
    const hh = toObject(this.data.household);
    return toNumber(hh.estimated_net_worth);
  }
```

In `backend-ts/src/domain/scanner/rules.ts`, after the `"831b-microcaptive"` entry:

```ts
  "nongrantor-dynasty-trust": (_benefit, facts) => {
    const netWorth = facts.estimatedNetWorth();

    if (netWorth <= 0) {
      if (facts.transferWealthGoal() === true) {
        return {
          status: "nearly_eligible",
          message: "Wealth-transfer goal set — record estimated net worth to assess whether GST-exempt dynasty trust planning applies (2025 exemption $13.99M per person).",
          missing_facts: ["household.estimated_net_worth"]
        };
      }
      return {
        status: "not_applicable",
        message: "Dynasty trust planning is an estate/GST tool — no wealth-transfer goal or net worth recorded."
      };
    }

    if (netWorth < 10000000) {
      return {
        status: "not_applicable",
        message: `Estimated net worth $${netWorth.toLocaleString()} is below estate/GST exemption territory ($13.99M per person in 2025; $15M from 2026 under OBBBA) — a dynasty trust adds cost and complexity without estate-tax benefit at this level.`
      };
    }

    return {
      status: "eligible_now",
      message: `Estimated net worth $${netWorth.toLocaleString()} approaches the estate/GST exemption — a GST-exempt dynasty trust locks in today's $13.99M per-person exemption across generations. NOTE: this is estate/GST leverage, NOT income-tax elimination; a non-grantor trust pays compressed-bracket income tax (37% bracket starts ≈ $15,650).`,
      next_steps: [
        "Engage an estate attorney — the trust must be irrevocable and GST exemption allocated on Form 709",
        "Beware promoted \"§643(b) untaxed corpus\" schemes — an IRS Dirty Dozen scam (IR-2023-65); §641 taxes trust income regardless of corpus allocation",
        "Narrow income-tax uses (trust-level SALT deduction, per-trust QSBS capacity) are constrained by the §643(f) anti-multiplication rule",
        "Coordinate with a CPA on annual Form 1041 and long-duration state situs (SD, NV, DE, AK)"
      ]
    };
  },
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run test/rules.test.ts`
Expected: PASS including parity tests.

- [ ] **Step 6: Commit**

```powershell
git add tax_library/federal/federal-nongrantor-dynasty-trust.yaml frontend/src/schemas/household.js backend-ts/src/domain/scanner/userFacts.ts backend-ts/src/domain/scanner/rules.ts backend-ts/test/rules.test.ts
git commit -m "feat(scanner): nongrantor-dynasty-trust benefit + rule + net-worth field"
```

---

### Task 5: Stack engine — types, evaluator, loader, scan wiring

**Files:**
- Create: `backend-ts/src/domain/scanner/stacks.ts`
- Modify: `backend-ts/src/domain/scanner/types.ts` (add stack types + `ScanRun.stacks`)
- Modify: `backend-ts/src/domain/scanner/benefitLoader.ts` (skip `kind: strategy_stack` files)
- Modify: `backend-ts/src/domain/scanner/scan.ts` (wire stacks into `runScan`)
- Test: `backend-ts/test/stacks.test.ts` (new file)

**Interfaces:**
- Consumes: `ScanResult`, `ScanStatus` from `./types`; `projectPaths.taxLibrary` from `../../lib/paths`.
- Produces (used by Tasks 6–8):
  - Types in `types.ts`: `SequenceStep { step: number; action: string; timing: string; professional: string }`, `StackMemberResult { benefit_id: string; role: string; required: boolean; status: ScanStatus }`, `StackResult { stack_id: string; name: string; target_profile: string; status: ScanStatus; members: StackMemberResult[]; blocking: string[]; sequence: SequenceStep[]; interactions: string; combined_value: string; risk_level: string; abuse_boundary: string; review_required: boolean }`, and `ScanRun` gains `stacks: StackResult[]`.
  - `stacks.ts`: `parseStack(raw: Record<string, unknown>, knownBenefitIds: Set<string>, source: string): RawStack` (throws Error on invalid), `loadStacks(knownBenefitIds: Set<string>): RawStack[]`, `evaluateStack(stack: RawStack, resultsById: Map<string, ScanResult>): StackResult`, `riskRank(level: string): number`, `RISK_NAMES: readonly string[]` (`["low","medium","high"]`).

- [ ] **Step 1: Write the failing tests** — create `backend-ts/test/stacks.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { parseStack, evaluateStack, riskRank } from "../src/domain/scanner/stacks";
import type { RawStack } from "../src/domain/scanner/stacks";
import type { ScanResult, ScanStatus } from "../src/domain/scanner/types";

const KNOWN = new Set(["benefit-a", "benefit-b", "benefit-c"]);

function rawStackYaml(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "test-stack",
    kind: "strategy_stack",
    name: "Test Stack",
    jurisdiction: "federal",
    target_profile: "Test profile",
    members: [
      { benefit_id: "benefit-a", role: "Foundation", required: true },
      { benefit_id: "benefit-b", role: "Layer", required: true },
      { benefit_id: "benefit-c", role: "Optional layer", required: false }
    ],
    interactions: "Some prose",
    sequence: [{ step: 1, action: "Do the thing", timing: "Q1", professional: "cpa" }],
    combined_value: "Some value",
    abuse_boundary: "",
    review_required: { cpa: true, attorney: false },
    ...overrides
  };
}

function member(id: string, status: ScanStatus, risk = "low"): [string, ScanResult] {
  return [
    id,
    {
      benefit_id: id,
      benefit_name: id,
      category: "x",
      jurisdiction: "federal",
      status,
      estimated_value: "",
      risk_level: risk,
      message: "",
      next_steps: [],
      missing_facts: [],
      changes_needed: [],
      documents_needed: [],
      forms_required: [],
      phaseout_note: "",
      review_required: false
    }
  ];
}

function stack(): RawStack {
  return parseStack(rawStackYaml(), KNOWN, "test.yaml");
}

describe("parseStack validation", () => {
  test("accepts a valid stack", () => {
    const parsed = stack();
    expect(parsed.id).toBe("test-stack");
    expect(parsed.members).toHaveLength(3);
    expect(parsed.review_required).toBe(true);
  });

  test("throws on dangling benefit_id", () => {
    const bad = rawStackYaml({
      members: [{ benefit_id: "no-such-benefit", role: "x", required: true }]
    });
    expect(() => parseStack(bad, KNOWN, "test.yaml")).toThrow(/no-such-benefit/);
  });

  test("throws on wrong kind", () => {
    expect(() => parseStack(rawStackYaml({ kind: "benefit" }), KNOWN, "test.yaml")).toThrow(/kind/);
  });

  test("throws on empty sequence", () => {
    expect(() => parseStack(rawStackYaml({ sequence: [] }), KNOWN, "test.yaml")).toThrow(/sequence/);
  });

  test("throws on empty members", () => {
    expect(() => parseStack(rawStackYaml({ members: [] }), KNOWN, "test.yaml")).toThrow(/members/);
  });
});

describe("evaluateStack roll-up truth table", () => {
  test("all required eligible_now -> eligible_now", () => {
    const result = evaluateStack(
      stack(),
      new Map([
        member("benefit-a", "eligible_now"),
        member("benefit-b", "eligible_now"),
        member("benefit-c", "not_applicable")
      ])
    );
    expect(result.status).toBe("eligible_now");
    expect(result.blocking).toEqual([]);
  });

  test("one required member blocked -> nearly_eligible with blocking list", () => {
    const result = evaluateStack(
      stack(),
      new Map([
        member("benefit-a", "eligible_now"),
        member("benefit-b", "nearly_eligible"),
        member("benefit-c", "eligible_now")
      ])
    );
    expect(result.status).toBe("nearly_eligible");
    expect(result.blocking).toEqual(["benefit-b"]);
  });

  test("required not_applicable propagates -> not_applicable", () => {
    const result = evaluateStack(
      stack(),
      new Map([
        member("benefit-a", "not_applicable"),
        member("benefit-b", "eligible_now"),
        member("benefit-c", "eligible_now")
      ])
    );
    expect(result.status).toBe("not_applicable");
  });

  test("required expired propagates -> not_applicable", () => {
    const result = evaluateStack(
      stack(),
      new Map([
        member("benefit-a", "expired"),
        member("benefit-b", "eligible_now"),
        member("benefit-c", "eligible_now")
      ])
    );
    expect(result.status).toBe("not_applicable");
  });

  test("missing member result treated as unknown -> nearly_eligible", () => {
    const result = evaluateStack(
      stack(),
      new Map([member("benefit-a", "eligible_now"), member("benefit-c", "eligible_now")])
    );
    expect(result.status).toBe("nearly_eligible");
    expect(result.members.find((m) => m.benefit_id === "benefit-b")?.status).toBe("unknown");
  });

  test("risk_level is max of counted members; N/A optional member excluded", () => {
    const highOptional = evaluateStack(
      stack(),
      new Map([
        member("benefit-a", "eligible_now", "low"),
        member("benefit-b", "eligible_now", "moderate"),
        member("benefit-c", "eligible_now", "high")
      ])
    );
    expect(highOptional.risk_level).toBe("high");

    const naOptional = evaluateStack(
      stack(),
      new Map([
        member("benefit-a", "eligible_now", "low"),
        member("benefit-b", "eligible_now", "moderate"),
        member("benefit-c", "not_applicable", "high")
      ])
    );
    expect(naOptional.risk_level).toBe("medium");
  });
});

describe("riskRank", () => {
  test("normalizes the library's messy risk vocabulary", () => {
    expect(riskRank("low")).toBe(0);
    expect(riskRank("medium")).toBe(1);
    expect(riskRank("moderate")).toBe(1);
    expect(riskRank("high")).toBe(2);
    expect(riskRank("aggressive")).toBe(2);
    expect(riskRank("high_review_required")).toBe(2);
    expect(riskRank("nonsense")).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/stacks.test.ts`
Expected: FAIL — module `../src/domain/scanner/stacks` not found.

- [ ] **Step 3: Add the types** — in `backend-ts/src/domain/scanner/types.ts`, append after `ScanResult` and change `ScanRun`:

```ts
export type SequenceStep = {
  step: number;
  action: string;
  timing: string;
  professional: string;
};

export type StackMemberResult = {
  benefit_id: string;
  role: string;
  required: boolean;
  status: ScanStatus;
};

export type StackResult = {
  stack_id: string;
  name: string;
  target_profile: string;
  status: ScanStatus;
  members: StackMemberResult[];
  blocking: string[];
  sequence: SequenceStep[];
  interactions: string;
  combined_value: string;
  risk_level: string;
  abuse_boundary: string;
  review_required: boolean;
};

export type ScanRun = {
  tax_year: number;
  total: number;
  counts: Record<string, number>;
  results: ScanResult[];
  stacks: StackResult[];
};
```

(The existing `ScanRun` declaration is replaced by this one — same fields plus `stacks`.)

- [ ] **Step 4: Create `backend-ts/src/domain/scanner/stacks.ts`**:

```ts
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { projectPaths } from "../../lib/paths";
import type { ScanResult, ScanStatus, SequenceStep, StackMemberResult, StackResult } from "./types";

type StackMember = { benefit_id: string; role: string; required: boolean };

export type RawStack = {
  id: string;
  name: string;
  target_profile: string;
  members: StackMember[];
  interactions: string;
  sequence: SequenceStep[];
  combined_value: string;
  abuse_boundary: string;
  review_required: boolean;
};

const RISK_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  moderate: 1,
  high: 2,
  aggressive: 2,
  high_review_required: 2
};

export const RISK_NAMES = ["low", "medium", "high"] as const;

export function riskRank(level: string): number {
  return RISK_RANK[level] ?? 0;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseStack(
  raw: Record<string, unknown>,
  knownBenefitIds: Set<string>,
  source: string
): RawStack {
  if (raw.kind !== "strategy_stack") {
    throw new Error(`Stack ${source}: kind must be "strategy_stack"`);
  }

  const id = text(raw.id);
  if (!id) {
    throw new Error(`Stack ${source}: missing id`);
  }

  const membersRaw = Array.isArray(raw.members) ? raw.members : [];
  if (membersRaw.length === 0) {
    throw new Error(`Stack ${id}: members must be a non-empty list`);
  }
  const members: StackMember[] = membersRaw.map((entry) => {
    const m = (entry ?? {}) as Record<string, unknown>;
    const benefitId = text(m.benefit_id);
    if (!knownBenefitIds.has(benefitId)) {
      throw new Error(`Stack ${id}: member benefit_id "${benefitId}" does not exist in the benefit library`);
    }
    return { benefit_id: benefitId, role: text(m.role), required: m.required === true };
  });

  const sequenceRaw = Array.isArray(raw.sequence) ? raw.sequence : [];
  if (sequenceRaw.length === 0) {
    throw new Error(`Stack ${id}: sequence (playbook) must be non-empty`);
  }
  const sequence: SequenceStep[] = sequenceRaw.map((entry, i) => {
    const s = (entry ?? {}) as Record<string, unknown>;
    return {
      step: typeof s.step === "number" ? s.step : i + 1,
      action: text(s.action),
      timing: text(s.timing),
      professional: text(s.professional) || "none"
    };
  });

  const review = (raw.review_required ?? {}) as Record<string, unknown>;

  return {
    id,
    name: text(raw.name) || id,
    target_profile: text(raw.target_profile),
    members,
    interactions: text(raw.interactions),
    sequence,
    combined_value: text(raw.combined_value),
    abuse_boundary: text(raw.abuse_boundary),
    review_required: review.cpa === true || review.attorney === true
  };
}

export function loadStacks(knownBenefitIds: Set<string>): RawStack[] {
  const dir = path.join(projectPaths.taxLibrary, "stacks");
  if (!fs.existsSync(dir)) {
    return [];
  }

  const stacks: RawStack[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".yaml")) {
      continue;
    }
    const filePath = path.join(dir, entry.name);
    const parsed = yaml.load(fs.readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`Stack file ${entry.name}: not a YAML mapping`);
    }
    stacks.push(parseStack(parsed as Record<string, unknown>, knownBenefitIds, entry.name));
  }

  return stacks;
}

const DEAD: ReadonlySet<ScanStatus> = new Set(["not_applicable", "expired"]);

export function evaluateStack(stack: RawStack, resultsById: Map<string, ScanResult>): StackResult {
  const members: StackMemberResult[] = stack.members.map((m) => ({
    benefit_id: m.benefit_id,
    role: m.role,
    required: m.required,
    status: resultsById.get(m.benefit_id)?.status ?? "unknown"
  }));

  const required = members.filter((m) => m.required);

  let status: ScanStatus;
  if (required.some((m) => DEAD.has(m.status))) {
    status = "not_applicable";
  } else if (required.length > 0 && required.every((m) => m.status === "eligible_now")) {
    status = "eligible_now";
  } else {
    status = "nearly_eligible";
  }

  const counted = members.filter((m) => m.required || !DEAD.has(m.status));
  const maxRisk = counted.reduce(
    (max, m) => Math.max(max, riskRank(resultsById.get(m.benefit_id)?.risk_level ?? "low")),
    0
  );

  return {
    stack_id: stack.id,
    name: stack.name,
    target_profile: stack.target_profile,
    status,
    members,
    blocking: required.filter((m) => m.status !== "eligible_now").map((m) => m.benefit_id),
    sequence: stack.sequence,
    interactions: stack.interactions,
    combined_value: stack.combined_value,
    risk_level: RISK_NAMES[maxRisk],
    abuse_boundary: stack.abuse_boundary,
    review_required: stack.review_required
  };
}
```

- [ ] **Step 5: Guard the benefit loader** — in `backend-ts/src/domain/scanner/benefitLoader.ts`, inside the `if (parsed && typeof parsed === "object" && !Array.isArray(parsed))` block, add as the FIRST statement:

```ts
        if ((parsed as RawBenefit)["kind"] === "strategy_stack") {
          continue; // stacks are loaded by stacks.ts, not evaluated as benefits
        }
```

- [ ] **Step 6: Wire stacks into `runScan`** — replace the body of `runScan` in `backend-ts/src/domain/scanner/scan.ts`:

```ts
import { loadBenefitLibrary } from "./benefitLoader";
import { evaluateBenefit } from "./rules";
import { loadStacks, evaluateStack } from "./stacks";
import { UserFacts } from "./userFacts";
import type { ScanResult, ScanRun, ScanStatus } from "./types";
```

```ts
export async function runScan(taxYear: number, userId?: string | null): Promise<ScanRun> {
  const rawBenefits = loadBenefitLibrary();
  const facts = userId ? await UserFacts.fromUserSections(userId, taxYear) : UserFacts.fromYaml(taxYear);

  const all = rawBenefits.map((b) => evaluateBenefit(b, facts));

  // Stacks see every member result, including "unknown" ones filtered from the response.
  const resultsById = new Map(all.map((r) => [r.benefit_id, r]));
  const knownIds = new Set(
    rawBenefits.map((b) => (typeof b.id === "string" ? b.id : "")).filter(Boolean)
  );
  const stacks = loadStacks(knownIds).map((s) => evaluateStack(s, resultsById));

  const results = all.filter((r) => r.status !== "unknown");

  return {
    tax_year: taxYear,
    total: results.length,
    counts: countByStatus(results),
    results,
    stacks
  };
}
```

Note: `loadStacks` throws on a malformed or dangling stack YAML, which fails the scan loudly — that is the spec's "fail loudly on a dangling reference" behavior. Shipped YAMLs are covered by the Task 6 route test, so a bad stack can't reach `main` silently.

- [ ] **Step 7: Run tests to verify pass**

Run: `npx vitest run test/stacks.test.ts`
Expected: PASS (13 tests).
Then: `npx vitest run test/api.test.ts test/eligibility.test.ts`
Expected: PASS — existing scan consumers tolerate the new `stacks` field (`tax_library/stacks/` doesn't exist yet, so `loadStacks` returns `[]`).

- [ ] **Step 8: Commit**

```powershell
git add backend-ts/src/domain/scanner/stacks.ts backend-ts/src/domain/scanner/types.ts backend-ts/src/domain/scanner/benefitLoader.ts backend-ts/src/domain/scanner/scan.ts backend-ts/test/stacks.test.ts
git commit -m "feat(scanner): strategy-stack evaluator, loader, and ScanRun.stacks"
```

---

### Task 6: Three authored stack YAMLs + scan-route integration test

**Files:**
- Create: `tax_library/stacks/business-owner-deduction-stack.yaml`
- Create: `tax_library/stacks/appreciated-asset-charitable-stack.yaml`
- Create: `tax_library/stacks/exit-estate-stack.yaml`
- Test: `backend-ts/test/api.test.ts` (append one test)

**Interfaces:**
- Consumes: benefit ids from Tasks 1–4 plus existing ids (see Global Constraints list); `parseStack` validation from Task 5 (all `benefit_id`s must exist or every scan throws).
- Produces: the three shipped stacks with ids `business-owner-deduction-stack`, `appreciated-asset-charitable-stack`, `exit-estate-stack` (the UI in Task 7 and miner in Task 8 read these).

- [ ] **Step 1: Write the failing route test** — append to `backend-ts/test/api.test.ts` (inside the existing describe, using the existing imports):

```ts
  test("POST /api/scan returns strategy stacks consistent with member statuses", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "POST", url: "/api/scan?tax_year=2025" });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.stacks.map((s: { stack_id: string }) => s.stack_id).sort()).toEqual([
      "appreciated-asset-charitable-stack",
      "business-owner-deduction-stack",
      "exit-estate-stack"
    ]);

    for (const stack of payload.stacks) {
      const dead = (s: string) => s === "not_applicable" || s === "expired";
      const required = stack.members.filter((m: { required: boolean }) => m.required);
      const expected = required.some((m: { status: string }) => dead(m.status))
        ? "not_applicable"
        : required.every((m: { status: string }) => m.status === "eligible_now")
          ? "eligible_now"
          : "nearly_eligible";
      expect(stack.status).toBe(expected);
      expect(stack.sequence.length).toBeGreaterThan(0);
      expect(["low", "medium", "high"]).toContain(stack.risk_level);
    }

    await app.close();
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/api.test.ts -t "strategy stacks"`
Expected: FAIL — `payload.stacks` is `[]` (no stack YAMLs exist yet).

- [ ] **Step 3: Create `tax_library/stacks/business-owner-deduction-stack.yaml`**:

```yaml
id: business-owner-deduction-stack
kind: strategy_stack
name: Business Owner Deduction Stack (§162 family + §179/§168(k) + optional §831(b))
jurisdiction: federal
target_profile: |
  Who this fits: profitable owner-operators (sole prop, LLC, or S-Corp) layering
  entity structure, everyday §162 deductions, and equipment expensing into one
  coordinated plan. The captive layer only fits businesses with ~$1M+ revenue
  and genuine uninsured risks.
members:
  - benefit_id: s-corp-election
    role: "Foundation: entity layer — reasonable salary + distributions to cut SE tax"
    required: true
  - benefit_id: home-office-deduction
    role: "§162 layer: deduct the business-use share of the home via an accountable plan"
    required: false
  - benefit_id: business-vehicle-deduction
    role: "§162 layer: mileage or actual-expense deduction for business vehicle use"
    required: false
  - benefit_id: augusta-rule
    role: "§280A(g): rent your home to the business ≤14 days/year, income tax-free"
    required: false
  - benefit_id: section-179-expensing
    role: "Expensing layer: immediate write-off of equipment up to the §179 limit"
    required: false
  - benefit_id: bonus-depreciation
    role: "Expensing layer: §168(k) bonus depreciation on qualifying property"
    required: false
  - benefit_id: 831b-microcaptive
    role: "Advanced layer: captive premiums deductible under §162 — ONLY with real insurance risk"
    required: false
interactions: |
  Sequencing matters. The S-Corp election changes whose return the deductions land
  on: once elected, home-office and vehicle costs must run through an accountable
  plan (reimbursements from the S-Corp), not Schedule C. Augusta-rule rent is
  deductible to the S-Corp and tax-free to you, but needs documented fair-market
  rates and a real business purpose per meeting. §179 and bonus depreciation apply
  to the same asset pool — elect §179 per asset first, bonus sweeps the remainder;
  both reduce QBI, so model against the §199A deduction before maxing them.
  Captive premiums also reduce operating income (and QBI); the captive is the last
  layer added, never the first.
sequence:
  - step: 1
    action: "Confirm S-Corp status (Form 2553) and set a defensible reasonable salary"
    timing: "Q1 — by March 15 for the election to apply to the current year"
    professional: cpa
  - step: 2
    action: "Adopt a written accountable plan; start monthly home-office and vehicle reimbursements"
    timing: "Q1"
    professional: cpa
  - step: 3
    action: "Document Augusta-rule rentals as they happen: agenda, attendees, comparable rate quotes, invoice"
    timing: "throughout the year, 14-day maximum"
    professional: none
  - step: 4
    action: "Plan equipment purchases; place assets in service and elect the §179 / bonus split"
    timing: "before 12/31 — the in-service date controls, not the payment date"
    professional: cpa
  - step: 5
    action: "Only if revenue and real risk justify it: independent captive feasibility study, then formation"
    timing: "6-9 month lead time; premiums deductible only once coverage is bound"
    professional: cpa+attorney
combined_value: |
  Typical range $15,000 – $150,000+/year: SE-tax savings from the S-Corp layer
  (~$10-20k at $150k+ profit), $3-15k from accountable-plan reimbursements and
  Augusta rent, and equipment expensing that scales with purchases. Captive
  premiums (ceiling $2.85M, 2025) defer tax on underwriting profit but carry real
  cost and risk — value exists only if the insurance is real. Per-member estimates
  control; no combined dollar total is computed.
risk_level: high
abuse_boundary: |
  The captive member is why this stack is flagged. T.D. 10029 (January 2025) makes
  certain §831(b) captives listed transactions (loss ratio under 30% plus financing
  flowing back to the insured or its owners) or transactions of interest (loss
  ratio under 60%). Listed status means Form 8886 disclosure, promoter penalties,
  and near-certain examination. If premiums are priced to hit a deduction target
  instead of actuarial risk, that is the fact pattern the IRS wins in court
  (Avrahami, Syzygy, Caylor). Run this stack without the captive unless there is
  genuine, material, uninsured risk priced by an independent actuary.
review_required: { cpa: true, attorney: true }
```

- [ ] **Step 4: Create `tax_library/stacks/appreciated-asset-charitable-stack.yaml`**:

```yaml
id: appreciated-asset-charitable-stack
kind: strategy_stack
name: Appreciated-Asset Charitable Stack (§170 + DAF + CRUT)
jurisdiction: federal
target_profile: |
  Who this fits: concentrated appreciated positions (>1 year holding), charitable
  intent, and high-income years — an exit, a large bonus, or a planned Roth
  conversion.
members:
  - benefit_id: charitable-contribution-deduction
    role: "Foundation: the itemized §170 deduction and its AGI ceilings"
    required: true
  - benefit_id: donor-advised-fund
    role: "Bunch multiple years of giving; donate stock at FMV, gain never realized"
    required: true
  - benefit_id: crut-664
    role: "For positions too large for one year's AGI ceiling: defer gain, spread income"
    required: false
interactions: |
  All three share the §170 AGI ceilings, and the ordering rules apply cash (60%)
  before appreciated property (30%). A DAF contribution of long-term stock is
  capped at 30% of AGI with a 5-year carryforward — donate in the highest-AGI year
  to use the ceiling. When one position's gain is too large for the ceilings to
  absorb, the CRUT takes over: the trust sells without recognizing gain, and the
  §170 deduction is only the present value of the charitable remainder, so it
  consumes far less ceiling per dollar of asset moved. DAF first for
  liquidity-sized gifts; CRUT for the concentrated block.
sequence:
  - step: 1
    action: "Inventory long-term appreciated positions (>1 year holding) and estimate this year's AGI"
    timing: "Q3"
    professional: none
  - step: 2
    action: "Open a DAF; transfer shares in-kind BEFORE any sale agreement exists"
    timing: "before 12/31 — start by November, year-end brokerage queues run weeks"
    professional: cpa
  - step: 3
    action: "Size the DAF gift against the 30%-of-AGI ceiling; carry forward any excess (5 years)"
    timing: "with the transfer"
    professional: cpa
  - step: 4
    action: "For a block too large for the ceilings: attorney drafts a CRUT, verify the 10% remainder test at the current §7520 rate, then fund it"
    timing: "60-90 day lead time before any planned liquidity event"
    professional: cpa+attorney
  - step: 5
    action: "File Form 8283 for non-cash gifts over $500; qualified appraisal if over $5,000 (publicly traded securities exempt)"
    timing: "with the return"
    professional: cpa
combined_value: |
  On a $500k long-term position with $300k of gain: donating in-kind avoids
  roughly $60-71k of capital-gains tax and yields a deduction worth ~$150-185k at
  high brackets (subject to the 30% AGI ceiling, 5-year carryforward). A CRUT on a
  larger block defers the entire gain and adds a remainder deduction. Per-member
  estimates control; no combined dollar total is computed.
risk_level: medium
abuse_boundary: |
  Two boundaries. (1) Prearranged sales: if shares reach the DAF or CRUT after a
  binding sale agreement exists, the donor is taxed on the gain anyway
  (assignment-of-income doctrine) — transfer first, negotiate after. (2) Abusive
  CRUT variants — early terminations engineered to strip the charity's remainder,
  or funding with dealer property — draw §4941/§507 scrutiny and appear in IRS
  enforcement campaigns.
review_required: { cpa: true, attorney: true }
```

- [ ] **Step 5: Create `tax_library/stacks/exit-estate-stack.yaml`**:

```yaml
id: exit-estate-stack
kind: strategy_stack
name: Exit & Estate Stack (§664 CRUT + dynasty trust + §453 installment sale)
jurisdiction: federal
target_profile: |
  Who this fits: owners approaching a business or property exit with estate-scale
  net worth ($10M+) and multi-generational transfer goals.
members:
  - benefit_id: crut-664
    role: "Divert part of the exit into a CRUT: defer gain, lifetime income, charitable remainder"
    required: true
  - benefit_id: nongrantor-dynasty-trust
    role: "Shelter growth assets from estate/GST tax across generations via GST-exemption allocation"
    required: true
  - benefit_id: installment-sale
    role: "Seller-finance part of the sale to spread gain across lower-bracket years"
    required: false
interactions: |
  These three split one liquidity event three ways, and the split must be set
  BEFORE a binding sale agreement. The CRUT slice defers gain entirely (taxed as
  distributed under §664(b)); the installment slice spreads gain over the note's
  term (§453 — depreciation recapture is still recognized in year one); the
  dynasty-trust slice is about the estate, not income: gift or sell growth assets
  to the trust and allocate GST exemption while values are pre-exit low. Conflict
  to watch: assets already inside the CRUT cannot also fund the dynasty trust —
  decide the split first, then paper each leg.
sequence:
  - step: 1
    action: "Model the three-way split of the exit (CRUT / installment note / retained-plus-trust) against income needs and estate exposure"
    timing: "6-12 months before a planned exit"
    professional: cpa+attorney
  - step: 2
    action: "Draft and fund the dynasty trust with growth assets at pre-exit valuation; allocate GST exemption on Form 709"
    timing: "before any letter of intent — valuation discounts vanish once a deal is on paper"
    professional: attorney
  - step: 3
    action: "Draft and fund the CRUT with its slice BEFORE a binding sale agreement (verify the 10% remainder test at the current §7520 rate)"
    timing: "60-90 days before signing"
    professional: cpa+attorney
  - step: 4
    action: "Negotiate installment note terms for the retained slice (rate ≥ AFR, security, term matched to the bracket plan)"
    timing: "at signing"
    professional: cpa
  - step: 5
    action: "Post-close compliance: Form 6252 each payment year; Form 5227 for the CRUT; Form 1041 for the trust; monitor the §453A interest charge if notes exceed $5M"
    timing: "every filing season"
    professional: cpa
combined_value: |
  Bracket spreading via §453 typically saves $5,000 – $100,000+ lifetime; the CRUT
  defers the entire gain on its slice and adds a remainder deduction; the dynasty
  trust removes future appreciation from a 40% estate tax — on $10M of sheltered
  growth that is $4M+ preserved for heirs. Per-member estimates control; no
  combined dollar total is computed.
risk_level: high
abuse_boundary: |
  The dynasty-trust member is flagged because of what is promoted online, not what
  this stack recommends. The "§643(b) trust" pitch — that income allocated to
  corpus escapes tax — is a scam the IRS named in the 2023 Dirty Dozen
  (IR-2023-65): §641 taxes trust income no matter what the deed calls corpus. The
  legitimate version here is estate/GST-exemption leverage plus narrow non-grantor
  uses, both constrained by §643(f). On the CRUT leg, funding after a binding sale
  agreement collapses the deferral (assignment of income). Nothing in this stack
  eliminates income tax.
review_required: { cpa: true, attorney: true }
```

- [ ] **Step 6: Run tests to verify pass**

Run: `npx vitest run test/api.test.ts test/stacks.test.ts test/rules.test.ts test/eligibility.test.ts`
Expected: PASS. If the route test fails on a dangling id, the YAML `benefit_id` has a typo — the error message names it.

- [ ] **Step 7: Commit**

```powershell
git add tax_library/stacks/ backend-ts/test/api.test.ts
git commit -m "feat(scanner): three authored strategy stacks + scan-route stacks test"
```

---

### Task 7: UI — Strategy Stacks cards on the Dashboard

**Files:**
- Create: `frontend/src/components/StackCard.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx` (render a Strategy Stacks section between the summary cards and the filters)

**Interfaces:**
- Consumes: `results.stacks` from `POST /api/scan` (shape = `StackResult` from Task 5); `StatusBadge` component (existing).
- Produces: `StackCard({ stack })` React component.

There is no frontend test infra; verification is the frontend build plus a live check.

- [ ] **Step 1: Create `frontend/src/components/StackCard.jsx`**:

```jsx
import { useState } from "react";
import StatusBadge from "./StatusBadge";

const MEMBER_ICON = {
  eligible_now: { glyph: "✓", cls: "text-emerald-400" },
  nearly_eligible: { glyph: "◐", cls: "text-amber-400" },
  eligible_if_changed: { glyph: "◑", cls: "text-blue-400" },
  future_opportunity: { glyph: "◔", cls: "text-purple-400" },
  high_risk: { glyph: "⚠", cls: "text-red-400" },
  not_applicable: { glyph: "—", cls: "text-gray-600" },
  expired: { glyph: "✗", cls: "text-red-500" },
  unknown: { glyph: "?", cls: "text-gray-500" },
};

const RISK_CLS = {
  low: "bg-gray-800 text-gray-400",
  medium: "bg-amber-900 text-amber-300",
  high: "bg-red-900 text-red-300",
};

export default function StackCard({ stack }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-white">{stack.name}</h3>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={stack.status} />
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${RISK_CLS[stack.risk_level] ?? RISK_CLS.low}`}>
            {stack.risk_level} risk
          </span>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-3 whitespace-pre-line">{stack.target_profile}</p>

      <ul className="space-y-1 mb-3">
        {stack.members.map((m) => {
          const icon = MEMBER_ICON[m.status] ?? MEMBER_ICON.unknown;
          return (
            <li key={m.benefit_id} className="flex gap-2 text-xs">
              <span className={`${icon.cls} w-3 shrink-0`} title={m.status}>{icon.glyph}</span>
              <span className="text-gray-300">
                <span className="font-mono text-gray-500">{m.benefit_id}</span>
                {m.required ? "" : " (optional)"} — {m.role}
              </span>
            </li>
          );
        })}
      </ul>

      {stack.risk_level === "high" && stack.abuse_boundary && (
        <div className="mb-3 p-3 bg-red-900/40 border border-red-700 rounded">
          <p className="text-xs font-bold text-red-300 uppercase mb-1">⚠ Abuse boundary — read before proceeding</p>
          <p className="text-xs text-red-200 whitespace-pre-line">{stack.abuse_boundary}</p>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-xs text-emerald-400 hover:text-emerald-300 self-start mb-2 focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
      >
        {open ? "▼ Hide playbook" : "▶ Show playbook"}
      </button>

      {open && (
        <div className="border-t border-gray-800 pt-3">
          {stack.interactions && (
            <p className="text-xs text-gray-300 mb-3 whitespace-pre-line">{stack.interactions}</p>
          )}
          <ol className="space-y-2 mb-3">
            {stack.sequence.map((s) => (
              <li key={s.step} className="text-xs text-gray-300 flex gap-2">
                <span className="text-gray-500 font-mono shrink-0">{s.step}.</span>
                <span>
                  {s.action}
                  <span className="block mt-0.5 text-gray-500">
                    {s.timing && <span className="mr-2">🕒 {s.timing}</span>}
                    {s.professional !== "none" && (
                      <span className="px-1 py-0.5 rounded bg-gray-800 text-gray-400">{s.professional}</span>
                    )}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          {stack.combined_value && (
            <p className="text-xs text-emerald-400/90 whitespace-pre-line mb-2">{stack.combined_value}</p>
          )}
        </div>
      )}

      {stack.review_required && (
        <p className="text-xs text-red-400 mt-auto">★ CPA / attorney review required before implementing</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Render the section in `frontend/src/pages/Dashboard.jsx`**

Add the import at the top with the other imports:

```jsx
import StackCard from "../components/StackCard";
```

Inside the `{results && (<>...</>)}` block, directly after the summary-cards `<div className="grid grid-cols-6 gap-3 mb-6">…</div>` and before the `{/* Filters */}` comment, insert:

```jsx
          {/* Strategy stacks */}
          {results.stacks?.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">Strategy Stacks</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[...results.stacks]
                  .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
                  .map((s) => (
                    <StackCard key={s.stack_id} stack={s} />
                  ))}
              </div>
            </div>
          )}
```

(`STATUS_ORDER` already exists at the top of Dashboard.jsx; `not_applicable` is not in that array so N/A stacks sort last via `indexOf === -1`… no — `indexOf === -1` sorts FIRST. Use this comparator instead:)

```jsx
                {[...results.stacks]
                  .sort((a, b) => {
                    const rank = (s) => { const i = STATUS_ORDER.indexOf(s.status); return i === -1 ? STATUS_ORDER.length : i; };
                    return rank(a) - rank(b);
                  })
                  .map((s) => (
                    <StackCard key={s.stack_id} stack={s} />
                  ))}
```

Use the second (rank-based) version, not the bare `indexOf` version.

- [ ] **Step 3: Build the frontend**

Run (from `frontend/`): `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Live check**

Start the backend (`npm run dev` in `backend-ts/`) and frontend dev server (`npm run dev` in `frontend/`), log in as the seeded test user (re-seed first: `npm run seed:test-user` — note it creates a NEW user id each run), run a scan from the Dashboard, and verify: three stack cards render, member checklists show status icons, the playbook expands/collapses, and high-risk stacks show the red abuse-boundary callout. Zero console errors. (Playwright MCP tools work for this if available; otherwise check manually.)

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/components/StackCard.jsx frontend/src/pages/Dashboard.jsx
git commit -m "feat(ui): strategy stack cards on the opportunity dashboard"
```

---

### Task 8: Candidate stack miner (authoring aid)

**Files:**
- Create: `backend-ts/src/domain/scanner/stackMiner.ts`
- Create: `backend-ts/scripts/suggestStacks.mjs`
- Modify: `backend-ts/package.json` (add `"suggest:stacks": "tsx scripts/suggestStacks.mjs"` to `scripts`)
- Test: `backend-ts/test/stackMiner.test.ts` (new file)
- Possibly modify: existing `tax_library/**/*.yaml` files (fix dangling `compatible_with` ids the first run surfaces — Step 6)

**Interfaces:**
- Consumes: `riskRank`, `RISK_NAMES` from `./stacks` (Task 5).
- Produces:
  - `toMinerBenefit(raw: Record<string, unknown>): MinerBenefit | null`
  - `mineCandidateStacks(benefits: MinerBenefit[], authoredMemberIds: Set<string>): MinerReport`
  - Types: `MinerBenefit { id: string; risk_level: string; compatible_with: string[]; conflicts_with: string[]; facts: string[] }`, `MinerCandidate { members: [string, string]; sharedFacts: string[]; jaccard: number; maxRisk: string; inAuthoredStack: string[] }`, `MinerReport { candidates: MinerCandidate[]; dangling: Array<{ from: string; to: string }> }`.

- [ ] **Step 1: Write the failing tests** — create `backend-ts/test/stackMiner.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { mineCandidateStacks, toMinerBenefit } from "../src/domain/scanner/stackMiner";
import type { MinerBenefit } from "../src/domain/scanner/stackMiner";

function benefit(id: string, overrides: Partial<MinerBenefit> = {}): MinerBenefit {
  return { id, risk_level: "low", compatible_with: [], conflicts_with: [], facts: [], ...overrides };
}

describe("toMinerBenefit", () => {
  test("normalizes YAML shapes: fact objects, string conflicts, missing stacking_rules", () => {
    const parsed = toMinerBenefit({
      id: "thing",
      risk_level: "moderate",
      stacking_rules: {
        compatible_with: ["other", 42],
        conflicts_with: ["bad-pair", { rule: "prose conflict, not an id" }]
      },
      required_user_facts: [{ fact: "household.estimated_agi" }, "income.w2_employment", { nonsense: true }]
    });
    expect(parsed).toEqual({
      id: "thing",
      risk_level: "moderate",
      compatible_with: ["other"],
      conflicts_with: ["bad-pair"],
      facts: ["household.estimated_agi", "income.w2_employment"]
    });
  });

  test("returns null without an id", () => {
    expect(toMinerBenefit({ name: "No Id" })).toBeNull();
  });
});

describe("mineCandidateStacks", () => {
  test("builds edges from either side's compatible_with and ranks by Jaccard", () => {
    const benefits = [
      benefit("a", { compatible_with: ["b"], facts: ["f1", "f2"] }),
      benefit("b", { facts: ["f1", "f2", "f3"] }),
      benefit("c", { compatible_with: ["a"], facts: ["f9"] })
    ];
    const report = mineCandidateStacks(benefits, new Set());
    expect(report.candidates.map((c) => c.members)).toEqual([
      ["a", "b"],
      ["a", "c"]
    ]);
    expect(report.candidates[0].jaccard).toBeCloseTo(2 / 3);
    expect(report.candidates[0].sharedFacts).toEqual(["f1", "f2"]);
    expect(report.candidates[1].jaccard).toBe(0);
  });

  test("excludes conflicting pairs", () => {
    const benefits = [
      benefit("a", { compatible_with: ["b"], conflicts_with: ["b"] }),
      benefit("b")
    ];
    expect(mineCandidateStacks(benefits, new Set()).candidates).toEqual([]);
  });

  test("collects dangling ids instead of crashing", () => {
    const benefits = [benefit("a", { compatible_with: ["ghost-benefit"] })];
    const report = mineCandidateStacks(benefits, new Set());
    expect(report.candidates).toEqual([]);
    expect(report.dangling).toEqual([{ from: "a", to: "ghost-benefit" }]);
  });

  test("marks members already in an authored stack and takes max risk", () => {
    const benefits = [
      benefit("a", { compatible_with: ["b"], risk_level: "high" }),
      benefit("b", { risk_level: "low" })
    ];
    const report = mineCandidateStacks(benefits, new Set(["b"]));
    expect(report.candidates[0].maxRisk).toBe("high");
    expect(report.candidates[0].inAuthoredStack).toEqual(["b"]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/stackMiner.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `backend-ts/src/domain/scanner/stackMiner.ts`**:

```ts
import { riskRank, RISK_NAMES } from "./stacks";

export type MinerBenefit = {
  id: string;
  risk_level: string;
  compatible_with: string[];
  conflicts_with: string[];
  facts: string[];
};

export type MinerCandidate = {
  members: [string, string];
  sharedFacts: string[];
  jaccard: number;
  maxRisk: string;
  inAuthoredStack: string[];
};

export type MinerReport = {
  candidates: MinerCandidate[];
  dangling: Array<{ from: string; to: string }>;
};

export function toMinerBenefit(raw: Record<string, unknown>): MinerBenefit | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  if (!id) {
    return null;
  }

  const stacking = (raw.stacking_rules ?? {}) as Record<string, unknown>;
  const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];

  const factsRaw = Array.isArray(raw.required_user_facts) ? raw.required_user_facts : [];
  const facts = factsRaw
    .map((f) => {
      if (typeof f === "string") {
        return f;
      }
      const fact = (f as Record<string, unknown> | null)?.fact;
      return typeof fact === "string" ? fact : "";
    })
    .filter(Boolean);

  return {
    id,
    risk_level: typeof raw.risk_level === "string" ? raw.risk_level : "low",
    compatible_with: strings(stacking.compatible_with),
    conflicts_with: strings(stacking.conflicts_with),
    facts
  };
}

export function mineCandidateStacks(
  benefits: MinerBenefit[],
  authoredMemberIds: Set<string>
): MinerReport {
  const byId = new Map(benefits.map((b) => [b.id, b]));
  const dangling: Array<{ from: string; to: string }> = [];
  const edges = new Map<string, [string, string]>();

  for (const b of benefits) {
    for (const target of b.compatible_with) {
      if (target === b.id) {
        continue;
      }
      const other = byId.get(target);
      if (!other) {
        dangling.push({ from: b.id, to: target });
        continue;
      }
      if (b.conflicts_with.includes(target) || other.conflicts_with.includes(b.id)) {
        continue;
      }
      const pair = [b.id, target].sort() as [string, string];
      edges.set(pair.join("::"), pair);
    }
  }

  const candidates: MinerCandidate[] = [];
  for (const [a, b] of edges.values()) {
    const factsA = new Set(byId.get(a)!.facts);
    const factsB = new Set(byId.get(b)!.facts);
    const shared = [...factsA].filter((f) => factsB.has(f));
    const union = new Set([...factsA, ...factsB]);
    candidates.push({
      members: [a, b],
      sharedFacts: shared,
      jaccard: union.size === 0 ? 0 : shared.length / union.size,
      maxRisk: RISK_NAMES[Math.max(riskRank(byId.get(a)!.risk_level), riskRank(byId.get(b)!.risk_level))],
      inAuthoredStack: [a, b].filter((id) => authoredMemberIds.has(id))
    });
  }

  candidates.sort((x, y) => y.jaccard - x.jaccard || x.members[0].localeCompare(y.members[0]));
  return { candidates, dangling };
}
```

- [ ] **Step 4: Run tests, then create the CLI**

Run: `npx vitest run test/stackMiner.test.ts`
Expected: PASS (6 tests).

Create `backend-ts/scripts/suggestStacks.mjs`:

```js
// Offline authoring aid: mines the benefit library's stacking_rules graph for
// candidate strategy stacks. Advisory output only — a candidate becomes a real
// stack only when an author writes the tax_library/stacks/ YAML by hand.
//
// Usage (from backend-ts/): npm run suggest:stacks
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const { toMinerBenefit, mineCandidateStacks } = await import("../src/domain/scanner/stackMiner.ts");

const taxLibrary = path.resolve(process.cwd(), "..", "tax_library");

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith(".yaml") && !entry.name.startsWith("example-")) files.push(full);
  }
  return files;
}

const benefits = [];
const authoredMemberIds = new Set();
for (const file of walk(taxLibrary)) {
  const parsed = yaml.load(fs.readFileSync(file, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
  if (parsed.kind === "strategy_stack") {
    for (const m of parsed.members ?? []) {
      if (m?.benefit_id) authoredMemberIds.add(m.benefit_id);
    }
    continue;
  }
  const mb = toMinerBenefit(parsed);
  if (mb) benefits.push(mb);
}

const { candidates, dangling } = mineCandidateStacks(benefits, authoredMemberIds);

if (dangling.length > 0) {
  console.log("⚠ DANGLING compatible_with references (fix these in the YAMLs):");
  for (const d of dangling) console.log(`  ${d.from} -> ${d.to} (no such benefit id)`);
  console.log("");
}

console.log(`Candidate stacks (${candidates.length} pairs, ranked by shared-fact Jaccard):\n`);
for (const c of candidates) {
  const authored = c.inAuthoredStack.length > 0 ? ` [already stacked: ${c.inAuthoredStack.join(", ")}]` : " [NEW]";
  console.log(`${c.jaccard.toFixed(2)}  ${c.members.join(" + ")}  risk:${c.maxRisk}${authored}`);
  if (c.sharedFacts.length > 0) console.log(`      shared facts: ${c.sharedFacts.join(", ")}`);
}
```

Add to `backend-ts/package.json` `scripts` (after `"update:tax-params"`):

```json
    "suggest:stacks": "tsx scripts/suggestStacks.mjs",
```

- [ ] **Step 5: Run the miner once**

Run (from `backend-ts/`): `npm run suggest:stacks`
Expected: a ranked candidate list on stdout, very likely with a `⚠ DANGLING` section — `stacking_rules` was never read by code before, so stale ids are expected (e.g. references like `mortgage-interest` vs the real id `mortgage-interest-deduction`).

- [ ] **Step 6: Fix the dangling ids the report names**

For each `from -> to` line: open the `from` benefit's YAML, and in `stacking_rules.compatible_with` either correct the id to the real one (check against the `id:` lines in `tax_library/`) or delete the entry if no matching benefit exists. Re-run `npm run suggest:stacks` until the dangling section is empty. Do not add new benefits to satisfy a reference.

- [ ] **Step 7: Commit**

```powershell
git add backend-ts/src/domain/scanner/stackMiner.ts backend-ts/scripts/suggestStacks.mjs backend-ts/package.json backend-ts/test/stackMiner.test.ts tax_library/
git commit -m "feat(scanner): candidate stack miner (authoring aid) + stacking_rules id cleanup"
```

---

### Task 9: Full validation loop

**Files:** none new — verification only, plus any fixes it forces.

- [ ] **Step 1: Full backend test suite**

Run (from `backend-ts/`): `npm test`
Expected: all tests pass (363 pre-existing + ~25 new). Note: `npm test` wipes seeded data in the shared dev DB — re-seed afterwards if you need the test user again.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean. (Common trips: unused imports in `scan.ts`, `??` precedence parens.)

- [ ] **Step 3: Backend build**

Run: `npm run build`
Expected: `tsc` exits 0.

- [ ] **Step 4: Frontend build**

Run (from `frontend/`): `npm run build`
Expected: clean build.

- [ ] **Step 5: Commit any stragglers and update the handoff**

Update `CLAUDE.md`'s "Next Sprint Goals" / current-state section with one line: strategy stacks shipped (4 new benefits, 3 stacks, evaluator, dashboard cards, miner). Then:

```powershell
git add CLAUDE.md
git commit -m "docs: record strategy-stacks feature in handoff"
```

---

## Self-Review (done at planning time)

**Spec coverage:**
- §1 four benefit YAMLs + rules → Tasks 1–4 ✓ (including the "no new generic §162 entry" rule — stacks reference existing entries)
- §2 stack YAML schema + three initial stacks → Task 6 ✓
- §3 evaluator, loader validation, `ScanRun.stacks`, roll-up truth table → Task 5 ✓
- §4 UI cards with member checklist, playbook, abuse-boundary callout → Task 7 ✓
- §5 testing: rule fixtures (Tasks 1–4), roll-up truth table + loader validation (Task 5), scan-route test (Task 6), miner unit test (Task 8) ✓
- §6 miner + first-run dangling-id cleanup → Task 8 ✓
- Out-of-scope items honored: no combined-value calculator, no runtime emergent discovery, no mechanism tagging, no state stacks, §643(b) scheme appears only as warnings ✓

**Known deliberate deviations (documented inline):** captive rule's ceiling status is `nearly_eligible` (scanner can't verify an existing captive); roll-up treats `future_opportunity`/`high_risk`/`unknown` required members as `nearly_eligible` (spec's three buckets made total); stack YAML `risk_level` field is authored documentation, while the API's `risk_level` is computed from live member results per the spec's max rule.

**Type consistency check:** `StackResult`/`SequenceStep`/`StackMemberResult` defined once in `types.ts` (Task 5), consumed by `stacks.ts`, the route payload (Task 6 test), and the UI (Task 7). `riskRank`/`RISK_NAMES` exported from `stacks.ts`, imported by `stackMiner.ts` (Task 8). Accessor names used in rules match the definitions: `totalUnrealizedTaxableGains` (Task 2), `firstBusinessGrossRevenue` (Task 3), `estimatedNetWorth` (Task 4). ✓
