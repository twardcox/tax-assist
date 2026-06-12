# Opportunity Report — Tax Year 2025

_Generated: 6/11/26, 6:05 PM_

## Summary

Total benefits evaluated: **59**

- eligible_now: 16
- nearly_eligible: 14
- eligible_if_changed: 9
- future_opportunity: 2
- not_applicable: 18

## Eligible Now

| Benefit | Est. Value | Risk | Forms |
|---------|-----------|------|-------|
| County Homestead Property Tax Exemption | $50 – $500+/year | low | County homestead exemption application (varies by county — search '[county] homestead exemption application') |
| 1031 Like-Kind Exchange (Tax-Deferred Real Estate Sale) | Deferred tax on ~153,300 gain + depreciation recapture | moderate | Form 8824 (Like-Kind Exchanges — filed for each exchange) |
| Energy Efficient Home Improvement Credit (§25C) | $600 - $3,200/year | low | Form 5695, Part II |
| 529-to-Roth IRA Rollover (SECURE 2.0) | Up to $35,000 in Roth IRA contributions without income limit | low | Form 5329 (if applicable, for excess contributions), Roth IRA custodian rollover documentation |
| Annual Gift Tax Exclusion | $19,000-$38,000 per recipient per year removed from taxable estate | low | Form 709 (only required if above annual exclusion or gift splitting) |
| Business Vehicle Deduction (Mileage or Actual Expense) | ~$5,628+ per year | low | Schedule C, Part IV (vehicle information), Form 4562 (if claiming depreciation) |
| Child and Dependent Care Credit (CDCC) | ~$0/year | low | Form 2441 (Child and Dependent Care Expenses) |
| Child Tax Credit (CTC) | ~$4,000/year | low | Schedule 8812 (Credits for Qualifying Children and Other Dependents) |
| Home Office Deduction | $500 – $5,000+/year | medium | Form 8829 (regular method — homeowners and renters), Schedule C, Line 30 (simplified method — no Form 8829 needed) |
| Qualified Opportunity Zone Investment | Deferred tax on $8,080 + potential 10-year exclusion on QOF appreciation | moderate | Form 8949 (original gain reporting), Form 8997 (QOF investment tracking) |
| Qualified Business Income (QBI) Deduction | ~$1,802/year (before taxable income cap) | low | Form 8995 (below income threshold), Form 8995-A (above income threshold or multiple businesses) |
| Qualified Small Business Stock Exclusion (§1202) | 100% federal capital gains exclusion on qualifying gains (no upper limit with 10× basis rule) | high_review_required | Form 8949 (Sales and Other Dispositions of Capital Assets), Schedule D |
| Rental Property Depreciation | ~$10,786/year non-cash deduction | low | Schedule E (rental income and expenses), Form 4562 (depreciation schedule) |
| Section 121 Primary Residence Gain Exclusion | Up to $500,000 gain excluded | low | Schedule D (Capital Gains and Losses), Form 8949 (Sales and Other Dispositions of Capital Assets) |
| State Homestead Property Tax Exemption | $200 – $2,000+/year | low | County homestead exemption application (varies by county) |
| No State Income Tax Benefit | $2,000 – $30,000+/year depending on income and prior-state comparison | low | — |

## Nearly Eligible — More Info Needed

### County Solar / Renewable Energy Property Tax Exemption

WA mandates that counties exempt the added value of solar installations from property tax assessment. If you have or are considering solar panels, their value will not increase your property tax bill.

**Missing facts:**
- `household.residence.state`
- `household.residence.county`
- `real_estate.properties (primary_residence present)`

**Next steps:**
- Verify your current property tax bill does not include solar panel value
- In mandatory-exemption states this is typically automatic after installation
- Stack with the federal 30% Residential Clean Energy Credit (Form 5695)
- Factor this exemption into your solar ROI calculation before installing

### American Opportunity Tax Credit (AOTC)

Has dependents. Confirm whether any are in first four years of college.

