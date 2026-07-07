/**
 * Automated form-field mapping verification.
 *
 * For each IRS form the app fills, this script fills it live from a real
 * user's DB data (flatten disabled so AcroForm fields stay readable), then
 * asserts every mapped money/value field contains exactly the value the
 * field is documented to hold in state/pdf_check/FIELD_MAP.md.
 *
 * The expectations below are transcribed from FIELD_MAP.md (which was
 * verified visually / via markitdown / via live dumps), NOT from
 * fillIrsForms.ts — so this catches the fill code writing the right value
 * to the wrong field, or the wrong value to the right field.
 *
 * Usage (from backend-ts/):
 *   npx tsx scripts/checkFieldMappings.mjs <userId> [taxYear]
 *
 * Exit code 0 = all mapped fields match; 1 = at least one mismatch.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFForm, PDFDocument } from "pdf-lib";

const originalFlatten = PDFForm.prototype.flatten;
PDFForm.prototype.flatten = function () { /* keep fields live */ };

// ── Revision guard ────────────────────────────────────────────────────────────
// The IRS re-publishes form PDFs at the same URL, and a revision can renumber
// the AcroForm fields (the 9/5/25 Form 1040 revision shifted every index after
// f1_53/f2_06 and silently broke the mapping). The mapping below is only valid
// for these exact files. If a hash differs, STOP: re-derive the mapping per
// FORM_MAPPING_PROCESS.md before trusting any output.
const EXPECTED_SHA256_PREFIX = {
  "f1040.pdf": "3d31c226df0d189c",
  "f1040s1.pdf": "8dafec719f6a4716",
  "f1040s1a.pdf": "64f97b38ff4218e2",
  "f1040sb.pdf": "dd1ec3719954532b",
  "f1040sc.pdf": "ddf401dbe060467d",
  "f1040sd.pdf": "90564c8b7e492803",
  "f1040sse.pdf": "05bc2b3e1dfca65d",
  "f1040sf.pdf": "c6f7f19e1a4f5729",
  "f1040sh.pdf": "d04de932bd7d960b",
  "f1040s3.pdf": "008cfd3fe3ebd086",
  "f1040s8812.pdf": "6936462d67e2309d",
  "f1040sa.pdf": "c14acf3478f4c33f",
  "f2441.pdf": "6c3c2d19163fa4c4",
  "f8863.pdf": "a251a1cfbd613d5d",
  "f5695.pdf": "e2ac6a5c4b39e903",
};

const FORM_CACHE = path.join(
  path.dirname(fileURLToPath(import.meta.url)), "..", "..", "state", "form_cache"
);

let revisionMismatch = false;
for (const [file, expected] of Object.entries(EXPECTED_SHA256_PREFIX)) {
  const full = path.join(FORM_CACHE, file);
  if (!fs.existsSync(full)) {
    console.error(`REVISION GUARD: ${file} missing from form cache`);
    revisionMismatch = true;
    continue;
  }
  const actual = crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex").slice(0, 16);
  if (actual !== expected) {
    console.error(`REVISION GUARD: ${file} changed (sha256 ${actual} != mapped ${expected}).`);
    console.error(`  The IRS published a new revision — the field mapping may be invalid.`);
    console.error(`  Re-derive per state/pdf_check/FORM_MAPPING_PROCESS.md, then update this hash.`);
    revisionMismatch = true;
  }
}
if (revisionMismatch) process.exit(2);

const { fillSingleIrsForm } = await import("../src/domain/taxForms/fillIrsForms.ts");
const { loadAllUserData, computeTaxFigures } = await import("../src/domain/taxForms/index.ts");
const { getTaxParams } = await import("../src/domain/taxForms/taxParams.ts");

const userId = process.argv[2];
const taxYear = Number(process.argv[3] ?? 2025);
if (!userId) {
  console.error("Usage: tsx scripts/checkFieldMappings.mjs <userId> [taxYear]");
  process.exit(1);
}

const data = await loadAllUserData(userId, taxYear);
const figures = await computeTaxFigures(userId, taxYear);
const c = figures.computed;
const params = getTaxParams(taxYear);

// An empty user makes every check vacuous ("" == ""). Refuse to bless it —
// this happens when the seeded user was recreated and the userId is stale
// (npm run seed:test-user issues a NEW id; tests may also wipe the tables).
if (Number(c["total_income"] ?? 0) === 0) {
  console.error(`User ${userId} has zero total income for ${taxYear} — no data to verify.`);
  console.error(`Stale userId? Re-run "npm run seed:test-user" and use the current id.`);
  process.exit(2);
}

