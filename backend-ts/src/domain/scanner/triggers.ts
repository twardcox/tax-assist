import type { TriggerStatus } from "./types";
import { UserFacts } from "./userFacts";

type RawBenefit = Record<string, unknown>;

// Metric registry: YAML `trigger.metric` keys → UserFacts reads. Add a row to support a new metric.
const METRICS: Record<string, { label: string; read: (facts: UserFacts) => number }> = {
  annual_cash_operating_spend: {
    label: "Annual cash operating spend",
    read: (facts) => facts.totalBusinessCashOperatingSpend()
  },
  net_profit: {
    label: "Net profit",
    read: (facts) => facts.totalBusinessNetProfit()
  }
};

function warnInvalid(benefit: RawBenefit, field: string, detail: string): undefined {
  const id = typeof benefit.id === "string" ? benefit.id : "unknown-benefit";
  console.warn(`[triggers] Benefit "${id}": invalid trigger.${field} — ${detail}. Trigger ignored.`);
  return undefined;
}

/**
 * Evaluate a benefit's optional YAML `trigger:` block against user facts.
 * Returns undefined when no (valid) trigger is declared — scan behavior unchanged.
 */
export function evaluateTrigger(benefit: RawBenefit, facts: UserFacts): TriggerStatus | undefined {
  const raw = benefit.trigger;
  if (raw == null) {
    return undefined;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return warnInvalid(benefit, "", "must be a mapping");
  }

  const t = raw as Record<string, unknown>;

  const metricKey = t.metric;
  if (typeof metricKey !== "string" || !(metricKey in METRICS)) {
    return warnInvalid(benefit, "metric", `must be one of: ${Object.keys(METRICS).join(", ")}`);
  }

  const threshold = t.threshold;
  if (typeof threshold !== "number" || !Number.isFinite(threshold) || threshold <= 0) {
    return warnInvalid(benefit, "threshold", "must be a positive number");
  }

  const comparison = t.comparison ?? "gte";
  if (comparison !== "gte" && comparison !== "lte") {
    return warnInvalid(benefit, "comparison", 'must be "gte" or "lte"');
  }

  const metric = METRICS[metricKey];
  const current = metric.read(facts);
  const fired = comparison === "gte" ? current >= threshold : current <= threshold;
  const distance = fired ? 0 : comparison === "gte" ? threshold - current : current - threshold;

  return {
    metric: metricKey,
    label: typeof t.label === "string" && t.label.trim() ? t.label.trim() : metric.label,
    threshold,
    comparison,
    current_value: current,
    distance,
    fired
  };
}

/** The YAML-declared threshold, for rules that key status messages off it (single source, FR-009). */
export function triggerThreshold(benefit: RawBenefit): number | null {
  const raw = benefit.trigger;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const threshold = (raw as Record<string, unknown>).threshold;
    if (typeof threshold === "number" && Number.isFinite(threshold) && threshold > 0) {
      return threshold;
    }
  }
  return null;
}
