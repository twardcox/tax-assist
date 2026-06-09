import { describe, expect, test } from "vitest";
import { evaluateBenefit } from "../src/domain/scanner/rules";
import { UserFacts } from "../src/domain/scanner/userFacts";

function makeFacts(data: Record<string, unknown>): UserFacts {
  const facts = UserFacts.fromYaml(2025);
  facts.data = {
    household: {},
    income: {},
    businesses: {},
    real_estate: {},
    investments: {},
    retirement: {},
    healthcare: {},
    dependents: {},
    goals: {},
    documents_index: {},
    ...data
  } as Record<string, Record<string, unknown>>;
  return facts;
}

describe("rules parity", () => {
  test("unknown benefit returns unknown status", () => {
    const result = evaluateBenefit(
      {
        id: "some-obscure-benefit",
        name: "Some Obscure Benefit",
        category: "credit",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({})
    );

    expect(result.status).toBe("unknown");
  });

  test("home office rule recognizes eligible now when facts are present", () => {
    const result = evaluateBenefit(
      {
        id: "home-office-deduction",
        name: "Home Office Deduction",
        category: "business_deduction",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        businesses: {
          businesses: [
            {
              entity_type: "sole_prop",
              home_office: {
                claimed: true,
                square_footage: 180
              }
            }
          ]
        }
      })
    );

    expect(result.status).toBe("eligible_now");
    expect(result.next_steps.length).toBeGreaterThan(0);
  });

  test("pte election rule recognizes eligible now for a qualifying state business", () => {
    const result = evaluateBenefit(
      {
        id: "pte-election",
        name: "Pass-Through Entity (PTE) Election",
        category: "deduction",
        jurisdiction: "state",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          residence: {
            state: "CA"
          }
        },
        businesses: {
          businesses: [
            {
              entity_type: "llc_single",
              financials: {
                net_profit_loss: 200000
              },
              operating_states: ["CA"]
            }
          ]
        }
      })
    );

    expect(result.status).toBe("eligible_now");
    expect(result.message).toContain("CA");
  });

  test("state retirement exemption is not applicable without retirement income", () => {
    const result = evaluateBenefit(
      {
        id: "state-retirement-income-exemption",
        name: "State Retirement Income Exemption",
        category: "state_tax",
        jurisdiction: "state",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          residence: {
            state: "PA"
          }
        },
        income: {
          retirement_distributions: {},
          social_security: { gross_benefits: 0 }
        }
      })
    );

    expect(result.status).toBe("not_applicable");
  });

  test("state retirement exemption recognizes full-exempt states", () => {
    const result = evaluateBenefit(
      {
        id: "state-retirement-income-exemption",
        name: "State Retirement Income Exemption",
        category: "state_tax",
        jurisdiction: "state",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          residence: {
            state: "PA"
          }
        },
        income: {
          retirement_distributions: { ira: 25000 },
          social_security: { gross_benefits: 12000 }
        }
      })
    );

    expect(result.status).toBe("eligible_now");
    expect(result.message).toContain("exempts ALL retirement income");
  });

  test("no-income-tax-state handles NH as minimal-income-tax state", () => {
    const result = evaluateBenefit(
      {
        id: "no-income-tax-state",
        name: "No Income Tax State",
        category: "state_tax",
        jurisdiction: "state",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          residence: {
            state: "NH"
          }
        }
      })
    );

    expect(result.status).toBe("eligible_now");
    expect(result.message).toContain("taxes only interest and dividend income");
  });

  test("county senior freeze is future opportunity for ages 60-64", () => {
    const result = evaluateBenefit(
      {
        id: "county-senior-property-tax-freeze",
        name: "County Senior Property Tax Freeze",
        category: "county_tax",
        jurisdiction: "county",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          taxpayer: { age: 62 },
          residence: { state: "PA", county: "Allegheny" }
        },
        real_estate: {
          properties: [{ property_type: "primary_residence" }]
        }
      })
    );

    expect(result.status).toBe("future_opportunity");
  });

  test("county senior freeze is nearly eligible at 65+ with primary residence", () => {
    const result = evaluateBenefit(
      {
        id: "county-senior-property-tax-freeze",
        name: "County Senior Property Tax Freeze",
        category: "county_tax",
        jurisdiction: "county",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          taxpayer: { age: 67 },
          residence: { state: "PA", county: "Allegheny" }
        },
        real_estate: {
          properties: [{ property_type: "primary_residence" }]
        }
      })
    );

    expect(result.status).toBe("nearly_eligible");
    expect(result.message).toContain("property tax assessment freeze");
  });

  test("county homestead is not applicable without a primary residence", () => {
    const result = evaluateBenefit(
      {
        id: "county-homestead-exemption",
        name: "County Homestead Exemption",
        category: "county_tax",
        jurisdiction: "county",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          residence: { state: "PA", county: "Allegheny" }
        },
        real_estate: {
          properties: [{ property_type: "rental_residential" }]
        }
      })
    );

    expect(result.status).toBe("not_applicable");
    expect(result.message).toContain("applies to a primary residence");
  });

  test("county homestead is nearly eligible with primary residence because county filing is required", () => {
    const result = evaluateBenefit(
      {
        id: "county-homestead-exemption",
        name: "County Homestead Exemption",
        category: "county_tax",
        jurisdiction: "county",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          residence: { state: "PA", county: "Allegheny" }
        },
        real_estate: {
          properties: [{ property_type: "primary_residence" }]
        }
      })
    );

    expect(result.status).toBe("nearly_eligible");
    expect(result.message).toContain("not automatic");
    expect(result.next_steps).toContain("File before the county deadline (most states: March 1)");
  });

  test("county homestead does not require state when county is present", () => {
    const result = evaluateBenefit(
      {
        id: "county-homestead-exemption",
        name: "County Homestead Exemption",
        category: "county_tax",
        jurisdiction: "county",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          residence: { county: "Allegheny" }
        },
        real_estate: {
          properties: [{ property_type: "primary_residence" }]
        }
      })
    );

    expect(result.status).toBe("nearly_eligible");
    expect(result.message).toContain("Allegheny County");
    expect(result.missing_facts).toEqual([]);
  });

  test("state homestead is not applicable with no state primary residence data", () => {
    const result = evaluateBenefit(
      {
        id: "state-homestead-exemption",
        name: "State Homestead Exemption",
        category: "state_tax",
        jurisdiction: "state",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          residence: { state: "PA" }
        },
        real_estate: {
          properties: []
        }
      })
    );

    expect(result.status).toBe("not_applicable");
    expect(result.message).toContain("No primary residence recorded");
  });

  test("state homestead is eligible now when already applied", () => {
    const result = evaluateBenefit(
      {
        id: "state-homestead-exemption",
        name: "State Homestead Exemption",
        category: "state_tax",
        jurisdiction: "state",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          residence: { state: "PA" }
        },
        real_estate: {
          properties: [
            {
              property_type: "primary_residence",
              homestead_exemption_applied: true
            }
          ]
        }
      })
    );

    expect(result.status).toBe("eligible_now");
    expect(result.message).toContain("already applied in PA");
  });

  test("lifetime learning credit is not applicable above AGI limit", () => {
    const result = evaluateBenefit(
      {
        id: "lifetime-learning-credit",
        name: "Lifetime Learning Credit",
        category: "education_credit",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          filing_status: "single",
          estimated_agi: 120000
        },
        dependents: {
          dependents: [
            {
              name: "Student One",
              education: {
                school_level: "graduate",
                tuition_paid: 15000
              }
            }
          ]
        }
      })
    );

    expect(result.status).toBe("not_applicable");
    expect(result.message).toContain("above Lifetime Learning Credit limit");
  });

  test("premium tax credit is nearly eligible for self-employed user without coverage type", () => {
    const result = evaluateBenefit(
      {
        id: "premium-tax-credit",
        name: "Premium Tax Credit",
        category: "healthcare",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        businesses: {
          businesses: [
            {
              entity_type: "sole_prop",
              financials: {
                net_profit_loss: 50000
              }
            }
          ]
        },
        healthcare: {
          insurance: {}
        }
      })
    );

    expect(result.status).toBe("nearly_eligible");
    expect(result.missing_facts).toContain("healthcare.coverage_type");
  });

  test("premium tax credit treats missing AGI with marketplace coverage as below-FPL not applicable", () => {
    const result = evaluateBenefit(
      {
        id: "premium-tax-credit",
        name: "Premium Tax Credit",
        category: "healthcare",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        healthcare: {
          insurance: {
            coverage_type: "marketplace"
          }
        }
      })
    );

    expect(result.status).toBe("not_applicable");
    expect(result.message).toContain("below 100% FPL");
  });

  test("premium tax credit is not applicable when AGI is below 100% FPL", () => {
    const result = evaluateBenefit(
      {
        id: "premium-tax-credit",
        name: "Premium Tax Credit",
        category: "healthcare",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          estimated_agi: 10000
        },
        dependents: {
          dependents: [
            { name: "One" },
            { name: "Two" }
          ]
        },
        healthcare: {
          insurance: {
            coverage_type: "marketplace"
          }
        }
      })
    );

    expect(result.status).toBe("not_applicable");
    expect(result.message).toContain("below 100% FPL");
  });

  test("foreign earned income exclusion is not applicable when US state is present", () => {
    const result = evaluateBenefit(
      {
        id: "foreign-earned-income-exclusion",
        name: "Foreign Earned Income Exclusion",
        category: "federal_exclusion",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          residence: {
            state: "PA"
          }
        }
      })
    );

    expect(result.status).toBe("not_applicable");
    expect(result.message).toContain("FEIE applies to taxpayers living and working abroad");
  });

  test("foreign earned income exclusion is nearly eligible when no US state is set", () => {
    const result = evaluateBenefit(
      {
        id: "foreign-earned-income-exclusion",
        name: "Foreign Earned Income Exclusion",
        category: "federal_exclusion",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          residence: {
            state: ""
          }
        }
      })
    );

    expect(result.status).toBe("nearly_eligible");
    expect(result.missing_facts).toContain("household.residence.state or foreign country confirmation");
  });

  test("clean vehicle credit is not applicable above AGI limit", () => {
    const result = evaluateBenefit(
      {
        id: "clean-vehicle-credit",
        name: "Clean Vehicle Credit",
        category: "federal_credit",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          filing_status: "single",
          estimated_agi: 200000
        }
      })
    );

    expect(result.status).toBe("not_applicable");
    expect(result.message).toContain("exceeds income limit");
  });

  test("residential clean energy credit is not applicable without owned home", () => {
    const result = evaluateBenefit(
      {
        id: "residential-clean-energy-credit",
        name: "Residential Clean Energy Credit",
        category: "federal_credit",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        real_estate: {
          properties: []
        }
      })
    );

    expect(result.status).toBe("not_applicable");
    expect(result.message).toContain("requires a home you own");
  });

  test("section 121 exclusion is not applicable without a primary residence", () => {
    const result = evaluateBenefit(
      {
        id: "section-121-exclusion",
        name: "Section 121 Exclusion",
        category: "federal_exclusion",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        real_estate: {
          properties: [
            {
              property_type: "rental_residential",
              acquisition: {
                purchase_price: 300000,
                current_market_value: 450000
              }
            }
          ]
        }
      })
    );

    expect(result.status).toBe("not_applicable");
    expect(result.message).toContain("applies to sale of primary residence only");
  });

  test("section 121 exclusion is eligible_if_changed when occupancy is under 2 years", () => {
    const result = evaluateBenefit(
      {
        id: "section-121-exclusion",
        name: "Section 121 Exclusion",
        category: "federal_exclusion",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          filing_status: "single"
        },
        real_estate: {
          properties: [
            {
              property_type: "primary_residence",
              primary_residence: {
                years_lived_in: 1
              },
              acquisition: {
                purchase_price: 300000,
                current_market_value: 450000
              }
            }
          ]
        }
      })
    );

    expect(result.status).toBe("eligible_if_changed");
    expect(result.changes_needed).toContain("Wait until 1 more year(s) before selling to qualify");
  });

  test("section 121 exclusion eligible-now message mirrors Python gain wording", () => {
    const result = evaluateBenefit(
      {
        id: "section-121-exclusion",
        name: "Section 121 Exclusion",
        category: "federal_exclusion",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          filing_status: "single"
        },
        real_estate: {
          properties: [
            {
              property_type: "primary_residence",
              primary_residence: {
                years_lived_in: 3
              },
              acquisition: {
                purchase_price: 300000,
                current_market_value: 450000
              }
            }
          ]
        }
      })
    );

    expect(result.status).toBe("eligible_now");
    expect(result.message).toContain("up to $250,000 gain excluded on home sale");
    expect(result.message).toContain("Estimated gain ~$150,000 is fully within exclusion");
  });

  test("self-employed health insurance is nearly eligible with next steps when premium facts are missing", () => {
    const result = evaluateBenefit(
      {
        id: "self-employed-health-insurance",
        name: "Self-Employed Health Insurance Deduction",
        category: "business_deduction",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        businesses: {
          businesses: [
            {
              entity_type: "sole_prop"
            }
          ]
        },
        healthcare: {
          insurance: {
            coverage_type: "marketplace"
          }
        }
      })
    );

    expect(result.status).toBe("nearly_eligible");
    expect(result.missing_facts).toContain("businesses.health_insurance.premium_amount");
    expect(result.next_steps).toContain("Record monthly premium in businesses.yaml");
  });

  test("child tax credit reports partial phaseout when AGI exceeds threshold", () => {
    const result = evaluateBenefit(
      {
        id: "child-tax-credit",
        name: "Child Tax Credit",
        category: "federal_credit",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          filing_status: "mfj",
          estimated_agi: 410000
        },
        dependents: {
          dependents: [
            { age_at_year_end: 8, ssn_obtained: true },
            { age_at_year_end: 12, ssn_obtained: true }
          ]
        }
      })
    );

    expect(result.status).toBe("eligible_now");
    expect(result.message).toContain("Partial credit:");
    expect(result.phaseout_note).toContain("phaseout threshold");
  });

  test("excess fica refund is eligible now when social security withholding exceeds cap", () => {
    const result = evaluateBenefit(
      {
        id: "excess-fica-refund",
        name: "Excess FICA Refund",
        category: "federal_credit",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        income: {
          w2_employment: [
            { wages: 120000 },
            { wages: 120000 }
          ]
        }
      })
    );

    expect(result.status).toBe("eligible_now");
    expect(result.message).toContain("refundable");
    expect(result.estimated_value).toContain("refundable credit");
  });

  test("net unrealized appreciation is not applicable with only social security income", () => {
    const result = evaluateBenefit(
      {
        id: "net-unrealized-appreciation",
        name: "Net Unrealized Appreciation",
        category: "retirement_strategy",
        jurisdiction: "federal",
        risk_level: "medium",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        income: {
          social_security: {
            gross_benefits: 25000
          }
        },
        retirement: {
          employer_plans: {}
        }
      })
    );

    expect(result.status).toBe("not_applicable");
    expect(result.message).toContain("401k/profit-sharing plan");
  });

  test("installment sale uses top-level current_value and purchase_price for appreciated property", () => {
    const result = evaluateBenefit(
      {
        id: "installment-sale",
        name: "Installment Sale",
        category: "capital_gains",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        real_estate: {
          properties: [
            {
              property_type: "rental_residential",
              status: "held",
              purchase_price: 300000,
              current_value: 460000
            }
          ]
        }
      })
    );

    expect(result.status).toBe("eligible_if_changed");
    expect(result.message).toContain("seller financing");
  });

  test("backdoor roth detects legacy traditional_ira.accounts balance and stays nearly eligible", () => {
    const result = evaluateBenefit(
      {
        id: "backdoor-roth-ira",
        name: "Backdoor Roth IRA",
        category: "retirement_strategy",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          filing_status: "single",
          estimated_agi: 200000
        },
        retirement: {
          traditional_ira: {
            accounts: [
              {
                balance: 25000
              }
            ]
          }
        }
      })
    );

    expect(result.status).toBe("nearly_eligible");
    expect(result.message).toContain("pro-rata");
  });

  test("qlac includes legacy traditional_ira.accounts balance in total balance", () => {
    const result = evaluateBenefit(
      {
        id: "qlac",
        name: "QLAC",
        category: "retirement_strategy",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          taxpayer: { age: 66 }
        },
        retirement: {
          traditional_ira: {
            accounts: [
              {
                balance: 80000
              }
            ]
          }
        }
      })
    );

    expect(result.status).toBe("nearly_eligible");
    expect(result.message).toContain("Retirement balance");
    expect(result.message).toContain("80,000");
  });

  test("real estate professional status future-opportunity branch uses Python AGI wording", () => {
    const result = evaluateBenefit(
      {
        id: "real-estate-professional-status",
        name: "Real Estate Professional Status",
        category: "real_estate_strategy",
        jurisdiction: "federal",
        risk_level: "medium",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          filing_status: "single",
          estimated_agi: 120000
        },
        real_estate: {
          properties: [
            {
              property_type: "rental_residential"
            }
          ]
        }
      })
    );

    expect(result.status).toBe("future_opportunity");
    expect(result.message).toContain("still within $25,000 rental loss allowance range");
    expect(result.message).toContain("above $150,000");
  });

  test("real estate professional status eligible-if-changed branch uses Python checklist wording", () => {
    const result = evaluateBenefit(
      {
        id: "real-estate-professional-status",
        name: "Real Estate Professional Status",
        category: "real_estate_strategy",
        jurisdiction: "federal",
        risk_level: "medium",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          filing_status: "single",
          estimated_agi: 180000
        },
        real_estate: {
          properties: [
            {
              property_type: "rental_residential"
            }
          ]
        }
      })
    );

    expect(result.status).toBe("eligible_if_changed");
    expect(result.message).toContain("would unlock unlimited rental loss deductions");
    expect(result.estimated_value).toContain("Depends on suspended losses");
    expect(result.estimated_value).toContain("$10,000–$200,000+");
    expect(result.changes_needed).toContain("File material participation statement or aggregation election");
  });

  test("american opportunity credit includes phaseout note text when AGI is in range", () => {
    const result = evaluateBenefit(
      {
        id: "american-opportunity-credit",
        name: "American Opportunity Credit",
        category: "education_credit",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          filing_status: "single",
          estimated_agi: 85000
        },
        dependents: {
          dependents: [
            {
              education: {
                school_level: "undergraduate",
                tuition_paid: 12000
              }
            }
          ]
        }
      })
    );

    expect(result.status).toBe("eligible_now");
    expect(result.message).toContain("American Opportunity Credit: up to $");
    expect(result.phaseout_note).toContain("AGI 85,000 is within phaseout planning range");
  });

  test("savers credit above AGI ceiling uses Python-style disqualification wording", () => {
    const result = evaluateBenefit(
      {
        id: "savers-credit",
        name: "Saver's Credit",
        category: "retirement_credit",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          filing_status: "single",
          estimated_agi: 50000,
          taxpayer: {
            age: 35
          }
        }
      })
    );

    expect(result.status).toBe("not_applicable");
    expect(result.message).toContain("No credit available above this income level");
  });

  test("capital gains harvesting is not applicable above 0% LTCG ceiling zone with Python-style wording", () => {
    const result = evaluateBenefit(
      {
        id: "capital-gains-harvesting",
        name: "Capital Gains Harvesting",
        category: "investment_strategy",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          filing_status: "single",
          estimated_agi: 70000
        }
      })
    );

    expect(result.status).toBe("not_applicable");
    expect(result.message).toContain("0% LTCG bracket ceiling");
    expect(result.message).toContain("15% or 20%");
  });

  test("backdoor roth is not applicable below Roth limit with direct-contribution guidance", () => {
    const result = evaluateBenefit(
      {
        id: "backdoor-roth-ira",
        name: "Backdoor Roth IRA",
        category: "retirement_strategy",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          filing_status: "single",
          estimated_agi: 120000
        }
      })
    );

    expect(result.status).toBe("not_applicable");
    expect(result.message).toContain("contribute directly to Roth IRA");
  });

    test("backdoor roth treats missing AGI as below-limit not-applicable path", () => {
      const result = evaluateBenefit(
        {
          id: "backdoor-roth-ira",
          name: "Backdoor Roth IRA",
          category: "retirement_strategy",
          jurisdiction: "federal",
          risk_level: "low",
          required_forms: [],
          required_documents: [],
          review_required: {}
        },
        makeFacts({
          household: {
            filing_status: "single"
          }
        })
      );

      expect(result.status).toBe("not_applicable");
      expect(result.message).toContain("below Roth IRA income limit");
      expect(result.message).toContain("contribute directly to Roth IRA");
    });

  test("capital gains harvesting eligible now includes permanent elimination wording and detailed steps", () => {
    const result = evaluateBenefit(
      {
        id: "capital-gains-harvesting",
        name: "Capital Gains Harvesting",
        category: "investment_strategy",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          filing_status: "single",
          estimated_agi: 30000
        },
        income: {
          investment_income: {
            long_term_capital_gains: 10000
          }
        }
      })
    );

    expect(result.status).toBe("eligible_now");
    expect(result.estimated_value).toContain("Permanent elimination of federal tax");
    expect(result.next_steps).toContain("New cost basis eliminates deferred gain permanently");
  });

  test("capital gains harvesting eligible-if-changed includes brokerage missing facts wording", () => {
    const result = evaluateBenefit(
      {
        id: "capital-gains-harvesting",
        name: "Capital Gains Harvesting",
        category: "investment_strategy",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          filing_status: "single",
          estimated_agi: 30000
        },
        income: {
          investment_income: {
            long_term_capital_gains: 0
          }
        }
      })
    );

    expect(result.status).toBe("eligible_if_changed");
    expect(result.missing_facts).toContain("income.investment_income.long_term_capital_gains or investments.taxable_accounts");
    expect(result.changes_needed).toContain("Identify taxable brokerage holdings with unrealized long-term gains");
  });

  test("opportunity zone investment eligible now uses Python-style QOF and deferred-gain wording", () => {
    const result = evaluateBenefit(
      {
        id: "opportunity-zone-investment",
        name: "Opportunity Zone Investment",
        category: "investment_strategy",
        jurisdiction: "federal",
        risk_level: "medium",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        income: {
          investment_income: {
            long_term_capital_gains: 25000
          }
        }
      })
    );

    expect(result.status).toBe("eligible_now");
    expect(result.message).toContain("Opportunity Zone investment would defer this tax");
    expect(result.next_steps).toContain("10+ year hold permanently excludes QOF appreciation from income");
  });

  test("annual gift exclusion not-applicable branch uses Python-style estate-planning prompt", () => {
    const result = evaluateBenefit(
      {
        id: "annual-gift-tax-exclusion",
        name: "Annual Gift Tax Exclusion",
        category: "estate_planning",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        goals: {
          transfer_wealth_to_heirs: false
        }
      })
    );

    expect(result.status).toBe("not_applicable");
    expect(result.message).toContain("Update goals.yaml if estate planning becomes a priority");
  });

  test("25c energy home improvement eligible-now branch includes detailed annual cap guidance", () => {
    const result = evaluateBenefit(
      {
        id: "25c-energy-home-improvement",
        name: "25C Energy Home Improvement",
        category: "federal_credit",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        real_estate: {
          properties: [
            {
              property_type: "primary_residence"
            }
          ]
        }
      })
    );

    expect(result.status).toBe("eligible_now");
    expect(result.message).toContain("Heat pump: up to $2,000/year");
    expect(result.next_steps).toContain("Home energy audit = up to $150 toward $1,200 cap");
  });

  test("savers credit AGI-missing with contributions uses Python-style moderate-income message", () => {
    const result = evaluateBenefit(
      {
        id: "savers-credit",
        name: "Saver's Credit",
        category: "retirement_credit",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          filing_status: "single",
          taxpayer: {
            age: 35
          }
        },
        retirement: {
          employer_plans: {
            traditional_401k: {
              employee_contribution_ytd: 1500
            }
          }
        }
      })
    );

    expect(result.status).toBe("nearly_eligible");
    expect(result.message).toContain("AGI not provided");
    expect(result.message).toContain("moderate-income taxpayers");
  });

  test("qbi deduction includes Python-style AGI-in-range phaseout note", () => {
    const result = evaluateBenefit(
      {
        id: "qbi-deduction",
        name: "QBI Deduction",
        category: "business_deduction",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          filing_status: "single",
          estimated_agi: 210000
        },
        businesses: {
          businesses: [
            {
              entity_type: "sole_prop",
              financials: {
                net_profit_loss: 100000
              }
            }
          ]
        }
      })
    );

    expect(result.status).toBe("eligible_now");
    expect(result.message).toContain("Note: AGI $210,000 is within phaseout planning range");
  });

  test("s corp election returns not-applicable when entity is already s corp", () => {
    const result = evaluateBenefit(
      {
        id: "s-corp-election",
        name: "S Corp Election",
        category: "business_strategy",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        businesses: {
          businesses: [
            {
              entity_type: "s_corp",
              financials: {
                net_profit_loss: 120000
              },
              employees: {
                owner_w2_salary: 0
              }
            }
          ]
        }
      })
    );

    expect(result.status).toBe("not_applicable");
    expect(result.message).toContain("already taxed as an S Corp");
  });

  test("bonus depreciation is nearly eligible for self-employment with assets (Python parity)", () => {
    const result = evaluateBenefit(
      {
        id: "bonus-depreciation",
        name: "Bonus Depreciation",
        category: "business_deduction",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        businesses: {
          businesses: [
            {
              entity_type: "sole_prop",
              depreciation: {
                assets_placed_in_service: [
                  {
                    description: "Equipment",
                    cost: 25000
                  }
                ]
              }
            }
          ]
        }
      })
    );

    expect(result.status).toBe("nearly_eligible");
    expect(result.message).toContain("40% in 2025");
    expect(result.message).toContain("Rate drops to 20% in 2026");
  });

  test("state 529 deduction is eligible now when home-state 529 account exists even without contributions", () => {
    const result = evaluateBenefit(
      {
        id: "state-529-deduction",
        name: "State 529 Deduction",
        category: "state_tax",
        jurisdiction: "state",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          residence: { state: "PA" }
        },
        investments: {
          "529_plans": [
            {
              beneficiary: "Child One",
              balance: 0
            }
          ]
        }
      })
    );

    expect(result.status).toBe("eligible_now");
    expect(result.message).toContain("home-state 529 plan");
  });

  test("state 529 deduction not-applicable branch includes federal growth note for non-deduction states", () => {
    const result = evaluateBenefit(
      {
        id: "state-529-deduction",
        name: "State 529 Deduction",
        category: "state_tax",
        jurisdiction: "state",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          residence: { state: "CA" }
        }
      })
    );

    expect(result.status).toBe("not_applicable");
    expect(result.message).toContain("Federal tax-free growth still applies");
  });

  test("augusta rule includes Python-style fair-market-rate and 15th-day guidance", () => {
    const result = evaluateBenefit(
      {
        id: "augusta-rule",
        name: "Augusta Rule",
        category: "business_strategy",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        businesses: {
          businesses: [
            {
              entity_type: "sole_prop"
            }
          ]
        },
        real_estate: {
          properties: [
            {
              property_type: "primary_residence"
            }
          ]
        }
      })
    );

    expect(result.status).toBe("eligible_if_changed");
    expect(result.estimated_value).toContain("14 days");
    expect(result.changes_needed).toContain("Ensure payment is actually made from business account to your personal account");
    expect(result.changes_needed).toContain("Keep total rental days at 14 or fewer — the 15th day eliminates the exclusion");
  });

  test("cost segregation eligible-now branch includes Python ROI and bonus-rate guidance", () => {
    const result = evaluateBenefit(
      {
        id: "cost-segregation",
        name: "Cost Segregation",
        category: "real_estate_strategy",
        jurisdiction: "federal",
        risk_level: "medium",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        real_estate: {
          properties: [
            {
              property_type: "rental_residential",
              acquisition: {
                purchase_price: 1000000
              }
            }
          ]
        }
      })
    );

    expect(result.status).toBe("eligible_now");
    expect(result.estimated_value).toContain("2025 bonus rate");
    expect(result.next_steps).toContain("Expect study cost of $5,000-$20,000; typical ROI is 5-10x");
    expect(result.next_steps).toContain("Act in 2025 or 2026 — bonus depreciation drops to 20% in 2026, 0% in 2027");
  });

  test("529-to-roth rollover returns eligible now with funded account even without opened date", () => {
    const result = evaluateBenefit(
      {
        id: "529-to-roth-rollover",
        name: "529 to Roth Rollover",
        category: "education_strategy",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        investments: {
          "529_plans": [
            {
              balance: 12000
            }
          ]
        }
      })
    );

    expect(result.status).toBe("eligible_now");
    expect(result.message).toContain("total balance ~12,000");
    expect(result.next_steps).toContain("Verify account opening date — must be at least 15 years old");
  });

  test("529-to-roth rollover stays nearly eligible when account exists but no balance is recorded", () => {
    const result = evaluateBenefit(
      {
        id: "529-to-roth-rollover",
        name: "529 to Roth Rollover",
        category: "education_strategy",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        investments: {
          "529_plans": [
            {
              beneficiary: "Child",
              opened_date: "2020-01-01"
            }
          ]
        }
      })
    );

    expect(result.status).toBe("nearly_eligible");
    expect(result.message).toContain("no balance recorded");
    expect(result.missing_facts).toContain("investments.529_plans.balance");
  });

  test("sep ira unestablished branch includes Python October 15 and custodian guidance", () => {
    const result = evaluateBenefit(
      {
        id: "sep-ira-contribution",
        name: "SEP-IRA Contribution",
        category: "retirement_strategy",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        businesses: {
          businesses: [
            {
              entity_type: "sole_prop",
              financials: {
                net_profit_loss: 100000
              }
            }
          ]
        },
        retirement: {
          sep_ira: {
            established: false,
            contributions_ytd: 0
          }
        }
      })
    );

    expect(result.status).toBe("nearly_eligible");
    expect(result.message).toContain("for tax year 2025");
    expect(result.next_steps).toContain("Can establish and fund up to October 15 (with extension)");
  });

  test("solo 401k established branch uses Python-style max and October 15 guidance", () => {
    const result = evaluateBenefit(
      {
        id: "solo-401k",
        name: "Solo 401(k)",
        category: "retirement_strategy",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          taxpayer: {
            age: 45
          }
        },
        businesses: {
          businesses: [
            {
              entity_type: "sole_prop",
              financials: {
                net_profit_loss: 100000
              },
              employees: {
                w2_employees_count: 0
              }
            }
          ]
        },
        retirement: {
          solo_401k: {
            established: true
          }
        }
      })
    );

    expect(result.status).toBe("eligible_now");
    expect(result.message).toContain("Max combined contribution");
    expect(result.next_steps?.some((step) => step.includes("Employer contribution: up to $"))).toBe(true);
    expect(result.next_steps?.some((step) => step.includes("can fund by October 15"))).toBe(true);
  });

  test("passive activity loss is nearly eligible when rental property exists but AGI is missing", () => {
    const result = evaluateBenefit(
      {
        id: "passive-activity-loss",
        name: "Passive Activity Loss",
        category: "real_estate_strategy",
        jurisdiction: "federal",
        risk_level: "medium",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        real_estate: {
          properties: [
            {
              property_type: "rental_residential"
            }
          ]
        }
      })
    );

    expect(result.status).toBe("nearly_eligible");
    expect(result.missing_facts).toContain("household.estimated_agi");
  });

  test("passive activity loss in phaseout range uses Python-style phaseout note", () => {
    const result = evaluateBenefit(
      {
        id: "passive-activity-loss",
        name: "Passive Activity Loss",
        category: "real_estate_strategy",
        jurisdiction: "federal",
        risk_level: "medium",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          estimated_agi: 120000
        },
        real_estate: {
          properties: [
            {
              property_type: "rental_residential"
            }
          ]
        }
      })
    );

    expect(result.status).toBe("eligible_now");
    expect(result.phaseout_note).toContain("AGI $120,000 is within phaseout planning range");
  });

  test("passive activity loss is eligible-if-changed above full phaseout", () => {
    const result = evaluateBenefit(
      {
        id: "passive-activity-loss",
        name: "Passive Activity Loss",
        category: "real_estate_strategy",
        jurisdiction: "federal",
        risk_level: "medium",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        household: {
          estimated_agi: 180000
        },
        real_estate: {
          properties: [
            {
              property_type: "rental_residential"
            }
          ]
        }
      })
    );

    expect(result.status).toBe("eligible_if_changed");
    expect(result.message).toContain("fully phased out");
  });

  test("1031 exchange is nearly eligible when rental values are missing", () => {
    const result = evaluateBenefit(
      {
        id: "1031-exchange",
        name: "1031 Exchange",
        category: "real_estate_strategy",
        jurisdiction: "federal",
        risk_level: "medium",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        real_estate: {
          properties: [
            {
              property_type: "rental_residential",
              acquisition: {
                purchase_price: 350000
              }
            }
          ]
        }
      })
    );

    expect(result.status).toBe("nearly_eligible");
    expect(result.message).toContain("confirm current value");
    expect(result.missing_facts).toContain("real_estate.acquisition.current_market_value");
  });

  test("1031 exchange eligible-now branch includes Python QI guidance wording", () => {
    const result = evaluateBenefit(
      {
        id: "1031-exchange",
        name: "1031 Exchange",
        category: "real_estate_strategy",
        jurisdiction: "federal",
        risk_level: "medium",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        real_estate: {
          properties: [
            {
              property_type: "rental_residential",
              acquisition: {
                purchase_price: 300000,
                current_market_value: 500000
              }
            }
          ]
        }
      })
    );

    expect(result.status).toBe("eligible_now");
    expect(result.message).toContain("1031 exchange would defer this tax on sale");
    expect(result.estimated_value).toContain("+ depreciation recapture");
    expect(result.next_steps).toContain("Engage a Qualified Intermediary (QI) BEFORE listing the property for sale");
    expect(result.next_steps).toContain("Do NOT receive any proceeds — all funds must go directly to QI");
  });

  test("section 179 expensing eligible-now branch uses Python form and sequencing guidance", () => {
    const result = evaluateBenefit(
      {
        id: "section-179-expensing",
        name: "Section 179 Expensing",
        category: "business_deduction",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        businesses: {
          businesses: [
            {
              entity_type: "sole_prop",
              depreciation: {
                assets_placed_in_service: [
                  {
                    description: "Laptop",
                    placed_in_service_date: "2025-03-01",
                    purchase_price: 2500
                  }
                ]
              }
            }
          ]
        }
      })
    );

    expect(result.status).toBe("eligible_now");
    expect(result.message).toContain("Section 179 immediate expensing available");
    expect(result.next_steps).toContain("Complete Form 4562");
    expect(result.next_steps).toContain("Apply Section 179 before bonus depreciation on same assets");
  });

  test("section 179 expensing nearly-eligible branch uses Python purchase-record guidance", () => {
    const result = evaluateBenefit(
      {
        id: "section-179-expensing",
        name: "Section 179 Expensing",
        category: "business_deduction",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        businesses: {
          businesses: [
            {
              entity_type: "sole_prop"
            }
          ]
        }
      })
    );

    expect(result.status).toBe("nearly_eligible");
    expect(result.message).toContain("Section 179 available if equipment or vehicles are purchased this year");
    expect(result.next_steps).toContain("Record any business assets purchased in businesses.yaml");
  });

  test("business vehicle deduction eligible-now branch uses Python mileage formula guidance", () => {
    const result = evaluateBenefit(
      {
        id: "business-vehicle-deduction",
        name: "Business Vehicle Deduction",
        category: "business_deduction",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        businesses: {
          businesses: [
            {
              entity_type: "sole_prop",
              vehicle: {
                business_vehicle: true,
                business_miles: 10000
              }
            }
          ]
        }
      })
    );

    expect(result.status).toBe("eligible_now");
    expect(result.message).toContain("10,000 miles");
    expect(result.message).toContain("$0.67");
    expect(result.next_steps).toContain("Compare standard mileage vs. actual expense method");
  });

  test("small employer retirement startup credit is eligible now with employees and no retirement plan", () => {
    const result = evaluateBenefit(
      {
        id: "small-employer-retirement-startup-credit",
        name: "Small Employer Retirement Startup Credit",
        category: "business_credit",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        businesses: {
          businesses: [
            {
              entity_type: "llc_single",
              employees: {
                w2_employees_count: 4
              },
              retirement_plans: {
                sep_ira: false,
                simple_ira: false,
                solo_401k: false,
                defined_benefit: false
              }
            }
          ]
        }
      })
    );

    expect(result.status).toBe("eligible_now");
    expect(result.message).toContain("§45E applies");
    expect(result.next_steps).toContain("File Form 8881 with the return for each of the 3 qualifying years");
  });

  test("small employer retirement startup credit is not applicable when plan already exists", () => {
    const result = evaluateBenefit(
      {
        id: "small-employer-retirement-startup-credit",
        name: "Small Employer Retirement Startup Credit",
        category: "business_credit",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        businesses: {
          businesses: [
            {
              entity_type: "llc_single",
              employees: {
                w2_employees_count: 3
              },
              retirement_plans: {
                simple_ira: true
              }
            }
          ]
        }
      })
    );

    expect(result.status).toBe("not_applicable");
    expect(result.message).toContain("new plan establishment only");
  });

  test("work opportunity tax credit with employees is nearly eligible and requests wotc hires", () => {
    const result = evaluateBenefit(
      {
        id: "work-opportunity-tax-credit",
        name: "Work Opportunity Tax Credit",
        category: "business_credit",
        jurisdiction: "federal",
        risk_level: "low",
        required_forms: [],
        required_documents: [],
        review_required: {}
      },
      makeFacts({
        businesses: {
          businesses: [
            {
              entity_type: "llc_single",
              employees: {
                w2_employees_count: 2
              }
            }
          ]
        }
      })
    );

    expect(result.status).toBe("nearly_eligible");
    expect(result.message).toContain("WOTC credit");
    expect(result.missing_facts).toContain("businesses.employees.wotc_hires");
  });
});