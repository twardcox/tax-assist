import { loadBenefitLibrary } from "./benefitLoader";
import type { ScanResult, ScanRun, ScanStatus } from "./types";

const STATUS_ORDER: ScanStatus[] = [
  "eligible_now",
  "nearly_eligible",
  "eligible_if_changed",
  "future_opportunity",
  "high_risk",
  "unknown"
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

function stringifyListField(raw: unknown, key: string): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      if (entry && typeof entry === "object") {
        const obj = entry as Record<string, unknown>;
        const val = obj[key];
        return typeof val === "string" ? val : "";
      }
      return "";
    })
    .filter(Boolean);
}

function toEstimatedValue(raw: unknown): string {
  if (!raw) {
    return "";
  }
  if (typeof raw === "string") {
    return raw;
  }
  if (typeof raw === "object" && raw !== null) {
    const typical = (raw as Record<string, unknown>).typical_range;
    if (typeof typical === "string") {
      return typical;
    }
  }
  return "";
}

function toPhaseoutNote(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) {
    return "";
  }

  const first = raw[0];
  if (typeof first === "string") {
    return first;
  }
  if (first && typeof first === "object") {
    const value = (first as Record<string, unknown>).rule;
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
}

export function runScan(taxYear: number): ScanRun {
  const rawBenefits = loadBenefitLibrary();

  const results: ScanResult[] = rawBenefits.map((b) => {
    const id = typeof b.id === "string" ? b.id : "unknown-benefit";
    const name = typeof b.name === "string" ? b.name : id;
    const category = typeof b.category === "string" ? b.category : "unknown";
    const jurisdiction = typeof b.jurisdiction === "string" ? b.jurisdiction : "unknown";
    const riskLevel = typeof b.risk_level === "string" ? b.risk_level : "low";

    const nextSteps = stringifyListField(b.qualification_pathways, "");
    const missingFacts = stringifyListField(b.required_user_facts, "fact");
    const changesNeeded = stringifyListField(b.qualification_pathways, "");
    const documentsNeeded = stringifyListField(b.required_documents, "document");
    const formsRequired = stringifyListField(b.required_forms, "form");
    const reviewRequired = Boolean(
      (b.review_required as Record<string, unknown> | undefined)?.cpa
    );

    return {
      benefit_id: id,
      benefit_name: name,
      category,
      jurisdiction,
      status: "unknown",
      estimated_value: toEstimatedValue(b.estimated_value),
      risk_level: riskLevel,
      message:
        "Eligibility engine for this benefit is pending TypeScript parity port. This item is included for contract compatibility.",
      next_steps: nextSteps,
      missing_facts: missingFacts,
      changes_needed: changesNeeded,
      documents_needed: documentsNeeded,
      forms_required: formsRequired,
      phaseout_note: toPhaseoutNote(b.phaseouts),
      review_required: reviewRequired
    };
  });

  return {
    tax_year: taxYear,
    total: results.length,
    counts: countByStatus(results),
    results
  };
}
