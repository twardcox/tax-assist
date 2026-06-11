/**
 * TaxCalculator regression tests — 2025 tax year
 *
 * Each scenario targets specific data paths through the calculator.
 * Expected values are hand-calculated; assertions use toBeCloseTo(n, 2)
 * meaning within ±$0.005 (i.e., exact to the cent for integer inputs).
 *
 * Covered paths:
 *   Income   — W2 wages, investment (interest/divs/STCG/LTCG), retirement
 *              (IRA/pension/401k), social security §86, Schedule C (SE),
 *              Schedule E (rental), K-1 (ordinary/rental/guaranteed),
 *              other income (alimony/gambling/prizes/canceled debt)
 *   Adj      — SE tax deduction, educator ($300 cap), student loan, HSA,
 *              SE health insurance, IRA deduction, alimony paid, military
 *   Ded      — Standard by status, age-65 & blind extra, itemized (SALT cap
 *              $10k/$5k MFS, mortgage interest, charitable, medical 7.5%),
 *              QBI deduction (20% of Sch C + K-1 ordinary)
 *   Tax      — All 7 ordinary brackets, LTCG at 0%/15%/20%, NIIT (3.8%),
 *              additional Medicare (0.9%), SE tax (SS+Medicare; Medicare-only
 *              when W2 already fills SS wage base)
 *   Credits  — CTC, CTC phaseout, other-dependent ($500), child/dependent care,
 *              FSA offset on care credit, education, EV ($7,500)
 *   Payments — W2 withholding, estimated tax, other withholding
 *   Status   — single, MFJ, MFS, HOH
 */

import { describe, expect, test } from "vitest";
import { TaxCalculator } from "../src/domain/taxForms/taxCalculator";

const Y = 2025;

function run(data: Record<string, unknown>) {
  return new TaxCalculator(data, Y).compute();
}

/** Build a minimal complete data object; every field defaults to empty/zero. */
function d(o: {
  fs?: string;
  taxpayer?: Record<string, unknown>;
  householdExtra?: Record<string, unknown>;
  w2?: Array<Record<string, unknown>>;
  se?: Array<Record<string, unknown>>;
  rental?: Array<Record<string, unknown>>;
  investment?: Record<string, unknown>;
  retirement?: Record<string, unknown>;
  ss?: Record<string, unknown>;
  adj?: Record<string, unknown>;
  passive?: Record<string, unknown>;
  other?: Record<string, unknown>;
  businesses?: Array<Record<string, unknown>>;
  properties?: Array<Record<string, unknown>>;
  deps?: Array<Record<string, unknown>>;
  goals?: Record<string, unknown>;
  healthcare?: Record<string, unknown>;
} = {}): Record<string, unknown> {
  return {
    household: {
      filing_status: o.fs ?? "single",
      taxpayer: { age: 40, ...o.taxpayer },
      ...o.householdExtra,
    },
    income: {
      w2_employment:         o.w2        ?? [],
      self_employment:       o.se        ?? [],
      rental_income:         o.rental    ?? [],
      investment_income:     o.investment  ?? {},
      retirement_distributions: o.retirement ?? {},
      social_security:       o.ss        ?? {},
      adjustments_to_income: o.adj       ?? {},
      passive_income:        o.passive   ?? {},
      other_income:          o.other     ?? {},
    },
    businesses: { businesses: o.businesses ?? [] },
    real_estate: { properties: o.properties ?? [] },
    dependents:  { dependents: o.deps ?? [] },
    goals:       o.goals       ?? {},
    healthcare:  o.healthcare  ?? {},
  };
}

