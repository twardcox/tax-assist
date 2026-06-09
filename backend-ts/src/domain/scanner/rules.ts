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

const NO_INCOME_TAX_STATES = new Set(["AK", "FL", "NV", "SD", "TX", "WA", "WY"]);
const MINIMAL_INCOME_TAX_STATES = new Set(["NH", "TN"]);
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
const RETIREMENT_EXEMPT_STATES = new Set([
  "IL",
  "MS",
  "PA",
  "AL",
  "FL",
  "TX",
  "NV",
  "WA",
  "WY",
  "AK",
  "SD",
  "TN",
  "NH",
  "NY",
  "CO",
  "VA",
  "GA",
  "SC",
  "MD",
  "ND",
  "OH",
  "MI",
  "WI",
  "MO",
  "IA",
  "KS",
  "OK",
  "AR",
  "LA",
  "KY",
  "WV",
  "HI"
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
        message: `${qualifyingNoSsn.length} child(ren) missing SSN - credit requires SSN by return due date.`,
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
          message: `AGI $${agi.toLocaleString()} - Child Tax Credit fully phased out.`
        };
      }
      return {
        status: "eligible_now",
        message: `Child Tax Credit: ${qualifying.length} qualifying child(ren) x $2,000 = ~$${baseCredit.toLocaleString()}. Partial credit: ~$${remaining.toLocaleString()} remaining after phaseout.`,
        estimated_value: `~$${baseCredit.toLocaleString()}/year`,
        phaseout_note: `AGI $${agi.toLocaleString()} is above the ${cliff.toLocaleString()} phaseout threshold.`
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

  "excess-fica-refund": (_benefit, facts) => {
    const w2s = facts.w2EmploymentEntries();
    if (w2s.length < 2) {
      return {
        status: "not_applicable",
        message: "Excess FICA refund requires wages from two or more employers in the same year."
      };
    }

    const ssWageBase = 176100;
    const ssMax = Math.round(ssWageBase * 0.062 * 100) / 100;
    const totalWages = w2s.reduce((sum, entry) => sum + Number(entry.wages ?? 0), 0);
    const totalSsWithheld = w2s.reduce((sum, entry) => {
      const wages = Number(entry.wages ?? 0);
      const fallbackWithheld = Math.min(wages, ssWageBase) * 0.062;
      const rawWithheld = entry.social_security_withheld ?? entry.ss_withheld;
      const withheld = rawWithheld ? Number(rawWithheld) : fallbackWithheld;
      return sum + withheld;
    }, 0);

    if (totalWages <= ssWageBase) {
      return {
        status: "not_applicable",
        message: `Combined wages $${totalWages.toLocaleString()} do not exceed the SS wage base ($${ssWageBase.toLocaleString()}) — no excess withholding.`
      };
    }

    const excess = Math.max(0, Math.round((totalSsWithheld - ssMax) * 100) / 100);
    const excessRounded = Math.round(excess);
    const totalSsWithheldRounded = Math.round(totalSsWithheld);
    const ssMaxRounded = Math.round(ssMax);
    if (excess <= 0) {
      return {
        status: "nearly_eligible",
        message:
          `Combined wages $${totalWages.toLocaleString()} exceed SS wage base - check each W-2 Box 4 for actual SS withheld. Record ss_withheld on each W-2 to compute exact refund.`,
        missing_facts: ["income.w2_employment[*].social_security_withheld"]
      };
    }

    return {
      status: "eligible_now",
      message:
        `Excess Social Security withholding: ~$${excessRounded.toLocaleString()} refundable. Total SS withheld $${totalSsWithheldRounded.toLocaleString()} exceeds 2025 max of $${ssMaxRounded.toLocaleString()}.`,
      estimated_value: `$${excessRounded.toLocaleString()} refundable credit`,
      next_steps: [
        "Claim on Schedule 3, Line 11 of Form 1040",
        "Verify Box 4 on each W-2 — sum must exceed $10,918.20 to have excess",
        "This is a refundable credit — paid even if you owe no other tax"
      ]
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
      message: `American Opportunity Credit: up to $${credit.toLocaleString()} for college tuition expenses.${phaseout ? ` Note: ${phaseout}` : ""}`,
      estimated_value: `Up to $${credit.toLocaleString()}/year ($1,000 refundable)`,
      next_steps: ["Collect Form 1098-T from school", "Coordinate with 529 distributions (cannot double-count)"],
      phaseout_note: agi && agi >= lo ? phaseout : undefined
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
      message: "Lifetime Learning Credit available for any post-secondary education (grad school, professional courses).",
      missing_facts: ["dependents.education.tuition_paid"],
      next_steps: ["Record tuition expenses in dependents.yaml", "Collect Form 1098-T"]
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
        message: `AGI $${agi.toLocaleString()} exceeds the Saver's Credit limit for ${filingStatus} filers ($${ceiling.toLocaleString()}). No credit available above this income level.`
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
        changes_needed: ["Make an IRA or 401k contribution this year (or by April 15 for IRA)"],
        next_steps: [
          "Contribute to a Roth or Traditional IRA (up to $7,000 in 2025) by April 15",
          "Even $400 -> $200 credit at 50% rate"
        ]
      };
    }

    return {
      status: hasContributions ? "nearly_eligible" : "nearly_eligible",
      message: hasContributions
        ? "Has retirement contributions but AGI not provided — Saver's Credit may be available for moderate-income taxpayers."
        : "Saver's Credit available for moderate-income taxpayers with retirement contributions. Enter AGI to evaluate.",
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
        "Section 25C Energy Efficient Home Improvement Credit: 30% credit on eligible improvements. Heat pump: up to $2,000/year; insulation, windows, doors, energy audit: up to $1,200/year ($3,200 combined cap).",
      estimated_value: "$600 - $3,200/year",
      next_steps: [
        "Get ENERGY STAR or Section 25C certification from manufacturer before purchase",
        "Heat pump HVAC or water heater = up to $2,000 30% credit",
        "Insulation, exterior doors, windows = up to $1,200 30% credit",
        "Home energy audit = up to $150 toward $1,200 cap",
        "Spread improvements across multiple years to use the $3,200 annual cap each year"
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
        message: `AGI $${agi.toLocaleString()} exceeds income limit of $${clip.toLocaleString()} for Clean Vehicle Credit.`
      };
    }

    return {
      status: "nearly_eligible",
      message:
        "Income qualifies for EV credit (up to $7,500 new / $4,000 used). Check vehicle eligibility at fueleconomy.gov.",
      next_steps: [
        "Verify vehicle VIN qualifies at fueleconomy.gov before purchasing",
        "Use point-of-sale transfer option to receive credit as immediate discount at dealer",
        "Check MSRP limits: SUV/truck/van <= $80,000; sedan <= $55,000"
      ]
    };
  },

  "state-ev-credit": (_benefit, facts) => {
    const state = facts.stateCode();
    if (!state) {
      return {
        status: "nearly_eligible",
        message: "Set household.residence.state to check state EV credit availability.",
        missing_facts: ["household.residence.state"]
      };
    }

    const evCreditStates = new Set(["CA", "CO", "NY", "CT", "MA", "OR", "NJ", "IL", "VT", "ME"]);
    if (!evCreditStates.has(state)) {
      return {
        status: "not_applicable",
        message: `${state} does not currently offer a broad state EV purchase credit or rebate (as of 2025). The federal §30D credit still applies.`
      };
    }

    if (!facts.hasElectricVehicle()) {
      return {
        status: "eligible_if_changed",
        message:
          `${state} offers a state EV credit that stacks on top of the federal §30D credit. No EV recorded in your data yet.`,
        changes_needed: ["Purchase or lease a qualifying BEV or PHEV"],
        next_steps: [
          `Research ${state}'s current EV program (CA CVRP, CO Form DR 0617, NY Drive Clean Rebate)`,
          "Stack with federal §30D credit for maximum incentive",
          "CA: apply for CVRP rebate within 18 months of purchase — funding is limited"
        ]
      };
    }

    const agi = facts.estimatedAgi();
    const filingStatus = (facts.filingStatus() ?? "single").toLowerCase();
    const caLimit = ["single", "hoh", "head_of_household"].includes(filingStatus) ? 135000 : 200000;
    if (state === "CA" && agi !== null && agi > caLimit) {
      return {
        status: "not_applicable",
        message:
          `CA CVRP income limit exceeded (AGI ${agi.toLocaleString()} > ${caLimit.toLocaleString()}). The federal §30D credit may still apply — verify MSRP and income limits.`
      };
    }

    return {
      status: "eligible_now",
      message:
        `${state} offers a state EV credit/rebate on top of the federal §30D credit. Apply as soon as possible — some programs (CA CVRP) have limited funding.`,
      next_steps: [
        "CA: apply at cleanvehiclerebate.org within 18 months of purchase",
        "CO: claim on Form DR 0617 with your state return",
        "NY: claim on Form IT-253 with your state return",
        "Stack with federal §30D for maximum combined incentive"
      ]
    };
  },

  "ichra-qsehra": (_benefit, facts) => {
    if (facts.businesses().length === 0) {
      return {
        status: "not_applicable",
        message: "ICHRA/QSEHRA requires a business with employees."
      };
    }
    const employeeCount = facts.firstBusinessW2EmployeesCount();
    if (employeeCount === 0) {
      return {
        status: "nearly_eligible",
        message:
          "Has a business — ICHRA/QSEHRA allows tax-free health reimbursements to employees as an alternative to group health insurance. No W-2 employees recorded yet.",
        missing_facts: ["businesses.employees.w2_employees_count"]
      };
    }

    const hraType = employeeCount >= 50 ? "ICHRA" : "QSEHRA";
    const annualLimit = employeeCount >= 50 ? "no dollar limit" : "$6,350/single, $12,800/family (2025)";
    if (employeeCount < 50 && facts.employerGroupPlan()) {
      return {
        status: "not_applicable",
        message:
          "QSEHRA requires that the employer not offer a group health plan to same employees. Consider ICHRA if you want to offer both a group plan and an HRA to different classes."
      };
    }

    return {
      status: "nearly_eligible",
      message:
        `${hraType} allows you to reimburse ${employeeCount} employee(s) tax-free for individual health insurance premiums (${annualLimit}). Deductible as a business expense.`,
      missing_facts: ["businesses.healthcare.hra_established"],
      next_steps: [
        `Establish ${hraType} plan document before December 31 for next year's coverage`,
        "Notify eligible employees 90 days before plan year begins",
        "Use a third-party HRA administrator (PeopleKeep, Take Command) for compliance",
        "Employees must maintain qualifying individual coverage to receive reimbursements"
      ]
    };
  },

  "employer-childcare-credit": (_benefit, facts) => {
    if (facts.businesses().length === 0) {
      return {
        status: "not_applicable",
        message: "§45F Employer-Provided Childcare Credit requires a business with employees."
      };
    }

    const employeeCount = facts.firstBusinessW2EmployeesCount();
    if (employeeCount === 0) {
      return {
        status: "nearly_eligible",
        message:
          "Has a business — §45F credit is available if you pay for qualified childcare facilities or resource/referral services for employees. No W-2 employees recorded yet.",
        missing_facts: ["businesses.employees.w2_employees_count"]
      };
    }

    const childcareExpenses = facts.firstBusinessChildcareExpenses();
    if (childcareExpenses === 0) {
      return {
        status: "nearly_eligible",
        message:
          `Business has ${employeeCount} employee(s) — eligible for §45F credit on childcare facility or resource/referral expenses. Record childcare spending to compute credit.`,
        missing_facts: ["businesses.financials.childcare_expenses"],
        next_steps: [
          "25% credit on qualified childcare facility expenditures",
          "10% credit on childcare resource/referral contracts",
          "Maximum credit $150,000/year; file Form 8882"
        ]
      };
    }

    const credit = Math.min(childcareExpenses * 0.25, 150000);
    return {
      status: "eligible_now",
      message: `§45F Childcare Credit: ~$${credit.toLocaleString()} (25% of $${childcareExpenses.toLocaleString()} childcare expenses).`,
      estimated_value: `~$${credit.toLocaleString()}/year`,
      next_steps: ["File Form 8882 with business return", "Attach to Form 3800 (General Business Credit)"]
    };
  },

  "section-121-exclusion": (_benefit, facts) => {
    if (!facts.hasPrimaryResidence()) {
      return {
        status: "not_applicable",
        message: "No primary residence found. Section 121 exclusion applies to sale of primary residence only."
      };
    }

    const primary = facts.primaryResidenceProperty();
    const primaryMeta = (primary.primary_residence as Record<string, unknown> | undefined) ?? {};
    const yearsLived = Number(primaryMeta.years_lived_in ?? 0);
    if (yearsLived > 0 && yearsLived < 2) {
      return {
        status: "eligible_if_changed",
        message: `Only ${yearsLived} year(s) in home - need 2 of last 5 years as primary residence for exclusion.`,
        changes_needed: [`Wait until ${2 - yearsLived} more year(s) before selling to qualify`]
      };
    }

    const acquisition = (primary.acquisition as Record<string, unknown> | undefined) ?? {};
    const purchase = Number(acquisition.purchase_price ?? 0);
    const current = Number(acquisition.current_market_value ?? 0);
    const gain = purchase > 0 && current > 0 ? Math.max(0, current - purchase) : null;

    const filingStatus = facts.filingStatus() ?? "single";
    const exclusion = ["mfj", "married_filing_jointly"].includes(filingStatus.toLowerCase()) ? 500000 : 250000;
    let message = `Section 121 exclusion available - up to $${exclusion.toLocaleString()} gain excluded on home sale.`;
    if (gain !== null) {
      if (gain > exclusion) {
        message += ` Estimated gain ~$${gain.toLocaleString()} exceeds exclusion - $${(gain - exclusion).toLocaleString()} would be taxable.`;
      } else {
        message += ` Estimated gain ~$${gain.toLocaleString()} is fully within exclusion.`;
      }
    }

    return {
      status: "eligible_now",
      message,
      estimated_value: `Up to $${exclusion.toLocaleString()} gain excluded`,
      next_steps: [
        "Track all capital improvements to increase basis",
        "Document rental period (if any) - depreciation recapture applies"
      ]
    };
  },

  "residential-clean-energy-credit": (_benefit, facts) => {
    const hasHome = facts.properties().some((p) => ["primary_residence", "second_home"].includes(String(p.property_type ?? "")));
    if (!hasHome) {
      return {
        status: "not_applicable",
        message: "Residential Clean Energy Credit requires a home you own (primary or secondary)."
      };
    }

    return {
      status: "nearly_eligible",
      message: "Homeowner qualifies for 30% credit on solar panels, battery storage, wind, or geothermal installed at your home.",
      next_steps: [
        "Get solar quotes from 3+ installers - 30% credit applies through 2032",
        "Battery storage (3 kWh+) qualifies even without solar",
        "Check state and utility rebates that stack on top of federal credit"
      ]
    };
  },

  "opportunity-zone-investment": (_benefit, facts) => {
    const ltcg = facts.longTermCapitalGains();
    if (ltcg > 0) {
      return {
        status: "eligible_now",
        message: `Capital gains of ~$${ltcg.toLocaleString()} recorded — Opportunity Zone investment would defer this tax.`,
        estimated_value: `Deferred tax on $${ltcg.toLocaleString()} + potential 10-year exclusion on QOF appreciation`,
        next_steps: [
          "Identify and invest in a Qualified Opportunity Fund (QOF) within 180 days of gain recognition",
          "Note: deferred gain recognized December 31, 2026 — plan for that tax event",
          "10+ year hold permanently excludes QOF appreciation from income"
        ]
      };
    }

    return {
      status: "future_opportunity",
      message: "No realized capital gains recorded. Opportunity Zone deferral becomes relevant when selling appreciated assets.",
      next_steps: ["Revisit before any planned sale of stocks, real estate, or business assets"]
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
        message: "Capital gains 0% bracket harvesting opportunity — enter AGI to evaluate if you fall within the 0% rate bracket.",
        missing_facts: ["household.estimated_agi"]
      };
    }

    if (agi >= zeroPctCeiling * 1.15) {
      return {
        status: "not_applicable",
        message: `AGI $${agi.toLocaleString()} is above the 0% LTCG bracket ceiling ($${zeroPctCeiling.toLocaleString()} for ${filingStatus}). Gains will be taxed at 15% or 20%.`
      };
    }

    const headroom = Math.max(0, zeroPctCeiling - agi);
    if (ltcg > 0) {
      return {
        status: "eligible_now",
        message: `0% long-term capital gains rate applies. You have ~$${headroom.toLocaleString()} of 0% gain headroom (AGI $${agi.toLocaleString()} vs. $${zeroPctCeiling.toLocaleString()} ceiling). Current LTCG recorded: $${ltcg.toLocaleString()}.`,
        estimated_value: `Permanent elimination of federal tax on up to $${Math.min(ltcg, headroom).toLocaleString()} of gains`,
        next_steps: [
          `Sell appreciated positions held 12+ months to realize up to $${headroom.toLocaleString()} in gains this year`,
          "Immediately repurchase same shares — no wash sale rule for gains (only for losses)",
          "New cost basis eliminates deferred gain permanently",
          "Model with tax software to stay under the ceiling — one dollar over shifts the entire gain to 15%"
        ]
      };
    }

    return {
      status: "eligible_if_changed",
      message: `You are in the 0% LTCG bracket (AGI $${agi.toLocaleString()}, $${headroom.toLocaleString()} headroom). No long-term capital gains recorded — if you hold appreciated assets, this is a harvesting opportunity.`,
      missing_facts: ["income.investment_income.long_term_capital_gains or investments.taxable_accounts"],
      changes_needed: ["Identify taxable brokerage holdings with unrealized long-term gains"],
      next_steps: [
        "Check brokerage for appreciated positions held 12+ months",
        `You can realize up to $${headroom.toLocaleString()} in gains tax-free this year`
      ]
    };
  },

  "premium-tax-credit": (_benefit, facts) => {
    const coverage = facts.healthcareCoverage();
    if (coverage && !["marketplace", "aca", "exchange", "healthcare.gov"].includes(coverage.toLowerCase())) {
      return {
        status: "not_applicable",
        message: `Premium Tax Credit requires ACA Marketplace insurance. Coverage type '${coverage}' does not qualify.`
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
            "Premium Tax Credit applies to ACA Marketplace insurance. No coverage type recorded. If you have employer-sponsored insurance, you likely don't qualify."
        };
      }
      return {
        status: "nearly_eligible",
        message:
          "Self-employed without employer insurance - ACA Marketplace may provide a large Premium Tax Credit. Update healthcare.coverage_type if you purchase Marketplace insurance.",
        missing_facts: ["healthcare.coverage_type"]
      };
    }

    if (agi == null) {
      return {
        status: "nearly_eligible",
        message: "ACA Marketplace coverage found - enter AGI to calculate Premium Tax Credit amount.",
        missing_facts: ["household.estimated_agi"]
      };
    }

    if (agi < fplBase * 0.99) {
      return {
        status: "not_applicable",
        message:
          `AGI $${agi.toLocaleString()} appears to be below 100% FPL ($${fplBase.toLocaleString()} for household of ${householdSize}). Medicaid eligibility likely - PTC requires income at or above 100% FPL.`
      };
    }

    if (agi <= fplBase * 1.5) {
      return {
        status: "eligible_now",
        message:
          `ACA Premium Tax Credit available - at ${Math.round((agi / fplBase) * 100)}% FPL, your benchmark plan premium is $0 or near $0. Household size ${householdSize} (FPL: $${fplBase.toLocaleString()}).`,
        estimated_value: "$0 premium for benchmark Silver plan (below 150% FPL)",
        next_steps: [
          "File Form 8962 to reconcile advance credit payments with actual credit",
          "Ensure Form 1095-A from the exchange is received before filing"
        ]
      };
    }

    const capPct = agi < fpl400 ? Math.min(8.5, ((agi / fplBase - 1.5) / 2.5) * 8.5) : 8.5;
    return {
      status: "eligible_now",
      message:
        `ACA Premium Tax Credit available. At AGI $${agi.toLocaleString()} (${Math.round((agi / fplBase) * 100)}% FPL), your premium is capped at ~${capPct.toFixed(1)}% of income (~$${Math.round((agi * capPct) / 100).toLocaleString()}/year).`,
      estimated_value: `Credit = benchmark plan premium minus $${Math.round((agi * capPct) / 100).toLocaleString()}/year required contribution`,
      next_steps: [
        "Receive Form 1095-A from healthcare.gov or your state exchange",
        "File Form 8962 to compute and reconcile the credit",
        "Manage MAGI carefully - income spikes trigger repayment of advance credits"
      ]
    };
  },

  "qsbs-exclusion": (_benefit, facts) => {
    const hasStartup = facts.hasStartupEquity();
    if (!hasStartup) {
      if (facts.businesses().length === 0) {
        return {
          status: "not_applicable",
          message:
            "§1202 QSBS exclusion applies to original-issue C corporation stock from qualified small businesses. No startup equity or business activity recorded."
        };
      }

      return {
        status: "future_opportunity",
        message:
          "If you invest in or found a qualifying C corporation startup, §1202 may exclude 100% of gains up to $10M+. Set investments.has_qualified_small_business_stock: true if applicable.",
        next_steps: [
          "For startup founders: early exercise of options + §83(b) election starts the 5-year holding period",
          "Ensure company is a C corp (not LLC or S corp) with assets ≤ $50M at time of investment",
          "Document original issuance (not secondary purchase) to preserve §1202 eligibility"
        ]
      };
    }

    return {
      status: "eligible_now",
      message:
        "QSBS (§1202) stock identified. If held 5+ years and all requirements met, up to 100% of gains may be excluded (greater of $10M or 10× basis per issuer per taxpayer).",
      estimated_value:
        "100% federal capital gains exclusion on qualifying gains (no upper limit with 10× basis rule)",
      next_steps: [
        "Confirm: (1) original issuance from the corporation, (2) C corp status, (3) assets ≤ $50M at issuance, (4) active qualified business (not professional services, finance, hospitality)",
        "Track exact acquisition date — 5-year holding period must be met before sale",
        "Consider gifting shares to family members to multiply the per-taxpayer exclusion",
        "Note: CA and some states do not conform to §1202 — state tax may apply"
      ]
    };
  },

  "net-unrealized-appreciation": (_benefit, facts) => {
    const hasW2 = facts.hasW2Income();
    const hasRetirementDistributions = facts.hasRetirementDistributions();

    if (!hasW2 && !hasRetirementDistributions) {
      return {
        status: "not_applicable",
        message: "NUA strategy applies to employees with employer stock in a 401k/profit-sharing plan."
      };
    }

    const retirement = facts.data.retirement as Record<string, unknown> | undefined;
    const employerPlans = (retirement?.employer_plans as Record<string, unknown> | undefined) ?? {};
    const has401k = Boolean(employerPlans.traditional_401k || employerPlans.profit_sharing);

    if (!has401k && !hasRetirementDistributions) {
      return {
        status: "nearly_eligible",
        message:
          "Has W-2 income — if your 401k or profit-sharing plan holds employer stock with significant appreciation, the NUA strategy can save 20–37% in taxes vs. rollover.",
        missing_facts: ["retirement.employer_plans.traditional_401k"],
        next_steps: [
          "Ask your plan administrator for the cost basis of employer stock in your plan",
          "Compare NUA tax cost vs. rollover with your CPA before distributing",
          "NUA is only available as a lump-sum distribution — cannot split across years"
        ]
      };
    }

    const nuaAmount = facts.employerStockNuaAmount();
    if (nuaAmount > 0) {
      const savingsEstimate = nuaAmount * 0.2;
      return {
        status: "eligible_now",
        message:
          `NUA strategy available — $${nuaAmount.toLocaleString()} of employer stock appreciation could be taxed at LTCG rates (~$${savingsEstimate.toLocaleString()} potential savings vs. ordinary income).`,
        estimated_value: `~$${savingsEstimate.toLocaleString()}+ lifetime savings (20% × NUA)`,
        next_steps: [
          "Work with CPA to model NUA vs. IRA rollover — NUA wins when appreciation is large",
          "Lump-sum distribution must occur in one tax year",
          "Cost basis of employer stock is taxed as ordinary income in the year of distribution",
          "NUA (appreciation through distribution date) is taxed at LTCG rates upon sale — regardless of post-distribution holding period",
          "Appreciation after the distribution date follows actual holding period: LTCG if held >1 year, STCG if sold sooner"
        ]
      };
    }

    return {
      status: "nearly_eligible",
      message:
        "Has retirement plan — if plan holds appreciated employer stock, NUA strategy may apply. Record employer stock NUA amount to calculate potential savings.",
      missing_facts: ["retirement.employer_plans.traditional_401k.employer_stock_nua"]
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
        message: "AGI not recorded — needed to determine Roth IRA eligibility and whether backdoor strategy applies.",
        missing_facts: ["household.estimated_agi"]
      };
    }

    if (agi <= limit) {
      return {
        status: "not_applicable",
        message:
          `AGI $${agi.toLocaleString()} is below Roth IRA income limit — contribute directly to Roth IRA (no backdoor needed).`
      };
    }

    const traditionalBalance = facts.traditionalIraBalance();
    if (traditionalBalance > 0) {
      return {
        status: "nearly_eligible",
        message:
          `Backdoor Roth available but pro-rata rule applies — traditional IRA balance of ~$${traditionalBalance.toLocaleString()} makes conversion partially taxable.`,
        changes_needed: [
          "Roll pre-tax traditional IRA balance into employer 401(k) to clear the pro-rata issue",
          "Then execute backdoor Roth on clean slate"
        ],
        next_steps: ["Confirm employer 401(k) plan accepts incoming rollovers"]
      };
    }

    return {
      status: "eligible_now",
      message:
        "Income above Roth limit — backdoor Roth IRA strategy available. Contribute $7,000 (2025) as nondeductible traditional IRA, then convert.",
      estimated_value: "$7,000/year ($8,000 if 50+) into Roth — tax-free growth forever",
      next_steps: [
        "Make nondeductible traditional IRA contribution ($7,000 or $8,000 if 50+)",
        "Convert to Roth IRA immediately (Roth conversion has no income limit)",
        "File Form 8606 tracking nondeductible basis — file every year",
        "Confirm no existing pre-tax IRA balance (pro-rata rule)"
      ]
    };
  },

  "qlac": (_benefit, facts) => {
    const totalBalance = facts.qlacEligibleRetirementBalance();
    const age = facts.taxpayerAge();

    if (totalBalance === 0 && !facts.hasRetirementContributions()) {
      return {
        status: "not_applicable",
        message: "QLAC requires a Traditional IRA, 401k, 403b, or 457b account balance."
      };
    }

    if (age && age < 50) {
      return {
        status: "future_opportunity",
        message:
          `QLAC is most valuable near or in retirement. At age ${age}, focus on maximizing contributions first. Revisit at age 60+.`,
        next_steps: ["Maximize IRA/401k contributions now to grow the balance that funds a QLAC later"]
      };
    }

    const qlacLimit = Math.min(totalBalance > 0 ? totalBalance * 0.25 : 135000, 135000);
    if (totalBalance === 0) {
      return {
        status: "nearly_eligible",
        message: "Has retirement contributions — record IRA/401k balances to calculate QLAC purchase limit.",
        missing_facts: ["retirement.individual_retirement_accounts.traditional_ira.balance"]
      };
    }

    return {
      status: "nearly_eligible",
      message:
        `Retirement balance $${totalBalance.toLocaleString()} — QLAC purchase limit: $${qlacLimit.toLocaleString()} (lesser of 25% of balance or $135,000). Excludes QLAC amount from RMD calculations until payments begin (max age 85).`,
      estimated_value: `$${qlacLimit.toLocaleString()} excluded from RMDs; deferred income until age 72-85`,
      next_steps: [
        "Compare QLAC payouts from multiple insurers (Fidelity, New York Life, MassMutual)",
        "Model RMD reduction vs. Roth conversion — often Roth conversion is the better first step",
        "Purchase by December 31 to exclude from that year's RMD calculation",
        "SECURE 2.0: 25% limit now applies to aggregate balance across all accounts"
      ]
    };
  },

  "foreign-earned-income-exclusion": (_benefit, facts) => {
    if (facts.stateCode()) {
      return {
        status: "not_applicable",
        message: "US state residence recorded — FEIE applies to taxpayers living and working abroad."
      };
    }

    return {
      status: "nearly_eligible",
      message: "No US state recorded — may qualify for Foreign Earned Income Exclusion ($130,000 for 2025) if living abroad.",
      missing_facts: ["household.residence.state or foreign country confirmation"]
    };
  },

  "annual-gift-tax-exclusion": (_benefit, facts) => {
    const transferGoal = facts.transferWealthGoal();
    if (transferGoal === false) {
      return {
        status: "not_applicable",
        message: "Wealth transfer is not a stated goal. Update goals.yaml if estate planning becomes a priority."
      };
    }

    return {
      status: transferGoal ? "eligible_now" : "nearly_eligible",
      message: "Annual gift tax exclusion: $19,000 per recipient per year (2025) — $38,000 per recipient for married couples.",
      estimated_value: "$19,000-$38,000 per recipient per year removed from taxable estate",
      next_steps: [
        "Identify recipients: children, grandchildren, siblings, etc.",
        "Make gifts by December 31",
        "Direct tuition/medical payments to institutions are additionally excluded (no dollar limit)",
        "Consider 529 superfunding: 5 years of exclusion at once ($95,000 single / $190,000 MFJ per beneficiary)"
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

  "conservation-easement": (_benefit, facts) => {
    if (!facts.hasAnyRealEstate()) {
      return {
        status: "not_applicable",
        message: "Conservation easement deduction requires ownership of qualifying real property."
      };
    }

    const properties = facts.properties();
    const qualifyingTypes = new Set([
      "land",
      "farm",
      "ranch",
      "rural",
      "undeveloped",
      "agricultural",
      "timberland",
      "wetland",
      "open_space"
    ]);
    const qualifying = properties.filter((property) => {
      const propertyType = String(property.property_type ?? "").toLowerCase();
      const description = String(property.description ?? "").toLowerCase();
      return Array.from(qualifyingTypes).some((type) => propertyType.includes(type) || description.includes(type));
    });

    if (qualifying.length === 0) {
      return {
        status: "eligible_if_changed",
        message:
          "Has real estate — conservation easement deduction (§170(h)) requires land with conservation potential (farm, ranch, undeveloped land, habitat, scenic corridor). No qualifying land type identified in your data.",
        changes_needed: ["Own land with qualifying conservation purpose"],
        next_steps: [
          "CAUTION: Only pursue with a reputable land trust — not a promoter",
          "Syndicated easements are IRS listed transactions with heavy penalties"
        ]
      };
    }

    const agi = facts.estimatedAgi();
    const agiLimit = agi ? agi * 0.5 : null;
    const landValue = qualifying.reduce((sum, property) => sum + Number(property.current_value ?? 0), 0);
    const easementEstimate = landValue * 0.4;
    let message =
      `Has ${qualifying.length} qualifying land parcel(s) (estimated value $${landValue.toLocaleString()}). Conservation easement could yield ~$${easementEstimate.toLocaleString()} deduction (~40% of land value estimate).`;
    if (agiLimit) {
      message += ` Annual deduction limit: $${agiLimit.toLocaleString()} (50% of AGI) with 15-year carryforward.`;
    }

    return {
      status: "nearly_eligible",
      message,
      estimated_value: `~$${easementEstimate.toLocaleString()} deduction (50% AGI/year + 15-yr carryforward)`,
      next_steps: [
        "Consult with a reputable land trust — NOT a promoter offering 4:1+ deduction ratios",
        "Get a qualified appraisal from a certified appraiser (not the promoter's appraiser)",
        "Deed must be recorded by December 31; appraisal complete before return due date",
        "Review with CPA and attorney — high IRS audit rate on this deduction"
      ]
    };
  },

    "county-agricultural-use-valuation": (_benefit, facts) => {
      const properties = facts.properties();
      const hasLand = properties.some((property) => {
        const propertyType = String(property.property_type ?? "").toLowerCase();
        return propertyType === "land" || propertyType === "land (no structure)";
      });

      if (!hasLand && properties.length === 0) {
        return {
          status: "not_applicable",
          message: "Agricultural use valuation requires owning land or qualifying acreage - no real estate recorded."
        };
      }

      if (!hasLand) {
        return {
          status: "not_applicable",
          message:
            "Agricultural use valuation requires a land-type property. Residential properties do not qualify unless they include significant acreage."
        };
      }

      const state = facts.stateCode();
      const county = facts.county();
      const location = county && state ? `${county} County, ${state}` : county ? `${county} County` : state ?? "your county";

      return {
        status: "nearly_eligible",
        message:
          `You own land-type property that may qualify for ${location}'s agricultural use valuation. This assesses land at its agricultural value rather than market value - in rapidly appreciating areas the tax savings can be $1,000-$30,000+/year.`,
        missing_facts: county ? [] : ["household.residence.county"],
        next_steps: [
          `Contact ${location} assessor for the agricultural use / greenbelt application`,
          "Document qualifying agricultural activity: farming records, lease to farmer, or wildlife management plan",
          "TX Wildlife Management: requires a documented WMP - qualifies with 5+ acres and 6+ beehives",
          "Understand rollback taxes (3-5 years at full rate) before selling or changing land use",
          "Consult a real estate attorney before any sale of land under ag classification"
        ]
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
        status: "not_applicable",
        message: "County homestead exemption applies to a primary residence — no primary residence recorded."
      };
    }

    const location = county && state ? `${county} County, ${state}` : county ? `${county} County` : state ?? "your county";
    return {
      status: "nearly_eligible",
      message:
        `You own a primary residence and likely qualify for ${location}'s county homestead exemption. Most counties administer their own exemption on top of the state exemption, but it is not automatic — you must apply with the county assessor.`,
      missing_facts: county ? [] : ["household.residence.county"],
      next_steps: [
        `Search '${location} homestead exemption application' to find the county assessor portal`,
        "Gather deed/mortgage statement + government ID showing current address",
        "File before the county deadline (most states: March 1)",
        "Confirm you also have the state-level exemption — both layers are required separately"
      ]
    };
  },

  "county-veteran-property-tax-exemption": (_benefit, facts) => {
    const veteran = facts.taxpayerVeteranStatus();
    if (veteran == null) {
      return {
        status: "nearly_eligible",
        message:
          "Veteran status not recorded. If you are an honorably discharged veteran who owns a primary residence, you likely qualify for a county property tax exemption.",
        missing_facts: ["household.taxpayer.veteran"]
      };
    }

    if (!veteran) {
      return {
        status: "not_applicable",
        message: "County veteran property tax exemption requires honorably discharged veteran status."
      };
    }

    if (!facts.hasPrimaryResidence()) {
      return {
        status: "nearly_eligible",
        message:
          "Veteran status confirmed. This exemption applies when you own a primary residence — apply immediately after purchasing a home.",
        missing_facts: ["real_estate.properties (primary_residence)"]
      };
    }

    const state = facts.stateCode();
    const county = facts.county();
    const location = county && state ? `${county} County, ${state}` : county ? `${county} County` : state ?? "your county";

    return {
      status: "nearly_eligible",
      message:
        `As a veteran who owns a primary residence, you qualify for ${location}'s veteran property tax exemption. The savings range from a modest base exemption for any honorably discharged veteran to a full exemption for 100% service-connected disability.`,
      missing_facts: county ? [] : ["household.residence.county"],
      next_steps: [
        `Contact ${location} assessor and request the veteran property tax exemption application`,
        "Bring your DD-214 and any VA disability rating award letter",
        "Apply for the highest tier your disability rating supports (100% disabled = full exemption in many states)",
        "TX 100% disabled veterans: full property tax exemption - save $5,000-$15,000+/year"
      ]
    };
  },

  "county-disability-property-tax-exemption": (_benefit, facts) => {
    const disability = facts.taxpayerDisabilityStatus();
    if (disability == null) {
      return {
        status: "nearly_eligible",
        message:
          "Disability status not recorded. If you are permanently and totally disabled and own a primary residence, you may qualify for a county property tax exemption.",
        missing_facts: ["household.taxpayer.disabled"]
      };
    }

    if (!disability) {
      return {
        status: "not_applicable",
        message: "County disability property tax exemption requires permanent total disability."
      };
    }

    if (!facts.hasPrimaryResidence()) {
      return {
        status: "nearly_eligible",
        message:
          "Disability confirmed. This exemption requires owning a primary residence — apply immediately after purchasing a home.",
        missing_facts: ["real_estate.properties (primary_residence)"]
      };
    }

    const county = facts.county();
    const state = facts.stateCode();
    const location = county && state ? `${county} County, ${state}` : county ? `${county} County` : state ?? "your county";
    const agi = facts.estimatedAgi();
    const incomeNote = agi ? ` Income limit may apply (your AGI: $${agi.toLocaleString()}).` : " Some counties impose income limits - verify with the assessor.";

    return {
      status: "nearly_eligible",
      message: `As a permanently disabled homeowner you likely qualify for ${location}'s disability property tax exemption.${incomeNote}`,
      missing_facts: county ? [] : ["household.residence.county"],
      next_steps: [
        `Contact ${location} assessor and request the disability property tax exemption application`,
        "Provide SSA disability award letter or licensed physician certification",
        "Ask whether the exemption stacks with the homestead and senior exemptions",
        "Check if retroactive claims are allowed - some counties accept 1-2 years back"
      ]
    };
  },

  "county-solar-exemption": (_benefit, facts) => {
    if (!facts.hasPrimaryResidence()) {
      return {
        status: "not_applicable",
        message: "County solar exemption applies to homeowners - no primary residence recorded."
      };
    }

    const state = facts.stateCode();
    const county = facts.county();
    const location = county && state ? `${county} County, ${state}` : county ? `${county} County` : state ?? "your county";
    const mandatoryStates = new Set(["FL", "TX", "AZ", "CO", "NJ", "NY", "MA", "NC", "MN", "OR", "WA", "MD", "IN", "KY", "LA", "ME", "MI", "MT", "NE", "NM", "ND", "OH", "RI", "SC", "VT", "WI"]);

    if (state && mandatoryStates.has(state)) {
      return {
        status: "nearly_eligible",
        message:
          `${state} mandates that counties exempt the added value of solar installations from property tax assessment. If you have or are considering solar panels, their value will not increase your property tax bill.`,
        next_steps: [
          "Verify your current property tax bill does not include solar panel value",
          "In mandatory-exemption states this is typically automatic after installation",
          "Stack with the federal 30% Residential Clean Energy Credit (Form 5695)",
          "Factor this exemption into your solar ROI calculation before installing"
        ]
      };
    }

    return {
      status: "nearly_eligible",
      message:
        `Many counties exempt solar and renewable energy installations from property reassessment. Verify whether ${location} offers this exemption before or after installing solar panels.`,
      missing_facts: [] as string[] | undefined,
      next_steps: [
        `Search '${location} solar property tax exemption' or call the county assessor`,
        "If available, apply before or immediately after installation",
        "Stack with federal Form 5695 Residential Clean Energy Credit (30% of system cost)",
        "Leased solar systems may not qualify - confirm with installer"
      ]
    };
  },

  "county-senior-property-tax-freeze": (_benefit, facts) => {
    const age = facts.taxpayerAge();
    const state = facts.stateCode();
    const county = facts.county();

    if (!facts.hasPrimaryResidence()) {
      return {
        status: "not_applicable",
        message: "Senior property tax freeze requires owning a primary residence."
      };
    }

    if (age !== null && age < 60) {
      return {
        status: "not_applicable",
        message: `Senior property tax freeze requires age 65+ (current age: ${age}). Return to this once you approach that threshold.`
      };
    }

    if (age !== null && age >= 60 && age < 65) {
      return {
        status: "future_opportunity",
        message:
          `Age ${age} - most county senior freeze programs require age 65. Plan to apply as soon as you qualify to lock in the current assessed value.`,
        next_steps: ["Note the county assessor deadline for the year you turn 65"]
      };
    }

    const location = county && state ? `${county} County, ${state}` : county ? `${county} County` : state ?? "your county";
    const ageLabel = age !== null ? `age ${age}` : "your age";

    return {
      status: "nearly_eligible",
      message:
        `At ${ageLabel} you likely qualify for ${location}'s senior property tax assessment freeze. This locks your assessed value so your tax bill won't rise even as home values increase - potentially saving hundreds to thousands per year in appreciating markets.`,
      missing_facts: age === null
        ? ["household.taxpayer.age"]
        : (county ? [] : ["household.residence.county"]),
      next_steps: [
        `Contact ${location} assessor to confirm the senior freeze program and income limits`,
        "Gather proof of age (driver's license or birth certificate) and property ownership documents",
        "File before the county deadline (IL: July 1; TX/FL: April 30; others: typically March 1)",
        "Renew annually if required - missing a year can reset the frozen value"
      ]
    };
  },

  "state-homestead-exemption": (_benefit, facts) => {
    const state = facts.stateCode();
    if (!state) {
      return {
        status: "nearly_eligible",
        message: "Set household.residence.state to check homestead exemption availability.",
        missing_facts: ["household.residence.state"]
      };
    }

    if (!facts.hasPrimaryResidence() && !facts.hasAnyRealEstate()) {
      return {
        status: "not_applicable",
        message: "No primary residence recorded in real_estate.yaml."
      };
    }

    const primary = facts.primaryResidenceProperty();
    const applied = Boolean(primary.homestead_exemption_applied || primary.homestead_applied);
    if (applied) {
      return {
        status: "eligible_now",
        message: `Homestead exemption already applied in ${state}. If you have a spouse, senior, or veteran status, check for enhanced exemptions.`,
        next_steps: [
          "Verify the exemption amount on your property tax statement",
          "Check for senior/veteran enhanced exemptions if applicable"
        ]
      };
    }

    const age = facts.taxpayerAge();
    const seniorNote = age !== null && age >= 65 ? " Enhanced senior exemptions may be available for taxpayers 65+." : "";

    return {
      status: "nearly_eligible",
      message:
        `${state} offers a homestead property tax exemption. No evidence it has been applied — most homeowners must file an application with the county.${seniorNote}`,
      missing_facts: ["real_estate.properties.homestead_exemption_applied"],
      next_steps: [
        `Apply with your ${state} county property appraiser or assessor before the deadline (typically March 1)`,
        "Bring: proof of ownership, government ID showing property address",
        "Set homestead_exemption_applied: true in real_estate.yaml once filed",
        "Check for senior (65+), veteran, or disability enhanced exemptions"
      ]
    };
  },

  "state-retirement-income-exemption": (_benefit, facts) => {
    const state = facts.stateCode();
    if (!state) {
      return {
        status: "nearly_eligible",
        message: "Set household.residence.state to check if your state exempts retirement income.",
        missing_facts: ["household.residence.state"]
      };
    }

    const hasRetirementDistributions = Object.values(facts.retirementDistributions()).some((value) => Number(value ?? 0) > 0);
    const hasSocialSecurity = facts.socialSecurityBenefits() > 0;

    if (!hasRetirementDistributions && !hasSocialSecurity) {
      return {
        status: "not_applicable",
        message:
          "No retirement income sources found. This benefit applies to taxpayers with Social Security, pension, or IRA/401(k) distributions."
      };
    }

    if (NO_INCOME_TAX_STATES.has(state) || MINIMAL_INCOME_TAX_STATES.has(state)) {
      return {
        status: "not_applicable",
        message: `${state} has no/minimal income tax - retirement income is not taxed at the state level regardless.`
      };
    }

    if (!RETIREMENT_EXEMPT_STATES.has(state)) {
      return {
        status: "not_applicable",
        message:
          `${state} does not provide a broad retirement income exemption (as of 2025). Verify with your state's department of revenue.`
      };
    }

    const incomeType: string[] = [];
    if (hasSocialSecurity) {
      incomeType.push("Social Security");
    }
    if (hasRetirementDistributions) {
      incomeType.push("retirement distributions");
    }
    const incomeDescription = incomeType.join(" and ");

    if (["IL", "MS", "PA", "AL"].includes(state)) {
      return {
        status: "eligible_now",
        message:
          `${state} exempts ALL retirement income (${incomeDescription}) from state income tax - this is one of the most taxpayer-friendly retirement income rules in the country.`,
        next_steps: [
          "Confirm exemption applies to your income type on the state return",
          "PA: exempts IRAs, 401(k)s, SS, and pension income - ensure it's claimed on PA-40"
        ]
      };
    }

    return {
      status: "eligible_now",
      message:
        `${state} provides a partial exemption or deduction for ${incomeDescription}. Verify the specific exemption amounts on the state return.`,
      next_steps: [
        "Review your state's retirement income worksheet on the state return",
        "Confirm whether SS income, pension income, and IRA distributions each qualify separately",
        "Consider consulting a CPA if retirement income exceeds the exemption threshold"
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
        message: `${state} has no broad-based state income tax - you owe $0 in state income tax on wages, self-employment income, and most other income.`,
        next_steps: [
          "Ensure your domicile is established in your state (driver's license, voter registration, bank address)",
          "Part-year residents: confirm no tax owed to prior state for the portion of year lived there",
          "Community property states (TX, NV, WA): review federal planning interactions with your CPA"
        ]
      };
    }

    if (MINIMAL_INCOME_TAX_STATES.has(state)) {
      return {
        status: "eligible_now",
        message:
          `${state} taxes only interest and dividend income (very narrow). Wages, self-employment, and capital gains are not taxed at the state level.`,
        next_steps: [
          "Confirm investment income - only interest/dividends taxed in NH (through 2024)"
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

  "s-corp-election": (_benefit, facts) => {
    if (!facts.hasSelfEmployment()) {
      return {
        status: "not_applicable",
        message: "S Corp election requires an existing business entity with self-employment income."
      };
    }

    const biz = facts.firstBusiness();
    const entity = String(biz.entity_type ?? "");
    if (entity === "s_corp") {
      return {
        status: "not_applicable",
        message: "Business is already taxed as an S Corp."
      };
    }

    const netProfit = facts.firstBusinessNetProfit();
    if (netProfit <= 0) {
      return {
        status: "nearly_eligible",
        message: "Has business activity but no net profit is recorded. S Corp savings depend on profit level.",
        missing_facts: ["businesses.financials.net_profit_loss"]
      };
    }

    if (netProfit < 40000) {
      return {
        status: "eligible_if_changed",
        message: `Net profit of ~${netProfit.toLocaleString()} may be too low for S Corp payroll overhead to produce net savings.`,
        changes_needed: [
          "Grow net profit above ~$50,000 where S Corp economics are usually stronger",
          "Model self-employment tax savings versus payroll/admin costs"
        ]
      };
    }

    const seSavings = (netProfit * 0.9235 - Math.min(netProfit * 0.4, 60000)) * 0.153;
    return {
      status: "eligible_if_changed",
      message: `S Corp election could save about ${Math.round(seSavings).toLocaleString()} per year in self-employment taxes at current profit levels.`,
      estimated_value: `~$${Math.round(seSavings).toLocaleString()}/year`,
      changes_needed: [
        "File Form 2553 by March 15 (or use late election relief if needed)",
        "Set up payroll with reasonable W-2 compensation",
        "Maintain business bank and corporate records",
        "Use a payroll provider and account for annual admin costs"
      ],
      next_steps: ["Review state-level S Corp taxes and fees with CPA before electing"]
    };
  },

  "small-employer-retirement-startup-credit": (_benefit, facts) => {
    if (facts.businesses().length === 0) {
      return {
        status: "not_applicable",
        message: "§45E small employer retirement startup credit requires a business with employees."
      };
    }

    const employeeCount = facts.firstBusinessW2EmployeesCount();
    if (employeeCount === 0) {
      return {
        status: "nearly_eligible",
        message:
          "Has a business — §45E credit is available when you add employees and set up a new retirement plan. No W-2 employees recorded (solo operators do not qualify for this specific credit).",
        missing_facts: ["businesses.employees.w2_employees_count"]
      };
    }

    if (employeeCount > 100) {
      return {
        status: "not_applicable",
        message: `§45E requires ≤ 100 employees. Business has ${employeeCount} employees.`
      };
    }

    if (facts.firstBusinessHasQualifiedRetirementPlan()) {
      return {
        status: "not_applicable",
        message: "Business already has a qualified retirement plan. §45E credit is for new plan establishment only."
      };
    }

    return {
      status: "eligible_now",
      message:
        `§45E applies — ${employeeCount} employee(s), no existing retirement plan. Credit = 100% of startup costs up to $5,000/year × 3 years ($15,000 total). Set up a 401k, SIMPLE IRA, or SEP-IRA this year.`,
      estimated_value: "$500 – $5,000/year for 3 years; additional SECURE 2.0 employer contribution credit available",
      next_steps: [
        "Engage a plan provider (Fidelity, Vanguard, etc.) — ask about §45E credit eligibility",
        "401k is preferred: higher contribution limits + employer match options",
        "Add auto-enrollment to also claim the $500/year SECURE 2.0 auto-enrollment credit",
        "File Form 8881 with the return for each of the 3 qualifying years"
      ]
    };
  },

  "work-opportunity-tax-credit": (_benefit, facts) => {
    if (facts.businesses().length === 0) {
      return {
        status: "not_applicable",
        message: "Work Opportunity Tax Credit (WOTC) requires a business with employees."
      };
    }

    const employeeCount = facts.firstBusinessW2EmployeesCount();
    if (employeeCount === 0) {
      return {
        status: "nearly_eligible",
        message:
          "Has a business — WOTC is available when you hire from targeted groups (veterans, SNAP recipients, ex-felons, long-term unemployed, etc.). No W-2 employees recorded yet.",
        missing_facts: ["businesses.employees.w2_employees_count"]
      };
    }

    return {
      status: "nearly_eligible",
      message:
        `Business has ${employeeCount} employee(s). WOTC credit ($2,400–$9,600/qualifying hire) is available when hiring from WOTC target groups. Requires IRS Form 8850 filed with state workforce agency within 28 days of hire.`,
      missing_facts: ["businesses.employees.wotc_hires"],
      next_steps: [
        "Add Form 8850 pre-screening to all new-hire onboarding",
        "Target groups: veterans, SNAP/TANF recipients, ex-felons, long-term unemployed",
        "Disabled veteran = up to $9,600 credit per hire",
        "File Form 5884 with business return"
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

  "installment-sale": (_benefit, facts) => {
    if (!facts.hasAnyRealEstate() && facts.businesses().length === 0) {
      return {
        status: "not_applicable",
        message: "Installment sale method applies to sellers of real estate or business property."
      };
    }

    const selling = facts.properties().filter((property) => {
      const status = String(property.status ?? property.sale_status ?? "").toLowerCase();
      return ["for_sale", "pending_sale", "selling", "sold"].includes(status);
    });
    if (selling.length > 0) {
      return {
        status: "eligible_now",
        message:
          "Property marked for sale — installment method available to spread capital gains across payment years. Discuss seller-financing terms with buyer and CPA.",
        estimated_value: "Varies — can save $5,000–$100,000+ depending on gain size and brackets",
        next_steps: [
          "Negotiate installment payments in purchase agreement",
          "Get a promissory note secured by the property",
          "File Form 6252 with each year's return; depreciation recapture due in sale year"
        ]
      };
    }

    const appreciated = facts.properties().filter((property) => {
      const currentValue = Number(property.current_value ?? 0);
      const purchasePrice = Number(property.purchase_price ?? 0);
      return currentValue > purchasePrice;
    });
    if (appreciated.length > 0) {
      return {
        status: "eligible_if_changed",
        message:
          `Has ${appreciated.length} appreciated propert${appreciated.length === 1 ? "y" : "ies"} — if you sell with seller financing, the installment method spreads capital gains across payment years, keeping income in lower brackets.`,
        changes_needed: ["Negotiate seller financing terms when selling real estate or business"],
        next_steps: [
          "Model tax under lump-sum vs. 3–5 year installment schedule with CPA",
          "Depreciation recapture is taxed in year of sale regardless",
          "File Form 6252 every year payments are received"
        ]
      };
    }

    if (facts.businesses().length > 0) {
      return {
        status: "eligible_if_changed",
        message:
          "Has a business — installment sale method available if you sell the business and negotiate seller financing with the buyer.",
        changes_needed: ["Negotiate installment terms in business sale agreement"],
        next_steps: ["Model tax impact with CPA before agreeing to sale terms"]
      };
    }

    return {
      status: "not_applicable",
      message: "No appreciated real estate or business property identified for potential sale."
    };
  },

  "nol-carryforward": (_benefit, facts) => {
    if (facts.businesses().length === 0 && !facts.hasRentalProperty()) {
      return {
        status: "not_applicable",
        message: "NOL carryforward applies to business or investment losses. No business or rental activity recorded."
      };
    }

    const netProfit = facts.businesses().length > 0 ? facts.firstBusinessNetProfit() : 0;
    if (netProfit < 0) {
      const loss = Math.abs(netProfit);
      return {
        status: "eligible_now",
        message:
          `Business net loss of $${loss.toLocaleString()} recorded. This may create an NOL that carries forward indefinitely to offset up to 80% of taxable income in future profitable years.`,
        estimated_value: `$${loss.toLocaleString()} × future marginal rate (up to 80% of taxable income/year)`,
        next_steps: [
          "Compute the NOL using Publication 536 worksheet (deductions exceed income?)",
          "Document the NOL on your return and track the carryforward balance each year",
          "The NOL carries forward indefinitely — use it in high-income future years",
          "Consult CPA: at-risk rules and passive activity rules may limit the NOL before it reaches the return"
        ]
      };
    }

    if (netProfit === 0) {
      return {
        status: "nearly_eligible",
        message: "Has business but net profit/loss not recorded — if business had a net loss, an NOL may exist.",
        missing_facts: ["businesses.financials.net_profit_loss"]
      };
    }

    return {
      status: "future_opportunity",
      message:
        `Business is profitable (net $${netProfit.toLocaleString()}). NOL carryforward becomes relevant in any future loss year. Track cumulative NOL balance if prior years had losses.`,
      next_steps: ["Review prior returns — any year with net loss may have created an unused NOL carryforward"]
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
    const pteNexus = Array.from(nexusStates)
      .filter((state) => PTE_STATES.has(state) && !NO_INCOME_TAX_STATES.has(state) && !MINIMAL_INCOME_TAX_STATES.has(state));

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
        message: `${state} does not offer a state income tax deduction or credit for 529 contributions (as of 2025). Federal tax-free growth still applies.`
      };
    }

    if (!facts.has529Account()) {
      return {
        status: "eligible_if_changed",
        message: `${state} offers a 529 deduction — open a home-state 529 account to claim it.`,
        changes_needed: ["Open a 529 college savings account with your home-state plan"],
        next_steps: [
          `Research ${state}'s 529 plan at your state treasurer's website`,
          "Open an account with a beneficiary — can be any family member",
          "Contribute by December 31 to get the deduction for this tax year (PA allows by April 15)"
        ]
      };
    }

    return {
      status: "eligible_now",
      message: `${state} offers a state income tax deduction/credit for contributions to the home-state 529 plan. Contribute by December 31 to claim the deduction this tax year.`,
      next_steps: [
        "Contribute to the home-state 529 plan (not an out-of-state plan — most states require home-state plan)",
        "Check the annual deduction limit for your state (typically $2,500–$20,000 per beneficiary)",
        "Consider superfunding: elect to spread 5 years of gifts ($95,000 single / $190,000 MFJ) into one contribution"
      ]
    };
  },

  "529-to-roth-rollover": (_benefit, facts) => {
    if (!facts.has529Account()) {
      return {
        status: "eligible_if_changed",
        message:
          "SECURE 2.0 §126: unused 529 funds can roll to the beneficiary's Roth IRA tax-free. No 529 account recorded. Open one now to start the 15-year account age requirement.",
        changes_needed: ["Open a 529 account — the account must be at least 15 years old before rolling"],
        next_steps: [
          "Open a 529 plan today — even a small balance starts the 15-year clock",
          "Contributions made within the last 5 years cannot be rolled over",
          "Lifetime limit: $35,000 per beneficiary; annual Roth IRA limit applies"
        ]
      };
    }

    const ageYears = facts.oldest529PlanAgeYears();
    if (ageYears === null || ageYears < 15) {
      return {
        status: "nearly_eligible",
        message: "529 plan on file, but the account age has not been recorded as 15+ years yet.",
        missing_facts: ["investments.529_plans.opened_date"],
        next_steps: ["Confirm the 529 account opening date", "The account must be at least 15 years old before rollover"]
      };
    }

    const investments = facts.data.investments;
    const plans = Array.isArray(investments["529_plans"]) ? investments["529_plans"] : [];
    const balances = plans
      .filter((plan) => plan && typeof plan === "object")
      .map((plan) => Number((plan as Record<string, unknown>).balance ?? 0));
    const totalBalance = balances.reduce((sum, balance) => sum + balance, 0);

    if (totalBalance > 0) {
      return {
        status: "eligible_now",
        message:
          `529 account present (total balance ~${totalBalance.toLocaleString()}). If the account is 15+ years old, unused funds can roll to the beneficiary's Roth IRA — up to $7,000/year, $35,000 lifetime.`,
        estimated_value: "Up to $35,000 in Roth IRA contributions without income limit",
        next_steps: [
          "Verify account opening date — must be at least 15 years old",
          "Contributions made in the last 5 years cannot be rolled over",
          "Roll up to $7,000/year (2025 Roth IRA limit) into beneficiary's Roth IRA",
          "Beneficiary must have earned income ≥ the rollover amount",
          "No income limit applies to this rollover (bypasses normal Roth MAGI limits)"
        ]
      };
    }

    return {
      status: "nearly_eligible",
      message:
        "529 plan on file but no balance recorded. Once funded (15+ year account), unused funds can roll to Roth IRA.",
      missing_facts: ["investments.529_plans.balance"]
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

  "solo-401k": (_benefit, facts) => {
    if (!facts.hasSelfEmployment()) {
      return {
        status: "not_applicable",
        message: "Solo 401(k) requires self-employment with no full-time W-2 employees (other than spouse)."
      };
    }

    const employeeCount = facts.firstBusinessW2EmployeesCount();
    if (employeeCount > 0) {
      return {
        status: "not_applicable",
        message: "Solo 401(k) is generally unavailable when the business has W-2 employees (other than spouse).",
        changes_needed: ["Consider SIMPLE IRA or Safe Harbor 401(k) options for businesses with employees"]
      };
    }

    const netProfit = facts.firstBusinessNetProfit();
    const age = facts.taxpayerAge();
    const employeeLimit = age !== null && age >= 50 ? 31000 : 23500;
    const maxEmployer = Math.min(netProfit * 0.9235 * 0.25, 70000 - employeeLimit);
    const maxTotal = Math.min(
      employeeLimit + Math.max(0, maxEmployer),
      age !== null && age >= 50 ? 77500 : 70000
    );

    if (!facts.solo401kEstablished()) {
      return {
        status: "nearly_eligible",
        message: `Solo 401(k) is not yet established. It must be set up by December 31 to contribute for the tax year.`,
        estimated_value: netProfit > 0 ? `Up to $${Math.round(maxTotal).toLocaleString()} in combined contributions` : "Depends on net profit",
        next_steps: [
          "Open a Solo 401(k) plan before year-end",
          "Elect employee deferrals by December 31",
          "Fund employer contribution by filing deadline (with extension)"
        ]
      };
    }

    return {
      status: "eligible_now",
      message: `Solo 401(k) is established. Estimated max combined contribution is ~${Math.round(maxTotal).toLocaleString()}.`,
      estimated_value: `Up to $${Math.round(maxTotal).toLocaleString()} tax-deferred`,
      next_steps: [
        `Employee deferral up to ${employeeLimit.toLocaleString()} must be elected by December 31`,
        `Employer contribution up to ${Math.max(0, Math.round(maxEmployer)).toLocaleString()} can generally be funded by filing deadline`,
        "Evaluate Roth Solo 401(k) option if available"
      ]
    };
  },

  "section-179-expensing": (_benefit, facts) => {
    if (!facts.hasSelfEmployment()) {
      return {
        status: "not_applicable",
        message: "Section 179 requires an active business."
      };
    }

    const assetCount = facts.firstBusinessAssetsPlacedInServiceCount();
    if (assetCount > 0) {
      const totalCost = facts.firstBusinessAssetsPlacedInServiceTotalCost();
      return {
        status: "eligible_now",
        message: `Business assets were placed in service (${assetCount} item${assetCount === 1 ? "" : "s"}). Section 179 immediate expensing may be available.`,
        estimated_value: totalCost > 0
          ? `Up to ~$${Math.round(totalCost).toLocaleString()} immediate deduction (subject to annual limits and taxable income)`
          : "Immediate deduction may be available, subject to annual limits and taxable income",
        next_steps: [
          "Complete Form 4562 and confirm each asset is Section 179 eligible",
          "Section 179 is income-limited; apply bonus depreciation to remaining basis where appropriate"
        ]
      };
    }

    return {
      status: "nearly_eligible",
      message: "Has a business. Section 179 can apply if equipment or vehicles are purchased and placed in service this year.",
      missing_facts: ["businesses.depreciation.assets_placed_in_service"],
      next_steps: [
        "Record any business assets purchased and placed in service",
        "Evaluate year-end equipment purchases only if they fit business needs"
      ]
    };
  },

  "bonus-depreciation": (_benefit, facts) => {
    if (!facts.hasSelfEmployment() && !facts.hasRentalProperty()) {
      return {
        status: "not_applicable",
        message: "Bonus depreciation requires business or rental real-estate activity."
      };
    }

    return {
      status: "nearly_eligible",
      message: "Bonus depreciation available (40% in 2025) on qualifying assets placed in service. Rate drops to 20% in 2026.",
      next_steps: [
        "Identify qualifying asset purchases this year",
        "Apply Section 179 first, bonus on remainder",
        "Consider cost segregation study on real estate for QIP reclassification"
      ]
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
    const balance = facts.hsaExistingBalance();
    const invested = facts.hsaInvestmentAccountWithinHsa();
    const nextSteps = [`Contribute up to $${remaining.toLocaleString()} more (can contribute until April 15, ${facts.taxYear + 1})`];

    if (!invested && balance > 1000) {
      nextSteps.push(`Invest HSA balance ($${balance.toLocaleString()}) — don't leave it in cash`);
    }

    return {
      status: "eligible_now",
      message: `HDHP enrolled. HSA contribution available. $${remaining.toLocaleString()} of $${limit.toLocaleString()} limit remaining.`,
      estimated_value: `$${remaining.toLocaleString()} deductible contribution plus tax-free growth`,
      next_steps: nextSteps
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
          "Covered by employer plan - self-employed health insurance deduction not available in months with employer coverage."
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
      message: "Has self-employment - confirm health insurance premium amount and coverage structure.",
      missing_facts: [
        "businesses.health_insurance.premium_amount",
        "businesses.health_insurance.owner_health_insurance_deducted"
      ],
      next_steps: [
        "Record monthly premium in businesses.yaml",
        "Confirm policy is in business name or owner is reimbursed"
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
