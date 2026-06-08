import type { ScanResult, ScanStatus } from "./types";
import { UserFacts } from "./userFacts";

type RawBenefit = Record<string, unknown>;

type RuleOutput = {
  status: ScanStatus;
  message: string;
  estimated_value?: string;
  next_steps?: string[];
  missing_facts?: string[];
  changes_needed?: string[];
  phaseout_note?: string;
};

type RuleFn = (benefit: RawBenefit, facts: UserFacts) => RuleOutput;

function listField(raw: unknown, key: string): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      if (entry && typeof entry === "object") {
        const value = (entry as Record<string, unknown>)[key];
        return typeof value === "string" ? value : "";
      }
      return "";
    })
    .filter(Boolean);
}

function estimatedValue(raw: unknown): string {
  if (typeof raw === "string") {
    return raw;
  }

  if (raw && typeof raw === "object") {
    const typical = (raw as Record<string, unknown>).typical_range;
    return typeof typical === "string" ? typical : "";
  }

  return "";
}

function phaseoutNote(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) {
    return "";
  }
  const first = raw[0];
  if (typeof first === "string") {
    return first;
  }
  if (first && typeof first === "object") {
    const rule = (first as Record<string, unknown>).rule;
    return typeof rule === "string" ? rule : "";
  }
  return "";
}

function baseResult(benefit: RawBenefit): Omit<ScanResult, "status" | "message"> {
  const review = benefit.review_required as Record<string, unknown> | undefined;

  return {
    benefit_id: typeof benefit.id === "string" ? benefit.id : "unknown-benefit",
    benefit_name: typeof benefit.name === "string" ? benefit.name : "Unnamed Benefit",
    category: typeof benefit.category === "string" ? benefit.category : "unknown",
    jurisdiction: typeof benefit.jurisdiction === "string" ? benefit.jurisdiction : "unknown",
    estimated_value: estimatedValue(benefit.estimated_value),
    risk_level: typeof benefit.risk_level === "string" ? benefit.risk_level : "low",
    next_steps: [],
    missing_facts: listField(benefit.required_user_facts, "fact"),
    changes_needed: [],
    documents_needed: listField(benefit.required_documents, "document"),
    forms_required: listField(benefit.required_forms, "form"),
    phaseout_note: phaseoutNote(benefit.phaseouts),
    review_required: Boolean(review?.cpa)
  };
}

