# IRS Form Field Map — Tax Year 2025
# Verified via markitdown + visual inspection

## Form 1040 — Page 1 (AcroForm Page1)

### Header
| Field | Form Label | ComputedValues Key | Status |
|---|---|---|---|
| f1_01[0] | Your first name and middle initial | `household.taxpayer.first_name` | ✓ |
| f1_02[0] | Last name | `household.taxpayer.last_name` | ✓ |
| f1_03[0] | Your social security number | `household.taxpayer.ssn` | ✓ |
| f1_04[0] | Spouse's first name and middle initial | `household.spouse.first_name` | ✓ |
| f1_05[0] | Spouse's last name | `household.spouse.last_name` | ✓ |
| f1_06[0] | Spouse's social security number | `household.spouse.ssn` | ✓ |
| Address_ReadOrder.f1_20[0] | Home address (number and street) | `household.residence.street_address` | ✓ |
| Address_ReadOrder.f1_21[0] | Apt. no. | — | not filled |
| Address_ReadOrder.f1_22[0] | City, town, or post office | `household.residence.city` | ✓ |
| Address_ReadOrder.f1_23[0] | State | `household.residence.state` | ✓ |
| Address_ReadOrder.f1_24[0] | ZIP code | `household.residence.zip` | ✓ |

### Filing Status Checkboxes
| Field | Form Label | Status |
|---|---|---|
| c1_5[0] | Single | ✓ |
| c1_6[0] | Married filing jointly | ✓ |
| c1_7[0] | Married filing separately | ✓ |
| c1_9[0] | Head of household | ✓ |
| c1_10[0] | Qualifying surviving spouse | ✓ |

### Dependents (not filled — CPA responsibility)
| Field | Form Label |
|---|---|
| Table_Dependents.Row1.f1_31[0] | Dependent 1 first name |
| Table_Dependents.Row1.f1_32[0] | Dependent 1 last name |
| Table_Dependents.Row1.f1_33[0] | Dependent 1 SSN |
| Table_Dependents.Row1.f1_34[0] | Dependent 1 relationship |
| (Row2–Row4 follow same pattern: f1_35–f1_46) | | |

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
| f2_24[0] | 33 | TOTAL PAYMENTS | `total_payments` | ✓ |

### Refund / Amount Owed
| Field | Line | Form Label | ComputedValues Key | Status |
|---|---|---|---|---|
| f2_25[0] | 34 | Amount overpaid | `refund` | ✓ |
| f2_26[0] | 35a | Amount of line 34 to refund | `refund` | ✓ FIXED |
| f2_28[0] | 37 | Amount owed | `amount_owed` | ✓ |

---

## Schedule 1 (f1040s1.pdf)
| Field | Page | Line | Form Label | ComputedValues Key | Status |
|---|---|---|---|---|---|
| f1_05[0] | 1 | 3 | Business income (Sch C net) | `schedule_c_profit` | ✓ |
| f1_07[0] | 1 | 5 | Rental / royalties (Sch E net) | `schedule_e_net` | ✓ |
| f1_15[0] | 1 | 8b | Gambling winnings | `gambling_winnings` | ✓ |
| f1_37[0] | 1 | 9 | Total additional income | `schedule1_additional` | ✓ |
| f1_38[0] | 1 | 10 | Carry to Form 1040 line 8 | `schedule1_additional` | ✓ |
| f2_03[0] | 2 | 11 | Educator expenses | `educator_expenses` | ✓ |
| f2_05[0] | 2 | 13 | HSA deduction | `hsa_outside_payroll` | ✓ |
| f2_06[0] | 2 | 14 | Moving expenses (military) | `moving_expenses_military` | ✓ |
| f2_07[0] | 2 | 15 | Deductible ½ of SE tax | `se_tax_deduction` | ✓ |
| f2_08[0] | 2 | 16 | SE health insurance | `se_health_insurance` | ✓ |
| f2_13[0] | 2 | 20 | IRA deduction | `ira_deduction` | ✓ |
| f2_14[0] | 2 | 21 | Student loan interest | `student_loan_interest` | ✓ |
| f2_30[0] | 2 | 26 | Total adjustments | `total_adjustments` | ✓ |

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
