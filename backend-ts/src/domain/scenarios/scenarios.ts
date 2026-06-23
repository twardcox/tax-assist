import { loadBenefitLibrary } from "../scanner/benefitLoader";
import { evaluateBenefit } from "../scanner/rules";
import { UserFacts, type FactsData } from "../scanner/userFacts";
import { generateScenarioAiNarrative, type ScenarioDiff } from "../scanner/aiAdvisor";

export const SCENARIOS: Record<string, { description: string; fact_changes: Record<string, unknown> }> = {
  buy_rental_property: {
    description: "What if I purchase a rental property?",
    fact_changes: {
      "real_estate.properties": [
        {
          property_type: "rental_residential",
          acquisition: {
            purchase_price: 350000,
            current_market_value: 370000
          },
          rental_use: {
            rental_days: 365,
            gross_rental_income: 18000
          },
          financing: {
            mortgage_interest_paid: 12000,
            property_tax_paid: 4000
          }
        }
      ]
    }
  },
  start_llc: {
    description: "What if I start an LLC for my side income?",
    fact_changes: {
      "businesses.businesses": [
        {
          entity_type: "llc_single",
          tax_classification: "disregarded",
          financials: {
            gross_revenue: 50000,
            net_profit_loss: 30000
          },
          home_office: { claimed: true, square_footage: 200 }
        }
      ]
    }
  },
  elect_s_corp: {
    description: "What if I elect S Corp status for my existing business?",
    fact_changes: {
      "businesses.businesses": [
        {
          entity_type: "s_corp",
          tax_classification: "s_corp",
          financials: {
            gross_revenue: 150000,
            net_profit_loss: 90000
          },
          employees: {
            owner_w2_salary: 60000,
            w2_employees_count: 0
          }
        }
      ]
    }
  },
  buy_ev: {
    description: "What if I buy a qualifying electric vehicle?",
    fact_changes: {}
  },
  max_hsa: {
    description: "What if I switch to an HDHP and maximize HSA contributions?",
    fact_changes: {
      "healthcare.hdhp_enrolled": true,
      "healthcare.hdhp_coverage_level": "family"
    }
  },
  move_no_tax_state: {
    description: "What if I move to a no-income-tax state (TX, FL, NV)?",
    fact_changes: {
      "household.residence.state": "TX"
    }
  },
  hire_spouse: {
    description: "What if I hire my spouse in the business?",
    fact_changes: {
      "household.spouse.employed_in_business": true
    }
  },
  buy_home: {
    description: "What if I purchase a primary residence?",
    fact_changes: {
      "real_estate.properties": [
        {
          property_type: "primary_residence",
          acquisition: {
            purchase_price: 500000,
            current_market_value: 520000
          },
          financing: {
            mortgage_interest_paid: 18000,
            property_tax_paid: 6000
          },
          primary_residence: {
            years_lived_in: 3
          }
        }
      ],
      "household.itemizing_deductions": true
    }
  }
};

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cloneData(data: FactsData): FactsData {
  return JSON.parse(JSON.stringify(data)) as FactsData;
}

function setNested(node: Record<string, unknown>, segments: string[], value: unknown): void {
  const [head, ...rest] = segments;
  const arrayMatch = /^(.+)\[(\d+)\]$/.exec(head);

  if (rest.length === 0) {
    if (arrayMatch) {
      const key = arrayMatch[1];
      const index = Number(arrayMatch[2]);
      const list = Array.isArray(node[key]) ? [...(node[key] as unknown[])] : [];
      while (list.length <= index) {
        list.push({});
      }
      list[index] = value;
      node[key] = list;
      return;
    }

    node[head] = value;
    return;
  }

  if (arrayMatch) {
    const key = arrayMatch[1];
    const index = Number(arrayMatch[2]);
    const list = Array.isArray(node[key]) ? [...(node[key] as unknown[])] : [];
    while (list.length <= index) {
      list.push({});
    }
    const child = toObject(list[index]);
    setNested(child, rest, value);
    list[index] = child;
    node[key] = list;
    return;
  }

  const current = toObject(node[head]);
  setNested(current, rest, value);
  node[head] = current;
}