// ─── 1. Simple W2 · single ────────────────────────────────────────────────────
describe("scenario 1 · W2 only · single · basic brackets", () => {
  // wages=60000, withheld=8000
  // taxable = 60000 - 15000(std) = 45000
  // tax = 11925×0.10 + 33075×0.12 = 1192.50 + 3969.00 = 5161.50
  const c = run(d({
    w2: [{ wages: 60000, federal_withheld: 8000, state_withheld: 0 }],
  }));

  test("wages & federal_withheld", () => {
    expect(c.wages).toBeCloseTo(60000, 2);
    expect(c.federal_withheld).toBeCloseTo(8000, 2);
  });
  test("total_income and agi", () => {
    expect(c.total_income).toBeCloseTo(60000, 2);
    expect(c.agi).toBeCloseTo(60000, 2);
  });
  test("standard deduction used", () => {
    expect(c.standard_deduction).toBeCloseTo(15000, 2);
    expect(c.using_standard).toBe(true);
    expect(c.deduction).toBeCloseTo(15000, 2);
  });
  test("taxable_income and qbi_deduction=0", () => {
    expect(c.taxable_income).toBeCloseTo(45000, 2);
    expect(c.qbi_deduction).toBeCloseTo(0, 2);
  });
  test("ordinary_tax = 5161.50", () => expect(c.ordinary_tax).toBeCloseTo(5161.50, 2));
  test("no se_tax / ltcg_tax / niit / addl_medicare", () => {
    expect(c.se_tax).toBeCloseTo(0, 2);
    expect(c.ltcg_tax).toBeCloseTo(0, 2);
    expect(c.niit).toBeCloseTo(0, 2);
    expect(c.addl_medicare_tax).toBeCloseTo(0, 2);
  });
  test("total_tax = 5161.50", () => expect(c.total_tax).toBeCloseTo(5161.50, 2));
  test("total_payments = 8000  →  refund = 2838.50", () => {
    expect(c.total_payments).toBeCloseTo(8000, 2);
    expect(c.refund).toBeCloseTo(2838.50, 2);
    expect(c.amount_owed).toBeCloseTo(0, 2);
  });
  test("effective_rate = 8.60, marginal_rate = 12.0", () => {
    expect(c.effective_rate).toBeCloseTo(8.60, 1);
    expect(c.marginal_rate).toBe(12.0);
  });
});

// ─── 2. MFJ · LTCG at 0% rate ────────────────────────────────────────────────
describe("scenario 2 · MFJ · LTCG taxed at 0%", () => {
  // wages=75000, ord_div=8000, qual_div=8000, ltcg=18000 → TI=71000
  // preferred=26000, ordinary=45000 (< MFJ $96,700 0%-LTCG threshold)
  // ordinary_tax = 23850×0.10 + 21150×0.12 = 2385 + 2538 = 4923
  // ltcg_tax = 0 (all preferred income under threshold)
  const c = run(d({
    fs: "married_filing_jointly",
    w2: [{ wages: 75000, federal_withheld: 12000 }],
    investment: { ordinary_dividends: 8000, qualified_dividends: 8000, long_term_capital_gains: 18000 },
  }));

  test("capital_gains_net = 18000", () => expect(c.capital_gains_net).toBeCloseTo(18000, 2));
  test("total_income = 101000", () => expect(c.total_income).toBeCloseTo(101000, 2));
  test("MFJ standard deduction = 30000", () => expect(c.standard_deduction).toBeCloseTo(30000, 2));
  test("taxable_income = 71000", () => expect(c.taxable_income).toBeCloseTo(71000, 2));
  test("ordinary_tax = 4923", () => expect(c.ordinary_tax).toBeCloseTo(4923, 2));
  test("ltcg_tax = 0 (preferred income under MFJ $96,700 threshold)", () =>
    expect(c.ltcg_tax).toBeCloseTo(0, 2));
  test("total_tax = 4923", () => expect(c.total_tax).toBeCloseTo(4923, 2));
});

// ─── 3. Single · LTCG at 15% rate ────────────────────────────────────────────
describe("scenario 3 · single · LTCG taxed at 15%", () => {
  // wages=100000, ord_div=12000, qual_div=12000, ltcg=40000 → TI=137000
  // preferred=52000, ordinary=85000 (> single $48,350 0%-threshold)
  // ordinary_tax = 11925×0.10 + 36550×0.12 + 36525×0.22 = 13614
  // ltcg_tax = 52000×0.15 = 7800 (all preferred in 15% band)
  const c = run(d({
    w2: [{ wages: 100000, federal_withheld: 20000 }],
    investment: { ordinary_dividends: 12000, qualified_dividends: 12000, long_term_capital_gains: 40000 },
  }));

  test("preferred income captured", () => {
    expect(c.qualified_dividends).toBeCloseTo(12000, 2);
    expect(c.ltcg).toBeCloseTo(40000, 2);
  });
  test("taxable_income = 137000", () => expect(c.taxable_income).toBeCloseTo(137000, 2));
  test("ordinary_tax = 13614", () => expect(c.ordinary_tax).toBeCloseTo(13614, 2));
  test("ltcg_tax = 7800", () => expect(c.ltcg_tax).toBeCloseTo(7800, 2));
  test("total_tax = 21414", () => expect(c.total_tax).toBeCloseTo(21414, 2));
});