**Missing facts:**
- `dependents.education.school_level`
- `dependents.education.tuition_paid`

### Bonus Depreciation (First-Year Expensing)

Has business — bonus depreciation (40% in 2025) available on assets placed in service this year. Rate drops to 20% in 2026.

**Missing facts:**
- `businesses.depreciation.assets_placed_in_service`

**Next steps:**
- Identify qualifying asset purchases this year
- Apply Section 179 first, bonus on remainder
- Consider cost segregation study on real estate for QIP reclassification

### Residential Clean Energy Credit (Solar, Battery, Wind)

Homeowner qualifies for 30% credit on solar panels, battery storage, wind, or geothermal installed at your home.

**Missing facts:**
- `real_estate[*].property_type`
- `household.estimated_agi`

**Next steps:**
- Get solar quotes from 3+ installers - 30% credit applies through 2032
- Battery storage (3 kWh+) qualifies even without solar
- Check state and utility rebates that stack on top of federal credit

### Employer-Provided Childcare Credit (§45F)

Has a business — §45F credit is available if you pay for qualified childcare facilities or resource/referral services for employees. No W-2 employees recorded yet.

**Missing facts:**
- `businesses.employees.w2_employees_count`

### Clean Vehicle Credit (EV Tax Credit)

Income qualifies for EV credit (up to $7,500 new / $4,000 used). Check vehicle eligibility at fueleconomy.gov.

**Missing facts:**
- `household.estimated_agi`
- `household.filing_status`

**Next steps:**
- Verify vehicle VIN qualifies at fueleconomy.gov before purchasing
- Use point-of-sale transfer option to receive credit as immediate discount at dealer
- Check MSRP limits: SUV/truck/van <= $80,000; sedan <= $55,000

### Health Savings Account (HSA) — Triple Tax Advantage

Not confirmed on HDHP. Switching to a qualifying HDHP unlocks the HSA triple tax advantage.

**Missing facts:**
- `healthcare.hdhp_enrolled`

### ICHRA / QSEHRA — Individual Health Reimbursement Arrangement

Has a business — ICHRA/QSEHRA allows tax-free health reimbursements to employees as an alternative to group health insurance. No W-2 employees recorded yet.

**Missing facts:**
- `businesses.employees.w2_employees_count`

### Net Unrealized Appreciation (NUA) — §402(e)(4)

Has retirement plan — if plan holds appreciated employer stock, NUA strategy may apply. Record employer stock NUA amount to calculate potential savings.

**Missing facts:**
- `retirement.employer_plans.traditional_401k.employer_stock_nua`

### Section 179 Immediate Expensing

Has business — Section 179 available if equipment or vehicles are purchased this year.

**Missing facts:**
- `businesses.depreciation.assets_placed_in_service`

**Next steps:**
- Record any business assets purchased in businesses.yaml
- Consider whether needed equipment purchase makes sense before year-end

### SEP-IRA Contribution Deduction

SEP-IRA not yet established. Can contribute up to $2,093.134 for tax year 2025.

**Missing facts:**
- `businesses[*].entity_type`
- `businesses[*].financials.net_profit_loss`
- `retirement.sep_ira.established`
- `retirement.sep_ira.contributions_ytd`
- `businesses[*].employees.w2_employees_count`

**Next steps:**
- Open SEP-IRA at Fidelity, Vanguard, or Schwab (takes 15 minutes)
- Can establish and fund up to October 15 (with extension)
- Max contribution: $2,093.134

### Small Employer Retirement Plan Startup Credit (§45E)

Has a business — §45E credit is available when you add employees and set up a new retirement plan. No W-2 employees recorded (solo operators do not qualify for this specific credit).

**Missing facts:**
- `businesses.employees.w2_employees_count`

### Solo 401(k) — Self-Employed Retirement Plan

Solo 401(k) not yet established. Must be set up by December 31 to contribute for 2025.

