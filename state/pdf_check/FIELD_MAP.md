# IRS Form Field Map — Tax Year 2025
# Verified via markitdown + visual inspection

## Form 1040 — Page 1 (AcroForm Page1)

### Header — field positions verified via mapFieldPositions.mjs (2026-06-11)
f1_01–f1_13 are NON-NAME header fields (fiscal year dates, deceased dates, etc.).
Name fields begin at f1_14 (Y≈94 from page top).

| Field | Y,X pos | Form Label | Data Key | Status |
|---|---|---|---|---|
| f1_01[0] | 48, 229 | Alternate tax year "beginning" date | — | not filled |
| f1_02[0] | 48, 366 | Alternate tax year "ending" date | — | not filled |
| f1_03[0] | 48, 469 | Alternate tax year ending year | — | not filled |
| f1_04–f1_10 | 61, * | Deceased/spouse death dates, combat zone text | — | not filled |
| f1_11–f1_13 | 73, * | "Other" section text fields | — | not filled |
| **f1_14[0]** | **94, 36** | **Your first name and middle initial** | `household.taxpayer.first_name` | ✓ FIXED |
| **f1_15[0]** | **94, 253** | **Your last name** | `household.taxpayer.last_name` | ✓ FIXED |
| **f1_16[0]** | **94, 469** | **Your social security number** | `household.taxpayer.ssn` | ✓ FIXED |
| **f1_17[0]** | **118, 36** | **Spouse's first name and middle initial** | `household.spouse.first_name` | ✓ FIXED |
| **f1_18[0]** | **118, 253** | **Spouse's last name** | `household.spouse.last_name` | ✓ FIXED |
| **f1_19[0]** | **118, 469** | **Spouse's social security number** | `household.spouse.ssn` | ✓ FIXED |
| Address_ReadOrder.f1_20[0] | 142, 36 | Home address (number and street) | `household.residence.street_address` | ✓ |
| Address_ReadOrder.f1_21[0] | 142, 419 | Apt. no. | — | not filled |
| Address_ReadOrder.f1_22[0] | 166, 36 | City, town, or post office | `household.residence.city` | ✓ |
| Address_ReadOrder.f1_23[0] | 166, 332 | State | `household.residence.state` | ✓ |
| Address_ReadOrder.f1_24[0] | 166, 397 | ZIP code | `household.residence.zip` | ✓ |

### Filing Status Checkboxes — CORRECTED 2026-06-11
Left column (Single/MFJ/MFS) are inside Checkbox_ReadOrder subform; right column (HOH/QSS) are top-level.

| Field (full path) | Y,X pos | Form Label | Status |
|---|---|---|---|
| Checkbox_ReadOrder[0].c1_8[0] | 206, 98 | Single | ✓ FIXED |
| Checkbox_ReadOrder[0].c1_8[1] | 218, 98 | Married filing jointly | ✓ FIXED |
| Checkbox_ReadOrder[0].c1_8[2] | 230, 98 | Married filing separately | ✓ FIXED |
| c1_8[0] (top-level) | 206, 350 | Head of household | ✓ FIXED |
| c1_8[1] (top-level) | 218, 350 | Qualifying surviving spouse | ✓ FIXED |
| c1_10[0] | 287, 518 | Digital Assets — Yes | ✓ FIXED |
| c1_10[1] | 287, 554 | Digital Assets — No | ✓ FIXED |

Previously wrong mappings (OLD → these were Presidential Campaign / main-home checkboxes):
- c1_5[0] (Y=147, X=568) = "main home in U.S." checkbox — NOT Single
- c1_6[0] (Y=194, X=482) = Presidential Campaign "You" — NOT MFJ
- c1_7[0] (Y=194, X=526) = Presidential Campaign "Spouse" — NOT MFS

### Dependents — CORRECTED 2026-06-12
Table layout: **rows = field type**, **columns = dependents 1–4**.
Row1=first names, Row2=last names, Row3=SSNs, Row4=relationships.

