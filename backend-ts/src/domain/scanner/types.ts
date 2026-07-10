export type ScanStatus =
  | "eligible_now"
  | "nearly_eligible"
  | "eligible_if_changed"
  | "future_opportunity"
  | "not_applicable"
  | "high_risk"
  | "expired"
  | "unknown";

// Threshold-trigger status (System PRD §5.2). Thresholds live in benefit YAML, not code.
export type TriggerStatus = {
  metric: string;
  label: string;
  threshold: number;
  comparison: "gte" | "lte";
  current_value: number;
  distance: number; // dollars to firing; 0 when fired
  fired: boolean;
};

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
  trigger?: TriggerStatus;
};

export type SequenceStep = {
  step: number;
  action: string;
  timing: string;
  professional: string;
};

export type StackMemberResult = {
  benefit_id: string;
  role: string;
  required: boolean;
  status: ScanStatus;
};

export type StackResult = {
  stack_id: string;
  name: string;
  target_profile: string;
  status: ScanStatus;
  members: StackMemberResult[];
  blocking: string[];
  sequence: SequenceStep[];
  interactions: string;
  combined_value: string;
  risk_level: string;
  abuse_boundary: string;
  review_required: boolean;
};

export type ScanRun = {
  tax_year: number;
  total: number;
  counts: Record<string, number>;
  results: ScanResult[];
  stacks: StackResult[];
};
