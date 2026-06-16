# Claude Handoff

Project: `tax-assist`
Branch: `switch-to-ts`
Last updated: 2026-06-13

## Current State — Migration Complete + Tax Forms Verified

The Python → TypeScript migration is fully done. Every item in `TS_MIGRATION_TRACKER.md` is DONE.

- **Active runtime:** `backend-ts` (TypeScript/Fastify) — all Python routes retired
- **All 17 tax-law sources** ported; `scripts/update_tax_law.py` deleted
- **Scanner:** 59 rules, full parity, regression-tested
- **Scenarios:** with AI narrative support
- **CPA packet:** 4-bucket status sections, household summary, AI summary block
- **Tax forms:** full `TaxCalculator` (2024/2025 params), ZIP package generator, per-form PDF viewer/download
- **YAML→DB bootstrap:** idempotent on startup; creates `admin@localhost` / `changeme123`
- **Test seeder:** `npm run seed:test-user` (alex.carter@example.com / TestUser123!)
- **225 tests passing**, lint and build clean

## Tax Forms — Current State (2026-06-11)

### Per-form tabs (just shipped)
The Tax Forms page now has one tab per applicable form instead of a single merged PDF:
- **Line Items** | **Form 1040** | **Schedule 1** | **Schedule B** | **Schedule C** | **Schedule D** | **Schedule SE**
- Each tab shows the filled IRS PDF embedded in the browser with a **Download PDF** button
- Tabs are dynamic — only forms that apply to the user's data appear
- Backend: `GET /tax-forms/preview-pdf?form=f1040` (or `f1040s1`, `f1040sb`, `f1040sc_0`, `f1040sd`, `f1040sse`)
- See `backend-ts/src/domain/taxForms/fillIrsForms.ts` → `fillSingleIrsForm()`

### Field mapping verified (markitdown + manual inspection)
Used `python -m markitdown <pdf>` to convert the downloaded Form 1040 to markdown and verified all 21 numeric fields. Four bugs were found and fixed in `fillIrsForms.ts → fill1040()`:

| Bug | Fix |
|-----|-----|
| `f2_01–f2_06` blank on page 2 back | Added fills for Lines 11b, 12e, 13a, 14, 15 on page 2 |
| `f2_14` (Line 25b — 1099 withholding) not filled | Now fills `other_withholding` |
| `f2_17` (Line 25d total withholding) showed only W-2 amount | Fixed to `w2_withholding + other_withholding` |
| `f2_26` (Line 35a — amount to refund) not filled | Now mirrors Line 34 refund |

### Field map reference
Complete text→field→data mapping for all 6 forms:
`state/pdf_check/FIELD_MAP.md`

### Verification artifacts (state/pdf_check/)
- `f1040_2025.md` — markitdown output of the downloaded filled Form 1040
- `FIELD_MAP.md` — authoritative field reference for all 6 forms
- `FORM_MAPPING_PROCESS.md` — **step-by-step playbook** for adding/correcting any form
- `labeled_all_*.pdf` — each form with field names labeled in every text field
- `flat_labeled_*.pdf` — flattened versions; readable by markitdown
- `annotated_f1040.pdf` — Form 1040 with field names drawn as red text overlays
- Scripts: `inspectFields.mjs`, `mapFieldPositions.mjs`, `labelAllForms.mjs`, `flattenLabeledForms.mjs`, `annotateFields.mjs`

### Form 1040 header fields — FIXED 2026-06-11
Names were filling the wrong fields (f1_01–f1_06 are fiscal-year/deceased-date meta fields,
not the name row). Correct name fields: f1_14–f1_19. Filing status checkboxes also corrected
(Checkbox_ReadOrder subform for Single/MFJ/MFS; top-level c1_8 for HOH/QSS). Dependents
now filled from data.dependents.dependents array. Digital assets checkbox fixed to c1_10.

### All schedules verified — live AcroForm field dump (2026-06-16)
Initial pass used markitdown text-extraction, but Form 1040's two-column layout scrambles
which value appears next to which line label in markitdown's output — unreliable for ground
truth. Re-verified all 8 forms (1040, Sch 1, B, C, D, SE, F, H) by calling `fillSingleIrsForm`
directly against the seeded test user's real DB data, with the internal `flatten()` neutralized
so the AcroForm fields stay live and readable unambiguously via `pdf-lib`. New permanent tool:
`backend-ts/scripts/verifyFields.mjs <userId> <taxYear> <formKey>` (see `FORM_MAPPING_PROCESS.md`
Step 9a). Every field on every form matched the seeded data and computed values exactly.

Annotation bugs found and fixed in FIELD_MAP.md (the fill code was already correct in all cases —
only the documentation was stale):
- Sch SE Line 3: was documented as `schedule_c_profit`, actually fills `schedule_c_profit + farm_income`
- Form 1040 Line 19: was documented as `child_tax_credit`, actually fills `ctc_with_odc`
- Form 1040 Line 20: was documented "not filled (zero)", actually fills `schedule3_line8`
- Form 1040 Line 35a/36: refund is split against `household.payments.apply_to_next_year`, not a flat mirror of Line 34
- Sch D Line 14 (`f1_42`): is correctly left blank (no LT loss carryover seeded); the actual LTCG output is Line 15 (`f1_43`)
- Sch D Page 2 field is `f2_1[0]`, not `f2_2[0]`
- Sch SE `f1_3[0]` (Line 1a) and Sch B header name/SSN fields were missing from the map; added
- Sch H section was entirely undocumented; added in full

## Next Sprint Goals

1. **Add more benefit rules** — extend the library beyond the current 58 benefits
   (see `tax_library/federal/`, `tax_library/state/`, `tax_library/county/`)
2. **Merge to main** — the `switch-to-ts` branch is ready
   - ✓ Schedule verification complete
   - ✓ DB schema normalized (9 typed tables)

## Validation Loop

1. Run focused Vitest tests for the source you touched.
2. Run `npm test` (full suite) in `backend-ts`.
3. Run `npm run lint` in `backend-ts`.
4. Run `npm run build` in `backend-ts`.

## Useful References

- Migration tracker: `TS_MIGRATION_TRACKER.md`
- Main handoff: `HANDOFF.md`
- Benefit library: `tax_library/federal/`, `tax_library/state/`, `tax_library/county/`
- Scanner rules: `backend-ts/src/domain/scanner/rules.ts`
- Tax calculator: `backend-ts/src/domain/taxForms/taxCalculator.ts`
- Tax form filler: `backend-ts/src/domain/taxForms/fillIrsForms.ts`
- Field map: `state/pdf_check/FIELD_MAP.md`
