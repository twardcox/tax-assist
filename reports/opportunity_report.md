# Opportunity Report — Tax Year 2025

_Generated: 6/16/26, 3:29 PM_

## Summary

Total benefits evaluated: **59**

- eligible_now: 2
- nearly_eligible: 11
- eligible_if_changed: 5
- future_opportunity: 2
- not_applicable: 39

## Eligible Now

| Benefit | Est. Value | Risk | Forms |
|---------|-----------|------|-------|
| State Homestead Property Tax Exemption | $200 – $2,000+/year | low | County homestead exemption application (varies by county) |
| No State Income Tax Benefit | $2,000 – $30,000+/year depending on income and prior-state comparison | low | — |

## Nearly Eligible — More Info Needed

### County Disability Property Tax Exemption

Disability confirmed. This exemption requires owning a primary residence — apply immediately after purchasing a home.

**Missing facts:**
- `real_estate.properties (primary_residence)`

### County Veteran Property Tax Exemption

Veteran status confirmed. This exemption applies when you own a primary residence — apply immediately after purchasing a home.

**Missing facts:**
- `real_estate.properties (primary_residence)`

### Energy Efficient Home Improvement Credit (§25C)

Real estate found but no primary residence classified. Section 25C applies to primary residences.

**Missing facts:**
- `real_estate.properties (property_type: primary_residence)`

### American Opportunity Tax Credit (AOTC)

Has dependents. Confirm whether any are in first four years of college.

**Missing facts:**
- `dependents.education.school_level`
- `dependents.education.tuition_paid`

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

### Net Operating Loss (NOL) Carryforward

Has business but net profit/loss not recorded — if business had a net loss, an NOL may exist.

**Missing facts:**
- `businesses.financials.net_profit_loss`

### Small Employer Retirement Plan Startup Credit (§45E)

Has a business — §45E credit is available when you add employees and set up a new retirement plan. No W-2 employees recorded (solo operators do not qualify for this specific credit).

**Missing facts:**
- `businesses.employees.w2_employees_count`

### Work Opportunity Tax Credit (WOTC) — §51

Has a business — WOTC is available when you hire from targeted groups (veterans, SNAP recipients, ex-felons, long-term unemployed, etc.). No W-2 employees recorded yet.

**Missing facts:**
- `businesses.employees.w2_employees_count`

## Eligible If Changed

### 529-to-Roth IRA Rollover (SECURE 2.0)

SECURE 2.0 §126: unused 529 funds can roll to the beneficiary's Roth IRA tax-free. No 529 account recorded. Open one now to start the 15-year account age requirement.

**Changes needed:**
- Open a 529 account — the account must be at least 15 years old before rolling

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

### Installment Sale Method — §453

Has a business — installment sale method available if you sell the business and negotiate seller financing with the buyer.

**Changes needed:**
- Negotiate installment terms in business sale agreement

### Mortgage Interest Deduction

Has mortgage interest but not itemizing — deduction only applies when itemizing.

**Changes needed:**
- Calculate if total itemized deductions exceed standard deduction

## Future Opportunities

- **Qualified Opportunity Zone Investment** — No realized capital gains recorded. Opportunity Zone deferral becomes relevant when selling appreciated assets.
- **Qualified Small Business Stock Exclusion (§1202)** — If you invest in or found a qualifying C corporation startup, §1202 may exclude 100% of gains up to $10M+. Set investments.has_qualified_small_business_stock: true if applicable.