**Missing facts:**
- `businesses[*].entity_type`
- `businesses[*].financials.net_profit_loss`
- `businesses[*].employees.w2_employees_count`
- `retirement.solo_401k.established`
- `retirement.solo_401k.employee_contributions_ytd`
- `taxpayer.age`

**Next steps:**
- Open Solo 401(k) at Fidelity (free plan, no admin fees)
- MUST be established by December 31 — cannot retroactively create
- Employee deferrals also due by December 31
- Employer profit-sharing contribution can be made up to October 15

### Work Opportunity Tax Credit (WOTC) — §51

Has a business — WOTC is available when you hire from targeted groups (veterans, SNAP recipients, ex-felons, long-term unemployed, etc.). No W-2 employees recorded yet.

**Missing facts:**
- `businesses.employees.w2_employees_count`

## Eligible If Changed

### Augusta Rule — Home Rental to Business (Section 280A(g))

Augusta Rule available — rent your home to your business for up to 14 days/year tax-free.

**Changes needed:**
- Schedule legitimate business meeting(s) or events at your home
- Create a written rental agreement between yourself and your business
- Invoice your business at fair market rental rate (document comparable rates)
- Ensure payment is actually made from business account to your personal account
- Document the meeting agenda and attendees
- Keep total rental days at 14 or fewer — the 15th day eliminates the exclusion

### Charitable Contribution Deduction

Not currently itemizing — charitable deduction only applies when itemizing.

**Changes needed:**
- Calculate total itemized deductions (mortgage interest + SALT + charitable)
- If total exceeds standard deduction ($30,000 MFJ / $15,000 Single), itemize
- Consider bunching 2-3 years of giving via a Donor-Advised Fund

### Conservation Easement Deduction — §170(h)

Has real estate — conservation easement deduction (§170(h)) requires land with conservation potential (farm, ranch, undeveloped land, habitat, scenic corridor). No qualifying land type identified in your data.

**Changes needed:**
- Own land with qualifying conservation purpose

### Cost Segregation Study

Property value ~395,500 — cost segregation study may not be cost-effective below $500,000.

**Changes needed:**
- Acquire higher-value properties where study ROI is clear (typically $1M+)

### Installment Sale Method — §453

Has 2 appreciated properties — if you sell with seller financing, the installment method spreads capital gains across payment years, keeping income in lower brackets.

**Changes needed:**
- Negotiate seller financing terms when selling real estate or business

### Mortgage Interest Deduction

Has mortgage interest but not itemizing — deduction only applies when itemizing.

**Changes needed:**
- Calculate if total itemized deductions exceed standard deduction

### Rental Real Estate Passive Loss & $25,000 Allowance

AGI 212,000 — $25,000 rental loss allowance fully phased out. Losses carry forward.

**Changes needed:**
- Qualify as Real Estate Professional (750+ hours) to deduct losses without limit
- Use short-term rentals (avg stay < 7 days) with material participation as alternative
- Carry forward losses to offset future rental income or sale gains

### Real Estate Professional Status (REP)

Real Estate Professional status would unlock unlimited rental loss deductions against ordinary income.

**Changes needed:**
- Spend more than 750 hours per year in real property activities
- Ensure real estate hours exceed hours in any other profession
- Maintain detailed hourly activity logs throughout the year
- File material participation statement or aggregation election

### S Corporation Election (SE Tax Reduction)

Net profit of ~9,009 may be too low for S Corp payroll overhead to produce net savings.

**Changes needed:**
- Grow net profit above ~$50,000 where S Corp economics are usually stronger
- Model self-employment tax savings versus payroll/admin costs

## Future Opportunities

- **Net Operating Loss (NOL) Carryforward** — Business is profitable (net $9,009). NOL carryforward becomes relevant in any future loss year. Track cumulative NOL balance if prior years had losses.
- **Qualified Longevity Annuity Contract (QLAC) — §401(a)(9)** — QLAC is most valuable near or in retirement. At age 42, focus on maximizing contributions first. Revisit at age 60+.

