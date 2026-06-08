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
});