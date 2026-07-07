import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { projectPaths } from "../../lib/paths";
import type { ScanResult, ScanStatus, SequenceStep, StackMemberResult, StackResult } from "./types";

type StackMember = { benefit_id: string; role: string; required: boolean };

export type RawStack = {
  id: string;
  name: string;
  target_profile: string;
  members: StackMember[];
  interactions: string;
  sequence: SequenceStep[];
  combined_value: string;
  abuse_boundary: string;
  review_required: boolean;
};

const RISK_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  moderate: 1,
  high: 2,
  aggressive: 2,
  high_review_required: 2
};

export const RISK_NAMES = ["low", "medium", "high"] as const;

export function riskRank(level: string): number {
  return RISK_RANK[level] ?? 0;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseStack(
  raw: Record<string, unknown>,
  knownBenefitIds: Set<string>,
  source: string
): RawStack {
  if (raw.kind !== "strategy_stack") {
    throw new Error(`Stack ${source}: kind must be "strategy_stack"`);
  }

  const id = text(raw.id);
  if (!id) {
    throw new Error(`Stack ${source}: missing id`);
  }

  const membersRaw = Array.isArray(raw.members) ? raw.members : [];
  if (membersRaw.length === 0) {
    throw new Error(`Stack ${id}: members must be a non-empty list`);
  }
  const members: StackMember[] = membersRaw.map((entry) => {
    const m = (entry ?? {}) as Record<string, unknown>;
    const benefitId = text(m.benefit_id);
    if (!knownBenefitIds.has(benefitId)) {
      throw new Error(`Stack ${id}: member benefit_id "${benefitId}" does not exist in the benefit library`);
    }
    return { benefit_id: benefitId, role: text(m.role), required: m.required === true };
  });

  const sequenceRaw = Array.isArray(raw.sequence) ? raw.sequence : [];
  if (sequenceRaw.length === 0) {
    throw new Error(`Stack ${id}: sequence (playbook) must be non-empty`);
  }
  const sequence: SequenceStep[] = sequenceRaw.map((entry, i) => {
    const s = (entry ?? {}) as Record<string, unknown>;
    return {
      step: typeof s.step === "number" ? s.step : i + 1,
      action: text(s.action),
      timing: text(s.timing),
      professional: text(s.professional) || "none"
    };
  });

  const review = (raw.review_required ?? {}) as Record<string, unknown>;

  return {
    id,
    name: text(raw.name) || id,
    target_profile: text(raw.target_profile),
    members,
    interactions: text(raw.interactions),
    sequence,
    combined_value: text(raw.combined_value),
    abuse_boundary: text(raw.abuse_boundary),
    review_required: review.cpa === true || review.attorney === true
  };
}

export function loadStacks(knownBenefitIds: Set<string>): RawStack[] {
  const dir = path.join(projectPaths.taxLibrary, "stacks");
  if (!fs.existsSync(dir)) {
    return [];
  }

  const stacks: RawStack[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".yaml")) {
      continue;
    }
    const filePath = path.join(dir, entry.name);
    const parsed = yaml.load(fs.readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`Stack file ${entry.name}: not a YAML mapping`);
    }
    stacks.push(parseStack(parsed as Record<string, unknown>, knownBenefitIds, entry.name));
  }

  return stacks;
}

const DEAD: ReadonlySet<ScanStatus> = new Set<ScanStatus>(["not_applicable", "expired"]);

export function evaluateStack(stack: RawStack, resultsById: Map<string, ScanResult>): StackResult {
  const members: StackMemberResult[] = stack.members.map((m) => ({
    benefit_id: m.benefit_id,
    role: m.role,
    required: m.required,
    status: resultsById.get(m.benefit_id)?.status ?? "unknown"
  }));

  const required = members.filter((m) => m.required);

  let status: ScanStatus;
  if (required.some((m) => DEAD.has(m.status))) {
    status = "not_applicable";
  } else if (required.length > 0 && required.every((m) => m.status === "eligible_now")) {
    status = "eligible_now";
  } else {
    status = "nearly_eligible";
  }

  const counted = members.filter((m) => m.required || !DEAD.has(m.status));
  const maxRisk = counted.reduce(
    (max, m) => Math.max(max, riskRank(resultsById.get(m.benefit_id)?.risk_level ?? "low")),
    0
  );

  return {
    stack_id: stack.id,
    name: stack.name,
    target_profile: stack.target_profile,
    status,
    members,
    blocking: required.filter((m) => m.status !== "eligible_now").map((m) => m.benefit_id),
    sequence: stack.sequence,
    interactions: stack.interactions,
    combined_value: stack.combined_value,
    risk_level: RISK_NAMES[maxRisk],
    abuse_boundary: stack.abuse_boundary,
    review_required: stack.review_required
  };
}
