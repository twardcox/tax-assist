# IRS PDF Form Field Mapping Process

This document is the step-by-step playbook for adding or correcting a fillable IRS PDF form.
Follow it end-to-end for every new form or whenever a form is updated to a new tax year.

---

## Background: why this is non-trivial

IRS AcroForm field names like `f1_01[0]` do **not** follow visual reading order.
The IRS assigns them sequentially during PDF authoring, which produces counter-intuitive
results — for example, on the 2025 Form 1040 the first name field is `f1_14[0]`, not
`f1_01[0]` (which is the alternate fiscal-year start date).

The only reliable ground-truth is the **field's pixel position on the page**.

Additionally, IRS PDFs use JavaScript to auto-calculate totals. `pdf-lib` does NOT execute
that JavaScript. Every calculated field must be filled explicitly by our code.

---

## Tools (all in `backend-ts/scripts/`)

| Script | Purpose |
|---|---|
| `inspectFields.mjs` | Lists every field with its type and full AcroForm path |
| `mapFieldPositions.mjs [form.pdf]` | Lists every field sorted by page → Y (top→bottom) → X (left→right) |
| `labelAllForms.mjs` | Fills every text field with its own short name; saves `labeled_all_*.pdf` |
| `flattenLabeledForms.mjs` | Flattens the labeled PDFs → `flat_labeled_*.pdf` so markitdown can read them |

Run all four in sequence when starting a new form:

```
cd backend-ts
node scripts/inspectFields.mjs                      # see field list
node scripts/mapFieldPositions.mjs <form>.pdf       # see visual order
node scripts/labelAllForms.mjs                      # bake field names into PDF
node scripts/flattenLabeledForms.mjs                # flatten so markitdown works
cd ../state/pdf_check
python -m markitdown flat_labeled_<form>.pdf        # read field names in context
```

---

## Step 1 — Get the blank IRS PDF

