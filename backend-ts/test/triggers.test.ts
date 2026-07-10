import { describe, expect, test, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { evaluateTrigger, triggerThreshold } from "../src/domain/scanner/triggers";
import { evaluateBenefit } from "../src/domain/scanner/rules";
import { UserFacts } from "../src/domain/scanner/userFacts";

function makeFacts(businesses: Array<Record<string, unknown>>): UserFacts {
  return UserFacts.fromData(
    {
      household: {},
      income: {},
      businesses: { businesses },
      real_estate: {},
      investments: {},
      retirement: {},
      healthcare: {},
      dependents: {},
      goals: {},
      documents_index: {}
    },
    2026
  );
}

const oneBiz = (financials: Record<string, unknown>) =>
  makeFacts([{ entity_type: "llc_single", financials }]);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("evaluateTrigger", () => {
  test("returns undefined when no trigger block declared", () => {
    expect(evaluateTrigger({ id: "x" }, oneBiz({}))).toBeUndefined();
  });

  test("gte: below threshold -> not fired, positive distance", () => {
    const t = evaluateTrigger(
      { id: "x", trigger: { metric: "net_profit", threshold: 40000 } },
      oneBiz({ net_profit_loss: 10000 })
    );
    expect(t).toMatchObject({ fired: false, distance: 30000, current_value: 10000, comparison: "gte" });
  });

  test("gte: at threshold -> fired, distance 0", () => {
    const t = evaluateTrigger(
      { id: "x", trigger: { metric: "net_profit", threshold: 40000 } },
      oneBiz({ net_profit_loss: 40000 })
    );
    expect(t).toMatchObject({ fired: true, distance: 0 });
  });

  test("gte: negative current value (loss) -> distance without double negatives", () => {
    const t = evaluateTrigger(
      { id: "x", trigger: { metric: "net_profit", threshold: 40000 } },
      oneBiz({ net_profit_loss: -3.41 })
    );
    expect(t).toMatchObject({ fired: false, current_value: -3.41 });
    expect(t!.distance).toBeCloseTo(40003.41, 2);
  });

  test("lte: below threshold -> fired; above -> distance = current - threshold", () => {
    const benefit = { id: "x", trigger: { metric: "net_profit", threshold: 100000, comparison: "lte" } };
    expect(evaluateTrigger(benefit, oneBiz({ net_profit_loss: 50000 }))).toMatchObject({
      fired: true,
      distance: 0
    });
    expect(evaluateTrigger(benefit, oneBiz({ net_profit_loss: 130000 }))).toMatchObject({
      fired: false,
      distance: 30000
    });
  });

  test("lte: at threshold -> fired", () => {
    const t = evaluateTrigger(
      { id: "x", trigger: { metric: "net_profit", threshold: 100000, comparison: "lte" } },
      oneBiz({ net_profit_loss: 100000 })
    );
    expect(t).toMatchObject({ fired: true, distance: 0 });
  });

  test("label falls back to the metric registry default and honors YAML override", () => {
    const noLabel = evaluateTrigger(
      { id: "x", trigger: { metric: "net_profit", threshold: 1000 } },
      oneBiz({ net_profit_loss: 0 })
    );
    expect(noLabel!.label).toBe("Net profit");

    const custom = evaluateTrigger(
      { id: "x", trigger: { metric: "net_profit", threshold: 1000, label: "Profit (all businesses)" } },
      oneBiz({ net_profit_loss: 0 })
    );
    expect(custom!.label).toBe("Profit (all businesses)");
  });

  test("annual_cash_operating_spend sums operating expenses + COGS across businesses", () => {
    const facts = makeFacts([
      { financials: { operating_expenses: 1000, cost_of_goods_sold: 250 } },
      { financials: { operating_expenses: 500 } }
    ]);
    const t = evaluateTrigger(
      { id: "x", trigger: { metric: "annual_cash_operating_spend", threshold: 5000 } },
      facts
    );
    expect(t).toMatchObject({ current_value: 1750, distance: 3250, fired: false });
  });

  test.each([
    [{ metric: "unknown_metric", threshold: 5000 }, "metric"],
    [{ metric: "net_profit", threshold: -5 }, "threshold"],
    [{ metric: "net_profit", threshold: "5000" }, "threshold"],
    [{ metric: "net_profit", threshold: 5000, comparison: "eq" }, "comparison"]
  ])("invalid trigger block %o -> undefined, warning names the field", (trigger, field) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = evaluateTrigger({ id: "bad-benefit", trigger }, oneBiz({}));
    expect(t).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`trigger.${field}`));
  });

  test("triggerThreshold reads the YAML threshold; null when absent/invalid", () => {
    expect(triggerThreshold({ trigger: { metric: "net_profit", threshold: 40000 } })).toBe(40000);
    expect(triggerThreshold({})).toBeNull();
    expect(triggerThreshold({ trigger: { threshold: -1 } })).toBeNull();
  });
});

describe("trigger integration with evaluateBenefit", () => {
  const sCorpBenefit = {
    id: "s-corp-election",
    name: "S Corp Election",
    category: "entity_election",
    jurisdiction: "federal",
    risk_level: "moderate",
    required_forms: [],
    required_documents: [],
    review_required: {},
    trigger: { metric: "net_profit", label: "Net profit", threshold: 40000, comparison: "gte" }
  };

  test("s-corp at threshold: existing status preserved, trigger fired, CPA step present", () => {
    const result = evaluateBenefit(sCorpBenefit, oneBiz({ net_profit_loss: 40000 }));
    expect(result.status).toBe("eligible_if_changed"); // pre-trigger behavior unchanged
    expect(result.trigger).toMatchObject({ fired: true, distance: 0, label: "Net profit" });
    expect([...result.next_steps, ...result.changes_needed].join(" ")).toMatch(/CPA/);
  });

  test("s-corp with a loss: status preserved, trigger distance = threshold + |loss|", () => {
    const result = evaluateBenefit(sCorpBenefit, oneBiz({ net_profit_loss: -3.41 }));
    expect(result.status).toBe("nearly_eligible"); // pre-trigger behavior unchanged
    expect(result.trigger!.fired).toBe(false);
    expect(result.trigger!.distance).toBeCloseTo(40003.41, 2);
  });

  test("s-corp below threshold: trigger carries distance", () => {
    const result = evaluateBenefit(sCorpBenefit, oneBiz({ net_profit_loss: 25000 }));
    expect(result.status).toBe("eligible_if_changed");
    expect(result.trigger).toMatchObject({ fired: false, distance: 15000 });
  });

  test("benefit without trigger block has no trigger field (no regression)", () => {
    const result = evaluateBenefit(
      { ...sCorpBenefit, trigger: undefined },
      oneBiz({ net_profit_loss: 90000 })
    );
    expect(result.trigger).toBeUndefined();
  });
});

describe("shipped trigger records", () => {
  const libDir = path.resolve(__dirname, "..", "..", "tax_library", "federal");

  test.each([
    ["federal-research-credit-41.yaml", "research-credit-41", "annual_cash_operating_spend", 5000],
    ["federal-s-corp-election.yaml", "s-corp-election", "net_profit", 40000]
  ])("%s declares the expected trigger block", (file, id, metric, threshold) => {
    const record = yaml.load(fs.readFileSync(path.join(libDir, file), "utf8")) as Record<string, unknown>;
    expect(record.id).toBe(id);
    expect(record.trigger).toMatchObject({ metric, threshold, comparison: "gte" });
    expect(typeof (record.trigger as Record<string, unknown>).label).toBe("string");
  });
});
