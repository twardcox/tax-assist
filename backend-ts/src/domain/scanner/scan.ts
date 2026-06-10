import { loadBenefitLibrary } from "./benefitLoader";
import { evaluateBenefit } from "./rules";
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

export function runScan(taxYear: number, userId?: string | null): ScanRun {
  const rawBenefits = loadBenefitLibrary();
  const facts = userId ? UserFacts.fromUserSections(userId, taxYear) : UserFacts.fromYaml(taxYear);

  const results: ScanResult[] = rawBenefits
    .map((b) => evaluateBenefit(b, facts))
    .filter((r) => r.status !== "unknown");

  return {
    tax_year: taxYear,
    total: results.length,
    counts: countByStatus(results),
    results
  };
}