// ─── 4. Self-employed · Schedule C · SE tax · QBID ───────────────────────────
describe("scenario 4 · self-employed · SE tax · QBI deduction", () => {
  // Sch C net profit = 70000, SE health ins = 8000
  // seNet = 70000×0.9235 = 64645
  // se_tax = 64645×0.124 + 64645×0.029 = 8015.98 + 1874.705 = 9890.685
  // se_tax_deduction = 4945.3425
  // agi = 70000 - 4945.3425 - 8000 = 57054.6575
  // qbi_deduction = min(14000, 42054.6575×0.20) = 8410.9315
  // taxable = 57054.6575 - 15000 - 8410.9315 = 33643.726
  // ordinary_tax = 11925×0.10 + 21718.726×0.12 = 1192.50 + 2606.25 = 3798.75
  // total_tax = 3798.75 + 9890.685 = 13689.43
  const c = run(d({
    businesses: [{ name: "Consulting Co", entity_type: "sole_prop", financials: { gross_revenue: 90000, net_profit_loss: 70000 } }],
    adj: { self_employed_health_insurance: 8000 },
  }));

  test("schedule_c_profit = 70000", () => expect(c.schedule_c_profit).toBeCloseTo(70000, 2));
  test("se_tax ≈ 9890.69", () => expect(c.se_tax).toBeCloseTo(9890.685, 2));
  test("se_tax_deduction ≈ 4945.34", () => expect(c.se_tax_deduction).toBeCloseTo(4945.3425, 2));
  test("total_adjustments ≈ 12945.34", () => expect(c.total_adjustments).toBeCloseTo(12945.3425, 2));
  test("agi ≈ 57054.66", () => expect(c.agi).toBeCloseTo(57054.6575, 2));
  test("qbi_deduction ≈ 8410.93", () => expect(c.qbi_deduction).toBeCloseTo(8410.9315, 2));
  test("taxable_income ≈ 33643.73", () => expect(c.taxable_income).toBeCloseTo(33643.726, 2));
  test("ordinary_tax ≈ 3798.75", () => expect(c.ordinary_tax).toBeCloseTo(3798.747, 2));
  test("total_tax ≈ 13689.43", () => expect(c.total_tax).toBeCloseTo(13689.432, 2));
});

// ─── 5. Retirement distributions + Social Security (85% taxable) ──────────────
describe("scenario 5 · retirement + social security · 85% SS taxable", () => {
  // pension=20000, 401k=15000 → pension_gross=35000
  // ira=10000 → ira_taxable=10000
  // ss_gross=28000
  // combined for §86 = ira(10000)+pension(35000)+ss×0.5(14000) = 59000
  // 59000 > upper(34000 single):
  //   ss_taxable = min(28000×0.85, (34000-25000)×0.5 + (59000-34000)×0.85)
  //              = min(23800, 4500+21250) = 23800
  // total_income = 10000+35000+23800 = 68800
  // taxable = 53800
  // ordinary_tax = 11925×0.10 + 36550×0.12 + 5325×0.22 = 1192.50+4386+1171.50 = 6750
  const c = run(d({
    retirement: { pension: 20000, traditional_401k: 15000, traditional_ira: 10000 },
    ss: { gross_benefits: 28000 },
  }));

  test("pension_gross = 35000 (pension + 401k)", () => expect(c.pension_gross).toBeCloseTo(35000, 2));
  test("ira_taxable = 10000", () => expect(c.ira_taxable).toBeCloseTo(10000, 2));
  test("ss_taxable = 23800 (85% capped)", () => expect(c.ss_taxable).toBeCloseTo(23800, 2));
  test("total_income = 68800", () => expect(c.total_income).toBeCloseTo(68800, 2));
  test("taxable_income = 53800", () => expect(c.taxable_income).toBeCloseTo(53800, 2));
  test("ordinary_tax = 6750", () => expect(c.ordinary_tax).toBeCloseTo(6750, 2));
});