| Field (full path) | Form Label | Data Key |
|---|---|---|
| Row1[0].f1_31[0] | **Dep 1** first name | `name.split[0]` |
| Row1[0].f1_32[0] | **Dep 2** first name | `name.split[0]` |
| Row1[0].f1_33[0] | **Dep 3** first name | `name.split[0]` |
| Row1[0].f1_34[0] | **Dep 4** first name | `name.split[0]` |
| Row2[0].f1_35[0] | Dep 1 last name | `name.split[1+]` |
| Row2[0].f1_36–f1_38 | Dep 2–4 last names | same pattern |
| Row3[0].f1_39[0] | Dep 1 SSN | `ssn` |
| Row3[0].f1_40–f1_42 | Dep 2–4 SSNs | same pattern |
| Row4[0].f1_43[0] | Dep 1 relationship | `relationship` |
| Row4[0].f1_44–f1_46 | Dep 2–4 relationships | same pattern |
| Row5.Dependent1.c1_12[0] | Dep 1 lived with you (Yes) | `lives_with_taxpayer` |
| Row6.Dependent1.c1_20[0] | Dep 1 full-time student | `full_time_student` |
| Row7.Dependent1.c1_28[0] | Dep 1 child tax credit | `age_at_year_end < 17` |
| Row7.Dependent1.c1_28[1] | Dep 1 other dependent credit | `age_at_year_end >= 17` |

### Income Checkboxes — CORRECTED 2026-06-12
Income checkboxes c1_33–c1_44 map to Lines 3c, 4c, 5c, 6c, 6d, 7b in order (2+3+3+1+1+2 = 12).
Tab order does not match visual reading order, but the visual grouping is definitive.

| Field | Line | Form Label | Data Key | Status |
|---|---|---|---|---|
| c1_33[0] | 3c-1 | Child's dividends included in Line 3a | — | not filled |
| c1_34[0] | 3c-2 | Child's dividends included in Line 3b | — | not filled |
| c1_35[0] | 4c-1 | IRA rollover | `income.retirement_distributions.ira_rollover` | ✓ FIXED |
| c1_36[0] | 4c-2 | IRA QCD | — | not filled |
| c1_37[0] | 4c-3 | IRA other | — | not filled |
| c1_38[0] | 5c-1 | Pension/annuity rollover | `income.retirement_distributions.pension_rollover` | ✓ FIXED |
| c1_39[0] | 5c-2 | Pension PSO | — | not filled |
| c1_40[0] | 5c-3 | Pension other | — | not filled |
| c1_41[0] | 6c | SS lump-sum election method | `income.social_security.lump_sum_election` | ✓ FIXED |
| c1_42[0] | 6d | MFS, lived apart entire year | — | not filled |
| c1_43[0] | 7b-1 | Schedule D not required | `income.investment_income.schedule_d_not_required` | ✓ FIXED |
| c1_44[0] | 7b-2 | Includes child's capital gain | `income.investment_income.child_capital_gain_included` | ✓ FIXED |

### Income (Line Numbers)
| Field | Line | Form Label | ComputedValues Key | Status |
|---|---|---|---|---|
| f1_47[0] | 1a | Total amount from W-2, box 1 | `wages` | ✓ |
| f1_48[0] | 1b | Household employee wages | — | not filled |
| f1_49[0] | 1c | Tip income | — | not filled |
| f1_50[0] | 1d | Medicaid waiver payments | — | not filled |
| f1_51[0] | 1e | Taxable dependent care benefits | — | not filled |
| f1_52[0] | 1f | Employer adoption benefits | — | not filled |
| f1_53[0] | 1g | Wages from Form 8919 | — | not filled |
| f1_54[0] | 1h | Other earned income | — | not filled |
| f1_55[0] | 2b | Taxable interest | `taxable_interest` | ✓ |
| f1_56[0] | 3b | Ordinary dividends | `ordinary_dividends` | ✓ |
| f1_57[0] | 3a | Qualified dividends | `qualified_dividends` | ✓ |
| f1_58[0] | 4a | IRA distributions — gross | `ira_gross` | ✓ |
| f1_59[0] | 4b | IRA distributions — taxable | `ira_taxable` | ✓ |
| f1_60[0] | 5a | Pensions and annuities — gross | `pension_gross` | ✓ |
| f1_61[0] | 5b | Pensions and annuities — taxable | `pension_taxable` | ✓ |
| f1_62[0] | 6a | Social security benefits — gross | `ss_gross` | ✓ |
| f1_63[0] | 6b | Social security benefits — taxable | `ss_taxable` | ✓ |
| f1_64[0] | (year) | Lump-sum election year (§86(e)) | — | not filled |
| f1_65[0] | 7a | Capital gain or (loss) | `capital_gains_net` | ✓ |
| f1_66[0] | 8 | Additional income (Schedule 1, line 10) | `schedule1_additional` | ✓ |
| f1_67[0] | 9 | TOTAL INCOME | `total_income` | ✓ |
| f1_68[0] | 10 | Adjustments to income (Schedule 1, line 26) | `total_adjustments` | ✓ |
| f1_69[0] | 11a | ADJUSTED GROSS INCOME | `agi` | ✓ |

