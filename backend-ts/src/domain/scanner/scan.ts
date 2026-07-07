import { loadBenefitLibrary } from "./benefitLoader";
import { evaluateBenefit } from "./rules";
import { loadStacks, evaluateStack } from "./stacks";
import { UserFacts } from "./userFacts";
import type { ScanResult, ScanRun, ScanStatus } from "./types";

const STATUS_ORDER: ScanStatus[] = [
  "eligible_now",
  "nearly_eligible",
  "eligible_if_changed",
  "future_opportunity",
  "high_risk",
  "not_applicable",
  "expired"
];

function countByStatus(results: ScanResult[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const status of STATUS_ORDER) {
    counts[status] = 0;
  }

  for (const result of results) {
    counts[result.status] = (counts[result.status] ?? 0) + 1;
  }

  return counts;
}

export async function runScan(taxYear: number, userId?: string | null): Promise<ScanRun> {
  const rawBenefits = loadBenefitLibrary();
  const facts = userId ? await UserFacts.fromUserSections(userId, taxYear) : UserFacts.fromYaml(taxYear);

  const all = rawBenefits.map((b) => evaluateBenefit(b, facts));

  // Stacks see every member result, including the "unknown" ones filtered from the response.
  const resultsById = new Map(all.map((r) => [r.benefit_id, r]));
  const knownIds = new Set(
    rawBenefits.map((b) => (typeof b.id === "string" ? b.id : "")).filter(Boolean)
  );
  const stacks = loadStacks(knownIds).map((s) => evaluateStack(s, resultsById));

  const results = all.filter((r) => r.status !== "unknown");

  return {
    tax_year: taxYear,
    total: results.length,
    counts: countByStatus(results),
    results,
    stacks
  };
}