// ─── 6. Social Security — below MFJ threshold (0% taxable) ──────────────────
describe("scenario 6 · SS only · MFJ · below §86 threshold", () => {
  // ss_gross=28000, no other income
  // combined = 28000×0.5 = 14000 < MFJ base (32000) → ss_taxable = 0
  const c = run(d({
    fs: "married_filing_jointly",
    ss: { gross_benefits: 28000 },
  }));

  test("ss_taxable = 0", () => expect(c.ss_taxable).toBeCloseTo(0, 2));
  test("total_income = 0", () => expect(c.total_income).toBeCloseTo(0, 2));
  test("taxable_income = 0", () => expect(c.taxable_income).toBeCloseTo(0, 2));
  test("total_tax = 0", () => expect(c.total_tax).toBeCloseTo(0, 2));
});

// ─── 7. Itemized deductions (MFJ) ─────────────────────────────────────────────
describe("scenario 7 · MFJ · itemized deductions", () => {
  // wages=160000, state_withheld=14000
  // prop_tax=9000 → SALT = min(23000, 10000) = 10000
  // mortgage_interest=24000, charitable=7000
  // medical_total=22000 → deductible = max(0, 22000-160000×0.075) = 10000
  // itemized = 10000+24000+7000+10000 = 51000 > standard(30000)
  // taxable = 160000-51000 = 109000
  // MFJ tax = 23850×0.10 + 73100×0.12 + 12050×0.22 = 2385+8772+2651 = 13808
  const c = run(d({
    fs: "married_filing_jointly",
    w2: [{ wages: 160000, state_withheld: 14000 }],
    properties: [{ financing: { property_tax_paid: 9000, mortgage_interest_paid: 24000 } }],
    goals: { charitable_giving_annual: 7000 },
    healthcare: { out_of_pocket_expenses: 22000 },
  }));

  test("SALT capped at 10000", () => expect(c.salt).toBeCloseTo(10000, 2));
  test("mortgage_interest = 24000", () => expect(c.mortgage_interest).toBeCloseTo(24000, 2));
  test("charitable = 7000", () => expect(c.charitable).toBeCloseTo(7000, 2));
  test("medical_deductible = 10000 (above 7.5% floor)", () =>
    expect(c.medical_deductible).toBeCloseTo(10000, 2));
  test("itemized = 51000", () => expect(c.itemized).toBeCloseTo(51000, 2));
  test("itemized beats standard → using_standard = false", () => expect(c.using_standard).toBe(false));
  test("deduction = 51000", () => expect(c.deduction).toBeCloseTo(51000, 2));
  test("taxable_income = 109000", () => expect(c.taxable_income).toBeCloseTo(109000, 2));
  test("ordinary_tax = 13808", () => expect(c.ordinary_tax).toBeCloseTo(13808, 2));
});

// ─── 8. NIIT + Additional Medicare (single, >$200k) ──────────────────────────
describe("scenario 8 · single · NIIT + additional Medicare tax", () => {
  // wages=220000, interest=8000, ord_div=6000, qual_div=6000, ltcg=25000, rental=15000
  // schedule1_additional = 15000; total_income = 274000; agi = 274000
  // addl_medicare: (220000-200000)×0.009 = 180
  // nii = 8000+6000+25000+15000 = 54000; agiOver=74000
  // NIIT = min(54000,74000)×0.038 = 54000×0.038 = 2052
  // ordinary=228000; tax=11925×0.10+36550×0.12+54875×0.22+93950×0.24+30700×0.32=50023
  // LTCG at 15%: 31000×0.15=4650
  // income_tax_before_credits = 50023+4650+180+2052 = 56905
  const c = run(d({
    w2: [{ wages: 220000, federal_withheld: 55000 }],
    investment: { interest: 8000, ordinary_dividends: 6000, qualified_dividends: 6000, long_term_capital_gains: 25000 },
    rental: [{ net_income_loss: 15000 }],
  }));

  test("schedule_e_net = 15000", () => expect(c.schedule_e_net).toBeCloseTo(15000, 2));
  test("agi = 274000", () => expect(c.agi).toBeCloseTo(274000, 2));
  test("addl_medicare_tax = 180", () => expect(c.addl_medicare_tax).toBeCloseTo(180, 2));
  test("niit = 2052", () => expect(c.niit).toBeCloseTo(2052, 2));
  test("ordinary_tax = 50023", () => expect(c.ordinary_tax).toBeCloseTo(50023, 2));
  test("ltcg_tax = 4650", () => expect(c.ltcg_tax).toBeCloseTo(4650, 2));
  test("income_tax_before_credits = 56905", () =>
    expect(c.income_tax_before_credits).toBeCloseTo(56905, 2));
});