### Deductions / Tax (bottom of Page 1 — also repeated on Page 2)
| Field | Line | Form Label | ComputedValues Key | Status |
|---|---|---|---|---|
| f1_70[0] | 12e | Standard or itemized deduction | `deduction` | ✓ |
| f1_71[0] | 13a | Qualified Business Income deduction (§199A) | `qbi_deduction` | ✓ |
| f1_72[0] | 14 | Add lines 12e + 13a + 13b | `deduction + qbi_deduction` | ✓ |
| f1_73[0] | 15 | TAXABLE INCOME | `taxable_income` | ✓ |
| f1_74[0] | 16 | Tax | `income_tax_before_credits` | ✓ |
| f1_75[0] | 18 | Add lines 16 and 17 (no AMT) | `income_tax_before_credits` | ✓ |

---

## Form 1040 — Page 2 (AcroForm Page2)

### Tax and Credits carry-over
| Field | Line | Form Label | ComputedValues Key | Status |
|---|---|---|---|---|
| f2_01[0] | 11b | Amount from line 11a (AGI carryover) | `agi` | ✓ FIXED |
| f2_02[0] | 12e | Standard or itemized deduction | `deduction` | ✓ FIXED |
| f2_03[0] | 13a | QBI deduction (§199A) | `qbi_deduction` | ✓ FIXED |
| f2_04[0] | 13b | Additional deductions (Sch 1-A, line 38) | — | not filled (zero) |
| f2_05[0] | 14 | Add lines 12e + 13a + 13b | `deduction + qbi_deduction` | ✓ FIXED |
| f2_06[0] | 15 | TAXABLE INCOME | `taxable_income` | ✓ FIXED |

### Credits
| Field | Line | Form Label | ComputedValues Key | Status |
|---|---|---|---|---|
| f2_07[0] | 19 | Child tax credit or credit for other dependents | `child_tax_credit` | ✓ |
| f2_08[0] | 20 | Amount from Schedule 3, line 8 | — | not filled (zero) |
| f2_09[0] | 21 | TOTAL CREDITS | `total_credits` | ✓ |
| f2_10[0] | 22 | Tax after credits | `income_tax_after_credits` | ✓ |
| f2_11[0] | 23 | Other taxes including SE tax | `se_tax` | ✓ |
| f2_12[0] | 24 | TOTAL TAX | `total_tax` | ✓ |

### Payments
| Field | Line | Form Label | ComputedValues Key | Status |
|---|---|---|---|---|
| f2_13[0] | 25a | Federal income tax withheld — W-2 | `w2_withholding` | ✓ |
| f2_14[0] | 25b | Federal income tax withheld — 1099 / other | `other_withholding` | ✓ FIXED |
| f2_15[0] | 25c | Other forms (see instructions) | — | not filled (zero) |
| f2_17[0] | 25d | Add lines 25a + 25b + 25c | `w2_withholding + other_withholding` | ✓ FIXED |
| f2_18[0] | 26 | 2025 estimated tax payments | `estimated_tax_payments` | ✓ |
| SSN_ReadOrder[0].f2_22[0] | 26 footnote | Former spouse SSN | `household.payments.former_spouse_ssn` | ✓ FIXED |
| f2_24[0] | 33 | TOTAL PAYMENTS | `total_payments` | ✓ |

### Refund / Amount Owed
| Field | Line | Form Label | ComputedValues Key | Status |
|---|---|---|---|---|
| f2_25[0] | 34 | Amount overpaid | `refund` | ✓ |
| f2_26[0] | 35a | Amount of line 34 to refund | `refund` | ✓ FIXED |
| f2_28[0] | 37 | Amount owed | `amount_owed` | ✓ |

---

## Schedule 1 (f1040s1.pdf)

Fields confirmed by subform name in all_fields.txt are marked (name✓).
Fields confirmed by markitdown verification are marked (md✓).
Fields estimated from tab-order position are marked (est).

