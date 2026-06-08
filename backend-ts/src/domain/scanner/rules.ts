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

const NO_INCOME_TAX_STATES = new Set(["AK", "FL", "NV", "NH", "SD", "TN", "TX", "WA", "WY"]);
const PTE_STATES = new Set([
  "CA",
  "NY",
  "NJ",
  "IL",
  "MA",
  "CT",
  "MD",
  "VA",
  "CO",
  "OR",
  "GA",
  "WI",
  "MN",
  "NC",
  "OH",
  "SC",
  "AZ",
  "MI",
  "PA",
  "LA",
  "ID",
  "RI",
  "ME",
  "MO",
  "VT",
  "AL",
  "UT",
  "NM",
  "KS",
  "OK"
]);
const STATES_WITH_529_DEDUCTION = new Set([
  "AL",
  "AZ",
  "AR",
  "CO",
  "CT",
  "DC",
  "GA",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "UT",
  "VA",
  "WV",
  "WI"
]);
const RETIREMENT_FRIENDLY_STATES = new Set([
  "AL",
  "AZ",
  "GA",
  "IL",
  "IN",
  "IA",
  "KY",
  "LA",
  "MI",
  "MS",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "SC",
  "VA",
  "WV"
]);

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
  "child-tax-credit": (_benefit, facts) => {
    if (!facts.hasDependents()) {
      return {
        status: "not_applicable",
        message: "No dependents recorded. Child Tax Credit requires qualifying children under age 17."
      };
    }

    const agi = facts.estimatedAgi();
    const filingStatus = facts.filingStatus() ?? "single";
    const cliff = ["mfj", "married_filing_jointly"].includes(filingStatus.toLowerCase()) ? 400000 : 200000;

    const deps = facts.dependents();
    const qualifying = deps.filter((d) => Number(d.age_at_year_end ?? 99) < 17 && d.ssn_obtained === true);
    const qualifyingNoSsn = deps.filter((d) => Number(d.age_at_year_end ?? 99) < 17 && d.ssn_obtained !== true);

    if (qualifying.length === 0 && qualifyingNoSsn.length === 0) {
      return {
        status: "not_applicable",
        message: "No qualifying children under 17 found."
      };
    }

    if (qualifyingNoSsn.length > 0) {
      const creditValue = qualifying.length * 2000;
      return {
        status: "nearly_eligible",
        message: `${qualifyingNoSsn.length} child(ren) missing SSN. Credit requires SSN by return due date.`,
        estimated_value: `~$${creditValue.toLocaleString()}/year if all SSNs are obtained`,
        next_steps: ["Apply for SSN at the Social Security Administration immediately"]
      };
    }

    const baseCredit = qualifying.length * 2000;
    if (agi && agi > cliff) {
      const excess = agi - cliff;
      const reduction = (Math.floor(excess / 1000) + 1) * 50;
      const remaining = Math.max(0, baseCredit - reduction);
      if (remaining === 0) {
        return {
          status: "not_applicable",
          message: `AGI $${agi.toLocaleString()} fully phases out Child Tax Credit.`
        };
      }
      return {
        status: "eligible_now",
        message: `Child Tax Credit partially available after phaseout: ~${remaining.toLocaleString()} remaining.`,
        estimated_value: `~$${remaining.toLocaleString()}/year`,
        phaseout_note: `AGI $${agi.toLocaleString()} is above the ${cliff.toLocaleString()} phaseout threshold`
      };
    }

    return {
      status: "eligible_now",
      message: `Child Tax Credit: ${qualifying.length} qualifying child(ren) × $2,000.`,
      estimated_value: `~$${baseCredit.toLocaleString()}/year`,
      next_steps: ["Report on Schedule 8812", "Up to $1,700 per child may be refundable (ACTC)"]
    };
  },

  "child-dependent-care-credit": (_benefit, facts) => {
    const young = facts.dependents().filter((d) => Number(d.age_at_year_end ?? 99) < 13);
    if (young.length === 0) {
      return {
        status: "not_applicable",
        message: "Child and Dependent Care Credit requires children under age 13."
      };
    }

    const careExpenses = young.reduce((sum, dep) => {
      const care = (dep.care_expenses as Record<string, unknown> | undefined) ?? {};
      return sum
        + Number(care.daycare_cost ?? 0)
        + Number(care.after_school_care_cost ?? 0)
        + Number(care.summer_camp_cost ?? 0);
    }, 0);

    if (careExpenses <= 0) {
      return {
        status: "nearly_eligible",
        message: `Has ${young.length} child(ren) under 13. Record care expenses to calculate CDCC.`,
        missing_facts: ["dependents.care_expenses"],
        next_steps: ["Record daycare, after-school, and summer camp costs in dependents data"]
      };
    }

    const fsaAmount = facts.dependentCareFsaElection();
    const cap = young.length >= 2 ? 6000 : 3000;
    const expenseBase = Math.min(Math.max(0, cap - fsaAmount), careExpenses || cap);
    const credit = expenseBase * 0.2;

    return {
      status: "eligible_now",
      message: `Child and Dependent Care Credit estimated at ~${credit.toLocaleString()} (20% of ${expenseBase.toLocaleString()}).`,
      estimated_value: `~$${Math.round(credit).toLocaleString()}/year`,
      next_steps: [
        "Report on Form 2441",
        "Collect care provider TIN (EIN or SSN)",
        `Dependent Care FSA (${fsaAmount.toLocaleString()}) reduces CDCC expense base`
      ]
    };
  },

  "earned-income-tax-credit": (_benefit, facts) => {
    const agi = facts.estimatedAgi();
    const filingStatus = facts.filingStatus() ?? "single";
    const deps = facts.dependents().length;
    const fsKey = ["mfj", "married_filing_jointly"].includes(filingStatus.toLowerCase()) ? "mfj" : "single";
    const depKey = Math.min(deps, 3);

    const upper: Record<string, number> = {
      "single-0": 19524,
      "mfj-0": 26214,
      "single-1": 46560,
      "mfj-1": 53502,
      "single-2": 52952,
      "mfj-2": 59898,
      "single-3": 59899,
      "mfj-3": 66819
    };
    const agiLimit = upper[`${fsKey}-${depKey}`] ?? 19524;

    const investmentIncome = facts.totalInvestmentIncome();
    if (investmentIncome > 11950) {
      return {
        status: "not_applicable",
        message: `Investment income ${investmentIncome.toLocaleString()} exceeds EITC limit ($11,950).`
      };
    }

    if (agi && agi > agiLimit) {
      return {
        status: "not_applicable",
        message: `AGI ${agi.toLocaleString()} is above EITC limit of ${agiLimit.toLocaleString()} for ${filingStatus} with ${deps} dependent(s).`
      };
    }

    if (!facts.hasSelfEmployment() && !facts.hasW2Income()) {
      return {
        status: "not_applicable",
        message: "No earned income found. EITC requires wages or self-employment income."
      };
    }

    const maxCredits: Record<number, number> = { 0: 649, 1: 4328, 2: 7152, 3: 8046 };
    const credit = maxCredits[depKey] ?? 8046;
    return {
      status: "eligible_now",
      message: `EITC may be available, up to ${credit.toLocaleString()} with ${depKey} qualifying child(ren).`,
      estimated_value: `Up to $${credit.toLocaleString()}/year (fully refundable)`,
      next_steps: ["Confirm qualifying child details on Schedule EIC", "Verify all qualifying children have SSNs"]
    };
  },

  "american-opportunity-credit": (_benefit, facts) => {
    const deps = facts.dependents();
    const collegeDeps = deps.filter((d) => {
      const education = (d.education as Record<string, unknown> | undefined) ?? {};
      return education.school_level === "undergraduate" && Number(education.tuition_paid ?? 0) > 0;
    });

    if (collegeDeps.length === 0 && !facts.hasDependents()) {
      return {
        status: "not_applicable",
        message: "No dependents in undergraduate education with tuition recorded."
      };
    }

    if (collegeDeps.length === 0) {
      return {
        status: "nearly_eligible",
        message: "Has dependents. Confirm whether any are in first four years of college.",
        missing_facts: ["dependents.education.school_level", "dependents.education.tuition_paid"]
      };
    }

    const agi = facts.estimatedAgi();
    const filingStatus = facts.filingStatus() ?? "single";
    const [lo, hi] = ["mfj", "married_filing_jointly"].includes(filingStatus.toLowerCase())
      ? [160000, 180000]
      : [80000, 90000];

    if (agi && agi > hi) {
      return {
        status: "not_applicable",
        message: `AGI ${agi.toLocaleString()} is above AOTC limit of ${hi.toLocaleString()}.`
      };
    }

    const phaseout = agi ? `${agi >= hi ? "AGI above phaseout range" : `AGI ${agi.toLocaleString()} is within phaseout planning range`}` : "";
    const credit = Math.min(collegeDeps.length * 2500, 2500);
    return {
      status: "eligible_now",
      message: `American Opportunity Credit available up to ${credit.toLocaleString()}${phaseout ? `. Note: ${phaseout}` : ""}.`,
      estimated_value: `Up to $${credit.toLocaleString()}/year ($1,000 refundable)`,
      next_steps: ["Collect Form 1098-T", "Coordinate with 529 distributions to avoid double-counting expenses"],
      phaseout_note: agi && agi >= lo ? `AOTC phaseout range: ${lo.toLocaleString()}-${hi.toLocaleString()}` : undefined
    };
  },

  "lifetime-learning-credit": (_benefit, facts) => {
    if (!facts.hasDependents()) {
      return {
        status: "not_applicable",
        message: "No dependents with education expenses recorded."
      };
    }

    const agi = facts.estimatedAgi();
    const filingStatus = facts.filingStatus() ?? "single";
    const hi = ["mfj", "married_filing_jointly"].includes(filingStatus.toLowerCase()) ? 180000 : 90000;

    if (agi && agi > hi) {
      return {
        status: "not_applicable",
        message: `AGI ${agi.toLocaleString()} is above Lifetime Learning Credit limit.`
      };
    }

    return {
      status: "nearly_eligible",
      message: "Lifetime Learning Credit can apply to post-secondary education (including grad/professional programs).",
      missing_facts: ["dependents.education.tuition_paid"],
      next_steps: ["Record tuition expenses and collect Form 1098-T"]
    };
  },

  "savers-credit": (_benefit, facts) => {
    const agi = facts.estimatedAgi();
    const filingStatus = (facts.filingStatus() ?? "single").toLowerCase();
    const age = facts.taxpayerAge();

    if (age !== null && age < 18) {
      return {
        status: "not_applicable",
        message: "Saver's Credit requires taxpayer to be at least 18 years old."
      };
    }

    const ceilings: Record<string, number> = {
      single: 40500,
      mfj: 81000,
      married_filing_jointly: 81000,
      hoh: 60750,
      head_of_household: 60750,
      mfs: 40500,
      married_filing_separately: 40500,
      qualifying_surviving_spouse: 81000
    };
    const fiftyPct: Record<string, number> = {
      single: 23500,
      mfj: 47000,
      married_filing_jointly: 47000,
      hoh: 35250,
      head_of_household: 35250,
      mfs: 23500,
      married_filing_separately: 23500,
      qualifying_surviving_spouse: 47000
    };
    const ceiling = ceilings[filingStatus] ?? 40500;
    const fifty = fiftyPct[filingStatus] ?? 23500;

    if (agi !== null && agi > ceiling) {
      return {
        status: "not_applicable",
        message: `AGI ${agi.toLocaleString()} exceeds Saver's Credit limit (${ceiling.toLocaleString()}).`
      };
    }

    const hasContributions = facts.hasRetirementContributions();
    if (agi !== null) {
      const rate = agi <= fifty ? "50%" : (agi <= ceiling * 0.63 ? "20%" : "10%");
      if (hasContributions) {
        const maxBase = filingStatus.includes("mfj") ? 4000 : 2000;
        return {
          status: "eligible_now",
          message: `Saver's Credit available at ${rate} rate based on AGI ${agi.toLocaleString()}.`,
          estimated_value: `Up to $${maxBase.toLocaleString()} × ${rate} credit`,
          next_steps: [
            "File Form 8880",
            "Confirm eligible retirement contributions and distribution adjustments on the worksheet"
          ]
        };
      }
      return {
        status: "eligible_if_changed",
        message: `AGI ${agi.toLocaleString()} qualifies for Saver's Credit at ${rate}, but no retirement contributions were found.`,
        missing_facts: ["retirement contributions"],
        changes_needed: ["Make IRA or qualified plan contributions this year"],
        next_steps: ["IRA contributions can generally be made up to filing deadline"]
      };
    }

    return {
      status: hasContributions ? "nearly_eligible" : "nearly_eligible",
      message: hasContributions
        ? "Retirement contributions found, but AGI is missing for Saver's Credit evaluation."
        : "Saver's Credit may apply for moderate-income taxpayers with retirement contributions.",
      missing_facts: hasContributions ? ["household.estimated_agi"] : ["household.estimated_agi", "retirement contributions"]
    };
  },

  "25c-energy-home-improvement": (_benefit, facts) => {
    if (!facts.hasPrimaryResidence() && !facts.hasAnyRealEstate()) {
      return {
        status: "not_applicable",
        message: "Section 25C requires an existing primary residence. No primary residence found."
      };
    }

    if (!facts.hasPrimaryResidence()) {
      return {
        status: "nearly_eligible",
        message: "Real estate found but no primary residence classified. Section 25C applies to primary residences.",
        missing_facts: ["real_estate.properties (property_type: primary_residence)"]
      };
    }

    return {
      status: "eligible_now",
      message:
        "Section 25C credit available: 30% on qualifying home-energy improvements with annual category caps.",
      estimated_value: "$600-$3,200/year",
      next_steps: [
        "Get ENERGY STAR or Section 25C certification from manufacturer",
        "Track placed-in-service dates and receipts",
        "Use Form 5695 Part II",
        "Spread upgrades across years to reuse annual caps"
      ]
    };
  },

  "clean-vehicle-credit": (_benefit, facts) => {
    const agi = facts.estimatedAgi();
    const filingStatus = facts.filingStatus() ?? "single";
    const clips: Record<string, number> = {
      mfj: 300000,
      married_filing_jointly: 300000,
      single: 150000,
      hoh: 225000,
      head_of_household: 225000
    };
    const clip = clips[filingStatus.toLowerCase()] ?? 150000;

    if (agi && agi > clip) {
      return {
        status: "not_applicable",
        message: `AGI ${agi.toLocaleString()} exceeds clean vehicle credit limit of ${clip.toLocaleString()}.`
      };
    }

    return {
      status: "nearly_eligible",
      message:
        "Income appears within EV credit limits. Verify VIN/model eligibility and MSRP caps before purchase.",
      next_steps: [
        "Check VIN eligibility at fueleconomy.gov",
        "Use dealer point-of-sale transfer option if available",
        "Confirm MSRP caps by vehicle class"
      ]
    };
  },

  "section-121-exclusion": (_benefit, facts) => {
    if (!facts.hasPrimaryResidence()) {
      if (facts.hasAnyRealEstate()) {
        return {
          status: "nearly_eligible",
          message: "Real estate found but no primary residence identified for Section 121 evaluation.",
          missing_facts: ["real_estate.properties (primary_residence)"]
        };
      }

      return {
        status: "not_applicable",
        message: "No primary residence found. Section 121 applies only to sale of primary residence."
      };
    }

    const primary = facts.primaryResidenceProperty();
    const primaryMeta = (primary.primary_residence as Record<string, unknown> | undefined) ?? {};
    const yearsLived = Number(primaryMeta.years_lived_in ?? 0);
    if (yearsLived > 0 && yearsLived < 2) {
      return {
        status: "eligible_if_changed",
        message: `Only ${yearsLived} year(s) in home. Need 2 of last 5 years to fully qualify for Section 121.`,
        changes_needed: ["Delay sale until 2-year occupancy threshold where feasible"]
      };
    }

    const acquisition = (primary.acquisition as Record<string, unknown> | undefined) ?? {};
    const purchase = Number(acquisition.purchase_price ?? 0);
    const current = Number(acquisition.current_market_value ?? 0);
    const gain = purchase > 0 && current > 0 ? Math.max(0, current - purchase) : null;

    const filingStatus = facts.filingStatus() ?? "single";
    const exclusion = ["mfj", "married_filing_jointly"].includes(filingStatus.toLowerCase()) ? 500000 : 250000;
    let message = `Section 121 exclusion available up to ${exclusion.toLocaleString()} of primary-residence gain.`;
    if (gain !== null) {
      if (gain > exclusion) {
        message += ` Estimated gain ${gain.toLocaleString()} exceeds exclusion by ${(gain - exclusion).toLocaleString()}.`;
      } else {
        message += ` Estimated gain ${gain.toLocaleString()} is within exclusion.`;
      }
    }

    return {
      status: "eligible_now",
      message,
      estimated_value: `Up to $${exclusion.toLocaleString()} gain excluded`,
      next_steps: [
        "Track capital improvements to maximize basis",
        "Document residency/use period",
        "Model depreciation recapture if any rental use occurred"
      ]
    };
  },

  "residential-clean-energy-credit": (_benefit, facts) => {
    const hasHome = facts.properties().some((p) => ["primary_residence", "second_home"].includes(String(p.property_type ?? "")));
    if (!hasHome) {
      return {
        status: "not_applicable",
        message: "Residential Clean Energy Credit requires a primary or secondary home you own."
      };
    }

    return {
      status: "nearly_eligible",
      message: "Homeowner may qualify for 30% credit on solar, battery, wind, or geothermal installations.",
      next_steps: [
        "Get quotes for qualifying systems and confirm placed-in-service year",
        "Check state and utility rebates that stack with federal credit",
        "Use Form 5695 and carry forward unused credit if tax liability is limited"
      ]
    };
  },

  "opportunity-zone-investment": (_benefit, facts) => {
    const ltcg = facts.longTermCapitalGains();
    if (ltcg > 0) {
      return {
        status: "eligible_now",
        message: `Recorded long-term gains of ${ltcg.toLocaleString()}. Opportunity Zone investment can defer this gain.`,
        estimated_value: `Deferred tax on $${ltcg.toLocaleString()} plus potential 10-year appreciation exclusion`,
        next_steps: [
          "Identify and invest in a Qualified Opportunity Fund within 180 days of gain recognition",
          "Plan for deferred-gain recognition deadlines",
          "Track annual reporting on Form 8997"
        ]
      };
    }

    return {
      status: "future_opportunity",
      message: "No realized long-term capital gains found. Opportunity Zone deferral is relevant after gain events.",
      next_steps: ["Revisit before any planned sale of appreciated assets"]
    };
  },

  "capital-gains-harvesting": (_benefit, facts) => {
    const agi = facts.estimatedAgi();
    const filingStatus = (facts.filingStatus() ?? "single").toLowerCase();
    const ltcg = facts.longTermCapitalGains();

    const zeroPctCeiling = {
      single: 47025,
      mfj: 94050,
      married_filing_jointly: 94050,
      hoh: 63000,
      head_of_household: 63000,
      mfs: 47025,
      married_filing_separately: 47025,
      qualifying_surviving_spouse: 94050
    }[filingStatus] ?? 47025;

    if (agi == null) {
      return {
        status: "nearly_eligible",
        message: "Potential 0% long-term capital gains harvesting opportunity. Add AGI to evaluate bracket headroom.",
        missing_facts: ["household.estimated_agi"]
      };
    }

    if (agi >= zeroPctCeiling * 1.15) {
      return {
        status: "not_applicable",
        message: `AGI ${agi.toLocaleString()} is above the 0% LTCG bracket zone for ${filingStatus}.`
      };
    }

    const headroom = Math.max(0, zeroPctCeiling - agi);
    if (ltcg > 0) {
      return {
        status: "eligible_now",
        message: `0% LTCG bracket planning available with ~${headroom.toLocaleString()} headroom and current LTCG ${ltcg.toLocaleString()}.`,
        estimated_value: `Potentially tax-free harvest of up to $${Math.min(ltcg, headroom).toLocaleString()} of gains`,
        next_steps: [
          `Realize up to $${headroom.toLocaleString()} of 12+ month gains this year`,
          "Rebuy positions if desired (wash sale rule does not apply to gains)",
          "Model total taxable income to avoid crossing into the 15% bracket"
        ]
      };
    }

    return {
      status: "eligible_if_changed",
      message: `You appear in/near the 0% LTCG bracket with ~${headroom.toLocaleString()} headroom, but no long-term gains are recorded.`,
      missing_facts: ["income.investment_income.long_term_capital_gains"],
      changes_needed: ["Identify appreciated long-term positions in taxable accounts"]
    };
  },

  "premium-tax-credit": (_benefit, facts) => {
    const coverage = facts.healthcareCoverage();
    if (coverage && !["marketplace", "aca", "exchange", "healthcare.gov"].includes(coverage.toLowerCase())) {
      return {
        status: "not_applicable",
        message: `Premium Tax Credit requires ACA marketplace coverage. Coverage '${coverage}' does not qualify.`
      };
    }

    const agi = facts.estimatedAgi();
    const householdSize = facts.householdSize();
    const fplBase = 15060 + (householdSize - 1) * 5380;
    const fpl400 = fplBase * 4;

    if (!coverage) {
      if (!facts.hasSelfEmployment()) {
        return {
          status: "not_applicable",
          message:
            "Premium Tax Credit applies to ACA marketplace insurance. No qualifying marketplace coverage was found."
        };
      }
      return {
        status: "nearly_eligible",
        message:
          "Self-employment detected without coverage type. ACA marketplace may provide a Premium Tax Credit.",
        missing_facts: ["healthcare.coverage_type"]
      };
    }

    if (agi == null) {
      return {
        status: "nearly_eligible",
        message: "Marketplace coverage found. Add AGI to calculate Premium Tax Credit amount.",
        missing_facts: ["household.estimated_agi"]
      };
    }

    if (agi < fplBase * 0.99) {
      return {
        status: "not_applicable",
        message:
          `AGI ${agi.toLocaleString()} appears below 100% FPL (${fplBase.toLocaleString()} for household size ${householdSize}).`
      };
    }

    if (agi <= fplBase * 1.5) {
      return {
        status: "eligible_now",
        message:
          `ACA Premium Tax Credit available. At ~${Math.round((agi / fplBase) * 100)}% FPL, benchmark premium may be near $0.`,
        estimated_value: "$0 premium for benchmark Silver plan at lower FPL bands",
        next_steps: ["Reconcile with Form 8962", "Keep Form 1095-A from exchange"]
      };
    }

    const capPct = agi < fpl400 ? Math.min(8.5, ((agi / fplBase - 1.5) / 2.5) * 8.5) : 8.5;
    return {
      status: "eligible_now",
      message:
        `ACA Premium Tax Credit available. Estimated premium cap is ~${capPct.toFixed(1)}% of income at current AGI.`,
      estimated_value: `Credit equals benchmark premium minus ~$${Math.round((agi * capPct) / 100).toLocaleString()} annual required contribution`,
      next_steps: ["Use Form 8962 to compute final credit", "Manage year-end MAGI to avoid repayment surprises"]
    };
  },

  "backdoor-roth-ira": (_benefit, facts) => {
    const agi = facts.estimatedAgi();
    const filingStatus = facts.filingStatus() ?? "single";
    const rothLimits: Record<string, number> = {
      mfj: 236000,
      married_filing_jointly: 236000,
      single: 150000,
      hoh: 150000,
      head_of_household: 150000
    };
    const limit = rothLimits[filingStatus.toLowerCase()] ?? 150000;

    if (agi == null) {
      return {
        status: "nearly_eligible",
        message: "AGI is required to determine direct Roth eligibility versus backdoor strategy.",
        missing_facts: ["household.estimated_agi"]
      };
    }

    if (agi <= limit) {
      return {
        status: "not_applicable",
        message:
          `AGI ${agi.toLocaleString()} is below direct Roth IRA phaseout. Backdoor strategy is not required.`
      };
    }

    const traditionalBalance = facts.traditionalIraBalance();
    if (traditionalBalance > 0) {
      return {
        status: "nearly_eligible",
        message:
          `Backdoor Roth is possible, but pro-rata rule applies with traditional IRA balance of ~${traditionalBalance.toLocaleString()}.`,
        changes_needed: [
          "Roll pre-tax traditional IRA balance into an employer 401(k) where possible",
          "Then execute backdoor Roth conversion on a cleaner basis"
        ]
      };
    }

    return {
      status: "eligible_now",
      message:
        "Income is above Roth limit and no pre-tax IRA balance is detected. Backdoor Roth process is available.",
      estimated_value: "$7,000/year ($8,000 if 50+) moved into Roth with long-term tax-free growth",
      next_steps: [
        "Make nondeductible traditional IRA contribution",
        "Convert to Roth promptly",
        "File Form 8606 each year"
      ]
    };
  },

  "foreign-earned-income-exclusion": (_benefit, facts) => {
    if (facts.stateCode()) {
      return {
        status: "not_applicable",
        message: "US state residence recorded. FEIE generally applies to taxpayers living/working abroad."
      };
    }

    return {
      status: "nearly_eligible",
      message: "No US state residence recorded. FEIE may apply if foreign residency and tests are met.",
      missing_facts: ["household.residence.state or foreign country confirmation"]
    };
  },

  "annual-gift-tax-exclusion": (_benefit, facts) => {
    const transferGoal = facts.transferWealthGoal();
    if (transferGoal === false) {
      return {
        status: "not_applicable",
        message: "Wealth transfer is not currently a stated goal."
      };
    }

    return {
      status: transferGoal ? "eligible_now" : "nearly_eligible",
      message: "Annual gift tax exclusion can remove $19,000 per recipient ($38,000 MFJ) from taxable estate each year.",
      estimated_value: "$19,000-$38,000 per recipient per year transferred without gift tax",
      next_steps: [
        "Identify intended recipients and year-end transfer plan",
        "Track gifts and consider 529 superfunding strategy where appropriate"
      ]
    };
  },

  "charitable-contribution-deduction": (_benefit, facts) => {
    const itemizing = facts.itemizing();

    if (itemizing === false) {
      return {
        status: "eligible_if_changed",
        message: "Not currently itemizing. Charitable deduction only applies when itemizing.",
        changes_needed: [
          "Calculate total itemized deductions (mortgage interest + SALT + charitable)",
          "If total exceeds standard deduction ($30,000 MFJ / $15,000 Single), itemize",
          "Consider bunching 2-3 years of giving via a Donor-Advised Fund"
        ]
      };
    }

    if (itemizing === null) {
      return {
        status: "nearly_eligible",
        message: "Itemization status not confirmed. Charitable deduction is valuable if itemizing.",
        missing_facts: ["household.itemizing_deductions"],
        next_steps: ["Compare total itemized deductions to standard deduction amount"]
      };
    }

    const hasAppreciatedStock = facts.hasAppreciatedTaxableStock();
    const nextSteps = ["Document all contributions. Written acknowledgment required for gifts over $250."];
    if (hasAppreciatedStock) {
      nextSteps.unshift(
        "Donate appreciated stock directly instead of cash to avoid capital gains and potentially deduct full FMV"
      );
    }

    return {
      status: "eligible_now",
      message: "Charitable contribution deduction available (itemizing confirmed).",
      next_steps: nextSteps
    };
  },

  "mortgage-interest-deduction": (_benefit, facts) => {
    const interest = facts.firstPropertyMortgageInterestPaid();

    if (interest <= 0 && !facts.hasAnyRealEstate()) {
      return {
        status: "not_applicable",
        message: "No real estate or mortgage interest recorded."
      };
    }

    const itemizing = facts.itemizing();
    if (itemizing === false) {
      return {
        status: "eligible_if_changed",
        message: "Has mortgage interest but not itemizing. Deduction only applies when itemizing.",
        changes_needed: ["Calculate if total itemized deductions exceed standard deduction"]
      };
    }

    if (interest > 0) {
      return {
        status: "eligible_now",
        message: `Mortgage interest of ~${interest.toLocaleString()} is deductible if itemizing.`,
        estimated_value: `~$${interest.toLocaleString()}/year deduction`,
        next_steps: ["Collect Form 1098 from lender", "Report on Schedule A"]
      };
    }

    return {
      status: "nearly_eligible",
      message: "Has real estate but mortgage interest amount is not recorded.",
      missing_facts: ["real_estate.financing.mortgage_interest_paid"]
    };
  },

  "salt-deduction": (_benefit, facts) => {
    const itemizing = facts.itemizing();

    if (itemizing === false) {
      return {
        status: "not_applicable",
        message: "Not itemizing. SALT deduction only applies when itemizing."
      };
    }

    if (itemizing === null) {
      return {
        status: "nearly_eligible",
        message: "Itemization status not confirmed. SALT deduction (up to $10,000) is available if itemizing.",
        missing_facts: ["household.itemizing_deductions"]
      };
    }

    const propertyTax = facts.firstPropertyPropertyTaxPaid();
    let message = "SALT deduction available (capped at $10,000).";
    if (propertyTax > 0) {
      message += ` Property tax: $${propertyTax.toLocaleString()}/year.`;
    }
    if (facts.hasSelfEmployment()) {
      message += " Evaluate state PTE tax election to bypass the SALT cap on pass-through income.";
    }

    return {
      status: "eligible_now",
      message,
      estimated_value: "Up to $10,000/year",
      next_steps: [
        "Report state income tax + property tax on Schedule A (combined cap $10,000)",
        "If self-employed in high-tax state, ask CPA about Pass-Through Entity (PTE) tax election"
      ]
    };
  },

  "county-homestead-exemption": (_benefit, facts) => {
    const state = facts.stateCode();
    const county = facts.county();

    if (!facts.hasPrimaryResidence()) {
      return {
        status: "nearly_eligible",
        message: "Primary residence not found. County homestead exemption requires an owner-occupied home.",
        missing_facts: ["real_estate.properties (primary_residence present)", "household.residence.county"]
      };
    }

    if (!state || !county) {
      return {
        status: "nearly_eligible",
        message: "Primary residence found, but state/county info is incomplete for the county exemption.",
        missing_facts: ["household.residence.state", "household.residence.county"]
      };
    }

    return {
      status: "eligible_now",
      message: `Primary residence in ${county}, ${state} should qualify for a county homestead exemption.`,
      estimated_value: "Typically $50–$500+/year depending on county millage",
      next_steps: [
        "File with the county assessor/property appraiser",
        "Confirm the county deadline for the current tax year",
        "Keep a copy of the deed and ID showing the address"
      ]
    };
  },

  "county-senior-property-tax-freeze": (_benefit, facts) => {
    const age = facts.taxpayerAge();
    const state = facts.stateCode();
    const county = facts.county();

    if (!facts.hasPrimaryResidence()) {
      return {
        status: "nearly_eligible",
        message: "Primary residence not found. Senior freeze applies only to owner-occupied homes.",
        missing_facts: ["real_estate.properties (primary_residence present)"]
      };
    }

    if (age == null) {
      return {
        status: "nearly_eligible",
        message: "Primary residence found, but taxpayer age is missing. Senior freeze generally starts at 65.",
        missing_facts: ["household.taxpayer.age"]
      };
    }

    if (age < 65) {
      return {
        status: "not_applicable",
        message: `Taxpayer age ${age} is below the usual 65+ senior freeze threshold.`
      };
    }

    return {
      status: "eligible_now",
      message: `Age ${age} with a primary residence${state && county ? ` in ${county}, ${state}` : ""} can qualify for a senior property tax freeze.`,
      estimated_value: "Potentially hundreds to thousands per year in appreciating markets",
      next_steps: [
        "Apply with the county assessor as soon as you qualify",
        "Verify whether an income cap applies in your county",
        "Keep proof of age and ownership handy for the application"
      ]
    };
  },

  "state-homestead-exemption": (_benefit, facts) => {
    const state = facts.stateCode();

    if (!facts.hasPrimaryResidence()) {
      return {
        status: "nearly_eligible",
        message: "Primary residence not found. State homestead exemptions apply only to owner-occupied homes.",
        missing_facts: ["real_estate.properties (primary_residence present)"]
      };
    }

    if (!state) {
      return {
        status: "nearly_eligible",
        message: "Primary residence found, but household.state is missing for the state homestead exemption.",
        missing_facts: ["household.residence.state"]
      };
    }

    return {
      status: "eligible_now",
      message: `Primary residence in ${state} should qualify for a state homestead exemption.`,
      estimated_value: "Typically $200–$2,000+/year depending on the state and locality",
      next_steps: [
        "File the county/appraiser homestead application",
        "Confirm whether your state requires an annual filing",
        "Check for senior, veteran, or disability add-ons"
      ]
    };
  },

  "state-retirement-income-exemption": (_benefit, facts) => {
    const state = facts.stateCode();
    if (!facts.hasRetirementIncome()) {
      return {
        status: "nearly_eligible",
        message: "No retirement or Social Security income found yet. This exemption only helps if you have retirement income.",
        missing_facts: ["income.retirement_distributions", "income.social_security.gross_benefits"]
      };
    }

    if (!state) {
      return {
        status: "nearly_eligible",
        message: "Retirement income exists, but state of residence is missing for exemption lookup.",
        missing_facts: ["household.residence.state"]
      };
    }

    if (NO_INCOME_TAX_STATES.has(state)) {
      return {
        status: "not_applicable",
        message: `${state} has no state income tax, so a retirement-income subtraction is not needed.`
      };
    }

    if (RETIREMENT_FRIENDLY_STATES.has(state)) {
      return {
        status: "eligible_now",
        message: `Retirement income in ${state} should qualify for a state retirement-income exemption or subtraction.`,
        estimated_value: "Potentially hundreds to thousands per year depending on the state",
        next_steps: [
          "Review state-specific retirement subtraction worksheets",
          "Check whether Social Security, pension, and IRA distributions are treated differently",
          "Coordinate Roth conversion timing with state retirement tax rules"
        ]
      };
    }

    return {
      status: "nearly_eligible",
      message: `Retirement income exists, but ${state} is not yet in the modeled exemption list.`,
      changes_needed: [
        "Verify the exact retirement subtraction rules for your state",
        "Check whether public pensions, private pensions, and IRA distributions are treated differently"
      ]
    };
  },

  "no-income-tax-state": (_benefit, facts) => {
    const state = facts.stateCode();

    if (!state) {
      return {
        status: "nearly_eligible",
        message: "State of residence is missing, so no-income-tax-state cannot be evaluated.",
        missing_facts: ["household.residence.state"]
      };
    }

    if (NO_INCOME_TAX_STATES.has(state)) {
      return {
        status: "eligible_now",
        message: `${state} has no state income tax. Ordinary wage, business, and retirement income are generally not taxed at the state level.`,
        estimated_value: "Potentially significant annual state tax savings",
        next_steps: [
          "Confirm whether any local or specialty taxes still apply",
          "Review residency rules if you recently moved",
          "Check whether capital gains or special-source income still has any state treatment"
        ]
      };
    }

    return {
      status: "not_applicable",
      message: `${state} is not a no-income-tax state.`
    };
  },

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

  "1031-exchange": (_benefit, facts) => {
    if (!facts.hasRentalProperty()) {
      return {
        status: "not_applicable",
        message: "1031 exchange applies to investment or business real property only (not primary residence)."
      };
    }

    const property = facts.firstProperty();
    const acquisition = (property.acquisition as Record<string, unknown> | undefined) ?? {};
    const purchase = Number(acquisition.purchase_price ?? 0);
    const current = Number(acquisition.current_market_value ?? 0);

    if (purchase <= 0 || current <= 0) {
      return {
        status: "nearly_eligible",
        message: "Has rental property. Confirm current value to assess potential gain for 1031 planning.",
        missing_facts: ["real_estate.acquisition.purchase_price", "real_estate.acquisition.current_market_value"]
      };
    }

    const gain = current - purchase;
    if (gain <= 0) {
      return {
        status: "future_opportunity",
        message: "No unrealized gain at current values. 1031 planning becomes relevant when selling at a gain.",
        next_steps: ["Revisit when property has appreciated or before any planned sale"]
      };
    }

    return {
      status: "eligible_now",
      message: `Estimated gain of ~${gain.toLocaleString()} on rental property. A 1031 exchange would defer this tax on sale.`,
      estimated_value: `Deferred tax on ~${gain.toLocaleString()} gain plus depreciation recapture`,
      next_steps: [
        "Engage a Qualified Intermediary before listing the property",
        "Do not receive sale proceeds directly; funds must flow through the intermediary",
        "Identify replacement property within 45 days of closing",
        "Close replacement property within 180 days"
      ]
    };
  },

  "real-estate-professional-status": (_benefit, facts) => {
    if (!facts.hasRentalProperty()) {
      return {
        status: "not_applicable",
        message: "Real Estate Professional status requires rental real estate."
      };
    }

    const agi = facts.estimatedAgi();
    if (agi && agi <= 150000) {
      return {
        status: "future_opportunity",
        message: `AGI ${agi.toLocaleString()} is still within the $25,000 rental loss allowance range. REP status becomes more critical above $150,000.`,
        next_steps: ["Revisit if AGI grows above $150,000"]
      };
    }

    return {
      status: "eligible_if_changed",
      message: "Real Estate Professional status can unlock unlimited rental loss deductions against ordinary income.",
      estimated_value: "Depends on suspended losses, potentially $10,000-$200,000+ unlocked",
      changes_needed: [
        "Spend more than 750 hours per year in real property activities",
        "Ensure real estate hours exceed hours in any other profession",
        "Maintain detailed hourly activity logs throughout the year",
        "File a material participation statement or aggregation election"
      ]
    };
  },

  "pte-election": (_benefit, facts) => {
    if (!facts.hasSelfEmployment()) {
      return {
        status: "not_applicable",
        message: "PTE election requires pass-through business income (S Corp, partnership, or multi-member LLC)."
      };
    }

    const residence = facts.stateCode();
    const nexusStates = facts.businessNexusStates();
    const pteNexus = Array.from(nexusStates).filter((state) => PTE_STATES.has(state) && !NO_INCOME_TAX_STATES.has(state));

    const business = facts.firstBusiness();
    const formationRaw = business.formation_state;
    const formation = typeof formationRaw === "string" ? formationRaw.trim().toUpperCase() : "";
    const formationNote = formation && !nexusStates.has(formation)
      ? ` Note: ${formation} is the formation state but does not appear in operating states. PTE elections apply where income is earned.`
      : "";

    if (!residence && nexusStates.size === 0) {
      return {
        status: "nearly_eligible",
        message: "Set residence state and business operating states to evaluate PTE election across nexus states.",
        missing_facts: ["household.residence.state", "businesses.businesses[*].operating_states"]
      };
    }

    if (pteNexus.length === 0) {
      const hasOperatingStates = facts.businesses().some((biz) => {
        const operating = biz.operating_states;
        return (Array.isArray(operating) && operating.length > 0) || (typeof operating === "string" && operating.trim().length > 0);
      });

      if (!hasOperatingStates && residence && !PTE_STATES.has(residence)) {
        return {
          status: "nearly_eligible",
          message: `Residence state ${residence} has not enacted a PTE election. If this business operates in other states, add operating states to evaluate opportunities.${formationNote}`,
          missing_facts: ["businesses.businesses[*].operating_states"]
        };
      }

      const statesStr = nexusStates.size > 0 ? Array.from(nexusStates).sort().join(", ") : "your states";
      return {
        status: "not_applicable",
        message: `None of your nexus states (${statesStr}) currently have a modeled PTE election opportunity.${formationNote}`
      };
    }

    const agi = facts.estimatedAgi();
    const netProfit = facts.businesses().reduce((sum, biz) => {
      const financials = (biz.financials as Record<string, unknown> | undefined) ?? {};
      return sum + Number(financials.net_profit_loss ?? 0);
    }, 0);

    if (netProfit <= 0) {
      return {
        status: "nearly_eligible",
        message: `PTE election available in: ${pteNexus.sort().join(", ")}. Business net profit is not yet recorded.${formationNote}`,
        missing_facts: ["businesses.financials.net_profit_loss"],
        next_steps: ["Enter business net profit to evaluate PTE tax savings"]
      };
    }

    const ordered = pteNexus.sort();
    const primary = residence && ordered.includes(residence) ? residence : ordered[0];
    const otherPte = ordered.filter((s) => s !== primary);
    const multiNote = otherPte.length > 0 ? ` Additional PTE elections also available in: ${otherPte.join(", ")}.` : "";
    const nonResNote = residence && !ordered.includes(residence)
      ? ` (You reside in ${residence}, but your business has nexus in ${primary}.)`
      : "";

    if (agi && agi < 150000) {
      return {
        status: "eligible_if_changed",
        message: `PTE election available in ${primary}.${nonResNote}${multiNote}${formationNote} At AGI ${agi.toLocaleString()}, the SALT cap may not be your binding constraint.`,
        next_steps: ["Consult CPA to model net federal benefit versus state credit limitations"]
      };
    }

    const nextSteps = [
      `Contact your CPA to model net federal benefit for each state: ${ordered.join(", ")}`,
      "File the PTE election on the entity return (many states: by March 15)",
      "Get shareholder or partner consent if S Corp or multi-member LLC",
      "For CA, pay estimated PTE tax by June 15 or risk losing the deduction"
    ];
    if (otherPte.length > 0) {
      nextSteps.push(`File separate PTE elections in each nexus state: ${otherPte.join(", ")}`);
    }

    return {
      status: "eligible_now",
      message: `PTE election available in ${primary}.${nonResNote}${multiNote}${formationNote} Entity-level state tax payment can bypass the $10,000 SALT cap at the owner level.`,
      next_steps: nextSteps
    };
  },

  "cost-segregation": (_benefit, facts) => {
    if (!facts.hasRentalProperty()) {
      return {
        status: "not_applicable",
        message: "Cost segregation applies to owned commercial or residential rental property."
      };
    }

    const property = facts.firstProperty();
    const acquisition = (property.acquisition as Record<string, unknown> | undefined) ?? {};
    const price = Number(acquisition.purchase_price ?? 0);

    if (price <= 0) {
      return {
        status: "nearly_eligible",
        message: "Has rental property but purchase price is not recorded. Needed to assess cost segregation ROI.",
        missing_facts: ["real_estate.acquisition.purchase_price"]
      };
    }

    if (price < 500000) {
      return {
        status: "eligible_if_changed",
        message: `Property value of ~${price.toLocaleString()} may be too low for a cost segregation study to be cost-effective.`,
        changes_needed: ["Acquire or aggregate higher-value properties where study ROI is clearer (often $1M+)"]
      };
    }

    const accelerated = price * 0.25 * 0.4;
    return {
      status: "eligible_now",
      message: `Cost segregation study on a ${price.toLocaleString()} property could generate ~${Math.round(accelerated).toLocaleString()} in accelerated first-year deductions (using 40% bonus assumptions).`,
      estimated_value: `~$${Math.round(accelerated).toLocaleString()} accelerated deduction`,
      next_steps: [
        "Commission a cost segregation study from a qualified engineering firm",
        "Expect study costs around $5,000-$20,000; evaluate ROI before ordering",
        "If property was acquired in prior years, consider a lookback study with Form 3115",
        "Act sooner while bonus depreciation percentages remain higher"
      ]
    };
  },

  "augusta-rule": (_benefit, facts) => {
    if (!facts.hasSelfEmployment()) {
      return {
        status: "not_applicable",
        message: "Augusta Rule requires a business entity to rent a home from the owner."
      };
    }

    const hasEligibleHome = facts.properties().some((property) => {
      const type = String(property.property_type ?? "");
      return type === "primary_residence" || type === "second_home";
    });

    if (!hasEligibleHome) {
      return {
        status: "nearly_eligible",
        message: "Has business activity but no primary residence or second home is recorded.",
        missing_facts: ["real_estate.properties (primary_residence or second_home)"]
      };
    }

    return {
      status: "eligible_if_changed",
      message: "Augusta Rule strategy is available: rent your home to your business for up to 14 days per year tax-free.",
      estimated_value: "$5,000-$25,000/year depending on fair-market daily rent",
      changes_needed: [
        "Schedule legitimate business meetings or events at home",
        "Create a written rental agreement between owner and business",
        "Invoice and pay fair-market rent from business account to personal account",
        "Keep rental use to 14 or fewer days in the year"
      ],
      next_steps: [
        "Document meeting purpose, attendees, and agenda",
        "Keep comparable local rental data to support fair-market pricing"
      ]
    };
  },

  "state-529-deduction": (_benefit, facts) => {
    const state = facts.stateCode();
    if (!state) {
      return {
        status: "nearly_eligible",
        message: "Set residence state to check whether a state 529 deduction is available.",
        missing_facts: ["household.residence.state"]
      };
    }

    if (NO_INCOME_TAX_STATES.has(state)) {
      return {
        status: "not_applicable",
        message: `${state} has no income tax, so there is no state 529 deduction (federal tax-free growth still applies).`
      };
    }

    if (!STATES_WITH_529_DEDUCTION.has(state)) {
      return {
        status: "not_applicable",
        message: `${state} is not currently in the modeled list of states with a 529 deduction or credit.`
      };
    }

    if (!facts.has529Account()) {
      return {
        status: "eligible_if_changed",
        message: `${state} offers a state 529 deduction or credit. Open a home-state 529 account to claim it.`,
        changes_needed: ["Open and fund a 529 plan aligned with your state's deduction rules"],
        next_steps: [
          `Research ${state} 529 plan details and contribution limits`,
          "Contribute by year-end to maximize current-year state benefit"
        ]
      };
    }

    return {
      status: "eligible_now",
      message: `${state} offers a state tax benefit for 529 contributions. Additional contributions may increase current-year state savings.`,
      next_steps: [
        "Confirm whether your state requires use of the in-state plan",
        "Check annual state deduction caps per beneficiary",
        "Keep contribution confirmations for state return support"
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
