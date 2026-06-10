# Opportunity Report — Tax Year 2025

_Generated: 6/10/26, 3:31 PM_

## Summary

Total benefits evaluated: **59**

- nearly_eligible: 21
- eligible_if_changed: 3
- future_opportunity: 2
- not_applicable: 33

## Nearly Eligible — More Info Needed

### Energy Efficient Home Improvement Credit (§25C)

Real estate found but no primary residence classified. Section 25C applies to primary residences.

**Missing facts:**
- `real_estate.properties (property_type: primary_residence)`

### American Opportunity Tax Credit (AOTC)

Has dependents. Confirm whether any are in first four years of college.

**Missing facts:**
- `dependents.education.school_level`
- `dependents.education.tuition_paid`

### Capital Gains 0% Bracket Tax Harvesting

Capital gains 0% bracket harvesting opportunity — enter AGI to evaluate if you fall within the 0% rate bracket.

**Missing facts:**
- `household.estimated_agi`

### Charitable Contribution Deduction

Itemization status not confirmed — charitable deduction valuable if itemizing.

**Missing facts:**
- `household.itemizing_deductions`

**Next steps:**
- Compare total itemized deductions to standard deduction amount

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

### Foreign Earned Income Exclusion (FEIE)

No US state recorded — may qualify for Foreign Earned Income Exclusion ($130,000 for 2025) if living abroad.

**Missing facts:**
- `household.residence.state or foreign country confirmation`

### Health Savings Account (HSA) — Triple Tax Advantage

Not confirmed on HDHP. Switching to a qualifying HDHP unlocks the HSA triple tax advantage.

**Missing facts:**
- `healthcare.hdhp_enrolled`

### ICHRA / QSEHRA — Individual Health Reimbursement Arrangement

Has a business — ICHRA/QSEHRA allows tax-free health reimbursements to employees as an alternative to group health insurance. No W-2 employees recorded yet.

**Missing facts:**
- `businesses.employees.w2_employees_count`

### Lifetime Learning Credit (LLC)

Lifetime Learning Credit available for any post-secondary education (grad school, professional courses).

**Missing facts:**
- `dependents.education.tuition_paid`

**Next steps:**
- Record tuition expenses in dependents.yaml
- Collect Form 1098-T

### Mortgage Interest Deduction

Has real estate but mortgage interest amount not recorded.

**Missing facts:**
- `real_estate.financing.mortgage_interest_paid`

### Net Operating Loss (NOL) Carryforward

Has business but net profit/loss not recorded — if business had a net loss, an NOL may exist.

**Missing facts:**
- `businesses.financials.net_profit_loss`

### State and Local Tax Deduction (SALT)

Itemization status not confirmed — SALT deduction (up to $10,000) available if itemizing.

**Missing facts:**
- `household.itemizing_deductions`

### Retirement Savings Contributions Credit (Saver's Credit)

Saver's Credit available for moderate-income taxpayers with retirement contributions. Enter AGI to evaluate.

**Missing facts:**
- `household.estimated_agi`
- `retirement contributions`

### Small Employer Retirement Plan Startup Credit (§45E)

Has a business — §45E credit is available when you add employees and set up a new retirement plan. No W-2 employees recorded (solo operators do not qualify for this specific credit).

**Missing facts:**
- `businesses.employees.w2_employees_count`

### Work Opportunity Tax Credit (WOTC) — §51

Has a business — WOTC is available when you hire from targeted groups (veterans, SNAP recipients, ex-felons, long-term unemployed, etc.). No W-2 employees recorded yet.

**Missing facts:**
- `businesses.employees.w2_employees_count`

### State 529 Plan Contribution Deduction/Credit

Set residence state to check whether a state 529 deduction is available.

**Missing facts:**
- `household.residence.state`

### State Electric Vehicle Tax Credit

Set household.residence.state to check state EV credit availability.

**Missing facts:**
- `household.residence.state`

### State Homestead Property Tax Exemption

Set household.residence.state to check homestead exemption availability.

**Missing facts:**
- `household.residence.state`

### No State Income Tax Benefit

State of residence is missing, so no-income-tax-state cannot be evaluated.

**Missing facts:**
- `household.residence.state`

### State Retirement Income Exemption

Set household.residence.state to check if your state exempts retirement income.

**Missing facts:**
- `household.residence.state`

## Eligible If Changed

### 529-to-Roth IRA Rollover (SECURE 2.0)

SECURE 2.0 §126: unused 529 funds can roll to the beneficiary's Roth IRA tax-free. No 529 account recorded. Open one now to start the 15-year account age requirement.

**Changes needed:**
- Open a 529 account — the account must be at least 15 years old before rolling

### Conservation Easement Deduction — §170(h)

Has real estate — conservation easement deduction (§170(h)) requires land with conservation potential (farm, ranch, undeveloped land, habitat, scenic corridor). No qualifying land type identified in your data.

**Changes needed:**
- Own land with qualifying conservation purpose

### Installment Sale Method — §453

Has a business — installment sale method available if you sell the business and negotiate seller financing with the buyer.

**Changes needed:**
- Negotiate installment terms in business sale agreement

## Future Opportunities

- **Qualified Opportunity Zone Investment** — No realized capital gains recorded. Opportunity Zone deferral becomes relevant when selling appreciated assets.
- **Qualified Small Business Stock Exclusion (§1202)** — If you invest in or found a qualifying C corporation startup, §1202 may exclude 100% of gains up to $10M+. Set investments.has_qualified_small_business_stock: true if applicable.

