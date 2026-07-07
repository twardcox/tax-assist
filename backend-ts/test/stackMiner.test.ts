import { describe, expect, test } from "vitest";
import { mineCandidateStacks, toMinerBenefit } from "../src/domain/scanner/stackMiner";
import type { MinerBenefit } from "../src/domain/scanner/stackMiner";

function benefit(id: string, overrides: Partial<MinerBenefit> = {}): MinerBenefit {
  return { id, risk_level: "low", compatible_with: [], conflicts_with: [], facts: [], ...overrides };
}

describe("toMinerBenefit", () => {
  test("normalizes YAML shapes: fact objects, string conflicts, missing stacking_rules", () => {
    const parsed = toMinerBenefit({
      id: "thing",
      risk_level: "moderate",
      stacking_rules: {
        compatible_with: ["other", 42],
        conflicts_with: ["bad-pair", { rule: "prose conflict, not an id" }]
      },
      required_user_facts: [{ fact: "household.estimated_agi" }, "income.w2_employment", { nonsense: true }]
    });
    expect(parsed).toEqual({
      id: "thing",
      risk_level: "moderate",
      compatible_with: ["other"],
      conflicts_with: ["bad-pair"],
      facts: ["household.estimated_agi", "income.w2_employment"]
    });
  });

  test("returns null without an id", () => {
    expect(toMinerBenefit({ name: "No Id" })).toBeNull();
  });
});

describe("mineCandidateStacks", () => {
  test("builds edges from either side's compatible_with and ranks by Jaccard", () => {
    const benefits = [
      benefit("a", { compatible_with: ["b"], facts: ["f1", "f2"] }),
      benefit("b", { facts: ["f1", "f2", "f3"] }),
      benefit("c", { compatible_with: ["a"], facts: ["f9"] })
    ];
    const report = mineCandidateStacks(benefits, new Set());
    expect(report.candidates.map((c) => c.members)).toEqual([
      ["a", "b"],
      ["a", "c"]
    ]);
    expect(report.candidates[0].jaccard).toBeCloseTo(2 / 3);
    expect(report.candidates[0].sharedFacts).toEqual(["f1", "f2"]);
    expect(report.candidates[1].jaccard).toBe(0);
  });

  test("excludes conflicting pairs", () => {
    const benefits = [
      benefit("a", { compatible_with: ["b"], conflicts_with: ["b"] }),
      benefit("b")
    ];
    expect(mineCandidateStacks(benefits, new Set()).candidates).toEqual([]);
  });

  test("collects dangling ids instead of crashing", () => {
    const benefits = [benefit("a", { compatible_with: ["ghost-benefit"] })];
    const report = mineCandidateStacks(benefits, new Set());
    expect(report.candidates).toEqual([]);
    expect(report.dangling).toEqual([{ from: "a", to: "ghost-benefit" }]);
  });

  test("marks members already in an authored stack and takes max risk", () => {
    const benefits = [
      benefit("a", { compatible_with: ["b"], risk_level: "high" }),
      benefit("b", { risk_level: "low" })
    ];
    const report = mineCandidateStacks(benefits, new Set(["b"]));
    expect(report.candidates[0].maxRisk).toBe("high");
    expect(report.candidates[0].inAuthoredStack).toEqual(["b"]);
  });
});
