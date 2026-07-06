# OBBBA Deductions (Schedule 1-A) — Design

Date: 2026-07-06 · Branch: `audit` · Status: approved

## Problem

The 2025 calculator models none of the four new OBBBA below-the-line deductions
(OBBBA §§70201–70203, §70103), all claimed on the new **Schedule 1-A (Form 1040)**
whose total flows to Form 1040 **Line 13b** — currently the only unfilled
deduction field on our 2025 Form 1040 (`f2_04[0]`, see FIELD_MAP.md). For any
2025 filer with tips, overtime, a qualifying car loan, or age 65+, our computed
taxable income is too high.

The four deductions (all 2025–2028, none reduce AGI; MAGI = AGI + foreign
exclusions, which we don't model, so MAGI = AGI):

| Deduction | Cap | Phase-out threshold (single / MFJ) | Phase-out | MFS |
|---|---|---|---|---|
| Qualified tips | $25,000 | $150k / $300k | $100 per $1,000 of MAGI over | denied |
| Qualified overtime (premium portion) | $12,500 / $25,000 MFJ | $150k / $300k | $100 per $1,000 over | denied |
| New-car loan interest | $10,000 | $100k / $200k | $200 per $1,000 over | allowed (single threshold) |
| Senior deduction | $6,000 per person 65+ | $75k / $150k | 6% of MAGI over | denied (married must file jointly) |

Exact rounding semantics (linear percentage vs. per-$1,000 steps) will be
pinned to the actual Schedule 1-A worksheet math during form mapping — the
IRS form is ground truth, same as every other form in this project.

## Decisions made with the user

- **Tips/overtime entry is per W-2** (matches employer reporting; spouses' W-2s stay separate).
- **Self-employed tips are in scope** — per-business field, limited to that business's net profit.
- **Parameters come from the PolicyEngine pipeline** (`updateTaxParams.mjs`), with statutory-constant fallback + citations if PolicyEngine lacks a path.

## Components

### 1. Parameters — `taxParams.ts`, `updateTaxParams.mjs`, `taxParams.generated.ts`

Add to `TaxParams`:

```ts
obbba_deductions: null | {
  tips_cap: number;
  overtime_cap: { single: number; married_filing_jointly: number };
  tips_overtime_phase_threshold: { single: number; married_filing_jointly: number };
  tips_overtime_phase_rate: number;          // 0.10
  car_loan_cap: number;
  car_loan_phase_threshold: { single: number; married_filing_jointly: number };
  car_loan_phase_rate: number;               // 0.20
  senior_amount: number;                     // per qualifying individual
  senior_phase_threshold: { single: number; married_filing_jointly: number };
  senior_phase_rate: number;                 // 0.06
};
```

`null` for 2024 (calculator skips the whole block). `updateTaxParams.mjs`
fetches the PolicyEngine YAMLs — exact paths discovered at implementation time
via the GitHub API directory listing; if a parameter has no PolicyEngine path,
the script emits the statutory constant with an OBBBA citation comment.
Pinning tests in `test/taxParams.test.ts` cite OBBBA §§70201 (tips), 70202
(overtime), 70203 (car loan), 70103 (senior).

### 2. Schema fields — `frontend/src/schemas/income.js`

- **Per W-2** (`w2_employment` items): `qualified_tips` (source: W-2 Box 14 /
  new tip-reporting box), `qualified_overtime` (premium portion only — the
  "half" of time-and-a-half, not total overtime pay), `tipped_occupation`
  (optional text; Schedule 1-A prints occupation + Treasury code).
- **Per self-employment business** (`self_employment` items): `qualified_tips`.
- **Existing `other_wages.tip_income_unreported`** (Form 4137) also counts as
  qualified tips per IRS guidance — description updated, no new field.
- **New group "New 2025 Deductions"**: `car_loan_interest_paid`, `vehicle_vin`
  (printed on Schedule 1-A). Description carries eligibility: new vehicle,
  loan originated after 12/31/2024, US final assembly, personal use, secured
  by the vehicle.
- **Senior deduction**: no new fields — taxpayer/spouse ages already collected.

### 3. Calculator — `taxCalculator.ts`

New `_schedule1A()` called between `_deductions()` and `_taxableIncome()`
(needs AGI, filing status, ages; must precede taxable income). Skips entirely
when `p.obbba_deductions` is null.

- `qualified_tips_total` = Σ W-2 `qualified_tips`
  + Σ per-business min(`qualified_tips`, max(0, business net profit))
  + `tip_income_unreported`; then cap, then phase-out. MFS → 0.
- `qualified_overtime_total` = Σ W-2 `qualified_overtime`; cap, phase. MFS → 0.
- `car_loan_interest_deduction` = min(paid, cap), phased. MFS allowed at single threshold.
- `senior_deduction` = senior_amount × (taxpayer 65+ ? 1 : 0) + (MFJ spouse 65+ ? 1 : 0),
  phased on joint MAGI. MFS → 0.
- `schedule_1a_total` = sum of the four; per-part intermediates exposed in `c`
  for the form fill (same pattern as the `f5695_*` intermediates).
- `taxable_income = max(0, agi − deduction − qbi_deduction − schedule_1a_total)`.
- QBI income-limit base (`tiBeforeQbi`) also subtracts `schedule_1a_total`
  (QBI limit is taxable income before the QBI deduction, which now includes 13b).

**Adjacent bug fix (in scope):** `_deductions()` currently adds the extra
65+/blind standard deduction only for the taxpayer. Fix to also count spouse
age/blind for joint filers — the 12d checkboxes in `fillIrsForms.ts` already
read both, so the data exists.

### 4. Form fill — `fillIrsForms.ts`, `state/form_cache`

- Download 2025 `f1040s1a.pdf` into `state/form_cache`; map per
  `state/pdf_check/FORM_MAPPING_PROCESS.md` (label dump → FIELD_MAP.md section
  → live AcroForm verification via `verifyFields.mjs`).
- New `fillSchedule1A(c, data)` + `formKey === "f1040s1a"` dispatch.
- Form 1040: fill `f2_04[0]` (Line 13b) with `schedule_1a_total`; Line 14
  (`f2_05[0]`) becomes `deduction + qbi_deduction + schedule_1a_total`.
- FIELD_MAP.md: new Schedule 1-A section; update the 1040 13b/14 rows.

### 5. Wiring

- `index.ts`: `_need_sch_1a = schedule_1a_total > 0`; ZIP `formsIncluded`
  entry "Schedule 1-A — Additional Deductions".
- `TaxForms.jsx`: tab label map + `_need_sch_1a` tab push.
- `summaryText.ts`: Schedule 1-A section with the four parts.
- `checkFieldMappings.mjs`: sha256 for the new PDF + expectation block.
- `labelAllForms.mjs`: add `f1040s1a.pdf`.
- `seedTestUser`: add qualified tips, overtime, car-loan interest, and one
  65+ scenario so `checkFieldMappings` exercises the form non-vacuously.

### 6. Testing

Vitest (calculator): each deduction's cap boundary; phase-out below /
partial / fully-phased; MFS denial (tips, overtime, senior) and MFS-allowed
(car loan); SE tips limited by business net profit (profit > tips, < tips,
negative); senior count 0/1/2; spouse-65 standard-deduction fix; 2024 →
whole block is a no-op. Then the standard validation loop (focused tests →
`npm test` → lint → build) and `checkFieldMappings.mjs` against a freshly
re-seeded test user (re-seed after `npm test` — it wipes the shared dev DB).

## Out of scope (flagged)

- Scanner rules suggesting these deductions (belongs to the per-rule scanner
  audit, a separate open item).
- State tax treatment.
- Occupation-eligibility validation for tips (Treasury customarily-tipped
  occupation list) — guidance text only; CPA review catches misuse.
- Form 4137 interaction beyond reusing `tip_income_unreported`.