// ─── 9. Credits sweep (MFJ) ───────────────────────────────────────────────────
describe("scenario 9 · MFJ · all credits (CTC, care, education, EV)", () => {
  // wages=90000; AGI=90000; std=30000; taxable=60000
  // ordinary_tax = 23850×0.10 + 36150×0.12 = 2385+4338 = 6723
  // 2 qualifying children (<17): CTC=4000
  // 1 non-qualifying (age 20, full-time student): other_dep=500, education_credit=min(1800,2500)=1800
  // care=5000+2000=7000; cap(2 kids)=6000 → eligible=6000 → care_credit=1200
  // ev_credit=7500
  // total_credits = 4000+500+1800+1200+7500 = 15000
  // income_tax_after_credits = max(0, 6723-15000) = 0
  const c = run(d({
    fs: "married_filing_jointly",
    w2: [{ wages: 90000, federal_withheld: 10000 }],
    householdExtra: { has_electric_vehicle: true },
    deps: [
      { age_at_year_end: 6,  relationship: "child", daycare_cost: 5000 },
      { age_at_year_end: 14, relationship: "child", after_school_care_cost: 2000 },
      { age_at_year_end: 20, relationship: "child", full_time_student: true,
        education: { tuition_paid: 9000 } },
    ],
  }));

  test("qualifying_children = 2", () => expect(c.qualifying_children).toBe(2));
  test("child_tax_credit = 4000", () => expect(c.child_tax_credit).toBeCloseTo(4000, 2));
  test("other_dependent_credit = 500", () => expect(c.other_dependent_credit).toBeCloseTo(500, 2));
  test("child_care_credit = 1200 (care capped at 6000 for 2 kids)", () =>
    expect(c.child_care_credit).toBeCloseTo(1200, 2));
  test("education_credit = 1800", () => expect(c.education_credit).toBeCloseTo(1800, 2));
  test("ev_credit = 7500", () => expect(c.ev_credit).toBeCloseTo(7500, 2));
  test("total_credits = 15000", () => expect(c.total_credits).toBeCloseTo(15000, 2));
  test("income_tax_after_credits = 0 (credits exceed tax)", () =>
    expect(c.income_tax_after_credits).toBeCloseTo(0, 2));
  test("total_tax = 0", () => expect(c.total_tax).toBeCloseTo(0, 2));
  test("refund = 10000 (withholding only)", () => expect(c.refund).toBeCloseTo(10000, 2));
});

// ─── 10. CTC phaseout (MFJ > $400k) ──────────────────────────────────────────
describe("scenario 10 · MFJ · child tax credit phaseout", () => {
  // wages=420000; 3 qualifying children → raw CTC=6000
  // phaseout = floor((420000-400000+999)/1000)×50 = 20×50 = 1000
  // child_tax_credit = 6000-1000 = 5000
  const c = run(d({
    fs: "married_filing_jointly",
    w2: [{ wages: 420000 }],
    deps: [
      { age_at_year_end: 5,  relationship: "child" },
      { age_at_year_end: 10, relationship: "child" },
      { age_at_year_end: 15, relationship: "child" },
    ],
  }));

  test("child_tax_credit = 5000 after phaseout", () =>
    expect(c.child_tax_credit).toBeCloseTo(5000, 2));
});

