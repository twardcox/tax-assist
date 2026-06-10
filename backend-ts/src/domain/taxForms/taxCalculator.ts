type FilingStatus =
  | "single"
  | "married_filing_jointly"
  | "married_filing_separately"
  | "head_of_household"
  | "qualifying_surviving_spouse";

type TaxParams = {
  standard_deduction: Record<string, number>;
  extra_deduction_65: { single: number; married: number };
  brackets: Record<string, Array<[number, number]>>;
  ltcg_thresholds: Record<string, [number, number]>;
  se_ss_wage_base: number;
  child_tax_credit: number;
  ctc_phaseout: Record<string, number>;
  niit_threshold: Record<string, number>;
  amt_exemption: Record<string, number>;
};

const TAX_PARAMS: Record<number, TaxParams> = {
  2024: {
    standard_deduction: {
      single: 14600,
      married_filing_jointly: 29200,
      married_filing_separately: 14600,
      head_of_household: 21900,
      qualifying_surviving_spouse: 29200,
    },
    extra_deduction_65: { single: 1950, married: 1550 },
    brackets: {
      single: [[11600, 0.10], [47150, 0.12], [100525, 0.22], [191950, 0.24], [243725, 0.32], [609350, 0.35], [1e18, 0.37]],
      married_filing_jointly: [[23200, 0.10], [94300, 0.12], [201050, 0.22], [383900, 0.24], [487450, 0.32], [731200, 0.35], [1e18, 0.37]],
      married_filing_separately: [[11600, 0.10], [47150, 0.12], [100525, 0.22], [191950, 0.24], [243725, 0.32], [365600, 0.35], [1e18, 0.37]],
      head_of_household: [[16550, 0.10], [63100, 0.12], [100500, 0.22], [191950, 0.24], [243700, 0.32], [609350, 0.35], [1e18, 0.37]],
      qualifying_surviving_spouse: [[23200, 0.10], [94300, 0.12], [201050, 0.22], [383900, 0.24], [487450, 0.32], [731200, 0.35], [1e18, 0.37]],
    },
    ltcg_thresholds: {
      single: [47025, 518900],
      married_filing_jointly: [94050, 583750],
      married_filing_separately: [47025, 291850],
      head_of_household: [63000, 551350],
      qualifying_surviving_spouse: [94050, 583750],
    },
    se_ss_wage_base: 168600,
    child_tax_credit: 2000,
    ctc_phaseout: { single: 200000, married_filing_jointly: 400000 },
    niit_threshold: { single: 200000, married_filing_jointly: 250000 },
    amt_exemption: { single: 85700, married_filing_jointly: 133300 },
  },
  2025: {
    standard_deduction: {
      single: 15000,
      married_filing_jointly: 30000,
      married_filing_separately: 15000,
      head_of_household: 22500,
      qualifying_surviving_spouse: 30000,
    },
    extra_deduction_65: { single: 2000, married: 1600 },
    brackets: {
      single: [[11925, 0.10], [48475, 0.12], [103350, 0.22], [197300, 0.24], [250525, 0.32], [626350, 0.35], [1e18, 0.37]],
      married_filing_jointly: [[23850, 0.10], [96950, 0.12], [206700, 0.22], [394600, 0.24], [501050, 0.32], [751600, 0.35], [1e18, 0.37]],
      married_filing_separately: [[11925, 0.10], [48475, 0.12], [103350, 0.22], [197300, 0.24], [250525, 0.32], [375800, 0.35], [1e18, 0.37]],
      head_of_household: [[17000, 0.10], [64850, 0.12], [103350, 0.22], [197300, 0.24], [250500, 0.32], [626350, 0.35], [1e18, 0.37]],
      qualifying_surviving_spouse: [[23850, 0.10], [96950, 0.12], [206700, 0.22], [394600, 0.24], [501050, 0.32], [751600, 0.35], [1e18, 0.37]],
    },
    ltcg_thresholds: {
      single: [48350, 533400],
      married_filing_jointly: [96700, 600050],
      married_filing_separately: [48350, 300000],
      head_of_household: [64750, 566700],
      qualifying_surviving_spouse: [96700, 600050],
    },
    se_ss_wage_base: 176100,
    child_tax_credit: 2000,
    ctc_phaseout: { single: 200000, married_filing_jointly: 400000 },
    niit_threshold: { single: 200000, married_filing_jointly: 250000 },
    amt_exemption: { single: 88100, married_filing_jointly: 137000 },
  },
};

