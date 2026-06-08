export type ScanStatus =
  | "eligible_now"
  | "nearly_eligible"
  | "eligible_if_changed"
  | "future_opportunity"
  | "not_applicable"
  | "high_risk"
  | "expired"
  | "unknown";

export type ScanResult = {
  benefit_id: string;
  benefit_name: string;
  category: string;
  jurisdiction: string;
  status: ScanStatus;
  estimated_value: string;
  risk_level: string;
  message: string;
  next_steps: string[];
  missing_facts: string[];
  changes_needed: string[];
  documents_needed: string[];
  forms_required: string[];
  phaseout_note: string;
  review_required: boolean;
};

export type ScanRun = {
  tax_year: number;
  total: number;
  counts: Record<string, number>;
  results: ScanResult[];
};