// ─── 11. FSA offsets dependent care credit ───────────────────────────────────
describe("scenario 11 · dependent care FSA offsets care credit", () => {
  // 1 qualifying child, daycare=6000, FSA=4000
  // eligible = max(0, min(6000-4000, 3000)) = 2000
  // child_care_credit = 2000×0.20 = 400
  const c = run(d({
    w2: [{ wages: 80000, dependent_care_fsa: 4000 }],
    deps: [{ age_at_year_end: 4, relationship: "child", daycare_cost: 6000 }],
  }));

  test("dependent_care_fsa = 4000", () => expect(c.dependent_care_fsa).toBeCloseTo(4000, 2));
  test("child_care_credit = 400 (FSA reduced eligible care to 2000)", () =>
    expect(c.child_care_credit).toBeCloseTo(400, 2));
});

// ─── 12. Above-the-line adjustments sweep ────────────────────────────────────
describe("scenario 12 · all above-the-line adjustments", () => {
  // educator_expenses=500 → capped at 300
  // student_loan=2500, hsa=3000, se_health=1500, ira=6500, alimony=12000, military=3000
  // total_adjustments = 300+2500+3000+1500+6500+12000+3000 = 28800
  // agi = 80000-28800 = 51200
  const c = run(d({
    w2: [{ wages: 80000 }],
    adj: {
      educator_expenses: 500,
      student_loan_interest: 2500,
      hsa_contributions_outside_payroll: 3000,
      self_employed_health_insurance: 1500,
      ira_deduction: 6500,
      alimony_paid: 12000,
      moving_expenses_military: 3000,
    },
  }));

  test("educator_expenses capped at 300", () => expect(c.educator_expenses).toBeCloseTo(300, 2));
  test("student_loan_interest = 2500", () => expect(c.student_loan_interest).toBeCloseTo(2500, 2));
  test("hsa_outside_payroll = 3000", () => expect(c.hsa_outside_payroll).toBeCloseTo(3000, 2));
  test("se_health_insurance = 1500", () => expect(c.se_health_insurance).toBeCloseTo(1500, 2));
  test("ira_deduction = 6500", () => expect(c.ira_deduction).toBeCloseTo(6500, 2));
  test("alimony_paid = 12000", () => expect(c.alimony_paid).toBeCloseTo(12000, 2));
  test("moving_expenses_military = 3000", () =>
    expect(c.moving_expenses_military).toBeCloseTo(3000, 2));
  test("total_adjustments = 28800", () => expect(c.total_adjustments).toBeCloseTo(28800, 2));
  test("agi = 51200", () => expect(c.agi).toBeCloseTo(51200, 2));
});

// ─── 13. Age 65 + blind — extra standard deduction ───────────────────────────
describe("scenario 13 · single · age 67 + blind → extra standard deduction", () => {
  // extra = 2000(age≥65) + 2000(blind) = 4000
  // standard = 15000+4000 = 19000
  // taxable = 45000-19000 = 26000
  // tax = 11925×0.10 + 14075×0.12 = 1192.50+1689 = 2881.50
  const c = run(d({
    taxpayer: { age: 67, blind: true },
    w2: [{ wages: 45000 }],
  }));

  test("standard_deduction = 19000", () => expect(c.standard_deduction).toBeCloseTo(19000, 2));
  test("taxable_income = 26000", () => expect(c.taxable_income).toBeCloseTo(26000, 2));
  test("ordinary_tax = 2881.50", () => expect(c.ordinary_tax).toBeCloseTo(2881.50, 2));
});

// ─── 14. Other income types ───────────────────────────────────────────────────
describe("scenario 14 · other income — alimony/gambling/prizes/canceled debt", () => {
  // wages=50000 + alimony_received=12000 + gambling=5000 + prizes=3000
  // + canceled_debt=2000 + other=1000 = schedule1_additional=23000
  // total_income = 73000
  const c = run(d({
    w2: [{ wages: 50000 }],
    other: {
      alimony_received: 12000,
      gambling_winnings: 5000,
      prizes_awards: 3000,
      canceled_debt: 2000,
      other_amount: 1000,
    },
  }));

  test("alimony_received = 12000", () => expect(c.alimony_received).toBeCloseTo(12000, 2));
  test("gambling_winnings = 5000", () => expect(c.gambling_winnings).toBeCloseTo(5000, 2));
  test("prizes_awards = 3000", () => expect(c.prizes_awards).toBeCloseTo(3000, 2));
  test("canceled_debt = 2000", () => expect(c.canceled_debt).toBeCloseTo(2000, 2));
  test("other_income_misc = 1000", () => expect(c.other_income_misc).toBeCloseTo(1000, 2));
  test("schedule1_additional = 23000", () => expect(c.schedule1_additional).toBeCloseTo(23000, 2));
  test("total_income = 73000", () => expect(c.total_income).toBeCloseTo(73000, 2));
});

