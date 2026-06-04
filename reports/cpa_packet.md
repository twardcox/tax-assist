# CPA Review Packet

**Prepared by:** UTBIS  
**Date:** 2026-06-02 12:49  
**Tax Year:** 2025  

---

## Taxpayer Facts Summary

| Field | Value |
|-------|-------|
| Filing Status | None |
| State | None |
| Estimated AGI | None |
| Tax Year | 2025 |

---


## Near-Miss Opportunities — CPA Guidance Needed

### American Opportunity Tax Credit (AOTC)
Has dependents — confirm if any are enrolled in first 4 years of college.

**Missing:**
- `dependents.education.school_level`
- `dependents.education.tuition_paid`

### Annual Gift Tax Exclusion
Annual gift tax exclusion: $19,000 per recipient per year (2025) — $38,000 per recipient for married couples.


**Next Steps:**
- Identify recipients: children, grandchildren, siblings, etc.
- Make gifts by December 31
- Direct tuition/medical payments to institutions are additionally excluded (no dollar limit)
- Consider 529 superfunding: 5 years of exclusion at once ($95,000 single / $190,000 MFJ per beneficiary)

### Charitable Contribution Deduction
Itemization status not confirmed — charitable deduction valuable if itemizing.

**Missing:**
- `household.itemizing_deductions`

**Next Steps:**
- Compare total itemized deductions to standard deduction amount

### Clean Vehicle Credit (EV Tax Credit)
Income qualifies for EV credit (up to $7,500 new / $4,000 used). Check vehicle eligibility at fueleconomy.gov.


**Next Steps:**
- Verify vehicle VIN qualifies at fueleconomy.gov before purchasing
- Use point-of-sale transfer option to receive credit as immediate discount at dealer
- Check MSRP limits: SUV/truck/van ≤ $80,000; sedan ≤ $55,000

### Foreign Earned Income Exclusion (FEIE)
No US state recorded — may qualify for Foreign Earned Income Exclusion ($130,000 for 2025) if living abroad.

**Missing:**
- `household.residence.state or foreign country confirmation`

### Health Savings Account (HSA) — Triple Tax Advantage
Not confirmed on HDHP. Switching to a qualifying HDHP unlocks the HSA triple tax advantage.

**Missing:**
- `healthcare.hdhp_enrolled`

### Lifetime Learning Credit (LLC)
Lifetime Learning Credit available for any post-secondary education (grad school, professional courses).

**Missing:**
- `dependents.education.tuition_paid`

**Next Steps:**
- Record tuition expenses in dependents.yaml
- Collect Form 1098-T

### Mortgage Interest Deduction
Has real estate but mortgage interest amount not recorded.

**Missing:**
- `real_estate.financing.mortgage_interest_paid`

### State and Local Tax Deduction (SALT)
Itemization status not confirmed — SALT deduction (up to $10,000) available if itemizing.

**Missing:**
- `household.itemizing_deductions`


---

## Questions for CPA

1. Please review all `nearly_eligible` items above and confirm which gaps can be closed.
2. Please advise on any `eligible_if_changed` structural changes that make economic sense.
3. Please confirm risk levels and documentation requirements for all claimed deductions.
4. Please review carryforward amounts from prior years.

---

_This packet is prepared for CPA review and planning purposes only._