### Part I — Additional Income (Page 1)
| Field | Line | Form Label | ComputedValues Key | Status |
|---|---|---|---|---|
| f1_01[0] | header | Taxpayer name | — | not filled |
| f1_02[0] | header | SSN | — | not filled |
| f1_03[0] | 1 | Taxable refunds of state/local taxes | `taxable_refunds` | ✓ est |
| f1_04[0] | 2a | Alimony received | `alimony_received` | ✓ est |
| f1_05[0] | 3 | Business income (Sch C net) | `schedule_c_profit` | ✓ md✓ |
| f1_06[0] | 4 | Other gains/(losses) Form 4797 | — | not filled |
| f1_07[0] | 5 | Rental/royalties/K-1 (Sch E net) | `schedule_e_net` | ✓ md✓ |
| c1_1[0], c1_2[0] | ? | Unknown checkboxes | — | not filled |
| f1_08[0] | 6 | Farm income/(loss) from Sch F | `farm_income` | ✓ est |
| Line7_ReadOrder[0].c1_3[0] | 7 | Unemployment compensation checkbox | if `unemployment_compensation` > 0 | ✓ name✓ |
| Line7_ReadOrder[0].f1_11[0] | 7 | Unemployment compensation amount | `unemployment_compensation` | ✓ name✓ |
| Line8a_ReadOrder[0].f1_13[0] | 8a | Net operating loss | `net_operating_loss` | ✓ name✓ |
| f1_15[0] | 8b | Gambling winnings | `gambling_winnings` | ✓ md✓ |
| f1_16[0] | 8c | Cancellation of debt | `canceled_debt` | ✓ est |
| f1_17[0]–f1_34[0] | 8d–8v | Specialized other income lines | — | not filled |
| Line8z_ReadOrder[0].f1_35[0] | 8z | Other income description | `line8z_desc` | ✓ name✓ |
| f1_36[0] | 8z | Other income amount (prizes+other) | `line8z_amount` | ✓ est |
| f1_37[0] | 9 | Total Lines 8a–8z | `schedule1_line9` | ✓ md✓ |
| f1_38[0] | 10 | Carry to Form 1040 line 8 | `schedule1_additional` | ✓ md✓ |

### Part II — Adjustments to Income (Page 2)
Field order verified via mapFieldPositions.mjs: f2_10 in Line19b_CombField → f2_09=L19a;
f2_16 in Line24a_ReadOrder; f2_27 in Line24z_ReadOrder; f2_30=L26 total.
Lines 12 and 18 have no AcroForm field in this PDF.

| Field | Line | Form Label | ComputedValues Key | Status |
|---|---|---|---|---|
| f2_01[0], f2_02[0] | header | Name/SSN | — | not filled |
| f2_03[0] | 11 | Educator expenses | `educator_expenses` | ✓ md✓ |
| c2_1[0] | 11? | Unknown checkbox | — | not filled |
| f2_04[0] | 13 | HSA deduction (Form 8889) | `hsa_outside_payroll` | ✓ md✓ |
| f2_05[0] | 14 | Moving expenses (military only) | `moving_expenses_military` | ✓ md✓ |
| f2_06[0] | 15 | Deductible ½ of SE tax | `se_tax_deduction` | ✓ md✓ |
| f2_07[0] | 16 | SEP/SIMPLE/qualified plan | `sep_simple_contributions` | ✓ est |
| f2_08[0] | 17 | SE health insurance | `se_health_insurance` | ✓ md✓ |
| f2_09[0] | 19a | Alimony paid | `alimony_paid` | ✓ md✓ |
| Line19b_CombField[0].f2_10[0] | 19b | Alimony recipient SSN | `alimony_recipient_ssn` | ✓ name✓ |
| f2_11[0] | ? | Unknown field | — | not filled |
| c2_2[0] | ? | Unknown checkbox | — | not filled |
| f2_12[0] | 20 | IRA deduction | `ira_deduction` | ✓ md✓ |
| f2_13[0] | 21 | Student loan interest | `student_loan_interest` | ✓ md✓ |
| f2_14[0] | 22 | Tuition and fees (expired) | — | not filled |
| f2_15[0] | 23 | Archer MSA deduction | — | not filled |
| Line24a_ReadOrder[0].f2_16[0] | 24a | First additional adjustment desc | — | not filled |
| f2_17[0]–f2_26[0] | 24b–24y | Additional adjustment amounts | — | not filled |
| Line24z_ReadOrder[0].f2_27[0] | 24z | Last additional adjustment desc | `other_adjustments_desc` | ✓ name✓ |
| f2_28[0] | 24z | Last additional adjustment amount | `other_adjustments_amount` | ✓ name✓ |
| f2_29[0] | 25 | Total of Lines 24 items | `other_adjustments_amount` | ✓ est |
| f2_30[0] | 26 | Total adjustments | `total_adjustments` | ✓ md✓ |

