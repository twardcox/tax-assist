import type { ComputedValues } from "./taxCalculator";

function d(val: unknown): string {
  if (val == null || val === 0 || val === "") return "—";
  const n = Number(val);
  if (!Number.isFinite(n) || n === 0) return "—";
  return "$" + Math.round(n).toLocaleString("en-US");
}

function pct(val: unknown): string {
  if (val == null || val === 0) return "0.0%";
  return `${Number(val).toFixed(1)}%`;
}

function line(num: string, desc: string, amount: string): string {
  const numPad = num.padEnd(5);
  const descPad = desc.length > 50 ? desc.slice(0, 47) + "..." : desc.padEnd(50);
  return `  ${numPad} ${descPad} ${amount.padStart(14)}`;
}

function hr(char = "─"): string {
  return char.repeat(74);
}

function heading(title: string): string {
  return `\n${title}\n${hr("─")}`;
}

function section(title: string): string {
  return `\n  ${title}`;
}

export function buildSummaryText(
  c: ComputedValues,
  data: Record<string, unknown>,
  taxYear: number,
  displayName: string
): string {
  const hh = (data["household"] as Record<string, unknown>) ?? {};
  const tp = (hh["taxpayer"] as Record<string, unknown>) ?? {};
  const sp = (hh["spouse"] as Record<string, unknown>) ?? {};
  const res = (hh["residence"] as Record<string, unknown>) ?? {};
  const fs = (c["_fs"] as string) ?? (hh["filing_status"] as string) ?? "single";
  const fsLabel = fs.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  const tpName = [tp["first_name"], tp["last_name"]].filter(Boolean).join(" ") || displayName || "Taxpayer";
  const spName = [sp["first_name"], sp["last_name"]].filter(Boolean).join(" ");
  const address = [res["street_address"], res["city"], res["state"], res["zip"]]
    .filter(Boolean)
    .join(", ") || "—";

  const now = new Date().toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });

  const lines: string[] = [];

  lines.push(hr("═"));
  lines.push("  FEDERAL TAX RETURN DATA PACKAGE");
  lines.push(`  Tax Year ${taxYear} — For CPA Review`);
  lines.push(hr("═"));
  lines.push("");
  lines.push(`  Taxpayer:      ${tpName}${tp["ssn"] ? `  SSN: ${tp["ssn"]}` : ""}`);
  if (spName) lines.push(`  Spouse:        ${spName}${sp["ssn"] ? `  SSN: ${sp["ssn"]}` : ""}`);
  lines.push(`  Address:       ${address}`);
  lines.push(`  Filing Status: ${fsLabel}`);
  lines.push(`  Tax Year:      ${taxYear}`);
  lines.push(`  Generated:     ${now}`);
  lines.push(`  Software:      UTBIS — Universal Tax Benefit Intelligence System`);
  lines.push("");
  lines.push("  ⚠  IMPORTANT: This document is a data summary prepared for professional");
  lines.push("     review. All figures require CPA verification before filing.");
  lines.push("     Items marked [CPA REVIEW] require professional judgment.");
  lines.push("");

  // ── INCOME ──────────────────────────────────────────────────────────────────
  lines.push(heading("FORM 1040 — INCOME TAX SUMMARY"));
  lines.push(section("INCOME"));
  lines.push(line("1a", "Wages, salaries, tips (W-2)", d(c["wages"])));
  lines.push(line("2b", "Taxable interest income", d(c["taxable_interest"])));
  lines.push(line("3a", "Qualified dividends", d(c["qualified_dividends"])));
  lines.push(line("3b", "Ordinary dividends", d(c["ordinary_dividends"])));
  lines.push(line("4a/b", "IRA distributions (gross / taxable)", `${d(c["ira_gross"])} / ${d(c["ira_taxable"])}`));
  lines.push(line("5a/b", "Pensions & annuities (gross / taxable)", `${d(c["pension_gross"])} / ${d(c["pension_taxable"])}`));
  lines.push(line("6a/b", "Social security (gross / taxable)", `${d(c["ss_gross"])} / ${d(c["ss_taxable"])}`));
  const cgDetail = `[ST: ${d(c["stcg"])}  LT: ${d(c["ltcg"])}]`;
  lines.push(line("7", `Capital gain or (loss)  ${cgDetail}`, d(c["capital_gains_net"])));
  lines.push(line("8", "Other income (Schedule 1)", d(c["schedule1_additional"])));
  lines.push(hr());
  lines.push(line("9", "TOTAL INCOME", d(c["total_income"])));

  // ── ADJUSTMENTS ─────────────────────────────────────────────────────────────
  lines.push(section("ADJUSTMENTS TO INCOME (Schedule 1, Part II)"));
  lines.push(line("", "½ Self-employment tax deduction", d(c["se_tax_deduction"])));
  lines.push(line("", "Self-employed health insurance deduction", d(c["se_health_insurance"])));
  lines.push(line("", "Student loan interest deduction", d(c["student_loan_interest"])));
  lines.push(line("", "Educator expenses", d(c["educator_expenses"])));
  lines.push(line("", "HSA contributions (outside payroll)", d(c["hsa_outside_payroll"])));
  lines.push(line("", "IRA deduction", d(c["ira_deduction"])));
  lines.push(line("", "Alimony paid (pre-2019 divorce)  [CPA REVIEW]", d(c["alimony_paid"])));
  lines.push(line("", "Moving expenses (military only)", d(c["moving_expenses_military"])));
  lines.push(hr());
  lines.push(line("10", "TOTAL ADJUSTMENTS", d(c["total_adjustments"])));
  lines.push(line("11", "ADJUSTED GROSS INCOME (AGI)", d(c["agi"])));

  // ── DEDUCTIONS ───────────────────────────────────────────────────────────────
  lines.push(section("DEDUCTIONS & TAXABLE INCOME"));
  const stdAmt = Number(c["standard_deduction"] ?? 0);
  const itmAmt = Number(c["itemized"] ?? 0);
  const usingStd = Boolean(c["using_standard"]);
  const deductionNote = usingStd
    ? `Standard ($${Math.round(stdAmt).toLocaleString("en-US")} — ${fsLabel})`
    : `Itemized ($${Math.round(itmAmt).toLocaleString("en-US")} — Schedule A)`;
  lines.push(line("12", `Deduction used: ${deductionNote}`, d(c["deduction"])));
  lines.push(line("13a", "Qualified Business Income (QBI) deduction (§199A)", d(c["qbi_deduction"])));
  lines.push(line("13b", "Additional deductions (Schedule 1-A)", d(c["schedule_1a_total"])));
  lines.push(hr());
  lines.push(line("15", "TAXABLE INCOME", d(c["taxable_income"])));

  if (Number(c["schedule_1a_total"] ?? 0) > 0) {
    lines.push(section("SCHEDULE 1-A — ADDITIONAL DEDUCTIONS (OBBBA, 2025-2028)"));
    lines.push(line("", `Qualified tips deduction (reported: ${d(c["qualified_tips_total"])})`, d(c["tips_deduction"])));
    lines.push(line("", `Qualified overtime deduction (reported: ${d(c["qualified_overtime_total"])})`, d(c["overtime_deduction"])));
    lines.push(line("", "New-car loan interest deduction  [CPA REVIEW]", d(c["car_loan_deduction"])));
    lines.push(line("", `Senior deduction (${Number(c["senior_count"] ?? 0)} × $6,000, phased)`, d(c["senior_deduction"])));
    lines.push(hr());
    lines.push(line("38", "TOTAL ADDITIONAL DEDUCTIONS → Form 1040 Line 13b", d(c["schedule_1a_total"])));
  }

  // ── TAX ──────────────────────────────────────────────────────────────────────
  lines.push(section("TAX COMPUTATION"));
  lines.push(line("16", "Income tax (ordinary brackets)", d(c["ordinary_tax"])));
  lines.push(line("", "Long-term capital gains / qualified dividend tax", d(c["ltcg_tax"])));
  lines.push(line("", "Additional Medicare Tax (0.9%) — wages/SE over threshold", d(c["addl_medicare_tax"])));
  lines.push(line("", "Net Investment Income Tax (3.8%)", d(c["niit"])));
  lines.push(line("17", "Income tax before credits", d(c["income_tax_before_credits"])));
  lines.push(line("", "Self-employment tax (Schedule SE)", d(c["se_tax"])));
  lines.push(hr());
  lines.push(line("24", "TOTAL TAX BEFORE CREDITS", d(c["total_tax_before_credits"])));

  // ── CREDITS ──────────────────────────────────────────────────────────────────
  lines.push(section("CREDITS"));
  const ctcKids = Number(c["qualifying_children"] ?? 0);
  const pCtc = Number(c["ctc_per_child"] ?? 2200);
  lines.push(line("19", `Child Tax Credit (${ctcKids} qualifying children × $${pCtc.toLocaleString("en-US")})`, d(c["child_tax_credit"])));
  lines.push(line("", "Credit for other dependents", d(c["other_dependent_credit"])));
  const careAmt = Number(c["care_expenses"] ?? 0);
  lines.push(line("", `Child and Dependent Care Credit (qualified expenses: $${Math.round(careAmt).toLocaleString("en-US")})`, d(c["child_care_credit"])));
  const tuitionAmt = Number(c["tuition_expenses"] ?? 0);
  lines.push(line("", `Education credit (AOTC — tuition paid: $${Math.round(tuitionAmt).toLocaleString("en-US")})  [CPA REVIEW]`, d(c["education_credit"])));
  lines.push(line("", "Clean Vehicle Credit (§30D)", d(c["ev_credit"])));
  lines.push(line("", "Retirement Savings Credit (Saver's Credit)  [CPA REVIEW]", d(c["saver_credit"])));
  lines.push(hr());
  lines.push(line("21", "TOTAL CREDITS", d(c["total_credits"])));
  lines.push(line("24", "INCOME TAX AFTER CREDITS", d(c["income_tax_after_credits"])));
  lines.push(line("", "Self-employment tax", d(c["se_tax"])));
  lines.push(line("24", "TOTAL TAX", d(c["total_tax"])));

  // ── PAYMENTS ─────────────────────────────────────────────────────────────────
  lines.push(section("PAYMENTS & BALANCE DUE"));
  lines.push(line("25a", "Federal income tax withheld (W-2)", d(c["w2_withholding"])));
  lines.push(line("25b", "Federal income tax withheld (1099s / other)", d(c["other_withholding"])));
  lines.push(line("26", "Estimated tax payments", d(c["estimated_tax_payments"])));
  lines.push(hr());
  lines.push(line("33", "TOTAL PAYMENTS", d(c["total_payments"])));

  const refund = Number(c["refund"] ?? 0);
  const owed = Number(c["amount_owed"] ?? 0);
  if (refund > 0) {
    lines.push(line("34", "REFUND", "+" + d(refund)));
  } else {
    lines.push(line("37", "AMOUNT OWED", "−" + d(owed)));
  }

  // ── SUMMARY BOX ──────────────────────────────────────────────────────────────
  lines.push("");
  lines.push(hr("═"));
  lines.push("  SUMMARY");
  lines.push(hr("═"));
  lines.push(`  Effective Tax Rate:  ${pct(c["effective_rate"])}`);
  lines.push(`  Marginal Tax Rate:   ${pct(c["marginal_rate"])}`);
  lines.push(`  AGI:                 ${d(c["agi"])}`);
  lines.push(`  Total Tax:           ${d(c["total_tax"])}`);
  if (refund > 0) {
    lines.push(`  RESULT:              REFUND  ${d(refund)}`);
  } else {
    lines.push(`  RESULT:              DUE     ${d(owed)}`);
  }
  lines.push(hr("═"));

  // ── SCHEDULE A ───────────────────────────────────────────────────────────────
  const itmTotal = Number(c["itemized"] ?? 0);
  if (!usingStd || itmTotal > 0) {
    lines.push(heading("SCHEDULE A — ITEMIZED DEDUCTIONS"));
    lines.push(line("1", "Medical and dental expenses (total)", d(c["medical_total"])));
    lines.push(line("3", "Medical expenses above 7.5% AGI floor", d(c["medical_deductible"])));
    lines.push(line("5e", "State and local income taxes withheld", d(c["state_tax_paid"])));
    lines.push(line("5b", "Real estate taxes", d(c["prop_tax_paid"])));
    lines.push(line("5d", "SALT total (capped $10,000 / $5,000 MFS)", d(c["salt"])));
    lines.push(line("8a", "Home mortgage interest", d(c["mortgage_interest"])));
    lines.push(line("12", "Charitable contributions  [CPA REVIEW — substantiation]", d(c["charitable"])));
    lines.push(hr());
    lines.push(line("17", "TOTAL ITEMIZED DEDUCTIONS", d(itmTotal)));
    if (usingStd) {
      lines.push("");
      lines.push("  Note: Standard deduction used because it exceeds itemized total.");
      lines.push("        Itemized detail is provided for CPA review only.");
    }
  }

  // ── SCHEDULE B ───────────────────────────────────────────────────────────────
  const interest = Number(c["taxable_interest"] ?? 0);
  const divs = Number(c["ordinary_dividends"] ?? 0);
  if (interest + divs > 0) {
    lines.push(heading("SCHEDULE B — INTEREST AND ORDINARY DIVIDENDS"));
    lines.push(line("Part I", "Taxable interest income", d(c["taxable_interest"])));
    lines.push(line("Part II", "Ordinary dividends", d(c["ordinary_dividends"])));
    lines.push(line("", "  of which qualified dividends", d(c["qualified_dividends"])));
    lines.push("");
    lines.push("  [CPA REVIEW] Enter payer names, EINs, and individual amounts on the");
    lines.push("  official Schedule B. Foreign account and trust questions on Schedule B");
    lines.push("  Part III require taxpayer answers.");
  }

  // ── SCHEDULE C ───────────────────────────────────────────────────────────────
  const schCRecords = (c["schedule_c_records"] as Record<string, unknown>[]) ?? [];
  for (const biz of schCRecords) {
    lines.push(heading(`SCHEDULE C — PROFIT OR LOSS FROM BUSINESS: ${biz["business_name"]}`));
    lines.push(line("A", "Business name", String(biz["business_name"] ?? "")));
    lines.push(line("B", "Principal business code (NAICS)", String(biz["naics"] || "[CPA: enter code]")));
    lines.push(line("C", "Entity type", String(biz["entity_type"] || "").replace(/_/g, " ")));
    lines.push(line("D", "EIN", String(biz["ein"] || "[not provided]")));
    lines.push(line("1", "Gross receipts / sales", d(biz["gross_revenue"])));
    lines.push(line("28", "Total expenses", d(biz["expenses"])));
    lines.push(hr());
    lines.push(line("31", "Net profit or (loss)", d(biz["net_profit_loss"])));
    if (biz["home_office"]) {
      lines.push("");
      lines.push("  ⚑ Home office deduction may apply — Form 8829 required  [CPA REVIEW]");
    }
    lines.push("");
    lines.push("  [CPA REVIEW] Expense line items (advertising, car/truck, depreciation,");
    lines.push("  insurance, meals, supplies, utilities, etc.) must be populated from");
    lines.push("  receipts and records. Business-use vehicle mileage logs required.");
  }

  // ── SCHEDULE D ───────────────────────────────────────────────────────────────
  const cgNet = Number(c["capital_gains_net"] ?? 0);
  const stcg = Number(c["stcg"] ?? 0);
  const ltcg = Number(c["ltcg"] ?? 0);
  if (cgNet !== 0 || stcg !== 0 || ltcg !== 0) {
    lines.push(heading("SCHEDULE D — CAPITAL GAINS AND LOSSES"));
    lines.push(line("Part I", "Short-term net gain / (loss)", d(c["stcg"])));
    lines.push(line("Part II", "Long-term net gain / (loss)", d(c["ltcg"])));
    lines.push(hr());
    lines.push(line("16", "Net capital gain / (loss) total", d(c["capital_gains_net"])));
    lines.push("");
    lines.push("  [CPA REVIEW] Individual transaction detail must be entered on Schedule D /");
    lines.push("  Form 8949. Brokerage 1099-B statements and cost-basis records are required.");
  }

  // ── SCHEDULE E ───────────────────────────────────────────────────────────────
  const schERecords = (c["schedule_e_records"] as Record<string, unknown>[]) ?? [];
  if (schERecords.length > 0) {
    lines.push(heading("SCHEDULE E — SUPPLEMENTAL INCOME AND LOSS (RENTAL)"));
    for (const prop of schERecords) {
      lines.push(line("A", "Property address", String(prop["property_address"] ?? "")));
      lines.push(line("3", "Gross rents received", d(prop["gross_rents"])));
      lines.push(line("21", "Net income / (loss)", d(prop["net_income_loss"])));
      lines.push("");
    }
    lines.push("  [CPA REVIEW] Itemized expense detail (advertising, insurance, mortgage");
    lines.push("  interest, repairs, taxes, depreciation, etc.) must be completed.");
    lines.push("  Depreciation schedules and Form 4562 may be required.");
  }

  // ── SCHEDULE SE ──────────────────────────────────────────────────────────────
  const seTax = Number(c["se_tax"] ?? 0);
  if (seTax > 0) {
    lines.push(heading("SCHEDULE SE — SELF-EMPLOYMENT TAX"));
    const seProfit = Number(c["schedule_c_profit"] ?? 0);
    const seNet = seProfit * 0.9235;
    lines.push(line("2", "Net profit from Schedule C", d(seProfit)));
    lines.push(line("3", "Net earnings subject to SE tax (× 0.9235)", d(seNet)));
    lines.push(hr());
    lines.push(line("5", "Self-employment tax (15.3% / 12.4% SS + 2.9%)", d(c["se_tax"])));
    lines.push(line("6", "Deduction for ½ of SE tax (→ Schedule 1)", d(c["se_tax_deduction"])));
  }

  // ── CPA NOTES ────────────────────────────────────────────────────────────────
  lines.push(heading("ITEMS REQUIRING CPA JUDGMENT"));
  const notes = [
    "GENERAL",
    "• All figures are taxpayer-provided estimates. Reconcile against actual W-2s, 1099s,",
    "  and brokerage statements.",
    "• This package does not include state return calculations. Prepare state return based",
    "  on federal AGI.",
    "• AMT (Form 6251) applicability should be evaluated — estimated AGI may trigger analysis.",
    "INCOME",
    "• Verify all employer EINs and W-2 box amounts match official employer records.",
    "• Social security taxable portion calculated using combined income rule (IRC §86); verify",
    "  with SSA-1099.",
    "• Retirement distribution taxability depends on prior nondeductible IRA basis (Form 8606).",
    "DEDUCTIONS",
    "• Charitable deduction requires contemporaneous written acknowledgment for gifts ≥ $250.",
    "• Mortgage interest deduction subject to acquisition debt limits (§163(h)); verify Form 1098.",
    "• QBI deduction (§199A) simplified here — W-2 wages and UBIA tests may apply at higher income.",
    "CREDITS",
    "• Education credits (AOTC/LLC) subject to income phase-outs; Form 1098-T required.",
    "• Child care credit rate (20% used here) is income-dependent — adjust per §21 tables.",
    "• Saver's Credit (§25B) may apply if income is within limits — not computed; CPA to evaluate.",
    "• EV credit subject to MSRP limits, taxpayer income limits, and dealer attestation requirements.",
    "SCHEDULES",
    "• Schedule C expense detail must be completed from receipts; home office requires Form 8829.",
    "• Schedule D requires Form 8949 transaction detail; wash-sale rules apply.",
    "• Schedule E depreciation must continue from prior-year schedules; Form 4562 required.",
    "ESTIMATED TAXES",
    "• Evaluate next-year estimated tax payment obligation based on final tax liability.",
    "• Penalty for underpayment (Form 2210) should be computed if applicable.",
  ];
  for (const note of notes) {
    if (note === note.toUpperCase() && !note.startsWith("•")) {
      lines.push(`\n  ${note}`);
    } else {
      lines.push(`  ${note}`);
    }
  }

  lines.push("");
  lines.push(hr("═"));
  lines.push("  Generated by: UTBIS — Universal Tax Benefit Intelligence System");
  lines.push(hr("═"));
  lines.push("");

  return lines.join("\n");
}