export function applyOverrides(baseData: FactsData, overrides: Record<string, unknown>): FactsData {
  const result = cloneData(baseData);
  for (const [dotPath, value] of Object.entries(overrides)) {
    setNested(result as Record<string, unknown>, dotPath.split("."), value);
  }
  return result;
}

function countByStatus(results: Array<{ status: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const result of results) {
    counts[result.status] = (counts[result.status] ?? 0) + 1;
  }
  return counts;
}

function diffResults(
  baseline: Array<{ benefit_id: string; benefit_name: string; status: string }>,
  scenario: Array<{ benefit_id: string; benefit_name: string; status: string }>
) {
  const order = ["eligible_now", "nearly_eligible", "eligible_if_changed", "future_opportunity", "high_risk", "unknown", "not_applicable", "expired"];
  const baselineMap = new Map(baseline.map((result) => [result.benefit_id, result]));
  const scenarioMap = new Map(scenario.map((result) => [result.benefit_id, result]));
  const newlyAdded: typeof scenario = [];
  const improved: Array<[typeof baseline[number], typeof scenario[number]]> = [];
  const degraded: Array<[typeof baseline[number], typeof scenario[number]]> = [];
  const removed: typeof baseline = [];

  for (const [benefitId, scenarioResult] of scenarioMap.entries()) {
    const baselineResult = baselineMap.get(benefitId);
    if (!baselineResult) {
      newlyAdded.push(scenarioResult);
      continue;
    }

    const scenarioIndex = order.indexOf(scenarioResult.status);
    const baselineIndex = order.indexOf(baselineResult.status);
    if (scenarioIndex !== -1 && baselineIndex !== -1) {
      if (scenarioIndex < baselineIndex) {
        improved.push([baselineResult, scenarioResult]);
      } else if (scenarioIndex > baselineIndex) {
        degraded.push([baselineResult, scenarioResult]);
      }
    }
  }

  for (const [benefitId, baselineResult] of baselineMap.entries()) {
    if (!scenarioMap.has(benefitId)) {
      removed.push(baselineResult);
    }
  }

  return { newlyAdded, improved, degraded, removed };
}

function evaluateFacts(taxYear: number, facts: UserFacts) {
  const results = loadBenefitLibrary().map((benefit) => evaluateBenefit(benefit, facts));
  return {
    tax_year: taxYear,
    total: results.length,
    counts: countByStatus(results),
    results
  };
}

export async function runScenario(key: string, taxYear: number, userId?: string | null, withAi = false) {
  const scenario = SCENARIOS[key];
  if (!scenario) {
    return null;
  }

  const baselineFacts = await UserFacts.fromUserSections(userId ?? "", taxYear);
  const baseline = evaluateFacts(taxYear, baselineFacts);
  const patched = applyOverrides(cloneData(baselineFacts.data), scenario.fact_changes);
  const scenarioFacts = UserFacts.fromData(patched, taxYear);
  const scenarioScan = evaluateFacts(taxYear, scenarioFacts);
  const diffRaw = diffResults(baseline.results, scenarioScan.results);

  const diff: ScenarioDiff = {
    newly_added: diffRaw.newlyAdded,
    improved: diffRaw.improved.map(([before, after]) => ({ before, after })),
    degraded: diffRaw.degraded.map(([before, after]) => ({ before, after })),
    removed: diffRaw.removed
  };

  const ai_narrative = withAi
    ? await generateScenarioAiNarrative(scenario.description, diff, taxYear)
    : "";

  return {
    scenario: key,
    description: scenario.description,
    baseline_counts: baseline.counts,
    scenario_counts: scenarioScan.counts,
    diff,
    ...(ai_narrative ? { ai_narrative } : {})
  };
}