---

## Schedule B (f1040sb.pdf)
| Field | Line | Form Label | ComputedValues Key | Status |
|---|---|---|---|---|
| Line1_ReadOrder.f1_03[0] | 1 (name) | Payer name | "Various payers" | ✓ |
| f1_04[0] | 1 (amount) | Interest amount | `taxable_interest` | ✓ |
| f1_33[0] | 2 | Total interest | `taxable_interest` | ✓ |
| ReadOrderControl.f1_34[0] | 4 | Taxable interest | `taxable_interest` | ✓ |
| f1_35[0] | Part II (name) | Payer name | "Various payers" | ✓ |
| f1_36[0] | Part II (amount) | Dividend amount | `ordinary_dividends` | ✓ |
| f1_65[0] | 6 | Total ordinary dividends | `ordinary_dividends` | ✓ |

---

## Schedule C (f1040sc.pdf) — per business
| Field | Line | Form Label | ComputedValues Key | Status |
|---|---|---|---|---|
| f1_1[0] | (header) | Proprietor name | `displayName` | ✓ |
| BComb.f1_4[0] | A | Business name | `biz.business_name` | ✓ |
| f1_10[0] | 1 | Gross receipts / sales | `biz.gross_revenue` | ✓ |
| f1_12[0] | 3 | Gross receipts less returns | `biz.gross_revenue` | ✓ |
| f1_14[0] | 5 | Gross profit | `biz.gross_revenue` | ✓ |
| f1_16[0] | 7 | Gross income | `biz.gross_revenue` | ✓ |
| f1_41[0] | 28 | Total expenses | `biz.expenses` | ✓ |
| f1_42[0] | 29 | Tentative profit | `biz.net_profit_loss` | ✓ |
| f1_45[0] | 31 | NET PROFIT OR (LOSS) | `biz.net_profit_loss` | ✓ |

---

## Schedule D (f1040sd.pdf)
| Field | Line | Form Label | ComputedValues Key | Status |
|---|---|---|---|---|
| Table_PartI.Row1a.f1_3[0] | 1a (desc) | Description | "Various" | ✓ |
| Table_PartI.Row1a.f1_6[0] | 1a (gain) | Short-term gain/(loss) | `stcg` | ✓ |
| f1_22[0] | 7 | Net short-term gain/(loss) | `stcg` | ✓ |
| Table_PartII.Row8a.f1_23[0] | 8a (desc) | Description | "Various" | ✓ |
| Table_PartII.Row8a.f1_26[0] | 8a (gain) | Long-term gain/(loss) | `ltcg` | ✓ |
| f1_42[0] | 14 | Net long-term gain/(loss) | `ltcg` | ✓ |
| f1_43[0] | 15 | Carry to Form 1040 | `ltcg (if > 0)` | ✓ |
| Page2.f2_2[0] | 16 | Combined net gain/(loss) | `stcg + ltcg` | ✓ |

---

## Schedule SE (f1040sse.pdf)
| Field | Line | Form Label | ComputedValues Key | Status |
|---|---|---|---|---|
| f1_1[0] | (header) | Name | `displayName` | ✓ |
| f1_5[0] | 2 | Net profit from Schedule C | `schedule_c_profit` | ✓ |
| f1_6[0] | 3 | Combine 1a+1b+2 | `schedule_c_profit` | ✓ |
| f1_7[0] | 4a | × 0.9235 | `seNet` | ✓ |
| f1_9[0] | 4c | Net SE earnings | `seNet` | ✓ |
| f1_12[0] | 6 | Net SE earnings (min $400 test) | `seNet` | ✓ |
| f1_13[0] | 7 | Maximum SS wage base ($176,100) | 176,100 | ✓ |
| Line8a_ReadOrder.f1_14[0] | 8a | W-2 SS wages | `wages` | ✓ |
| f1_17[0] | 8d | Total SS wages | `ssWages` | ✓ |
| f1_18[0] | 9 | Remaining room under SS base | `line9` | ✓ |
| f1_19[0] | 10 | SS portion (12.4%) | `ssSe` | ✓ |
| f1_20[0] | 11 | Medicare portion (2.9%) | `medSe` | ✓ |
| f1_21[0] | 12 | SE TAX TOTAL | `se_tax` | ✓ |
| f1_22[0] | 13 | Deduction for ½ SE tax | `se_tax_deduction` | ✓ |