const N = (k) => Number(c[k] ?? 0);
const fmt = (n) => { const v = Math.round(Number(n ?? 0)); return v === 0 ? "" : v.toLocaleString("en-US"); };
const fmtSigned = (n) => {
  const v = Math.round(Number(n ?? 0));
  if (v === 0) return "";
  return v < 0 ? `-${Math.abs(v).toLocaleString("en-US")}` : v.toLocaleString("en-US");
};

// ── Expectations, transcribed from state/pdf_check/FIELD_MAP.md ───────────────
// Each entry: [field-name suffix, "form line — meaning", () => expected string]

const seCombined = N("schedule_c_profit") + N("farm_income");
const seNet = seCombined * 0.9235;
const ssBase = params.se_ss_wage_base;
const ssWages = Math.min(N("wages"), ssBase);
const seLine9 = ssBase - ssWages;

const biz = (() => {
  const b = data?.businesses?.businesses?.[0] ?? {};
  const fin = b.financials ?? {};
  return {
    gross: Number(fin.gross_revenue ?? 0),
    net: Number(fin.net_profit_loss ?? 0),
    expenses: Number(fin.expenses ?? Number(fin.gross_revenue ?? 0) - Number(fin.net_profit_loss ?? 0)),
  };
})();

const applyToNext = Number(data?.household?.payments?.apply_to_next_year ?? 0);
const fsJoint = String(c["_fs"] ?? "") === "married_filing_jointly";
const s1aTipThreshold = fsJoint ? 300000 : 150000;
const s1aOvertimeCap = fsJoint ? 25000 : 12500;
const s1aCarThreshold = fsJoint ? 200000 : 100000;
const s1aSeniorThreshold = fsJoint ? 150000 : 75000;

