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
});