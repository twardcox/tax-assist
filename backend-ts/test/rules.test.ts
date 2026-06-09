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
});