const EXPECTATIONS = {
  // Form 1040 — revision "Created 9/5/25" (lines 12–18 are page 2 only)
  f1040: [
    ["f1_47[0]", "1a — W-2 wages", () => fmt(N("wages"))],
    ["f1_48[0]", "1b — household employee wages", () => fmt(N("household_employee_wages"))],
    ["f1_49[0]", "1c — unreported tips", () => fmt(N("tip_income_unreported"))],
    ["f1_50[0]", "1d — Medicaid waiver payments", () => fmt(N("medicaid_waiver_payments"))],
    ["f1_55[0]", "1h — other earned income", () => fmt(N("other_earned_income"))],
    ["f1_57[0]", "1z — add lines 1a-1h", () => fmt(
      N("wages") + N("household_employee_wages") + N("tip_income_unreported") +
      N("medicaid_waiver_payments") + N("other_earned_income"))],
    ["f1_59[0]", "2b — taxable interest", () => fmt(N("taxable_interest"))],
    ["f1_60[0]", "3a — qualified dividends", () => fmt(N("qualified_dividends"))],
    ["f1_61[0]", "3b — ordinary dividends", () => fmt(N("ordinary_dividends"))],
    ["f1_62[0]", "4a — IRA gross", () => fmt(N("ira_gross"))],
    ["f1_63[0]", "4b — IRA taxable", () => fmt(N("ira_taxable"))],
    ["f1_65[0]", "5a — pension gross", () => fmt(N("pension_gross"))],
    ["f1_66[0]", "5b — pension taxable", () => fmt(N("pension_taxable"))],
    ["f1_68[0]", "6a — SS gross", () => fmt(N("ss_gross"))],
    ["f1_69[0]", "6b — SS taxable", () => fmt(N("ss_taxable"))],
    ["f1_70[0]", "7a — capital gain/(loss)", () => fmtSigned(N("capital_gains_net"))],
    ["f1_72[0]", "8 — Schedule 1 additional income", () => fmt(N("schedule1_additional"))],
    ["f1_73[0]", "9 — TOTAL INCOME", () => fmt(N("total_income"))],
    ["f1_74[0]", "10 — adjustments", () => fmt(N("total_adjustments"))],
    ["f1_75[0]", "11a — AGI", () => fmt(N("agi"))],
    ["f2_01[0]", "11b — AGI carryover", () => fmt(N("agi"))],
    ["f2_02[0]", "12e — deduction", () => fmt(N("deduction"))],
    ["f2_03[0]", "13a — QBI", () => fmt(N("qbi_deduction"))],
    ["f2_04[0]", "13b — Schedule 1-A total", () => fmt(N("schedule_1a_total"))],
    ["f2_05[0]", "14 — deduction + QBI + Schedule 1-A", () => fmt(N("deduction") + N("qbi_deduction") + N("schedule_1a_total"))],
    ["f2_06[0]", "15 — TAXABLE INCOME", () => fmt(N("taxable_income"))],
    ["f2_08[0]", "16 — tax", () => fmt(N("income_tax_before_credits"))],
    ["f2_10[0]", "18 — add lines 16+17", () => fmt(N("income_tax_before_credits"))],
    ["f2_11[0]", "19 — CTC + ODC", () => fmt(N("ctc_with_odc"))],
    ["f2_12[0]", "20 — Schedule 3 line 8", () => fmt(N("schedule3_line8"))],
    ["f2_13[0]", "21 — total credits", () => fmt(N("total_credits"))],
    ["f2_14[0]", "22 — tax after credits", () => fmt(N("income_tax_after_credits"))],
    ["f2_15[0]", "23 — other taxes (SE + household employment)", () => fmt(N("se_tax") + N("household_employment_tax"))],
    ["f2_16[0]", "24 — TOTAL TAX", () => fmt(N("total_tax"))],
    ["f2_17[0]", "25a — W-2 withholding", () => fmt(N("w2_withholding"))],
    ["f2_18[0]", "25b — other withholding", () => fmt(N("other_withholding"))],
    ["f2_20[0]", "25d — total withholding", () => fmt(N("w2_withholding") + N("other_withholding"))],
    ["f2_21[0]", "26 — estimated payments", () => fmt(N("estimated_tax_payments"))],
    ["f2_23[0]", "27a — EIC", () => fmt(N("earned_income_credit"))],
    ["f2_24[0]", "28 — additional CTC", () => fmt(N("additional_ctc"))],
    ["f2_28[0]", "32 — total other payments/refundable", () => fmt(N("earned_income_credit") + N("additional_ctc"))],
    ["f2_29[0]", "33 — TOTAL PAYMENTS", () => fmt(N("total_payments"))],
    ["f2_30[0]", "34 — overpaid", () => fmt(N("refund"))],
    ["f2_31[0]", "35a — amount to refund", () =>
      N("refund") > 0 ? fmt(Math.max(0, N("refund") - applyToNext) || N("refund")) : ""],
    ["f2_34[0]", "36 — applied to next year", () => (N("refund") > 0 && applyToNext > 0 ? fmt(applyToNext) : "")],
    ["f2_35[0]", "37 — amount owed", () => (N("refund") > 0 ? "" : fmt(N("amount_owed")))],
  ],

  f1040s1: [
    ["f1_05[0]", "1 — Sch C net profit", () => fmt(N("schedule_c_profit"))],
    ["f1_07[0]", "5 — Sch E net", () => fmt(N("schedule_e_net"))],
    ["f1_08[0]", "6 — farm income", () => fmtSigned(N("farm_income"))],
    ["f1_36[0]", "8z — other income amount", () => fmt(N("line8z_amount"))],
    ["f1_37[0]", "9 — total lines 8a-8z", () => fmt(N("schedule1_line9"))],
    ["f1_38[0]", "10 — to Form 1040 line 8", () => fmt(N("schedule1_additional"))],
    ["f2_03[0]", "11 — educator expenses", () => fmt(N("educator_expenses"))],
    ["f2_04[0]", "13 — HSA deduction", () => fmt(N("hsa_outside_payroll"))],
    ["f2_05[0]", "14 — military moving", () => fmt(N("moving_expenses_military"))],
    ["f2_06[0]", "15 — half SE tax", () => fmt(N("se_tax_deduction"))],
    ["f2_07[0]", "16 — SEP/SIMPLE", () => fmt(N("sep_simple_contributions"))],
    ["f2_08[0]", "17 — SE health insurance", () => fmt(N("se_health_insurance"))],
    ["f2_09[0]", "19a — alimony paid", () => fmt(N("alimony_paid"))],
    ["f2_12[0]", "20 — IRA deduction", () => fmt(N("ira_deduction"))],
    ["f2_13[0]", "21 — student loan interest", () => fmt(N("student_loan_interest"))],
    ["f2_30[0]", "26 — total adjustments", () => fmt(N("total_adjustments"))],
  ],

  f1040s1a: [
    ["f1_03[0]", "1 — 1040 line 11b (AGI)", () => fmt(N("agi"))],
    ["f1_08[0]", "2e — foreign exclusions total", () => ""],
    ["f1_09[0]", "3 — MAGI", () => fmt(N("schedule_1a_magi"))],
    ["f1_10[0]", "4a — qualified tips from W-2/4137", () => fmt(N("qualified_tips_w2") + N("tip_income_unreported"))],
    ["f1_11[0]", "4b — Form 4137 tips", () => fmt(N("tip_income_unreported"))],
    ["f1_12[0]", "4c — employee qualified tips", () => fmt(N("qualified_tips_w2") + N("tip_income_unreported"))],
    ["f1_13[0]", "5 — self-employment qualified tips", () => fmt(N("qualified_tips_se"))],
    ["f1_14[0]", "6 — total qualified tips", () => fmt(N("qualified_tips_total"))],
    ["f1_15[0]", "7 — tips cap", () => fmt(Math.min(N("qualified_tips_total"), 25000))],
    ["f1_16[0]", "8 — MAGI", () => fmt(N("schedule_1a_magi"))],
    ["f1_17[0]", "9 — tips threshold", () => fmt(s1aTipThreshold)],
    ["f1_18[0]", "10 — tips MAGI excess", () => fmt(Math.max(0, N("schedule_1a_magi") - s1aTipThreshold))],
    ["f1_19[0]", "11 — floor(excess/1000)", () => fmt(Math.floor(Math.max(0, N("schedule_1a_magi") - s1aTipThreshold) / 1000))],
    ["f1_20[0]", "12 — line 11 × 100", () => fmt(Math.floor(Math.max(0, N("schedule_1a_magi") - s1aTipThreshold) / 1000) * 100)],
    ["f1_21[0]", "13 — tips deduction", () => fmt(N("tips_deduction"))],
    ["f1_22[0]", "14a — qualified overtime", () => fmt(N("qualified_overtime_total"))],
    ["f1_23[0]", "14b — 1099 overtime", () => ""],
    ["f1_24[0]", "14c — total overtime", () => fmt(N("qualified_overtime_total"))],
    ["f1_25[0]", "15 — overtime cap", () => fmt(Math.min(N("qualified_overtime_total"), s1aOvertimeCap))],
    ["f1_26[0]", "16 — MAGI", () => fmt(N("schedule_1a_magi"))],
    ["f1_27[0]", "17 — overtime threshold", () => fmt(s1aTipThreshold)],
    ["f1_28[0]", "18 — overtime MAGI excess", () => fmt(Math.max(0, N("schedule_1a_magi") - s1aTipThreshold))],
    ["f1_29[0]", "19 — floor(excess/1000)", () => fmt(Math.floor(Math.max(0, N("schedule_1a_magi") - s1aTipThreshold) / 1000))],
    ["f1_30[0]", "20 — line 19 × 100", () => fmt(Math.floor(Math.max(0, N("schedule_1a_magi") - s1aTipThreshold) / 1000) * 100)],
    ["f1_31[0]", "21 — overtime deduction", () => fmt(N("overtime_deduction"))],
    ["f2_01[0]", "22a(i) — VIN", () => String(c["car_loan_vin"] ?? "")],
    ["f2_02[0]", "22a(ii) — interest deducted elsewhere", () => ""],
    ["f2_03[0]", "22a(iii) — net QPVLI", () => fmt(N("car_loan_interest_paid"))],
    ["f2_07[0]", "23 — total QPVLI", () => fmt(N("car_loan_interest_paid"))],
    ["f2_08[0]", "24 — min(line 23, 10000)", () => fmt(Math.min(N("car_loan_interest_paid"), 10000))],
    ["f2_09[0]", "25 — MAGI", () => fmt(N("schedule_1a_magi"))],
    ["f2_10[0]", "26 — car-loan threshold", () => fmt(s1aCarThreshold)],
    ["f2_11[0]", "27 — car-loan MAGI excess", () => fmt(Math.max(0, N("schedule_1a_magi") - s1aCarThreshold))],
    ["f2_12[0]", "28 — ceil(excess/1000)", () => {
      const ex = Math.max(0, N("schedule_1a_magi") - s1aCarThreshold);
      return fmt(ex <= 0 ? 0 : Math.ceil(ex / 1000));
    }],
    ["f2_13[0]", "29 — line 28 × 200", () => {
      const ex = Math.max(0, N("schedule_1a_magi") - s1aCarThreshold);
      const l28 = ex <= 0 ? 0 : Math.ceil(ex / 1000);
      return fmt(l28 * 200);
    }],
    ["f2_14[0]", "30 — car-loan deduction", () => fmt(N("car_loan_deduction"))],
    ["f2_15[0]", "31 — MAGI", () => fmt(N("schedule_1a_magi"))],
    ["f2_16[0]", "32 — senior threshold", () => fmt(s1aSeniorThreshold)],
    ["f2_17[0]", "33 — senior MAGI excess", () => fmt(Math.max(0, N("schedule_1a_magi") - s1aSeniorThreshold))],
    ["f2_18[0]", "34 — line 33 × 6%", () => fmt(Math.max(0, N("schedule_1a_magi") - s1aSeniorThreshold) * 0.06)],
    ["f2_19[0]", "35 — 6000 minus line 34", () => fmt(Math.max(0, 6000 - (Math.max(0, N("schedule_1a_magi") - s1aSeniorThreshold) * 0.06)))],
    ["f2_20[0]", "36a — taxpayer senior amount", () => {
      const tpAge = Number(data?.household?.taxpayer?.age ?? 0);
      const l35 = Math.max(0, 6000 - (Math.max(0, N("schedule_1a_magi") - s1aSeniorThreshold) * 0.06));
      return fmt(tpAge >= 65 ? l35 : 0);
    }],
    ["f2_21[0]", "36b — spouse senior amount", () => {
      const spAge = Number(data?.household?.spouse?.age ?? 0);
      const l35 = Math.max(0, 6000 - (Math.max(0, N("schedule_1a_magi") - s1aSeniorThreshold) * 0.06));
      return fmt(fsJoint && spAge >= 65 ? l35 : 0);
    }],
    ["f2_22[0]", "37 — senior deduction", () => fmt(N("senior_deduction"))],
    ["f2_23[0]", "38 — total additional deductions", () => fmt(N("schedule_1a_total"))],
  ],

  f1040sb: [
    ["f1_04[0]", "1 — interest amount", () => fmt(N("taxable_interest"))],
    ["f1_33[0]", "2 — total interest", () => fmt(N("taxable_interest"))],
    ["f1_34[0]", "4 — taxable interest", () => fmt(N("taxable_interest"))],
    ["f1_36[0]", "Part II — dividend amount", () => fmt(N("ordinary_dividends"))],
    ["f1_65[0]", "6 — total ordinary dividends", () => fmt(N("ordinary_dividends"))],
  ],

  f1040sc_0: [
    ["f1_10[0]", "1 — gross receipts", () => fmt(biz.gross)],
    ["f1_12[0]", "3 — receipts less returns", () => fmt(biz.gross)],
    ["f1_14[0]", "5 — gross profit", () => fmt(biz.gross)],
    ["f1_16[0]", "7 — gross income", () => fmt(biz.gross)],
    ["f1_41[0]", "28 — total expenses", () => fmt(biz.expenses)],
    ["f1_45[0]", "31 — NET PROFIT/(LOSS)", () => fmtSigned(biz.net)],
  ],

  f1040sd: [
    ["Row1a[0].f1_6[0]", "1a — short-term gain/(loss)", () => fmtSigned(N("stcg"))],
    ["f1_22[0]", "7 — net short-term", () => fmtSigned(N("stcg"))],
    ["Row8a[0].f1_26[0]", "8a — long-term gain/(loss)", () => fmtSigned(N("ltcg"))],
    ["f1_43[0]", "15 — net long-term", () => fmtSigned(N("ltcg"))],
    ["Page2[0].f2_1[0]", "16 — combined net gain/(loss)", () => fmtSigned(N("stcg") + N("ltcg"))],
  ],

  f1040sse: [
    ["f1_3[0]", "1a — net farm profit", () => fmtSigned(N("farm_income"))],
    ["f1_5[0]", "2 — Sch C net profit", () => fmtSigned(N("schedule_c_profit"))],
    ["f1_6[0]", "3 — combined", () => fmtSigned(seCombined)],
    ["f1_7[0]", "4a — × 0.9235", () => fmt(seNet)],
    ["f1_9[0]", "4c — net SE earnings", () => fmt(seNet)],
    ["f1_12[0]", "6 — net SE earnings", () => fmt(seNet)],
    ["f1_13[0]", "7 — SS wage base", () => fmt(ssBase)],
    ["f1_14[0]", "8a — W-2 SS wages", () => fmt(N("wages"))],
    ["f1_17[0]", "8d — total SS wages", () => fmt(ssWages)],
    ["f1_18[0]", "9 — remaining SS base", () => fmt(seLine9)],
    ["f1_19[0]", "10 — SS portion 12.4%", () => fmt(Math.min(seNet, seLine9) * 0.124)],
    ["f1_20[0]", "11 — Medicare portion 2.9%", () => fmt(seNet * 0.029)],
    ["f1_21[0]", "12 — SE TAX", () => fmt(N("se_tax"))],
    ["f1_22[0]", "13 — half-SE-tax deduction", () => fmt(N("se_tax_deduction"))],
  ],

  f1040sf: [
    ["f1_9[0]", "2 — sales of products", () => fmt(N("farm_gross"))],
    ["f1_22[0]", "9 — gross income", () => fmt(N("farm_gross"))],
    ["f1_59[0]", "33 — total expenses", () => fmt(N("farm_expenses"))],
    ["f1_60[0]", "34 — net farm profit/(loss)", () => fmtSigned(N("farm_income"))],
  ],

  f1040sh: [
    ["f1_4[0]", "1 — SS wages", () => fmt(N("sch_h_ss_wages"))],
    ["f1_5[0]", "2 — SS tax", () => fmt(N("sch_h_ss_tax"))],
    ["f1_6[0]", "3 — Medicare wages", () => fmt(N("sch_h_medicare_wages"))],
    ["f1_7[0]", "4 — Medicare tax", () => fmt(N("sch_h_medicare_tax"))],
    ["f1_11[0]", "8 — Part I total", () => fmt(N("sch_h_part1_total"))],
    ["f2_2[0]", "14 — state UI contributions", () => fmt(N("sch_h_state_contr"))],
    ["f2_3[0]", "15 — FUTA wages", () => fmt(N("sch_h_futa_wages"))],
    ["f2_4[0]", "16 — FUTA tax", () => fmt(N("sch_h_futa_net"))],
    ["f2_31[0]", "25 — amount from line 8", () => fmt(N("sch_h_part1_total"))],
    ["f2_32[0]", "26 — total household employment tax", () => fmt(N("sch_h_total"))],
  ],
};