function f(val: unknown): number {
  if (val == null) return 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function getParams(taxYear: number): TaxParams {
  return TAX_PARAMS[taxYear] ?? TAX_PARAMS[2025];
}

function toObj(val: unknown): Record<string, unknown> {
  return val && typeof val === "object" && !Array.isArray(val) ? (val as Record<string, unknown>) : {};
}

function toObjArr(val: unknown): Record<string, unknown>[] {
  return Array.isArray(val) ? val.filter((x) => x && typeof x === "object") as Record<string, unknown>[] : [];
}

export type ComputedValues = Record<string, unknown>;

export class TaxCalculator {
  private data: Record<string, unknown>;
  private taxYear: number;
  private p: TaxParams;
  c: ComputedValues = {};

  constructor(data: Record<string, unknown>, taxYear: number) {
    this.data = data;
    this.taxYear = taxYear;
    this.p = getParams(taxYear);
  }

  compute(): ComputedValues {
    this.c = {};
    this._income();
    this._adjustments();
    this._agi();
    this._deductions();
    this._taxableIncome();
    this._tax();
    this._credits();
    this._payments();
    this._balance();
    return this.c;
  }

  filingStatus(): FilingStatus {
    const raw = (toObj(this.data["household"])["filing_status"] as string) ?? "single";
    const valid: FilingStatus[] = [
      "single", "married_filing_jointly", "married_filing_separately",
      "head_of_household", "qualifying_surviving_spouse",
    ];
    return valid.includes(raw as FilingStatus) ? (raw as FilingStatus) : "single";
  }

  private n(key: string): number {
    const val = this.c[key];
    return typeof val === "number" && Number.isFinite(val) ? val : 0;
  }

  private _income(): void {
    const c = this.c;
    const inc = toObj(this.data["income"]);

    const w2s = toObjArr(inc["w2_employment"]);
    c["wages"] = w2s.reduce((s, w) => s + f(w["wages"]), 0);
    c["federal_withheld"] = w2s.reduce((s, w) => s + f(w["federal_withheld"]), 0);
    c["state_withheld"] = w2s.reduce((s, w) => s + f(w["state_withheld"]), 0);
    c["hsa_payroll"] = w2s.reduce((s, w) => s + f(w["hsa_contributions_through_payroll"]), 0);
    c["w2_retirement"] = w2s.reduce((s, w) => s + f(w["retirement_contributions_through_payroll"]), 0);
    c["dependent_care_fsa"] = w2s.reduce((s, w) => s + f(w["dependent_care_fsa"]), 0);
    c["w2_records"] = w2s;

    const inv = toObj(inc["investment_income"]);
    c["taxable_interest"] = f(inv["interest"]);
    c["qualified_dividends"] = f(inv["qualified_dividends"]);
    c["ordinary_dividends"] = f(inv["ordinary_dividends"]);
    c["stcg"] = f(inv["short_term_capital_gains"]);
    c["ltcg"] = f(inv["long_term_capital_gains"]);
    c["capital_gains_net"] = this.n("stcg") + this.n("ltcg");

    const ret = toObj(inc["retirement_distributions"]);
    c["ira_gross"] = f(ret["traditional_ira"]);
    c["ira_taxable"] = this.n("ira_gross");
    c["pension_gross"] = f(ret["pension"]) + f(ret["annuity"]) + f(ret["traditional_401k"]);
    c["pension_taxable"] = this.n("pension_gross");

    const ss = toObj(inc["social_security"]);
    c["ss_gross"] = f(ss["gross_benefits"]);
    // _ssTaxable is called here; schedule_c_profit is not yet set, so it contributes 0 to combined
    c["ss_taxable"] = this._ssTaxable(this.n("ss_gross"));

    const seList = toObjArr(inc["self_employment"]);
    const bizList = toObjArr(toObj(this.data["businesses"])["businesses"]);
    c["schedule_c_records"] = this._buildSchC(bizList, seList);
    c["schedule_c_profit"] = (c["schedule_c_records"] as Record<string, unknown>[]).reduce(
      (s, r) => s + f(r["net_profit_loss"]), 0
    );

    const rental = toObjArr(inc["rental_income"]);
    c["schedule_e_records"] = rental;
    c["schedule_e_net"] = rental.reduce((s, r) => s + f(r["net_income_loss"]), 0);

    const passive = toObj(inc["passive_income"]);
    c["k1_ordinary"] = f(passive["k1_ordinary"]);
    c["k1_rental"] = f(passive["k1_rental"]);
    c["k1_guaranteed"] = f(passive["k1_guaranteed_payments"]);

    const other = toObj(inc["other_income"]);
    c["alimony_received"] = f(other["alimony_received"]);
    c["gambling_winnings"] = f(other["gambling_winnings"]);
    c["prizes_awards"] = f(other["prizes_awards"]);
    c["canceled_debt"] = f(other["canceled_debt"]);
    c["other_income_misc"] = f(other["other_amount"]);
    c["other_income_desc"] = other["other_description"] ?? "";

    c["schedule1_additional"] = (
      this.n("schedule_c_profit") + this.n("schedule_e_net") +
      this.n("k1_ordinary") + this.n("k1_rental") + this.n("k1_guaranteed") +
      this.n("alimony_received") + this.n("gambling_winnings") +
      this.n("prizes_awards") + this.n("canceled_debt") + this.n("other_income_misc")
    );

    c["total_income"] = (
      this.n("wages") + this.n("taxable_interest") + this.n("ordinary_dividends") +
      this.n("ira_taxable") + this.n("pension_taxable") + this.n("ss_taxable") +
      this.n("capital_gains_net") + this.n("schedule1_additional")
    );
  }

  private _buildSchC(
    bizList: Record<string, unknown>[],
    seList: Record<string, unknown>[]
  ): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];

    for (const biz of bizList) {
      const name = (biz["name"] as string) || (biz["business_name"] as string) || "";
      const fin = toObj(biz["financials"]);
      let se: Record<string, unknown> = {};
      const match = seList.find(
        (s) => ((s["business_name"] as string) ?? "").toLowerCase() === name.toLowerCase()
      );
      if (match) {
        se = match;
      } else if (bizList.length === 1 && seList.length > 0) {
        se = seList[0];
      }

      const grossRev = f(se["gross_revenue"] ?? biz["gross_revenue"] ?? fin["gross_revenue"]);
      const netPl = f(se["net_profit"] ?? se["net_profit_loss"] ?? biz["net_profit_loss"] ?? fin["net_profit_loss"]);
      const hoRaw = biz["home_office"];
      const hoObj = toObj(hoRaw);
      const homeOffice = Boolean(hoObj["claimed"] ?? hoRaw);

      out.push({
        business_name: name,
        entity_type: biz["entity_type"] ?? "",
        ein: biz["ein"] ?? "",
        naics: biz["naics_code"] ?? "",
        gross_revenue: grossRev,
        expenses: grossRev ? grossRev - netPl : 0,
        net_profit_loss: netPl,
        home_office: homeOffice,
      });
    }

    const listed = new Set(out.map((r) => (r["business_name"] as string).toLowerCase()));
    for (const se of seList) {
      const n = ((se["business_name"] as string) ?? "").toLowerCase();
      if (n && !listed.has(n)) {
        const net = f(se["net_profit"] ?? se["net_profit_loss"]);
        out.push({
          business_name: se["business_name"] ?? "",
          entity_type: "sole_prop",
          ein: "",
          naics: "",
          gross_revenue: f(se["gross_revenue"]),
          expenses: f(se["gross_revenue"]) - net,
          net_profit_loss: net,
          home_office: false,
        });
      }
    }

    return out;
  }

  private _ssTaxable(gross: number): number {
    if (gross <= 0) return 0;
    // IRC §86 combined income rule; schedule1_additional not yet set, contributes 0
    const combined = (
      this.n("wages") + this.n("taxable_interest") + this.n("ordinary_dividends") +
      this.n("ira_taxable") + this.n("pension_taxable") + this.n("capital_gains_net") +
      this.n("schedule1_additional") + gross * 0.5
    );
    const fs = this.filingStatus();
    const base = fs.includes("jointly") ? 32000 : 25000;
    const upper = fs.includes("jointly") ? 44000 : 34000;
    if (combined <= base) return 0;
    if (combined <= upper) return Math.min(gross, (combined - base) * 0.5);
    return Math.min(gross * 0.85, (upper - base) * 0.5 + (combined - upper) * 0.85);
  }

  private _adjustments(): void {
    const c = this.c;
    const inc = toObj(this.data["income"]);
    const adj = toObj(inc["adjustments_to_income"]);

    const seProfit = this.n("schedule_c_profit");
    if (seProfit > 0) {
      const seNet = seProfit * 0.9235;
      const ssBase = this.p.se_ss_wage_base;
      const ssWages = Math.min(this.n("wages"), ssBase);
      const ssSe = Math.max(0, Math.min(seNet, ssBase - ssWages) * 0.124);
      const medSe = seNet * 0.029;
      c["se_tax"] = ssSe + medSe;
      c["se_tax_deduction"] = this.n("se_tax") / 2;
    } else {
      c["se_tax"] = 0;
      c["se_tax_deduction"] = 0;
    }

    c["student_loan_interest"] = f(adj["student_loan_interest"]);
    c["educator_expenses"] = Math.min(f(adj["educator_expenses"]), 300);
    c["hsa_outside_payroll"] = f(adj["hsa_contributions_outside_payroll"]);
    c["se_health_insurance"] = f(adj["self_employed_health_insurance"]);
    c["ira_deduction"] = f(adj["ira_deduction"]);
    c["alimony_paid"] = f(adj["alimony_paid"]);
    c["moving_expenses_military"] = f(adj["moving_expenses_military"]);

    c["total_adjustments"] = (
      this.n("se_tax_deduction") + this.n("student_loan_interest") +
      this.n("educator_expenses") + this.n("hsa_outside_payroll") +
      this.n("se_health_insurance") + this.n("ira_deduction") +
      this.n("alimony_paid") + this.n("moving_expenses_military")
    );
  }

  private _agi(): void {
    this.c["agi"] = Math.max(0, this.n("total_income") - this.n("total_adjustments"));
  }

  private _deductions(): void {
    const c = this.c;
    const fs = this.filingStatus();
    const p = this.p;
    const agi = this.n("agi");

    let std = p.standard_deduction[fs] ?? 15000;
    const tp = toObj(toObj(this.data["household"])["taxpayer"]);
    const age = f(tp["age"]);
    const married = fs.includes("jointly") || fs.includes("separately");
    const extraKey = married ? "married" : "single";
    if (age >= 65) std += p.extra_deduction_65[extraKey];
    if (tp["blind"]) std += p.extra_deduction_65[extraKey];
    c["standard_deduction"] = std;

    c["itemized"] = this._scheduleA(agi);
    c["using_standard"] = this.n("standard_deduction") >= this.n("itemized");
    c["deduction"] = Math.max(this.n("standard_deduction"), this.n("itemized"));

    const qbi = Math.max(0, this.n("schedule_c_profit") + this.n("k1_ordinary"));
    const tiBeforeQbi = Math.max(0, agi - this.n("deduction"));
    const ordinaryTi = Math.max(0, tiBeforeQbi - this.n("qualified_dividends") - this.n("ltcg"));
    c["qbi_deduction"] = qbi > 0 ? Math.min(qbi * 0.20, ordinaryTi * 0.20) : 0;
  }

  private _scheduleA(agi: number): number {
    const c = this.c;
    const data = this.data;
    const fs = this.filingStatus();
    const props = toObjArr(toObj(data["real_estate"])["properties"]);

    const stateTax = this.n("state_withheld");
    const propTax = props.reduce((s, p) => {
      const fin = toObj(p["financing"]);
      return s + f(p["property_tax_annual"] ?? fin["property_tax_paid"]);
    }, 0);
    const saltCap = fs.includes("separately") ? 5000 : 10000;
    c["salt"] = Math.min(stateTax + propTax, saltCap);
    c["prop_tax_paid"] = propTax;
    c["state_tax_paid"] = stateTax;

    c["mortgage_interest"] = props.reduce((s, p) => {
      const fin = toObj(p["financing"]);
      return s + f(p["mortgage_interest_paid"] ?? fin["mortgage_interest_paid"]);
    }, 0);

    c["charitable"] = f(toObj(data["goals"])["charitable_giving_annual"]);

    c["medical_total"] = f(toObj(data["healthcare"])["out_of_pocket_expenses"]);
    c["medical_deductible"] = Math.max(0, this.n("medical_total") - agi * 0.075);

    return (
      this.n("salt") + this.n("mortgage_interest") +
      this.n("charitable") + this.n("medical_deductible")
    );
  }

  private _taxableIncome(): void {
    this.c["taxable_income"] = Math.max(
      0,
      this.n("agi") - this.n("deduction") - this.n("qbi_deduction")
    );
  }

  private _tax(): void {
    const c = this.c;
    const fs = this.filingStatus();
    const ti = this.n("taxable_income");

    const pref = this.n("qualified_dividends") + this.n("ltcg");
    const ordinary = Math.max(0, ti - pref);

    c["ordinary_tax"] = this._bracketTax(ordinary, fs);
    c["ltcg_tax"] = this._ltcgTax(ti, pref, fs);

    const niitThresh = this.p.niit_threshold[
      fs.includes("jointly") ? "married_filing_jointly" : "single"
    ] ?? 200000;
    const wagesAndSe = this.n("wages") + this.n("schedule_c_profit");
    c["addl_medicare_tax"] = Math.max(0, wagesAndSe - niitThresh) * 0.009;

    const nii = (
      this.n("taxable_interest") + this.n("ordinary_dividends") +
      this.n("capital_gains_net") + this.n("schedule_e_net")
    );
    const agiOver = Math.max(0, this.n("agi") - niitThresh);
    c["niit"] = nii > 0 && agiOver > 0 ? Math.min(nii, agiOver) * 0.038 : 0;

    c["income_tax_before_credits"] = (
      this.n("ordinary_tax") + this.n("ltcg_tax") +
      this.n("addl_medicare_tax") + this.n("niit")
    );
    c["total_tax_before_credits"] = this.n("income_tax_before_credits") + this.n("se_tax");
  }

  private _bracketTax(income: number, fs: FilingStatus): number {
    const brackets = this.p.brackets[fs] ?? this.p.brackets["single"];
    let tax = 0, prev = 0;
    for (const [upper, rate] of brackets) {
      if (income <= prev) break;
      tax += (Math.min(income, upper) - prev) * rate;
      prev = upper;
    }
    return tax;
  }

  private _ltcgTax(totalTi: number, pref: number, fs: FilingStatus): number {
    if (pref <= 0) return 0;
    const [zThresh, hiThresh] = this.p.ltcg_thresholds[fs] ?? [48350, 533400];
    const ordinaryBase = Math.max(0, totalTi - pref);
    const prefEnd = ordinaryBase + pref;
    let tax = 0;

    const band15Start = Math.max(ordinaryBase, zThresh);
    const band15End = Math.min(prefEnd, hiThresh);
    if (band15End > band15Start) tax += (band15End - band15Start) * 0.15;

    const band20Start = Math.max(ordinaryBase, hiThresh);
    if (prefEnd > band20Start) tax += (prefEnd - band20Start) * 0.20;

    return Math.max(0, tax);
  }

  private _credits(): void {
    const c = this.c;
    const fs = this.filingStatus();
    const agi = this.n("agi");
    const deps = toObjArr(toObj(this.data["dependents"])["dependents"]);

    const qualifying = deps.filter((d) => f(d["age_at_year_end"]) < 17);
    c["qualifying_children"] = qualifying.length;
    const ctcRaw = qualifying.length * this.p.child_tax_credit;
    const ctcThresh = this.p.ctc_phaseout[
      fs.includes("jointly") ? "married_filing_jointly" : "single"
    ] ?? 200000;
    const phaseout = Math.max(0, Math.floor((agi - ctcThresh + 999) / 1000)) * 50;
    c["child_tax_credit"] = Math.max(0, ctcRaw - phaseout);

    const otherDeps = deps.filter((d) => f(d["age_at_year_end"]) >= 17);
    c["other_dependent_credit"] = Math.min(otherDeps.length * 500, 1500);

    const care = deps.reduce((s, d) => {
      return s + f(d["daycare_cost"]) + f(d["after_school_care_cost"]) + f(d["summer_camp_cost"]);
    }, 0);
    c["care_expenses"] = care;
    const fsaOffset = this.n("dependent_care_fsa");
    const eligibleCare = Math.max(0, Math.min(care - fsaOffset, qualifying.length === 1 ? 3000 : 6000));
    c["child_care_credit"] = eligibleCare * 0.20;

    const tuition = deps
      .filter((d) => d["full_time_student"])
      .reduce((s, d) => {
        const edu = toObj(d["education"]);
        return s + f(edu["tuition_paid"] ?? d["tuition_paid"]);
      }, 0);
    c["tuition_expenses"] = tuition;
    c["education_credit"] = Math.min(tuition * 0.20, 2500);

    c["ev_credit"] = toObj(this.data["household"])["has_electric_vehicle"] ? 7500 : 0;
    c["saver_credit"] = 0;

    c["total_credits"] = (
      this.n("child_tax_credit") + this.n("other_dependent_credit") +
      this.n("child_care_credit") + this.n("education_credit") +
      this.n("ev_credit") + this.n("saver_credit")
    );

    c["income_tax_after_credits"] = Math.max(
      0,
      this.n("income_tax_before_credits") - this.n("total_credits")
    );
    c["total_tax"] = Math.max(0, this.n("income_tax_after_credits") + this.n("se_tax"));
  }

  private _payments(): void {
    const c = this.c;
    const hh = toObj(this.data["household"]);
    const payments = toObj(hh["payments"]);
    c["w2_withholding"] = this.n("federal_withheld");
    c["estimated_tax_payments"] = f(hh["estimated_tax_payments"] ?? payments["estimated_tax_payments"]);
    c["other_withholding"] = f(hh["other_withholding"] ?? payments["other_withholding"]);
    c["total_payments"] = (
      this.n("w2_withholding") + this.n("estimated_tax_payments") + this.n("other_withholding")
    );
  }

  private _balance(): void {
    const c = this.c;
    const net = this.n("total_payments") - this.n("total_tax");
    c["refund"] = Math.max(0, net);
    c["amount_owed"] = Math.max(0, -net);
    const agi = this.n("agi");
    c["effective_rate"] = agi ? Math.round((this.n("total_tax") / agi) * 10000) / 100 : 0;
    c["marginal_rate"] = this._marginalRate();
  }

  private _marginalRate(): number {
    const fs = this.filingStatus();
    const ti = this.n("taxable_income");
    const brackets = this.p.brackets[fs] ?? this.p.brackets["single"];
    for (const [upper, rate] of brackets) {
      if (ti <= upper) return Math.round(rate * 1000) / 10;
    }
    return 37.0;
  }
}