// ─── 15. K-1 + rental income + QBI on K-1 ordinary ──────────────────────────
describe("scenario 15 · K-1 income + Schedule E rental + QBI on K-1", () => {
  // wages=40000; k1_ordinary=20000, k1_rental=8000, k1_guaranteed=5000
  // rental net=10000; schedule1_additional = 10000+20000+8000+5000 = 43000
  // total_income = 83000; agi = 83000
  // qbi = max(0, schedule_c_profit(0)+k1_ordinary(20000)) = 20000
  // tiBeforeQbi = 83000-15000 = 68000; qbi_deduction = min(4000,13600) = 4000
  // taxable = 83000-15000-4000 = 64000
  const c = run(d({
    w2: [{ wages: 40000 }],
    passive: { k1_ordinary: 20000, k1_rental: 8000, k1_guaranteed_payments: 5000 },
    rental: [{ net_income_loss: 10000 }],
  }));

  test("k1_ordinary = 20000", () => expect(c.k1_ordinary).toBeCloseTo(20000, 2));
  test("k1_rental = 8000", () => expect(c.k1_rental).toBeCloseTo(8000, 2));
  test("k1_guaranteed = 5000", () => expect(c.k1_guaranteed).toBeCloseTo(5000, 2));
  test("schedule_e_net = 10000", () => expect(c.schedule_e_net).toBeCloseTo(10000, 2));
  test("schedule1_additional = 43000", () => expect(c.schedule1_additional).toBeCloseTo(43000, 2));
  test("total_income = 83000", () => expect(c.total_income).toBeCloseTo(83000, 2));
  test("qbi_deduction = 4000 (20% of K-1 ordinary)", () =>
    expect(c.qbi_deduction).toBeCloseTo(4000, 2));
  test("taxable_income = 64000", () => expect(c.taxable_income).toBeCloseTo(64000, 2));
});

// ─── 16. Head of Household filing status ─────────────────────────────────────
describe("scenario 16 · head of household · standard deduction + brackets", () => {
  // standard=22500; wages=55000; taxable=32500
  // HOH tax = 17000×0.10 + 15500×0.12 = 1700+1860 = 3560
  // CTC=2000 (1 qualifying child, AGI 55000 < 200000 phaseout)
  // income_tax_after_credits = 3560-2000 = 1560
  const c = run(d({
    fs: "head_of_household",
    w2: [{ wages: 55000 }],
    deps: [{ age_at_year_end: 10, relationship: "child" }],
  }));

  test("HOH standard_deduction = 22500", () => expect(c.standard_deduction).toBeCloseTo(22500, 2));
  test("taxable_income = 32500", () => expect(c.taxable_income).toBeCloseTo(32500, 2));
  test("ordinary_tax = 3560 (HOH brackets)", () => expect(c.ordinary_tax).toBeCloseTo(3560, 2));
  test("child_tax_credit = 2000", () => expect(c.child_tax_credit).toBeCloseTo(2000, 2));
  test("income_tax_after_credits = 1560", () =>
    expect(c.income_tax_after_credits).toBeCloseTo(1560, 2));
  test("total_tax = 1560", () => expect(c.total_tax).toBeCloseTo(1560, 2));
});