// ── Runner ────────────────────────────────────────────────────────────────────

let failures = 0;
let checks = 0;

for (const [formKey, expectations] of Object.entries(EXPECTATIONS)) {
  let pdfBytes;
  try {
    pdfBytes = await fillSingleIrsForm(formKey, c, figures.display_name, taxYear, data);
  } catch (e) {
    console.log(`\n=== ${formKey}: SKIPPED (${e.message}) ===`);
    continue;
  }

  const doc = await PDFDocument.load(pdfBytes);
  const values = new Map();
  for (const field of doc.getForm().getFields()) {
    const type = field.constructor.name;
    let value = "";
    try {
      if (type === "PDFTextField") value = field.getText() ?? "";
      else if (type === "PDFCheckBox") value = field.isChecked() ? "[X]" : "";
      else if (type === "PDFRadioGroup") value = field.getSelected() ?? "";
    } catch { /* unreadable */ }
    values.set(field.getName(), value);
  }

  console.log(`\n=== ${formKey} ===`);
  for (const [suffix, label, expectedFn] of expectations) {
    checks++;
    const matches = [...values.keys()].filter((n) => n === suffix || n.endsWith("." + suffix));
    if (matches.length !== 1) {
      failures++;
      console.log(`FAIL  ${label}: field suffix "${suffix}" matched ${matches.length} fields`);
      continue;
    }
    const actual = values.get(matches[0]) ?? "";
    const expected = expectedFn();
    if (actual === expected) {
      console.log(`ok    ${label}: "${actual}"`);
    } else {
      failures++;
      console.log(`FAIL  ${label} (${matches[0]}): expected "${expected}", got "${actual}"`);
    }
  }
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures > 0 ? 1 : 0);
