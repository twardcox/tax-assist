import { riskRank, RISK_NAMES } from "./stacks";

export type MinerBenefit = {
  id: string;
  risk_level: string;
  compatible_with: string[];
  conflicts_with: string[];
  facts: string[];
};

export type MinerCandidate = {
  members: [string, string];
  sharedFacts: string[];
  jaccard: number;
  maxRisk: string;
  inAuthoredStack: string[];
};

export type MinerReport = {
  candidates: MinerCandidate[];
  dangling: Array<{ from: string; to: string }>;
};

export function toMinerBenefit(raw: Record<string, unknown>): MinerBenefit | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  if (!id) {
    return null;
  }

  const stacking = (raw.stacking_rules ?? {}) as Record<string, unknown>;
  const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];

  const factsRaw = Array.isArray(raw.required_user_facts) ? raw.required_user_facts : [];
  const facts = factsRaw
    .map((f) => {
      if (typeof f === "string") {
        return f;
      }
      const fact = (f as Record<string, unknown> | null)?.fact;
      return typeof fact === "string" ? fact : "";
    })
    .filter(Boolean);

  return {
    id,
    risk_level: typeof raw.risk_level === "string" ? raw.risk_level : "low",
    compatible_with: strings(stacking.compatible_with),
    conflicts_with: strings(stacking.conflicts_with),
    facts
  };
}

export function mineCandidateStacks(
  benefits: MinerBenefit[],
  authoredMemberIds: Set<string>
): MinerReport {
  const byId = new Map(benefits.map((b) => [b.id, b]));
  const dangling: Array<{ from: string; to: string }> = [];
  const edges = new Map<string, [string, string]>();

  for (const b of benefits) {
    for (const target of b.compatible_with) {
      if (target === b.id) {
        continue;
      }
      const other = byId.get(target);
      if (!other) {
        dangling.push({ from: b.id, to: target });
        continue;
      }
      if (b.conflicts_with.includes(target) || other.conflicts_with.includes(b.id)) {
        continue;
      }
      const pair = [b.id, target].sort() as [string, string];
      edges.set(pair.join("::"), pair);
    }
  }

  const candidates: MinerCandidate[] = [];
  for (const [a, b] of edges.values()) {
    const factsA = new Set(byId.get(a)!.facts);
    const factsB = new Set(byId.get(b)!.facts);
    const shared = [...factsA].filter((f) => factsB.has(f));
    const union = new Set([...factsA, ...factsB]);
    candidates.push({
      members: [a, b],
      sharedFacts: shared,
      jaccard: union.size === 0 ? 0 : shared.length / union.size,
      maxRisk: RISK_NAMES[Math.max(riskRank(byId.get(a)!.risk_level), riskRank(byId.get(b)!.risk_level))],
      inAuthoredStack: [a, b].filter((id) => authoredMemberIds.has(id))
    });
  }

  candidates.sort((x, y) => y.jaccard - x.jaccard || x.members[0].localeCompare(y.members[0]));
  return { candidates, dangling };
}