const rules: Record<string, RuleFn> = {
  "sep-ira-contribution": (_benefit, facts) => {
    if (!facts.hasSelfEmployment()) {
      return {
        status: "not_applicable",
        message: "SEP-IRA requires self-employment income."
      };
    }

    const netProfit = facts.firstBusinessNetProfit();
    if (netProfit <= 0) {
      return {
        status: "nearly_eligible",
        message:
          "Has self-employment but net profit not provided. Needed to calculate SEP contribution limit.",
        missing_facts: ["businesses.financials.net_profit_loss"]
      };
    }

    const seDeduction = netProfit * 0.9235 * 0.5 * 0.153;
    const netEarnings = netProfit - seDeduction;
    const maxContrib = Math.max(0, Math.min(netEarnings * 0.25, 70000));
    const contributionsYtd = facts.sepIraContributionsYtd();
    const remaining = Math.max(0, maxContrib - contributionsYtd);

    if (!facts.sepIraEstablished()) {
      return {
        status: "nearly_eligible",
        message:
          `SEP-IRA not yet established. Can contribute up to $${maxContrib.toLocaleString()} for this tax year.`,
        estimated_value: `Up to $${maxContrib.toLocaleString()} deductible contribution`,
        next_steps: [
          "Open SEP-IRA at a brokerage custodian.",
          "Establish and fund by filing deadline (including extension)."
        ]
      };
    }

    if (remaining > 0) {
      return {
        status: "eligible_now",
        message:
          `SEP-IRA established. $${remaining.toLocaleString()} contribution room remaining (${contributionsYtd.toLocaleString()} contributed).`,
        estimated_value: `Up to $${remaining.toLocaleString()} additional deductible contribution`,
        next_steps: [`Contribute up to $${remaining.toLocaleString()} before filing deadline.`]
      };
    }

    return {
      status: "not_applicable",
      message: "SEP-IRA appears fully funded for the year."
    };
  },

  "hsa-triple-tax-advantage": (_benefit, facts) => {
    const coverage = facts.healthcareCoverage();
    if (coverage === "medicare" || coverage === "medicaid") {
      return {
        status: "not_applicable",
        message: "Cannot contribute to HSA while enrolled in Medicare or Medicaid."
      };
    }

    if (!facts.hdhpEnrolled()) {
      return {
        status: "nearly_eligible",
        message:
          "Not confirmed on HDHP. Switching to a qualifying HDHP unlocks HSA triple-tax advantage.",
        missing_facts: ["healthcare.insurance.hdhp_enrolled"],
        changes_needed: [
          "Switch to a qualifying HDHP plan.",
          "Open an HSA after HDHP enrollment."
        ]
      };
    }

    const level = facts.hdhpCoverageLevel();
    const age = facts.taxpayerAge();
    let limit = level === "family" ? 8550 : 4300;
    if (age !== null && age >= 55) {
      limit += 1000;
    }

    const contributed = facts.hsaContributionsYtd();
    const remaining = Math.max(0, limit - contributed);

    return {
      status: "eligible_now",
      message: `HDHP enrolled. $${remaining.toLocaleString()} of $${limit.toLocaleString()} HSA room remaining.`,
      estimated_value: `$${remaining.toLocaleString()} deductible contribution plus tax-free growth`,
      next_steps: [`Contribute up to $${remaining.toLocaleString()} before filing deadline.`]
    };
  },

  "self-employed-health-insurance": (_benefit, facts) => {
    if (!facts.hasSelfEmployment()) {
      return {
        status: "not_applicable",
        message: "Self-employed health insurance deduction requires self-employment income."
      };
    }

    const coverage = facts.healthcareCoverage();
    if (coverage === "employer") {
      return {
        status: "not_applicable",
        message:
          "Employer coverage detected. Deduction is unavailable for months with employer-sponsored coverage."
      };
    }

    const premium = facts.businessHealthInsurancePremium();
    const claimed = facts.businessHealthInsuranceClaimed();

    if (premium > 0 && claimed) {
      return {
        status: "eligible_now",
        message: `Self-employed health insurance deduction available for about $${premium.toLocaleString()} in premiums.`,
        estimated_value: `~$${premium.toLocaleString()} above-the-line deduction`,
        next_steps: ["Report on Schedule 1, Line 17.", "Confirm S Corp W-2 treatment if applicable."]
      };
    }

    return {
      status: "nearly_eligible",
      message: "Has self-employment. Confirm premium amount and deduction treatment.",
      missing_facts: [
        "businesses.health_insurance.premium_amount",
        "businesses.health_insurance.owner_health_insurance_deducted"
      ]
    };
  }
};

export function evaluateBenefit(benefit: RawBenefit, facts: UserFacts): ScanResult {
  const base = baseResult(benefit);
  const id = base.benefit_id;

  const rule = rules[id];
  if (!rule) {
    return {
      ...base,
      status: "unknown",
      message: "Eligibility rule not yet implemented for this benefit."
    };
  }

  const evaluated = rule(benefit, facts);
  return {
    ...base,
    status: evaluated.status,
    message: evaluated.message,
    estimated_value: evaluated.estimated_value ?? base.estimated_value,
    next_steps: evaluated.next_steps ?? base.next_steps,
    missing_facts: evaluated.missing_facts ?? base.missing_facts,
    changes_needed: evaluated.changes_needed ?? base.changes_needed,
    phaseout_note: evaluated.phaseout_note ?? base.phaseout_note
  };
}
