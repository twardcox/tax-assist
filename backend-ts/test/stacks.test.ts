import { describe, expect, test } from "vitest";
import { parseStack, evaluateStack, riskRank } from "../src/domain/scanner/stacks";
import type { RawStack } from "../src/domain/scanner/stacks";
import type { ScanResult, ScanStatus } from "../src/domain/scanner/types";

const KNOWN = new Set(["benefit-a", "benefit-b", "benefit-c"]);

function rawStackYaml(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "test-stack",
    kind: "strategy_stack",
    name: "Test Stack",
    jurisdiction: "federal",
    target_profile: "Test profile",
    members: [
      { benefit_id: "benefit-a", role: "Foundation", required: true },
      { benefit_id: "benefit-b", role: "Layer", required: true },
      { benefit_id: "benefit-c", role: "Optional layer", required: false }
    ],
    interactions: "Some prose",
    sequence: [{ step: 1, action: "Do the thing", timing: "Q1", professional: "cpa" }],
    combined_value: "Some value",
    abuse_boundary: "",
    review_required: { cpa: true, attorney: false },
    ...overrides
  };
}

function member(id: string, status: ScanStatus, risk = "low"): [string, ScanResult] {
  return [
    id,
    {
      benefit_id: id,
      benefit_name: id,
      category: "x",
      jurisdiction: "federal",
      status,
      estimated_value: "",
      risk_level: risk,
      message: "",
      next_steps: [],
      missing_facts: [],
      changes_needed: [],
      documents_needed: [],
      forms_required: [],
      phaseout_note: "",
      review_required: false
    }
  ];
}

function stack(): RawStack {
  return parseStack(rawStackYaml(), KNOWN, "test.yaml");
}

describe("parseStack validation", () => {
  test("accepts a valid stack", () => {
    const parsed = stack();
    expect(parsed.id).toBe("test-stack");
    expect(parsed.members).toHaveLength(3);
    expect(parsed.review_required).toBe(true);
  });

  test("throws on dangling benefit_id", () => {
    const bad = rawStackYaml({
      members: [{ benefit_id: "no-such-benefit", role: "x", required: true }]
    });
    expect(() => parseStack(bad, KNOWN, "test.yaml")).toThrow(/no-such-benefit/);
  });

  test("throws on wrong kind", () => {
    expect(() => parseStack(rawStackYaml({ kind: "benefit" }), KNOWN, "test.yaml")).toThrow(/kind/);
  });

  test("throws on empty sequence", () => {
    expect(() => parseStack(rawStackYaml({ sequence: [] }), KNOWN, "test.yaml")).toThrow(/sequence/);
  });

  test("throws on empty members", () => {
    expect(() => parseStack(rawStackYaml({ members: [] }), KNOWN, "test.yaml")).toThrow(/members/);
  });
});

describe("evaluateStack roll-up truth table", () => {
  test("all required eligible_now -> eligible_now", () => {
    const result = evaluateStack(
      stack(),
      new Map([
        member("benefit-a", "eligible_now"),
        member("benefit-b", "eligible_now"),
        member("benefit-c", "not_applicable")
      ])
    );
    expect(result.status).toBe("eligible_now");
    expect(result.blocking).toEqual([]);
  });

  test("one required member blocked -> nearly_eligible with blocking list", () => {
    const result = evaluateStack(
      stack(),
      new Map([
        member("benefit-a", "eligible_now"),
        member("benefit-b", "nearly_eligible"),
        member("benefit-c", "eligible_now")
      ])
    );
    expect(result.status).toBe("nearly_eligible");
    expect(result.blocking).toEqual(["benefit-b"]);
  });

  test("required not_applicable propagates -> not_applicable", () => {
    const result = evaluateStack(
      stack(),
      new Map([
        member("benefit-a", "not_applicable"),
        member("benefit-b", "eligible_now"),
        member("benefit-c", "eligible_now")
      ])
    );
    expect(result.status).toBe("not_applicable");
  });

  test("required expired propagates -> not_applicable", () => {
    const result = evaluateStack(
      stack(),
      new Map([
        member("benefit-a", "expired"),
        member("benefit-b", "eligible_now"),
        member("benefit-c", "eligible_now")
      ])
    );
    expect(result.status).toBe("not_applicable");
  });

  test("missing member result treated as unknown -> nearly_eligible", () => {
    const result = evaluateStack(
      stack(),
      new Map([member("benefit-a", "eligible_now"), member("benefit-c", "eligible_now")])
    );
    expect(result.status).toBe("nearly_eligible");
    expect(result.members.find((m) => m.benefit_id === "benefit-b")?.status).toBe("unknown");
  });

  test("risk_level is max of counted members; N/A optional member excluded", () => {
    const highOptional = evaluateStack(
      stack(),
      new Map([
        member("benefit-a", "eligible_now", "low"),
        member("benefit-b", "eligible_now", "moderate"),
        member("benefit-c", "eligible_now", "high")
      ])
    );
    expect(highOptional.risk_level).toBe("high");

    const naOptional = evaluateStack(
      stack(),
      new Map([
        member("benefit-a", "eligible_now", "low"),
        member("benefit-b", "eligible_now", "moderate"),
        member("benefit-c", "not_applicable", "high")
      ])
    );
    expect(naOptional.risk_level).toBe("medium");
  });
});

describe("riskRank", () => {
  test("normalizes the library's messy risk vocabulary", () => {
    expect(riskRank("low")).toBe(0);
    expect(riskRank("medium")).toBe(1);
    expect(riskRank("moderate")).toBe(1);
    expect(riskRank("high")).toBe(2);
    expect(riskRank("aggressive")).toBe(2);
    expect(riskRank("high_review_required")).toBe(2);
    expect(riskRank("nonsense")).toBe(0);
  });
});