Download the latest fillable PDF from [IRS Forms & Publications](https://www.irs.gov/forms-instructions).
Save it to `state/form_cache/<formname>.pdf`.

Naming convention used in this project:

| File | Form |
|---|---|
| `f1040.pdf` | Form 1040 |
| `f1040s1.pdf` | Schedule 1 |
| `f1040sb.pdf` | Schedule B |
| `f1040sc.pdf` | Schedule C |
| `f1040sd.pdf` | Schedule D |
| `f1040sse.pdf` | Schedule SE |

---

## Step 2 — Discover all fields

```
node scripts/mapFieldPositions.mjs <form>.pdf > /tmp/fields.txt
```

The output format is:
```
Page | TopY |   X | Type            | Field name
-----|------|-----|-----------------|--------------------------------------
   1 |   94 |  36 | TextField       | topmostSubform[0].Page1[0].f1_14[0]
```

`TopY` is measured from the top of the page (0 = top). Fields at the same TopY are on the
same visual row. Fields at the same TopY but different X are left→right on that row.

---

## Step 3 — Classify each field

For every field in the position list, assign one of these categories:

| Category | Description | How to handle |
|---|---|---|
| **Data input** | Value comes from the user (name, SSN, address, income, etc.) | Map to a field in `section_data` |
| **Calculated** | Derived from other values (line totals, AGI, tax, etc.) | Map to a `ComputedValues` key or compute inline |
| **Checkbox — filing** | Filing status, dependent credit type, etc. | Set via `tryCheckBox()` based on data |
| **Checkbox — Yes/No** | Digital assets, rollover indicator, etc. | Set both options (Yes AND No) explicitly |
| **Structural** | Read-order subform artefacts — often duplicates of real fields | Skip unless it's the canonical field |
| **Meta / header** | Alternate fiscal year dates, deceased dates, combat zone | Leave blank for standard calendar-year returns |
| **Signature / preparer** | Taxpayer/preparer signatures, PTIN, dates | Not filled — user completes manually |

**Key insight for structural fields:** When `mapFieldPositions.mjs` shows the same
`TopY,X` for both a nested path (e.g., `Checkbox_ReadOrder[0].c1_8[0]`) and a top-level
path (`c1_8[0]`), they are **different** checkboxes at different X positions that happen to
share a short name. Always use the **full dotted path** and verify X position.

---

## Step 4 — Check "My Data" coverage

For every **data input** field, verify a corresponding input exists in the user-facing
section data. Walk through the form in visual order and ask:

> "Where does the user enter this value?"

Common gaps to watch for:
- Dependent-level fields (individual name, SSN, relationship) vs. household-level counts
- Multiple W-2 / Schedule C entries (array items, not scalar values)
- Rarely-used lines (moving expenses, educator expenses, etc.) that may not have a form field yet

If a required input is missing: add it to the relevant YAML template in `tax_library/` and
to the seed data in `backend-ts/src/scripts/createTestUser.ts` before writing the fill code.

---

## Step 5 — Map calculated fields

For every **calculated** field, decide the computation source:

1. **Already in `ComputedValues`?** Use `c["key"]` directly. Check `taxCalculator.ts`.

2. **Simple inline sum?** Compute in the fill function itself:
   ```typescript
   const line14 = Number(c["deduction"] ?? 0) + Number(c["qbi_deduction"] ?? 0);
   s(p(1, "f1_72[0]"), line14);
   ```

3. **PDF has a JavaScript calculation?** **Do not rely on it.** `pdf-lib` strips and
   ignores JS when loading the form. The PDF's JS would auto-calculate the field in Adobe
   Reader but our flattened output will be blank unless we fill it ourselves.

   > Every line total (e.g., Line 9 "total income", Line 24 "total tax", Line 33 "total
   > payments") must be explicitly filled even though the IRS PDF would calculate it
   > interactively.

---

## Step 6 — Build the FIELD_MAP

Create or update `state/pdf_check/FIELD_MAP.md`. Add a section for the form:

```markdown
## <Form Name> (<filename>)
| Field (full AcroForm path) | Y,X | Line # | Form Label | Source | Status |
|---|---|---|---|---|---|
| topmostSubform[0].Page1[0].f1_14[0] | 94,36 | header | Your first name | `household.taxpayer.first_name` | ✓ |
| topmostSubform[0].Page1[0].f1_47[0] | 450,504 | 1a | W-2 wages | `wages` | ✓ |
```

Include **both filled and intentionally-not-filled fields** with a note. This prevents
re-investigation the next time the form is revisited.

---

## Step 7 — Write the fill function

In `backend-ts/src/domain/taxForms/fillIrsForms.ts`:

### Path helpers

```typescript
// p() builds the top-level page path — USE ONLY for fields directly under Page1/Page2
function p(page: number, field: string): string {
  return `topmostSubform[0].Page${page}[0].${field}`;
}
// For nested fields (Address_ReadOrder, Table_Dependents, Checkbox_ReadOrder, etc.)
// build the full path literally — do NOT use p()
```

### Text fields

```typescript
ts(doc, p(1, "f1_47[0]"), c["wages"]);                     // top-level field
ts(doc, `topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_20[0]`, street); // nested
```

### Checkboxes

```typescript
// Filing status — must use full path (nested in Checkbox_ReadOrder)
tryCheckBox(doc, "topmostSubform[0].Page1[0].Checkbox_ReadOrder[0].c1_8[0]", true);

// Yes/No pair — always set BOTH
tryCheckBox(doc, p(1, "c1_10[0]"), digitalAssets);   // Yes
tryCheckBox(doc, p(1, "c1_10[1]"), !digitalAssets);  // No
```

### Fill order
Work top-to-bottom, page-by-page, in the same order as `mapFieldPositions.mjs` output.
This makes future diffs and corrections easy to locate.

---

## Step 8 — Verify with the flat labeled PDF

```
node scripts/labelAllForms.mjs
node scripts/flattenLabeledForms.mjs
python -m markitdown state/pdf_check/flat_labeled_<form>.pdf
```

The markitdown output will show field short names (e.g., `f1_14[0]`) at the exact location
in the form text where they appear. Cross-check every filled field against the form labels.

Note: checkboxes are not readable via markitdown — use `mapFieldPositions.mjs` X,Y
coordinates to verify checkbox positions visually against the form image.

---

## Step 9 — Verify with test data

1. Start the app: `npm run dev` in `backend-ts` and `frontend`
2. Log in as `alex.carter@example.com` / `TestUser123!`
3. Navigate to **Tax Forms** and open the new form tab
4. Click **Download PDF**
5. Run markitdown on the downloaded file:
   ```
   python -m markitdown ~/Downloads/<form>.pdf
   ```
6. Compare every filled value against:
   - The traceability comments in `backend-ts/src/scripts/createTestUser.ts`
     (each seed value is globally unique so it's easy to grep)
   - The expected values from the tax calculator output
7. Fix any mismatches in `fillIrsForms.ts` and repeat until every field is correct

---

## Step 10 — Update tests and run the suite

```
cd backend-ts
npm test
npm run lint
npm run build
```

All 3 must pass clean before considering the form done.

---

## Common pitfalls recap

| Pitfall | Symptom | Fix |
|---|---|---|
| Using `p()` for a nested field | Field silently not filled (caught by `ts()` swallowing the error) | Use the full dotted path instead of `p()` |
| Wrong field number (off-by-one) | Data appears in the wrong form line | Re-run `mapFieldPositions.mjs` and compare Y positions |
| Missing calculated total | Blank total line on the form | Add explicit fill call; do not rely on PDF JS |
| Duplicate short name in different subforms | Wrong checkbox ticked | Use full path; verify with X position from `mapFieldPositions.mjs` |
| `markitdown` shows blanks in labeled PDF | Labeled PDF not yet flattened | Run `flattenLabeledForms.mjs` first |
| XFA warning in console | Expected; harmless | `pdf-lib` strips XFA and uses the AcroForm layer |

---

## Checklist for a completed form

- [ ] All `mapFieldPositions.mjs` fields reviewed and classified
- [ ] Every data-input field has a My Data source
- [ ] Every calculated field is filled explicitly (no reliance on PDF JS)
- [ ] `FIELD_MAP.md` updated with full paths, Y/X positions, and source keys
- [ ] `flat_labeled_*.pdf` verified via markitdown — field names match form labels
- [ ] Downloaded filled PDF verified via markitdown — values match expected test data
- [ ] `npm test && npm run lint && npm run build` all pass clean
