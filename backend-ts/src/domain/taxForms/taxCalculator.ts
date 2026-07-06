import { AppError } from "../../lib/errors";

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
  salt_cap: Record<string, number>;
  salt_phase_threshold: number | null;
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
    salt_cap: { single: 10000, married_filing_jointly: 10000, married_filing_separately: 5000, head_of_household: 10000, qualifying_surviving_spouse: 10000 },
    salt_phase_threshold: null as null | number,
  },
  2025: {
    // OBBBA (2025): standard deduction raised to $15,750/$31,500/$23,625
    standard_deduction: {
      single: 15750,
      married_filing_jointly: 31500,
      married_filing_separately: 15750,
      head_of_household: 23625,
      qualifying_surviving_spouse: 31500,
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
    // OBBBA (2025): CTC raised to $2,200 per qualifying child
    child_tax_credit: 2200,
    ctc_phaseout: { single: 200000, married_filing_jointly: 400000 },
    niit_threshold: { single: 200000, married_filing_jointly: 250000 },
    amt_exemption: { single: 88100, married_filing_jointly: 137000 },
    // 2025: SALT cap raised to $40k/$20k (MFS) by OBBBA, with 5% phase-down above $500k/$250k AGI (floor: $10k/$5k)
    salt_cap: { single: 40000, married_filing_jointly: 40000, married_filing_separately: 20000, head_of_household: 40000, qualifying_surviving_spouse: 40000 },
    salt_phase_threshold: 500000 as null | number,
  },
};

