# Claude Handoff

## Local Workspace Setup

- The local agent and workflow bundle lives in [ce/](ce/).
- For Claude Code, use this file first, then [ce/README.md](ce/README.md) and the relevant docs under [ce/agents/](ce/agents/) and [ce/templates/](ce/templates/).
- For GitHub Copilot in VS Code, use [.github/copilot-instructions.md](.github/copilot-instructions.md) as the repo-level instruction file.
- Treat the bundle as tracker-neutral: do not depend on Jira-specific workflow files or transitions unless they are explicitly reintroduced.
- When you need planning or agent guidance, prefer the local `ce/` docs over any external framework reference.

Project: `tax-assist`
Branch: `my-data` (off `main`, branched at `d16719b`)
Last updated: 2026-06-16

## In Progress — My Data UX/Accessibility Redesign

User complaint that triggered this: "My Data feels overwhelming, not in logical order — where do I
even enter my name?" Root cause: in `household.js` the name lived in a group literally called
"Taxpayer", third of seven groups, mixed in with rare fields like `combat_zone` and
`presidential_campaign_you`. Full plan: documented below in this handoff file.

**Phase A — DONE** (commit `0df4101`): shared component accessibility + the flagship reorder.
- `FieldInput.jsx` / `FieldGroup.jsx` / `HelpPopover.jsx`: `htmlFor`/`id` label association, visible
  focus rings (`focus:outline-none` was removed globally — replaced with `focus-visible:ring-2`),
  `role="switch"`/`role="group"` on toggles, `<fieldset>`/`<legend>`, `aria-expanded`/`aria-controls`
  on collapsibles, Escape-to-close + `role="tooltip"` on help popovers.
- `SectionForm.jsx`: field search box (matches label *and* key), `role="status" aria-live="polite"`
  save message, "Unsaved changes" indicator, new `callout` group type.
- New `lib/sectionCompleteness.js`: per-section completion signal from `essential`-flagged fields,
  falling back to a flat non-null ratio for schemas not yet retrofitted.
- `pages/UserData.jsx`: nav regrouped into categories (About You / Income & Accounts / Business &
  Property / Planning) with a live status dot per section.
- `schemas/household.js` fully reordered: **Your Info (name/SSN/DOB) is now the first group on the
  page**, essentials-first throughout, rare fields (combat zone, presidential campaign, deceased,
  foreign address, dual-status alien, etc.) swept into a collapsed "Special Situations"-style
  cluster of advanced groups, each tagged "Rarely needed". `Spouse` group now hidden entirely via
  `showIf` when filing status is Single/HOH. Killed the redundant manual `dependents.count` field —
  replaced with a live read-only count + "Manage Dependents →" link (new `callout` group type).

**Phase B — DONE** (commit `43f89d2`): same pattern applied to the 7 other schemas where it fits.
- `income.js`, `businesses.js`, `real_estate.js`, `investments.js`, `retirement.js`,
  `healthcare.js`, `dependents.js` — each got essentials-first reordering and/or rare fields
  demoted to `advanced: true` groups.
- New conditional capability used here: `real_estate.js` — "Rental Use" only shows for rental
  property types, "Primary Residence" only for primary residences, via `showIf` keyed on the
  property's own `property_type` field. `healthcare.js` — "Premium Tax Credit" only shows if
  `insurance.coverage_type === "marketplace"`.
- `ListEditor.jsx` updated to thread `advanced`/`showIf`/`defaultOpen` through to per-item
  `FieldGroup`s (needed so list-based schemas — businesses, real estate, dependents — could use
  the same mechanics).
- Deliberately **left unchanged**: `goals.js` (42 fields are all equally-weighted opt-in planning
  checkboxes — no genuine essential/rare split exists to apply) and `documents_index.js` (not
  reachable from the My Data nav at all — excluded server-side in `routes/userData.ts:53`).
- Verified live via Playwright against the real running app at every step (zero console errors);
  full backend test suite re-confirmed clean (344/344) after this session's combined work.

**Phase C — NOT STARTED, flagged as a separate effort.** Cross-section data redundancy found
during research, deliberately not touched because it reaches into the tax calculator, not just
the UI:
- Capital gains tracked in both `income.js` (`investment_income.short_term_capital_gains` etc.)
  and `investments.js` (`realized_gains_losses_this_year.short_term_gains` etc.) — unclear which
  is canonical.
- HSA contributions tracked in 3 places: `income.js` W-2 list (`hsa_contributions_through_payroll`),
  `income.js` adjustments (`hsa_contributions_outside_payroll`), and `healthcare.js`
  (`health_savings_account.contributions_ytd`).
- Field name mismatch for the same concept: `real_estate.js`'s `rental_use.gross_rental_income`
  vs. `income.js`'s `rental_income[].gross_rents`.
- Before starting: re-read the plan file above, trace each duplicated field through
  `backend-ts/src/domain/taxForms/taxCalculator.ts` to find which one (if any) the calculator
  actually reads, then decide whether to delete the unused duplicate or reconcile both into one
  canonical field with a migration.

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