// ─── 17. MFS · SALT cap $5,000 ────────────────────────────────────────────────
describe("scenario 17 · married filing separately · SALT cap = $5,000", () => {
  // wages=90000, state_withheld=8000, prop_tax=5000 → SALT=min(13000,5000)=5000
  // mortgage=15000; itemized=20000 > standard(15000)
  // taxable = 90000-20000 = 70000
  // MFS tax = 11925×0.10 + 36550×0.12 + 21525×0.22 = 1192.50+4386+4735.50 = 10314
  const c = run(d({
    fs: "married_filing_separately",
    w2: [{ wages: 90000, state_withheld: 8000 }],
    properties: [{ financing: { property_tax_paid: 5000, mortgage_interest_paid: 15000 } }],
  }));

  test("SALT capped at 5000 (MFS)", () => expect(c.salt).toBeCloseTo(5000, 2));
  test("itemized = 20000", () => expect(c.itemized).toBeCloseTo(20000, 2));
  test("using_standard = false", () => expect(c.using_standard).toBe(false));
  test("taxable_income = 70000", () => expect(c.taxable_income).toBeCloseTo(70000, 2));
  test("ordinary_tax = 10314", () => expect(c.ordinary_tax).toBeCloseTo(10314, 2));
});

// ─── 18. SE tax — W2 wages exceed SS wage base (Medicare only) ───────────────
describe("scenario 18 · SE tax with W2 wages already consuming SS wage base", () => {
  // wages=200000 (W2), schedule_c net=50000
  // seNet = 50000×0.9235 = 46175
  // ssWages = min(200000, 176100) = 176100 → fills entire SS base
  // ssSe = max(0, min(46175, 176100-176100)×0.124) = 0
  // medSe = 46175×0.029 = 1339.075
  // se_tax = 1339.075 (Medicare portion only)
  // se_tax_deduction = 669.5375
  const c = run(d({
    w2: [{ wages: 200000, federal_withheld: 40000 }],
    businesses: [{ name: "Side Gig", entity_type: "sole_prop",
                   financials: { gross_revenue: 65000, net_profit_loss: 50000 } }],
  }));

  test("schedule_c_profit = 50000", () => expect(c.schedule_c_profit).toBeCloseTo(50000, 2));
  test("se_tax ≈ 1339.08 (Medicare only — SS base consumed by W2)", () =>
    expect(c.se_tax).toBeCloseTo(1339.075, 2));
  test("se_tax_deduction ≈ 669.54", () =>
    expect(c.se_tax_deduction).toBeCloseTo(669.5375, 2));
});

// ─── 19. Payments — estimated tax + other withholding ────────────────────────
describe("scenario 19 · estimated tax payments + other withholding", () => {
  // W2 withholding=5000, estimated=8000, other=1500 → total_payments=14500
  const c = run(d({
    w2: [{ wages: 60000, federal_withheld: 5000 }],
    householdExtra: {
      estimated_tax_payments: 8000,
      other_withholding: 1500,
    },
  }));

  test("w2_withholding = 5000", () => expect(c.w2_withholding).toBeCloseTo(5000, 2));
  test("estimated_tax_payments = 8000", () =>
    expect(c.estimated_tax_payments).toBeCloseTo(8000, 2));
  test("other_withholding = 1500", () => expect(c.other_withholding).toBeCloseTo(1500, 2));
  test("total_payments = 14500", () => expect(c.total_payments).toBeCloseTo(14500, 2));
});

// ─── 20. Multiple W2s + HSA payroll + retirement contributions ────────────────
describe("scenario 20 · multiple W2s · HSA payroll · retirement contributions", () => {
  // Two W2s: wages summed, HSA and retirement also summed
  const c = run(d({
    w2: [
      { wages: 90000, federal_withheld: 15000, hsa_contributions_through_payroll: 2000,
        retirement_contributions_through_payroll: 8000 },
      { wages: 40000, federal_withheld: 5000,  hsa_contributions_through_payroll: 1000,
        retirement_contributions_through_payroll: 3000 },
    ],
  }));

  test("wages = 130000 (two W2s summed)", () => expect(c.wages).toBeCloseTo(130000, 2));
  test("federal_withheld = 20000", () => expect(c.federal_withheld).toBeCloseTo(20000, 2));
  test("hsa_payroll = 3000", () => expect(c.hsa_payroll).toBeCloseTo(3000, 2));
  test("w2_retirement = 11000", () => expect(c.w2_retirement).toBeCloseTo(11000, 2));
  test("total_income = 130000", () => expect(c.total_income).toBeCloseTo(130000, 2));
});