function f(val: unknown): number {
  if (val == null) return 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function getParams(taxYear: number): TaxParams {
  const params = TAX_PARAMS[taxYear];
  if (!params) {
    // Refuse rather than silently compute with another year's numbers.
    throw new AppError(400, `Tax year ${taxYear} is not supported (supported: ${Object.keys(TAX_PARAMS).join(", ")})`);
  }
  return params;
}

function toObj(val: unknown): Record<string, unknown> {
  return val && typeof val === "object" && !Array.isArray(val) ? (val as Record<string, unknown>) : {};
}

function toObjArr(val: unknown): Record<string, unknown>[] {
  return Array.isArray(val) ? val.filter((x) => x && typeof x === "object") as Record<string, unknown>[] : [];
}

function _careRate(agi: number): number {
  const table: [number, number][] = [
    [15000, 0.35], [17000, 0.34], [19000, 0.33], [21000, 0.32],
    [23000, 0.31], [25000, 0.30], [27000, 0.29], [29000, 0.28],
    [31000, 0.27], [33000, 0.26], [35000, 0.25], [37000, 0.24],
    [39000, 0.23], [41000, 0.22], [43000, 0.21],
  ];
  for (const [limit, rate] of table) if (agi <= limit) return rate;
  return 0.20;
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
    this._identity();
    this._income();
    this._adjustments();
    this._agi();
    this._deductions();
    this._taxableIncome();
    this._tax();
    this._credits();
    this._scheduleH();
    this._payments();
    this._balance();
    return this.c;
  }

  private _identity(): void {
    const tp = toObj(toObj(this.data["household"])["taxpayer"]);
    const firstName = String(tp["first_name"] ?? "");
    const lastName  = String(tp["last_name"]  ?? "");
    this.c["taxpayer_name"] = [firstName, lastName].filter(Boolean).join(" ");
    this.c["taxpayer_ssn"]  = String(tp["ssn"] ?? "");
    this.c["_fs"] = this.filingStatus();
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

    // Lines 1b–1h: wages not on W-2
    const ow = toObj(inc["other_wages"]);
    c["household_employee_wages"] = f(ow["household_employee_wages"]);  // Line 1b
    c["tip_income_unreported"]    = f(ow["tip_income_unreported"]);     // Line 1c
    c["medicaid_waiver_payments"] = f(ow["medicaid_waiver_payments"]);  // Line 1d
    c["other_earned_income"]      = f(ow["other_earned_income"]);       // Line 1h

    const inv = toObj(inc["investment_income"]);
    c["taxable_interest"] = f(inv["interest"]);
    c["qualified_dividends"] = f(inv["qualified_dividends"]);
    c["ordinary_dividends"] = f(inv["ordinary_dividends"]);
    c["stcg"] = f(inv["short_term_capital_gains"]);
    c["ltcg"] = f(inv["long_term_capital_gains"]);
    c["capital_gains_net"] = this.n("stcg") + this.n("ltcg");
    // Schedule B Part III flags
    c["foreign_financial_account"] = Boolean(inv["foreign_financial_account"]);
    c["foreign_account_country"]   = String(inv["foreign_account_country"] ?? "");
    c["foreign_trust"]             = Boolean(inv["foreign_trust"]);

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
    c["taxable_refunds"] = f(other["taxable_refunds"]);
    c["alimony_received"] = f(other["alimony_received"]);
    c["alimony_date_of_divorce"] = String(other["alimony_date_of_divorce"] ?? "");

    // Farm income: prefer income.farm (detailed) over income.other_income.farm_income
    const farmSection = toObj(inc["farm"]);
    const farmNetFromSection = farmSection["net_profit"] !== undefined ? f(farmSection["net_profit"]) : null;
    c["farm_income"] = farmNetFromSection !== null ? farmNetFromSection : f(other["farm_income"]);
    c["farm_gross"] = f(farmSection["gross_revenue"] ?? Math.abs(Number(c["farm_income"])));
    c["farm_expenses"] = Math.max(0, Number(c["farm_gross"]) - Number(c["farm_income"]));
    c["farm_expense_details"] = toObj(farmSection["expense_details"] ?? {});
    c["farm_name"] = String(farmSection["farm_name"] ?? "");
    c["farm_principal_product"] = String(farmSection["principal_product"] ?? "");
    c["farm_naics"] = String(farmSection["naics_code"] ?? "111900");
    c["farm_ein"] = String(farmSection["ein"] ?? "");
    c["unemployment_compensation"] = f(other["unemployment_compensation"]);
    c["net_operating_loss"] = f(other["net_operating_loss"]);
    c["gambling_winnings"] = f(other["gambling_winnings"]);
    c["canceled_debt"] = f(other["canceled_debt"]);
    c["prizes_awards"] = f(other["prizes_awards"]);
    c["other_income_misc"] = f(other["other_amount"]);
    c["other_income_desc"] = other["other_description"] ?? "";

    // Line 8z combines prizes/awards and other misc (with generated description)
    c["line8z_amount"] = this.n("prizes_awards") + this.n("other_income_misc");
    c["line8z_desc"] = (() => {
      const hasPrizes = this.n("prizes_awards") > 0;
      const hasOther = this.n("other_income_misc") > 0;
      if (hasPrizes && hasOther) return `Prizes/Awards; ${String(c["other_income_desc"] || "Other")}`;
      if (hasPrizes) return "Prizes and awards";
      if (hasOther) return String(c["other_income_desc"] || "Other income");
      return "";
    })();

    // Line 9: sum of Lines 8a–8z only
    c["schedule1_line9"] = (
      this.n("net_operating_loss") +
      this.n("gambling_winnings") +
      this.n("canceled_debt") +
      this.n("line8z_amount")
    );

    // Line 10: Lines 1+2a+3+5+6+7+Line9 (total additional income)
    c["schedule1_additional"] = (
      this.n("taxable_refunds") +
      this.n("alimony_received") +
      this.n("schedule_c_profit") +
      this.n("schedule_e_net") +
      this.n("k1_ordinary") + this.n("k1_rental") + this.n("k1_guaranteed") +
      this.n("farm_income") +
      this.n("unemployment_compensation") +
      this.n("schedule1_line9")
    );

    c["total_income"] = (
      this.n("wages") +
      this.n("household_employee_wages") + this.n("tip_income_unreported") +
      this.n("medicaid_waiver_payments") + this.n("other_earned_income") +
      this.n("taxable_interest") + this.n("ordinary_dividends") +
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

      const expDetail = toObj(se["expense_details"] ?? biz["expense_details"] ?? {});
      out.push({
        business_name: name,
        entity_type: biz["entity_type"] ?? "",
        ein: biz["ein"] ?? "",
        naics: biz["naics_code"] ?? "",
        gross_revenue: grossRev,
        expenses: grossRev ? grossRev - netPl : 0,
        net_profit_loss: netPl,
        home_office: homeOffice,
        expense_details: expDetail,
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
          expense_details: toObj(se["expense_details"] ?? {}),
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
    const farmProfit = this.n("farm_income");   // Schedule F net profit flows to SE Line 1a
    const combinedSe = seProfit + farmProfit;
    if (combinedSe > 0) {
      const seNet = combinedSe * 0.9235;
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
    c["moving_expenses_military"] = f(adj["moving_expenses_military"]);
    c["sep_simple_contributions"] = f(adj["sep_simple_contributions"]);
    c["se_health_insurance"] = f(adj["self_employed_health_insurance"]);
    c["alimony_paid"] = f(adj["alimony_paid"]);
    c["alimony_recipient_ssn"] = String(adj["alimony_recipient_ssn"] ?? "");
    c["ira_deduction"] = f(adj["ira_deduction"]);
    c["other_adjustments_amount"] = f(adj["other_adjustments_amount"]);
    c["other_adjustments_desc"] = String(adj["other_adjustments_description"] ?? "");

    c["total_adjustments"] = (
      this.n("se_tax_deduction") + this.n("educator_expenses") +
      this.n("hsa_outside_payroll") + this.n("moving_expenses_military") +
      this.n("sep_simple_contributions") + this.n("se_health_insurance") +
      this.n("alimony_paid") + this.n("ira_deduction") +
      this.n("student_loan_interest") + this.n("other_adjustments_amount")
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
    const saltCapBase = this.p.salt_cap[fs] ?? (fs.includes("separately") ? 5000 : 10000);
    const saltFloor = fs.includes("separately") ? 5000 : 10000;
    const saltPhaseThresh = this.p.salt_phase_threshold;
    const saltPhasedown = saltPhaseThresh != null
      ? Math.max(0, (agi - (fs.includes("separately") ? saltPhaseThresh / 2 : saltPhaseThresh)) * 0.05)
      : 0;
    const saltCap = Math.max(saltFloor, saltCapBase - saltPhasedown);
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
    const ctcPerChild = this.p.child_tax_credit;
    const ctcRaw = qualifying.length * ctcPerChild;
    const ctcThresh = this.p.ctc_phaseout[
      fs.includes("jointly") ? "married_filing_jointly" : "single"
    ] ?? 200000;
    const phaseout = Math.max(0, Math.floor((agi - ctcThresh + 999) / 1000)) * 50;
    c["child_tax_credit"] = Math.max(0, ctcRaw - phaseout);
    c["ctc_per_child"] = ctcPerChild;
    c["ctc_phaseout_threshold"] = ctcThresh;

    const otherDeps = deps.filter((d) => f(d["age_at_year_end"]) >= 17);
    c["other_dependent_count"] = otherDeps.length;
    c["other_dependent_credit"] = otherDeps.length * 500;

    // ctc_with_odc must be set before care credit (care credit limit depends on it)
    c["ctc_with_odc"] = this.n("child_tax_credit") + this.n("other_dependent_credit");

    // Support nested care_expenses sub-object (real app) and flat format (tests)
    const care = deps.reduce((s, d) => {
      const ce = toObj(d["care_expenses"]);
      return s + f(ce["daycare_cost"] ?? d["daycare_cost"])
               + f(ce["after_school_care_cost"] ?? d["after_school_care_cost"])
               + f(ce["summer_camp_cost"] ?? d["summer_camp_cost"]);
    }, 0);
    c["care_expenses"] = care;
    const fsaOffset = this.n("dependent_care_fsa");
    const eligibleCare = Math.max(0, Math.min(care - fsaOffset, qualifying.length === 1 ? 3000 : 6000));
    c["care_eligible_expenses"] = eligibleCare;
    const careRate = _careRate(agi);
    c["care_credit_rate"] = careRate;
    const careCreditLimit = Math.max(0, this.n("income_tax_before_credits") - this.n("ctc_with_odc"));
    c["care_credit_limit"] = careCreditLimit;
    c["child_care_credit"] = Math.min(eligibleCare * careRate, careCreditLimit);

    // Net tuition = paid minus scholarships (per IRS adjusted qualified expenses)
    const tuitionNet = deps
      .filter((d) => d["full_time_student"])
      .reduce((s, d) => {
        const edu = toObj(d["education"]);
        const paid = f(edu["tuition_paid"] ?? d["tuition_paid"]);
        const schol = f(edu["scholarships_received"] ?? d["scholarships_received"]);
        return s + Math.max(0, paid - schol);
      }, 0);
    c["tuition_expenses"] = tuitionNet;
    c["llc_expenses"] = Math.min(tuitionNet, 10000); // LLC cap: $10k per return

    // LLC phaseout: $80k-$90k single / $160k-$180k MFJ
    const eduThresh = fs.includes("jointly") ? 180000 : 90000;
    const eduRange = fs.includes("jointly") ? 20000 : 10000;
    const eduRemaining = Math.max(0, eduThresh - agi);
    const eduFraction = eduRemaining >= eduRange ? 1.0 : (eduRange > 0 ? eduRemaining / eduRange : 0);
    c["education_phaseout_threshold"] = eduThresh;
    c["education_phaseout_range"] = eduRange;
    c["education_phaseout_fraction"] = eduFraction;

    c["education_credit"] = Math.round(this.n("llc_expenses") * 0.20 * eduFraction * 100) / 100;

    c["ev_credit"] = toObj(this.data["household"])["has_electric_vehicle"] ? 7500 : 0;
    c["saver_credit"] = 0;

    // §25D + §25C from energy_credits on the primary residence
    const props = toObjArr(toObj(this.data["real_estate"])["properties"]);
    const primaryProp = props.find((p) => p["property_type"] === "primary_residence") ?? {};
    const energy = toObj(primaryProp["energy_credits"]);

    const solarElec   = f(energy["solar_electric_cost"]);
    const solarWater  = f(energy["solar_water_cost"]);
    const wind        = f(energy["wind_cost"]);
    const geothermal  = f(energy["geothermal_cost"]);
    const battery     = f(energy["battery_cost"]);
    const total25d    = solarElec + solarWater + wind + geothermal + battery;
    const credit25dRaw = Math.round(total25d * 0.30);

    const insulation    = f(energy["insulation_cost"]);
    const door          = f(energy["door_cost"]);
    const window        = f(energy["window_cost"]);
    const ac            = f(energy["central_ac_cost"]);
    const waterHeater   = f(energy["water_heater_cost"]);
    const furnace       = f(energy["furnace_cost"]);
    const audit         = f(energy["home_energy_audit_cost"]);
    const heatPump      = f(energy["heat_pump_cost"]);
    const heatPumpWh    = f(energy["heat_pump_wh_cost"]);
    const biomass       = f(energy["biomass_cost"]);

    // Per-category §25C caps
    const insulationCr  = Math.min(insulation  * 0.30, 1200);
    const doorCr        = Math.min(door        * 0.30, 500);
    const windowCr      = Math.min(window      * 0.30, 600);
    const acCr          = Math.min(ac          * 0.30, 600);
    const waterHeaterCr = Math.min(waterHeater * 0.30, 600);
    const furnaceCr     = Math.min(furnace     * 0.30, 600);
    const auditCr       = Math.min(audit       * 0.30, 150);
    // Annual $1,200 aggregate cap (line 28)
    const subtotal1200  = Math.min(insulationCr + doorCr + windowCr + acCr + waterHeaterCr + furnaceCr + auditCr, 1200);
    // Separate $2,000 cap for heat pumps + biomass (line 29h)
    const heatPumpCr    = Math.min((heatPump + heatPumpWh + biomass) * 0.30, 2000);
    const credit25cRaw  = subtotal1200 + heatPumpCr;

    // Both credits nonrefundable — limited by remaining tax liability
    const otherNonref = this.n("child_care_credit") + this.n("education_credit") + this.n("ev_credit") + this.n("saver_credit");
    const energyLimit = Math.max(0, this.n("income_tax_before_credits") - this.n("ctc_with_odc") - otherNonref);
    const cleanEnergyCr = Math.min(credit25dRaw, energyLimit);
    c["clean_energy_credit"] = cleanEnergyCr;
    c["clean_energy_carryforward"] = Math.max(0, credit25dRaw - cleanEnergyCr);
    const remainingAfter25d = Math.max(0, energyLimit - cleanEnergyCr);

    // Intermediates passed through to fill function
    c["f5695_solar_cost"]       = solarElec;
    c["f5695_solar_water_cost"] = solarWater;
    c["f5695_wind_cost"]        = wind;
    c["f5695_geothermal_cost"]  = geothermal;
    c["f5695_battery_cost"]     = battery;
    c["f5695_25d_total"]        = total25d;
    c["f5695_25d_times_30"]     = credit25dRaw;
    c["f5695_insulation_cost"]  = insulation;
    c["f5695_insulation_cr"]    = insulationCr;
    c["f5695_door_cost"]        = door;
    c["f5695_door_cr"]          = doorCr;
    c["f5695_window_cost"]      = window;
    c["f5695_window_cr"]        = windowCr;
    c["f5695_ac_cost"]          = ac;
    c["f5695_ac_cr"]            = acCr;
    c["f5695_wh_cost"]          = waterHeater;
    c["f5695_wh_cr"]            = waterHeaterCr;
    c["f5695_furnace_cost"]     = furnace;
    c["f5695_furnace_cr"]       = furnaceCr;
    c["f5695_audit_cost"]       = audit;
    c["f5695_audit_cr"]         = auditCr;
    c["f5695_heat_pump_cost"]   = heatPump;
    c["f5695_heat_pump_wh_cost"]= heatPumpWh;
    c["f5695_biomass_cost"]     = biomass;
    c["f5695_heat_pump_all"]    = heatPump + heatPumpWh + biomass;
    c["f5695_heat_pump_cr"]     = heatPumpCr;
    c["f5695_subtotal_1200"]    = subtotal1200;
    c["f5695_25c_raw"]          = credit25cRaw;
    c["f5695_energy_limit"]     = energyLimit;

    // Schedule 3 Line 8: child care + education + §25D + §25C + EV + saver → Form 1040 Line 20
    const homeImproveCr = Math.min(credit25cRaw, remainingAfter25d);
    c["home_improvement_credit"] = homeImproveCr;
    c["schedule3_line8"] = (
      this.n("child_care_credit") + this.n("education_credit") +
      cleanEnergyCr + homeImproveCr +
      this.n("ev_credit") + this.n("saver_credit")
    );

    c["total_credits"] = this.n("ctc_with_odc") + this.n("schedule3_line8");

    c["income_tax_after_credits"] = Math.max(
      0,
      this.n("income_tax_before_credits") - this.n("total_credits")
    );
    c["total_tax"] = Math.max(0, this.n("income_tax_after_credits") + this.n("se_tax"));

    // Additional Child Tax Credit (refundable) — simplified Credit Limit Worksheet A.
    // The credit limit for CTC is the tax before Schedule 3 credits (not after), matching IRS
    // worksheet A which is applied before other nonrefundable credits reduce the liability.
    const odc = this.n("other_dependent_credit");
    const ctcAfterPhaseout = this.n("child_tax_credit");
    const ctcNonref = Math.min(ctcAfterPhaseout, Math.max(0, this.n("income_tax_before_credits") - odc));
    const ctcUnused = Math.max(0, ctcAfterPhaseout - ctcNonref);
    const earnedIncome = (
      this.n("wages") + this.n("household_employee_wages") +
      this.n("tip_income_unreported") + this.n("other_earned_income") +
      Math.max(0, this.n("schedule_c_profit"))
    );
    c["earned_income"] = earnedIncome;
    const actcFromEarned = Math.max(0, earnedIncome - 2500) * 0.15;
    c["additional_ctc"] = qualifying.length > 0 && ctcUnused > 0
      ? Math.min(qualifying.length * 1700, actcFromEarned, ctcUnused)
      : 0;
  }

  private _scheduleH(): void {
    const c = this.c;
    const hh = toObj(this.data["household"]);
    const emp = toObj(hh["household_employment"]);
    const employees = toObjArr(emp["employees"]);

    const totalWages = employees.reduce((s, e) => s + f(e["total_wages"]), 0);
    const fedWithheld = f(emp["total_fed_tax_withheld"]);
    c["sch_h_total_wages"] = totalWages;
    c["sch_h_fed_withheld"] = fedWithheld;

    let part1Total = 0;
    const SS_THRESHOLD = 2800; // 2025 threshold for SS/Medicare withholding
    if (totalWages >= SS_THRESHOLD) {
      const ssWages = Math.min(totalWages, this.p.se_ss_wage_base);
      const ssTax = Math.round(ssWages * 0.124);
      const medicareTax = Math.round(totalWages * 0.029);
      c["sch_h_ss_wages"] = ssWages;
      c["sch_h_ss_tax"] = ssTax;
      c["sch_h_medicare_wages"] = totalWages;
      c["sch_h_medicare_tax"] = medicareTax;
      part1Total = ssTax + medicareTax + fedWithheld;
    }
    c["sch_h_part1_total"] = part1Total;

    // FUTA: 6% on first $7,000 per employee; with max state credit (5.4%), net = 0.6%
    let futaTotal = 0;
    const stateUnempPaid = Boolean(emp["state_unemployment_paid"] ?? true);
    if (totalWages > 0 && stateUnempPaid) {
      const futaWages = employees.reduce((s, e) => s + Math.min(f(e["total_wages"]), 7000), 0);
      const futaGross = Math.round(futaWages * 0.06);
      const stateContr = Math.round(futaWages * 0.054);
      futaTotal = Math.round(futaWages * 0.006); // net 0.6% after max credit
      c["sch_h_futa_wages"] = futaWages;
      c["sch_h_futa_gross"] = futaGross;
      c["sch_h_state"] = String(emp["state"] ?? "");
      c["sch_h_state_contr"] = stateContr;
      c["sch_h_futa_net"] = futaTotal;
    }

    const hhEmpTax = part1Total + futaTotal;
    c["household_employment_tax"] = hhEmpTax;
    c["sch_h_total"] = hhEmpTax;

    // Update total_tax to include household employment taxes
    if (hhEmpTax > 0) {
      c["total_tax"] = Math.max(0, this.n("total_tax") + hhEmpTax);
    }
  }

  private _payments(): void {
    const c = this.c;
    const hh = toObj(this.data["household"]);
    const payments = toObj(hh["payments"]);
    c["w2_withholding"] = this.n("federal_withheld");
    c["estimated_tax_payments"] = f(hh["estimated_tax_payments"] ?? payments["estimated_tax_payments"]);
    c["other_withholding"] = f(hh["other_withholding"] ?? payments["other_withholding"]);
    // EIC is a refundable credit; goes on Form 1040 Line 27 in the payments section
    c["earned_income_credit"] = f(hh["earned_income_credit"] ?? payments["earned_income_credit"]);
    c["total_payments"] = (
      this.n("w2_withholding") + this.n("estimated_tax_payments") +
      this.n("other_withholding") + this.n("earned_income_credit") +
      this.n("additional_ctc")
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
