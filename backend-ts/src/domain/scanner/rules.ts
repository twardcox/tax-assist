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
  "home-office-deduction": (_benefit, facts) => {
    if (!facts.hasSelfEmployment()) {
      return {
        status: "not_applicable",
        message:
          "No self-employment income found. Home office requires self-employment or required employer home office."
      };
    }

    const biz = facts.firstBusiness();
    const homeOffice = (biz.home_office as Record<string, unknown> | undefined) ?? {};
    const claimed = homeOffice.claimed === true;
    const sqft = Number(homeOffice.square_footage ?? 0);

    if (claimed && sqft > 0) {
      return {
        status: "eligible_now",
        message: "Home office deduction available. Verify exclusive-use documentation.",
        next_steps: [
          "Calculate office sq ft as % of total home sq ft",
          "Gather utility, insurance, and mortgage/rent receipts",
          "Photograph workspace for audit file",
          "Choose simplified ($5/sq ft, max $1,500) vs. regular method on Form 8829"
        ]
      };
    }

    if (claimed) {
      return {
        status: "nearly_eligible",
        message: "Home office confirmed but square footage missing — needed to calculate deduction.",
        missing_facts: ["businesses.home_office.square_footage"],
        next_steps: ["Measure and record office square footage in businesses.yaml"]
      };
    }

    return {
      status: "nearly_eligible",
      message: "Self-employment present — confirm whether you have an exclusive-use workspace.",
      missing_facts: ["businesses.home_office.claimed", "businesses.home_office.square_footage"],
      next_steps: [
        "Designate a space used exclusively for business",
        "Set home_office.claimed: true in businesses.yaml",
        "Measure and record square footage"
      ]
    };
  },

  "qbi-deduction": (_benefit, facts) => {
    if (!facts.hasSelfEmployment()) {
      return {
        status: "not_applicable",
        message:
          "QBI deduction requires pass-through business income (self-employment, partnership, S Corp, or LLC)."
      };
    }

    const biz = facts.firstBusiness();
    const netProfit = Number((biz.financials as Record<string, unknown> | undefined)?.net_profit_loss ?? 0);
    const agi = facts.estimatedAgi();
    const filingStatus = facts.filingStatus() ?? "single";
    const thresholds: Record<string, [number, number]> = {
      single: [197300, 247300],
      mfj: [394600, 494600],
      married_filing_jointly: [394600, 494600],
      hoh: [197300, 247300],
      head_of_household: [197300, 247300],
      mfs: [197300, 247300]
    };
    const [, hi] = thresholds[filingStatus.toLowerCase()] ?? thresholds.single;

    if (netProfit <= 0) {
      return {
        status: "nearly_eligible",
        message: "Has self-employment but net profit not recorded. QBI deduction requires positive net profit.",
        missing_facts: ["businesses.financials.net_profit_loss"]
      };
    }

    let phaseout = "";
    if (agi) {
      phaseout = `${agi >= hi ? "AGI above phaseout range" : `AGI ${agi.toLocaleString()} is within phaseout planning range`}`;
      if (agi > hi) {
        const sstb = (biz.specified_service_trade as boolean | null | undefined) === true;
        if (sstb) {
          return {
            status: "not_applicable",
            message: `SSTB business + AGI ${agi.toLocaleString()} above phaseout — QBI deduction fully phased out.`,
            phaseout_note: phaseout
          };
        }
        return {
          status: "eligible_now",
          message: "QBI deduction available but W-2 wage / qualified property limitation applies (AGI above threshold).",
          phaseout_note: phaseout,
          next_steps: [
            "Calculate W-2 wage limitation (50% of W-2 wages, or 25% wages + 2.5% property)",
            "Use Form 8995-A (not simplified Form 8995)",
            "Review with CPA — optimization of salary/distribution split matters here"
          ]
        };
      }
    }

    return {
      status: "eligible_now",
      message: `QBI deduction available — estimated 20% of ~${netProfit.toLocaleString()} net profit.${phaseout ? ` Note: ${phaseout}.` : ""}`,
      estimated_value: `~$${Math.round(netProfit * 0.2).toLocaleString()}/year (before taxable income cap)`,
      next_steps: [
        "Use Form 8995 if below income thresholds",
        "Confirm business is not a Specified Service Trade (SSTB)",
        "Model home office and retirement contribution impact on QBI"
      ]
    };
  },

  "business-vehicle-deduction": (_benefit, facts) => {
    if (!facts.hasSelfEmployment()) {
      return {
        status: "not_applicable",
        message: "Business vehicle deduction requires self-employment."
      };
    }

    const biz = facts.firstBusiness();
    const vehicle = (biz.vehicle as Record<string, unknown> | undefined) ?? {};
    const hasVehicle = vehicle.business_vehicle === true;
    const miles = Number(vehicle.business_miles ?? 0);

    if (hasVehicle && miles > 0) {
      const deduction = miles * 0.67;
      return {
        status: "eligible_now",
        message: `Business vehicle: ${miles.toLocaleString()} miles × $0.67 = ~${deduction.toLocaleString()} (standard mileage).`,
        estimated_value: `~$${Math.round(deduction).toLocaleString()}+ per year`,
        next_steps: [
          "Ensure contemporaneous mileage log exists (date, destination, purpose)",
          "Compare standard mileage vs. actual expense method",
          "If vehicle GVWR > 6,000 lbs: evaluate Section 179 deduction"
        ]
      };
    }

    if (hasVehicle) {
      return {
        status: "nearly_eligible",
        message: "Business vehicle confirmed but no mileage recorded.",
        missing_facts: ["businesses.vehicle.business_miles"],
        next_steps: ["Record business miles driven in businesses.yaml", "Start mileage log going forward"]
      };
    }

    return {
      status: "nearly_eligible",
      message: "Has self-employment — confirm whether a vehicle is used for business.",
      missing_facts: ["businesses.vehicle.business_vehicle", "businesses.vehicle.business_miles"]
    };
  },

  "real-estate-depreciation": (_benefit, facts) => {
    if (!facts.hasRentalProperty()) {
      if (facts.hasAnyRealEstate()) {
        return {
          status: "not_applicable",
          message:
            "Real estate held but not classified as rental — depreciation applies only to rental/business property."
        };
      }

      return {
        status: "not_applicable",
        message: "No rental real estate found. Depreciation applies to rental or business property."
      };
    }

    const prop = facts.firstProperty();
    const purchasePrice = Number((prop.acquisition as Record<string, unknown> | undefined)?.purchase_price ?? 0);

    if (purchasePrice <= 0) {
      return {
        status: "nearly_eligible",
        message: "Has rental property but purchase price not recorded — needed to calculate depreciation basis.",
        missing_facts: ["real_estate.acquisition.purchase_price"]
      };
    }

    const annualDepreciation = (purchasePrice * 0.75) / 27.5;
    return {
      status: "eligible_now",
      message: `Rental property depreciation available — estimated ~${annualDepreciation.toLocaleString()} per year (27.5-year residential).`,
      estimated_value: `~$${Math.round(annualDepreciation).toLocaleString()}/year non-cash deduction`,
      next_steps: [
        "Verify depreciation has been tracked since purchase date",
        "Allocate purchase price: ~75-80% to building (depreciable), 20-25% to land (not depreciable)",
        "Consider cost segregation study to accelerate depreciation",
        "File Form 3115 if depreciation was not taken in prior years (catch-up without amending)"
      ]
    };
  },

  "passive-activity-loss": (_benefit, facts) => {
    if (!facts.hasRentalProperty()) {
      return {
        status: "not_applicable",
        message: "Passive activity loss rules apply to rental real estate only."
      };
    }

    const agi = facts.estimatedAgi();
    if (agi == null) {
      return {
        status: "nearly_eligible",
        message:
          "Has rental property but AGI not provided — needed to determine passive loss allowance.",
        missing_facts: ["household.estimated_agi"]
      };
    }

    if (agi <= 100000) {
      return {
        status: "eligible_now",
        message:
          `AGI ${agi.toLocaleString()} qualifies for full $25,000 rental loss allowance against ordinary income.`,
        estimated_value: "Up to $25,000 rental loss against ordinary income",
        next_steps: ["Track all rental expenses to maximize allowable loss", "Report on Schedule E and Form 8582"]
      };
    }

    if (agi < 150000) {
      const allowance = 25000 - (agi - 100000) * 0.5;
      return {
        status: "eligible_now",
        message: `Partial rental loss allowance available — ~${allowance.toLocaleString()} of the $25,000 limit (AGI ${agi.toLocaleString()}).`,
        estimated_value: `~$${Math.round(allowance).toLocaleString()} rental loss against ordinary income`,
        phaseout_note: `AGI ${agi.toLocaleString()} is within passive loss phaseout range (100,000–150,000)`,
        next_steps: ["Consider whether Real Estate Professional status applies"]
      };
    }

    return {
      status: "eligible_if_changed",
      message:
        `AGI ${agi.toLocaleString()} — $25,000 rental loss allowance fully phased out. Losses carry forward.`,
      changes_needed: [
        "Qualify as Real Estate Professional (750+ hours) to deduct losses without limit",
        "Use short-term rentals (avg stay < 7 days) with material participation as alternative",
        "Carry forward losses to offset future rental income or sale gains"
      ]
    };
  },
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
