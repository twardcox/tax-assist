const BENEFIT_IDS = [
  "qbi-deduction", "s-corp-election", "sep-ira-contribution", "solo-401k",
  "self-employed-health-insurance", "hsa-triple-tax-advantage",
  "section-179-expensing", "bonus-depreciation", "business-vehicle-deduction",
  "home-office-deduction",
  "real-estate-depreciation", "passive-activity-loss", "1031-exchange",
  "augusta-rule", "real-estate-professional-status", "cost-segregation",
  "charitable-contribution-deduction", "mortgage-interest-deduction",
  "salt-deduction", "25c-energy-home-improvement",
  "backdoor-roth-ira", "savers-credit", "529-to-roth-rollover",
  "small-employer-retirement-startup-credit",
  "child-tax-credit", "child-dependent-care-credit", "earned-income-tax-credit",
  "american-opportunity-credit", "lifetime-learning-credit",
  "residential-clean-energy-credit", "clean-vehicle-credit",
  "premium-tax-credit",
  "capital-gains-harvesting", "qsbs-exclusion", "nol-carryforward",
  "opportunity-zone-investment", "annual-gift-tax-exclusion",
  "section-121-exclusion", "foreign-earned-income-exclusion",
  "no-income-tax-state", "pte-election", "state-529-deduction",
  "state-retirement-income-exemption", "state-homestead-exemption",
  "state-ev-credit",
  "county-homestead-exemption", "county-senior-property-tax-freeze",
  "county-veteran-property-tax-exemption", "county-disability-property-tax-exemption",
  "county-solar-exemption", "county-agricultural-use-valuation",
  "employer-childcare-credit", "work-opportunity-tax-credit",
  "net-unrealized-appreciation", "installment-sale",
  "excess-fica-refund", "ichra-qsehra", "conservation-easement", "qlac"
] as const;

const benefitList = BENEFIT_IDS.map((benefitId) => `  - ${benefitId}`).join("\n");

export const RECEIPT_PROMPT = `You are a tax document extraction specialist. Examine this expense receipt or invoice.

Return ONLY a valid JSON object with this exact structure (no other text):
{
  "document_type": "receipt|invoice|mileage_log|other",
  "merchant_or_payer": "string or null",
  "date": "YYYY-MM-DD or null",
  "total_amount": 0.00,
  "description": "brief one-line description",
  "tax_category": "business_expense|personal_expense|mixed_use|rental_expense|capital_improvement|repair|medical|charitable|education|needs_review",
  "deductible_pct": 1.0,
  "benefit_ids": [],
  "form_line": "IRS form and line number string or null",
  "suggested_updates": [
    {
      "yaml_file": "businesses|income|real_estate|healthcare|investments",
      "dot_path": "dot.separated.path",
      "operation": "add|set",
      "value": 0.00,
      "label": "human-readable description"
    }
  ],
  "confidence": "high|medium|low",
  "notes": "any important caveats"
}

Rules for deductible_pct (0.0 to 1.0):
- 1.0 for fully deductible business expenses
- 0.5 for business meals (IRC §274)
- 0.5 or less for home office if mixed-use
- 0.0 for clearly personal expenses
- Estimate business-use percentage for mixed-use items (phone, vehicle, internet)

Rules for benefit_ids — pick ALL that apply from this list:
${benefitList}

Rules for suggested_updates:
- Use "add" for cumulative amounts (expenses, revenue totals, mileage)
- Use "set" for specific named values (employer name, tax withheld)
- Only include updates you are confident about
- Apply the FULL amount in value (not scaled by deductible_pct — the system scales it)
- Common dot paths:
  - Business expenses: businesses.0.financials.operating_expenses
  - Office expense: businesses.0.financials.operating_expenses
  - Business miles: businesses.0.vehicle.business_miles
  - Rental expenses: real_estate.properties.0.expenses.repairs_maintenance
  - Medical expenses: healthcare.out_of_pocket_expenses
  - Charitable (cash): income.adjustments_to_income (if above-the-line)
  - Mortgage interest: real_estate.properties.0.financing.mortgage_interest_paid
  - Property tax: real_estate.properties.0.financing.property_tax_paid`;

export const INCOME_FORM_PROMPT = `You are a tax document extraction specialist. Examine this income tax form.

First identify the form type, then extract ALL relevant box values.

Return ONLY a valid JSON object with this exact structure (no other text):
{
  "document_type": "w2|1099_nec|1099_misc|1099_int|1099_div|1099_b|1099_r|1098|1098t|1098e|k1|ssa1099|other",
  "merchant_or_payer": "employer or payer name",
  "payer_ein": "XX-XXXXXXX or null",
  "date": "YYYY or YYYY-MM-DD",
  "total_amount": 0.00,
  "description": "brief description e.g. W-2 from Acme Corp",
  "tax_category": "w2_income|self_employment_income|interest_income|dividend_income|retirement_distribution|rental_income|other_income",
  "deductible_pct": 1.0,
  "benefit_ids": [],
  "form_line": "IRS form and line e.g. Form 1040 Line 1a",
  "suggested_updates": [],
  "confidence": "high|medium|low",
  "notes": "any important caveats"
}

W-2 specific — set these suggested_updates:
  - income.w2_employment.0.employer_name  (operation: set, value: employer name string)
  - income.w2_employment.0.wages           (operation: set, value: Box 1 amount)
  - income.w2_employment.0.federal_withheld (operation: set, value: Box 2 amount)
  - income.w2_employment.0.state_withheld  (operation: set, value: Box 17 amount if present)

1099-NEC specific:
  - income.self_employment.0.gross_revenue  (operation: add, value: Box 1 nonemployee comp)

1099-INT specific:
  - income.investment_income.interest       (operation: add, value: Box 1 interest income)

1099-DIV specific:
  - income.investment_income.ordinary_dividends  (operation: add, value: Box 1a)
  - income.investment_income.qualified_dividends (operation: add, value: Box 1b)

1099-R specific:
  - income.retirement_distributions.traditional_ira or .401k  (operation: add, value: Box 1)

1098 (mortgage interest) specific:
  - real_estate.properties.0.financing.mortgage_interest_paid (operation: set, value: Box 1)

1098-T (tuition) specific:
  - benefit_ids should include "american-opportunity-credit" or "lifetime-learning-credit"

1098-E (student loan interest) specific:
  - income.adjustments_to_income.student_loan_interest  (operation: add, value: Box 1)

SSA-1099 (Social Security) specific:
  - income.social_security.gross_benefits  (operation: set, value: net benefits Box 5)

Rules for benefit_ids — pick ALL that apply from this list:
${benefitList}`;

export const MILEAGE_PROMPT = `You are a tax document extraction specialist. Examine this mileage log.

Return ONLY a valid JSON object with this exact structure (no other text):
{
  "document_type": "mileage_log",
  "merchant_or_payer": null,
  "date": "YYYY-MM-DD of first entry or null",
  "total_amount": 0.00,
  "description": "Mileage log — N business miles",
  "tax_category": "business_expense",
  "deductible_pct": 1.0,
  "benefit_ids": ["business-vehicle-deduction"],
  "form_line": "Schedule C Line 9 (car and truck expenses)",
  "suggested_updates": [
    {
      "yaml_file": "businesses",
      "dot_path": "businesses.0.vehicle.business_miles",
      "operation": "add",
      "value": 0,
      "label": "Business miles from mileage log"
    }
  ],
  "confidence": "high|medium|low",
  "notes": "IRS standard mileage rate for 2025 is $0.70/mile for business"
}

Extract total business miles from the log. Set total_amount = business_miles * 0.70 (2025 rate).`;