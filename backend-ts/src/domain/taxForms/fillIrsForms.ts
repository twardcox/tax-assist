import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { projectPaths } from "../../lib/paths";
import type { ComputedValues } from "./taxCalculator";

const FORM_CACHE = path.join(projectPaths.state, "form_cache");

// Format a number as a dollar string (commas, no $, empty when zero)
function fmt(n: unknown): string {
  const v = Math.round(Number(n ?? 0));
  return v === 0 ? "" : v.toLocaleString("en-US");
}

// Format signed (negatives shown as negative, not parens)
function fmtSigned(n: unknown): string {
  const v = Math.round(Number(n ?? 0));
  if (v === 0) return "";
  return v < 0 ? `-${Math.abs(v).toLocaleString("en-US")}` : v.toLocaleString("en-US");
}

async function loadPdf(name: string): Promise<PDFDocument> {
  const bytes = fs.readFileSync(path.join(FORM_CACHE, name));
  return PDFDocument.load(bytes, { ignoreEncryption: true });
}

// Try to set a text field; skip silently if the field doesn't exist or is read-only
function ts(doc: PDFDocument, fieldPath: string, value: string): void {
  try {
    doc.getForm().getTextField(fieldPath).setText(value);
  } catch {
    // field missing or read-only — skip
  }
}

function tryCheckBox(doc: PDFDocument, fieldPath: string, check: boolean): void {
  try {
    const cb = doc.getForm().getCheckBox(fieldPath);
    if (check) cb.check(); else cb.uncheck();
  } catch {
    // skip
  }
}

// Build full dotted path for fields at the top level of a page (two-digit forms: 1040, s1, sb)
function p(page: number, field: string): string {
  return `topmostSubform[0].Page${page}[0].${field}`;
}

export async function fillSingleIrsForm(
  formKey: string,
  c: ComputedValues,
  displayName: string,
  _taxYear: number,
  data: Record<string, unknown> = {}
): Promise<Uint8Array> {
  let doc: PDFDocument;

  if (formKey === "f1040") {
    doc = await fill1040(c, data);
  } else if (formKey === "f1040s1") {
    doc = await fillSchedule1(c);
  } else if (formKey === "f1040sb") {
    doc = await fillScheduleB(c);
  } else if (formKey.startsWith("f1040sc_")) {
    const idx = parseInt(formKey.split("_")[1], 10);
    const records = (c["schedule_c_records"] as Record<string, unknown>[]) ?? [];
    const biz = records[idx];
    if (!biz) throw new Error(`No Schedule C record at index ${idx}`);
    doc = await fillScheduleC(biz, displayName, String(c["taxpayer_ssn"] ?? ""));
  } else if (formKey === "f1040s3") {
    doc = await fillSchedule3(c);
  } else if (formKey === "f1040s8812") {
    doc = await fillSchedule8812(c);
  } else if (formKey === "f1040sd") {
    doc = await fillScheduleD(c);
  } else if (formKey === "f1040sse") {
    doc = await fillScheduleSE(c, displayName);
  } else {
    throw new Error(`Unknown form key: ${formKey}`);
  }

  try { doc.getForm().flatten(); } catch { /* skip */ }
  return doc.save();
}

export async function fillIrsForms(
  c: ComputedValues,
  displayName: string,
  _taxYear: number,
  data: Record<string, unknown> = {}
): Promise<Uint8Array> {
  const docs: PDFDocument[] = [];

  docs.push(await fill1040(c, data));

  const needSch1 = Number(c["total_adjustments"]) > 0 || Number(c["schedule1_additional"]) !== 0;
  if (needSch1) {
    docs.push(await fillSchedule1(c));
  }

  const needSchB = (Number(c["taxable_interest"]) + Number(c["ordinary_dividends"])) > 0;
  if (needSchB) {
    docs.push(await fillScheduleB(c));
  }

  const needSch8812 = (Number(c["qualifying_children"]) + Number(c["other_dependent_count"])) > 0;
  if (needSch8812) {
    docs.push(await fillSchedule8812(c));
  }

  if (Number(c["schedule3_line8"]) > 0) {
    docs.push(await fillSchedule3(c));
  }

  const schCRecords = (c["schedule_c_records"] as Record<string, unknown>[]) ?? [];
  const tpSSNBulk = String(c["taxpayer_ssn"] ?? "");
  for (const biz of schCRecords) {
    docs.push(await fillScheduleC(biz, displayName, tpSSNBulk));
  }

  const needSchD = Number(c["stcg"]) !== 0 || Number(c["ltcg"]) !== 0;
  if (needSchD) {
    docs.push(await fillScheduleD(c));
  }

  if (Number(c["se_tax"]) > 0) {
    docs.push(await fillScheduleSE(c, displayName));
  }

  // Flatten each form and merge into one PDF
  const merged = await PDFDocument.create();
  for (const srcDoc of docs) {
    try { srcDoc.getForm().flatten(); } catch { /* skip if no form */ }
    const pageIndices = srcDoc.getPageIndices();
    const copied = await merged.copyPages(srcDoc, pageIndices);
    for (const page of copied) merged.addPage(page);
  }

  return merged.save();
}

// Extract a nested string from raw user data: get(data, "household.taxpayer.first_name")
function getStr(data: Record<string, unknown>, dotPath: string): string {
  const parts = dotPath.split(".");
  let cur: unknown = data;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return "";
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur == null ? "" : String(cur);
}

// Full AcroForm paths for the 5 filing-status checkboxes.
// Left column (Single, MFJ, MFS) are nested in Checkbox_ReadOrder; right column (HOH, QSS) are top-level.
const FILING_STATUS_CB: Record<string, string> = {
  single:                      "topmostSubform[0].Page1[0].Checkbox_ReadOrder[0].c1_8[0]",
  married_filing_jointly:      "topmostSubform[0].Page1[0].Checkbox_ReadOrder[0].c1_8[1]",
  married_filing_separately:   "topmostSubform[0].Page1[0].Checkbox_ReadOrder[0].c1_8[2]",
  head_of_household:           "topmostSubform[0].Page1[0].c1_8[0]",
  qualifying_surviving_spouse: "topmostSubform[0].Page1[0].c1_8[1]",
};

async function fill1040(c: ComputedValues, data: Record<string, unknown>): Promise<PDFDocument> {
  const doc = await loadPdf("f1040.pdf");
  const s = (field: string, val: unknown) =>
    ts(doc, field, typeof val === "string" ? val : fmt(val));
  const ss = (field: string, val: unknown) =>
    ts(doc, field, typeof val === "string" ? val : fmtSigned(val));

  // ── Page 1 ── Header: name, SSN, address, filing status ────────────────────
  const hh  = (data["household"] ?? {}) as Record<string, unknown>;
  const tp  = (hh["taxpayer"]   ?? {}) as Record<string, unknown>;
  const sp  = (hh["spouse"]     ?? {}) as Record<string, unknown>;
  const res = (hh["residence"]  ?? {}) as Record<string, unknown>;
  const pay = (hh["payments"]   ?? {}) as Record<string, unknown>;

  // Special header flags: "Filed pursuant to section 301.9100-2" (c1_1) and "Combat zone" (c1_2)
  if (hh["section_9100_2"]) tryCheckBox(doc, p(1, "c1_1[0]"), true);
  if (hh["combat_zone"])    tryCheckBox(doc, p(1, "c1_2[0]"), true);

  // Deceased taxpayer/spouse — f1_05–f1_07 = taxpayer MM/DD/YYYY, f1_08–f1_10 = spouse MM/DD/YYYY
  const fillDeceasedDate = (dateStr: string, mF: string, dF: string, yF: string) => {
    const parts = dateStr.split("-");  // ISO: YYYY-MM-DD
    if (parts.length === 3) {
      ts(doc, p(1, mF), parts[1] ?? "");   // MM
      ts(doc, p(1, dF), parts[2] ?? "");   // DD
      ts(doc, p(1, yF), parts[0] ?? "");   // YYYY
    }
  };
  const tpDod = String(hh["taxpayer_date_of_death"] ?? "");
  const spDod = String(hh["spouse_date_of_death"]   ?? "");
  if (tpDod) fillDeceasedDate(tpDod, "f1_05[0]", "f1_06[0]", "f1_07[0]");
  if (spDod) fillDeceasedDate(spDod, "f1_08[0]", "f1_09[0]", "f1_10[0]");

  const tpFirst = String(tp["first_name"] ?? "");
  const tpLast  = String(tp["last_name"]  ?? "");
  const tpSSN   = String(tp["ssn"]        ?? "");
  const spFirst = String(sp["first_name"] ?? "");
  const spLast  = String(sp["last_name"]  ?? "");
  const spSSN   = String(sp["ssn"]        ?? "");

  // f1_01–f1_13 are header/meta fields (fiscal year dates, deceased dates, etc.).
  // Name fields start at f1_14.
  ts(doc, p(1, "f1_14[0]"), tpFirst);              // Your first name + MI
  ts(doc, p(1, "f1_15[0]"), tpLast);               // Your last name
  ts(doc, p(1, "f1_16[0]"), tpSSN);                // Your SSN
  if (spFirst || spLast) {
    ts(doc, p(1, "f1_17[0]"), spFirst);             // Spouse first name + MI
    ts(doc, p(1, "f1_18[0]"), spLast);              // Spouse last name
    ts(doc, p(1, "f1_19[0]"), spSSN);               // Spouse SSN
  }

  // Address — Address_ReadOrder subform contains the address fields
  const street = String(res["street_address"] ?? "");
  const apt    = String(res["apt_number"]     ?? "");
  const city   = String(res["city"]   ?? "");
  const state  = String(res["state"]  ?? "");
  const zip    = String(res["zip"]    ?? "");
  const addr   = (base: string) => `topmostSubform[0].Page1[0].Address_ReadOrder[0].${base}`;
  ts(doc, addr("f1_20[0]"), street);               // Home address (number and street)
  ts(doc, addr("f1_21[0]"), apt);                  // Apt. no.
  ts(doc, addr("f1_22[0]"), city);                 // City, town, or post office
  ts(doc, addr("f1_23[0]"), state);                // State
  ts(doc, addr("f1_24[0]"), zip);                  // ZIP code

  // Foreign address (only present for non-U.S. mailing addresses)
  const foreignCountry  = String(res["foreign_country"]  ?? "");
  const foreignProvince = String(res["foreign_province"] ?? "");
  const foreignPostal   = String(res["foreign_postal_code"] ?? "");
  if (foreignCountry)  ts(doc, addr("f1_25[0]"), foreignCountry);   // Foreign country name
  if (foreignProvince) ts(doc, addr("f1_26[0]"), foreignProvince);  // Foreign province/state/county
  if (foreignPostal)   ts(doc, addr("f1_27[0]"), foreignPostal);    // Foreign postal code

  // Filing status checkbox — FILING_STATUS_CB stores the full AcroForm path
  const fs = String(c["_fs"] ?? getStr(data, "household.filing_status"));
  const cbKey = FILING_STATUS_CB[fs];
  if (cbKey) tryCheckBox(doc, cbKey, true);

  // HOH qualifying person name — filled when the qualifying person is NOT your dependent
  const hohQualifier = String(hh["hoh_qualifying_person_name"] ?? "");
  if (fs === "head_of_household" && hohQualifier) {
    ts(doc, "topmostSubform[0].Page1[0].Checkbox_ReadOrder[0].f1_28[0]", hohQualifier);
  }

  // Presidential Election Campaign — c1_6 = You, c1_7 = Spouse
  if (hh["presidential_campaign_you"])    tryCheckBox(doc, p(1, "c1_6[0]"), true);
  if (hh["presidential_campaign_spouse"]) tryCheckBox(doc, p(1, "c1_7[0]"), true);

  // Digital assets Yes/No (c1_10[0] = Yes, c1_10[1] = No)
  const digitalAssets = (hh["digital_assets"] as boolean | undefined) ?? false;
  tryCheckBox(doc, p(1, "c1_10[0]"), digitalAssets);
  tryCheckBox(doc, p(1, "c1_10[1]"), !digitalAssets);

  // ── Page 1 ── Dependents ────────────────────────────────────────────────────
  const depsSection = (data["dependents"] ?? {}) as Record<string, unknown>;
  const deps = (depsSection["dependents"] as Record<string, unknown>[]) ?? [];
  // The dependent table has rows=field types and columns=dependents 1–4.
  // Row1=first names (f1_31–f1_34), Row2=last names (f1_35–f1_38),
  // Row3=SSNs (f1_39–f1_42), Row4=relationships (f1_43–f1_46).
  const DEP_TABLE = "topmostSubform[0].Page1[0].Table_Dependents[0]";
  const depFnFields  = ["Row1[0].f1_31[0]","Row1[0].f1_32[0]","Row1[0].f1_33[0]","Row1[0].f1_34[0]"] as const;
  const depLnFields  = ["Row2[0].f1_35[0]","Row2[0].f1_36[0]","Row2[0].f1_37[0]","Row2[0].f1_38[0]"] as const;
  const depSsnFields = ["Row3[0].f1_39[0]","Row3[0].f1_40[0]","Row3[0].f1_41[0]","Row3[0].f1_42[0]"] as const;
  const depRelFields = ["Row4[0].f1_43[0]","Row4[0].f1_44[0]","Row4[0].f1_45[0]","Row4[0].f1_46[0]"] as const;
  // Dependent credit checkboxes (per row): child tax credit [0] vs other dependent credit [1]
  const depCreditCb = ["c1_28", "c1_29", "c1_30", "c1_31"] as const;
  // "Lived with you" Yes checkboxes
  const depLivedWithCb = [
    "topmostSubform[0].Page1[0].Table_Dependents[0].Row5[0].Dependent1[0].c1_12[0]",
    "topmostSubform[0].Page1[0].Table_Dependents[0].Row5[0].Dependent2[0].c1_14[0]",
    "topmostSubform[0].Page1[0].Table_Dependents[0].Row5[0].Dependent3[0].c1_16[0]",
    "topmostSubform[0].Page1[0].Table_Dependents[0].Row5[0].Dependent4[0].c1_18[0]",
  ] as const;
  // "Full-time student" checkboxes
  const depStudentCb = [
    "topmostSubform[0].Page1[0].Table_Dependents[0].Row6[0].Dependent1[0].c1_20[0]",
    "topmostSubform[0].Page1[0].Table_Dependents[0].Row6[0].Dependent2[0].c1_22[0]",
    "topmostSubform[0].Page1[0].Table_Dependents[0].Row6[0].Dependent3[0].c1_24[0]",
    "topmostSubform[0].Page1[0].Table_Dependents[0].Row6[0].Dependent4[0].c1_26[0]",
  ] as const;
  // "Permanently and totally disabled" checkboxes (Row6, adjacent to student checkboxes)
  const depDisabledCb = [
    "topmostSubform[0].Page1[0].Table_Dependents[0].Row6[0].Dependent1[0].c1_21[0]",
    "topmostSubform[0].Page1[0].Table_Dependents[0].Row6[0].Dependent2[0].c1_23[0]",
    "topmostSubform[0].Page1[0].Table_Dependents[0].Row6[0].Dependent3[0].c1_25[0]",
    "topmostSubform[0].Page1[0].Table_Dependents[0].Row6[0].Dependent4[0].c1_27[0]",
  ] as const;
  // "And in the U.S." checkboxes (Row5, checkbox (b) adjacent to lived-with-you (a))
  const depInUsCb = [
    "topmostSubform[0].Page1[0].Table_Dependents[0].Row5[0].Dependent1[0].c1_13[0]",
    "topmostSubform[0].Page1[0].Table_Dependents[0].Row5[0].Dependent2[0].c1_15[0]",
    "topmostSubform[0].Page1[0].Table_Dependents[0].Row5[0].Dependent3[0].c1_17[0]",
    "topmostSubform[0].Page1[0].Table_Dependents[0].Row5[0].Dependent4[0].c1_19[0]",
  ] as const;

  for (let i = 0; i < Math.min(deps.length, 4); i++) {
    const d = deps[i];
    const fullName = String(d["name"] ?? "").trim();
    const nameParts = fullName.split(/\s+/);
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ");
    ts(doc, `${DEP_TABLE}.${depFnFields[i]}`,  firstName);
    ts(doc, `${DEP_TABLE}.${depLnFields[i]}`,  lastName);
    ts(doc, `${DEP_TABLE}.${depSsnFields[i]}`, String(d["ssn"] ?? ""));
    ts(doc, `${DEP_TABLE}.${depRelFields[i]}`, String(d["relationship"] ?? ""));

    // "Lived with taxpayer" Yes checkbox + "And in the U.S." checkbox
    if (d["lives_with_taxpayer"] !== false) {
      tryCheckBox(doc, depLivedWithCb[i], true);
      tryCheckBox(doc, depInUsCb[i], true);        // assume in the U.S. when living with taxpayer
    }

    // Full-time student checkbox
    if (d["full_time_student"]) tryCheckBox(doc, depStudentCb[i], true);

    // Permanently and totally disabled checkbox
    if (d["disabled"]) tryCheckBox(doc, depDisabledCb[i], true);

    // Credit type checkbox
    const age = Number(d["age_at_year_end"] ?? 99);
    const isQualifyingChild = age < 17;
    const creditCbBase = `topmostSubform[0].Page1[0].Table_Dependents[0].Row7[0].Dependent${i + 1}[0].${depCreditCb[i]}`;
    tryCheckBox(doc, `${creditCbBase}[0]`, isQualifyingChild);   // Child tax credit
    tryCheckBox(doc, `${creditCbBase}[1]`, !isQualifyingChild);  // Credit for other dependents
  }

  // ── Page 1 ── Income checkboxes (Lines 4c, 5c, 6c, 7b) ─────────────────────
  const inc      = (data["income"]              ?? {}) as Record<string, unknown>;
  const retDist  = (inc["retirement_distributions"] ?? {}) as Record<string, unknown>;
  const ssBen    = (inc["social_security"]      ?? {}) as Record<string, unknown>;
  const invInc   = (inc["investment_income"]    ?? {}) as Record<string, unknown>;

  // Line 4c — IRA rollover (c1_35[0] = option 1 "Rollover"; c1_33–c1_34 are Line 3c)
  if (retDist["ira_rollover"])     tryCheckBox(doc, p(1, "c1_35[0]"), true);
  // Line 5c — Pension/annuity rollover (c1_38[0] = option 1 "Rollover"; c1_35–c1_37 are Line 4c)
  if (retDist["pension_rollover"]) tryCheckBox(doc, p(1, "c1_38[0]"), true);
  // Line 6c — SS lump-sum election (c1_41; c1_38–c1_40 are Line 5c)
  if (ssBen["lump_sum_election"])  tryCheckBox(doc, p(1, "c1_41[0]"), true);
  // Line 7b — Schedule D not required / includes child's capital gain (c1_43–c1_44; c1_42 is Line 6d)
  if (invInc["schedule_d_not_required"])    tryCheckBox(doc, p(1, "c1_43[0]"), true);
  if (invInc["child_capital_gain_included"]) tryCheckBox(doc, p(1, "c1_44[0]"), true);

  // ── Page 1 ── Income ────────────────────────────────────────────────────────
  s(p(1, "f1_47[0]"), c["wages"]);                // Line 1a  W-2 wages
  s(p(1, "f1_48[0]"), c["household_employee_wages"]); // Line 1b  household employee wages
  s(p(1, "f1_49[0]"), c["tip_income_unreported"]);    // Line 1c  tip income not on W-2
  s(p(1, "f1_50[0]"), c["medicaid_waiver_payments"]); // Line 1d  Medicaid waiver payments
  s(p(1, "f1_54[0]"), c["other_earned_income"]);      // Line 1h  other earned income
  s(p(1, "f1_55[0]"), c["taxable_interest"]);     // Line 2b  taxable interest
  s(p(1, "f1_56[0]"), c["ordinary_dividends"]);   // Line 3b  ordinary dividends
  s(p(1, "f1_57[0]"), c["qualified_dividends"]);  // Line 3a  qualified dividends
  s(p(1, "f1_58[0]"), c["ira_gross"]);            // Line 4a  IRA distributions (gross)
  s(p(1, "f1_59[0]"), c["ira_taxable"]);          // Line 4b  IRA distributions (taxable)
  s(p(1, "f1_60[0]"), c["pension_gross"]);        // Line 5a  pensions/annuities (gross)
  s(p(1, "f1_61[0]"), c["pension_taxable"]);      // Line 5b  pensions/annuities (taxable)
  s(p(1, "f1_62[0]"), c["ss_gross"]);             // Line 6a  Social Security benefits (gross)
  s(p(1, "f1_63[0]"), c["ss_taxable"]);           // Line 6b  Social Security benefits (taxable)
  ss(p(1, "f1_65[0]"), c["capital_gains_net"]);   // Line 7   capital gain or (loss)
  s(p(1, "f1_66[0]"), c["schedule1_additional"]); // Line 8   other income (Schedule 1 line 10)
  s(p(1, "f1_67[0]"), c["total_income"]);         // Line 9   total income
  s(p(1, "f1_68[0]"), c["total_adjustments"]);    // Line 10  adjustments to income
  s(p(1, "f1_69[0]"), c["agi"]);                  // Line 11  AGI

  s(p(1, "f1_70[0]"), c["deduction"]);            // Line 12  standard or itemized deduction
  s(p(1, "f1_71[0]"), c["qbi_deduction"]);        // Line 13  QBI deduction (§199A)
  const line14 = Number(c["deduction"] ?? 0) + Number(c["qbi_deduction"] ?? 0);
  s(p(1, "f1_72[0]"), line14);                    // Line 14  add lines 12 + 13
  s(p(1, "f1_73[0]"), c["taxable_income"]);       // Line 15  taxable income
  s(p(1, "f1_74[0]"), c["income_tax_before_credits"]); // Line 16  tax
  s(p(1, "f1_75[0]"), c["income_tax_before_credits"]); // Line 18  tax (no AMT in our calc)

  // ── Page 2 ── Deductions / taxable income carry-over ─────────────────────────
  // These fields repeat lines 11b-15 on the back page of the printed form
  s(p(2, "f2_01[0]"), c["agi"]);                       // Line 11b  AGI (carryover from page 1)

  // ── Page 2 ── Line 12a–d standard deduction modifier checkboxes ─────────────
  // Line 12a: Someone can claim you/spouse as a dependent
  if (tp["can_be_claimed_as_dependent"]) tryCheckBox(doc, p(2, "c2_1[0]"), true);  // You
  if (sp["can_be_claimed_as_dependent"]) tryCheckBox(doc, p(2, "c2_2[0]"), true);  // Spouse
  // Line 12b: Spouse itemizes on a separate return (MFS only)
  if (sp["itemizes_separately"]) tryCheckBox(doc, p(2, "c2_3[0]"), true);
  // Line 12c: Dual-status alien
  if (tp["dual_status_alien"]) tryCheckBox(doc, p(2, "c2_4[0]"), true);
  // Line 12d: Born before January 2, 1961 (age >= 65 at year-end) and Blind — You and Spouse
  const tpAge = Number(tp["age"] ?? 0);
  const spAge = Number(sp["age"] ?? 0);
  if (tpAge >= 65)         tryCheckBox(doc, p(2, "c2_5[0]"), true);   // You: born before Jan 2, 1961
  if (tp["blind"])         tryCheckBox(doc, p(2, "c2_6[0]"), true);   // You: blind
  if (spAge >= 65)         tryCheckBox(doc, p(2, "c2_7[0]"), true);   // Spouse: born before Jan 2, 1961
  if (sp["blind"])         tryCheckBox(doc, p(2, "c2_8[0]"), true);   // Spouse: blind

  s(p(2, "f2_02[0]"), c["deduction"]);                 // Line 12e  standard or itemized deduction
  s(p(2, "f2_03[0]"), c["qbi_deduction"]);             // Line 13a  QBI deduction (§199A)
  s(p(2, "f2_05[0]"), line14);                         // Line 14   add lines 12e + 13a + 13b
  s(p(2, "f2_06[0]"), c["taxable_income"]);            // Line 15   taxable income

  // ── Page 2 ── Tax, Credits, Payments ────────────────────────────────────────
  s(p(2, "f2_07[0]"), c["ctc_with_odc"]);              // Line 19  child tax credit + ODC (via Sch 8812)
  s(p(2, "f2_08[0]"), c["schedule3_line8"]);           // Line 20  Schedule 3, line 8
  s(p(2, "f2_09[0]"), c["total_credits"]);             // Line 21  total credits (Lines 19+20)
  s(p(2, "f2_10[0]"), c["income_tax_after_credits"]);  // Line 22  tax after credits
  s(p(2, "f2_11[0]"), c["se_tax"]);                    // Line 23  other taxes (SE tax)
  s(p(2, "f2_12[0]"), c["total_tax"]);                 // Line 24  total tax
  s(p(2, "f2_13[0]"), c["w2_withholding"]);            // Line 25a federal income tax withheld (W-2)
  s(p(2, "f2_14[0]"), c["other_withholding"]);         // Line 25b  1099 / other withholding
  const totalWithholding = Number(c["w2_withholding"] ?? 0) + Number(c["other_withholding"] ?? 0);
  s(p(2, "f2_17[0]"), totalWithholding);               // Line 25d  total withholding (25a+25b+25c)
  s(p(2, "f2_18[0]"), c["estimated_tax_payments"]);    // Line 26   estimated tax payments
  // Former spouse SSN for estimated payment allocation (Line 26 footnote — SSN_ReadOrder subform)
  const formerSpouseSSN = String(pay["former_spouse_ssn"] ?? "");
  if (formerSpouseSSN) ts(doc, "topmostSubform[0].Page2[0].SSN_ReadOrder[0].f2_22[0]", formerSpouseSSN);
  s(p(2, "f2_19[0]"), c["earned_income_credit"]);      // Line 27   Earned Income Credit
  s(p(2, "f2_20[0]"), c["additional_ctc"]);            // Line 28   Additional Child Tax Credit (Sch 8812)
  s(p(2, "f2_24[0]"), c["total_payments"]);            // Line 33   total payments

  if (Number(c["refund"] ?? 0) > 0) {
    s(p(2, "f2_25[0]"), c["refund"]);                  // Line 34   refund
    const applyToNext = Number(pay["apply_to_next_year"] ?? 0);
    const directRefund = Math.max(0, Number(c["refund"] ?? 0) - applyToNext);
    s(p(2, "f2_26[0]"), directRefund || c["refund"]);  // Line 35a  amount to refund (direct)
    if (applyToNext > 0) {
      s(p(2, "f2_27[0]"), applyToNext);               // Line 36   apply to 2026 estimated tax
    }
  } else {
    s(p(2, "f2_28[0]"), c["amount_owed"]);             // Line 37   amount owed
  }

  // Direct deposit routing / account / type
  const routing     = String(pay["routing_number"]  ?? "");
  const accountNum  = String(pay["account_number"]  ?? "");
  const accountType = String(pay["account_type"]    ?? "");
  if (routing)    ts(doc, `topmostSubform[0].Page2[0].RoutingNo[0].f2_32[0]`, routing);
  if (accountNum) ts(doc, `topmostSubform[0].Page2[0].AccountNo[0].f2_33[0]`, accountNum);
  if (accountType === "checking") tryCheckBox(doc, p(2, "c2_16[0]"), true);
  if (accountType === "savings")  tryCheckBox(doc, p(2, "c2_16[1]"), true);

  return doc;
}

async function fillSchedule1(c: ComputedValues): Promise<PDFDocument> {
  const doc = await loadPdf("f1040s1.pdf");
  const s = (field: string, val: unknown) =>
    ts(doc, field, typeof val === "string" ? val : fmt(val));
  const ss = (field: string, val: unknown) =>
    ts(doc, field, typeof val === "string" ? val : fmtSigned(val));

  // Header: name / SSN
  ts(doc, p(1, "f1_01[0]"), String(c["taxpayer_name"] ?? ""));
  ts(doc, p(1, "f1_02[0]"), String(c["taxpayer_ssn"]  ?? ""));

  // ── Page 1 ── Part I Additional Income ─────────────────────────────────────
  // Field positions: f1_01/02=name/SSN, f1_03=L1, f1_04=L2a, f1_05=L3(confirmed),
  //   f1_06=L4(other gains), f1_07=L5(confirmed), c1_1/c1_2=unknown checkboxes,
  //   f1_08=L6(farm, estimated), f1_09/f1_10=unknown,
  //   Line7_ReadOrder=L7(confirmed by subform), Line8a_ReadOrder=L8a(confirmed),
  //   f1_14=unknown, f1_15=L8b(confirmed), f1_16=L8c, f1_17–f1_34=L8d–L8v,
  //   Line8z_ReadOrder=L8z(confirmed by subform), f1_36=L8z amount, f1_37=L9, f1_38=L10.
  s(p(1, "f1_03[0]"), c["taxable_refunds"]);              // Line 1  taxable state/local refunds
  s(p(1, "f1_04[0]"), c["alimony_received"]);             // Line 2a alimony received (pre-2019)
  ss(p(1, "f1_05[0]"), c["schedule_c_profit"]);           // Line 3  business income (Sch C)
  ss(p(1, "f1_07[0]"), c["schedule_e_net"]);              // Line 5  rental/royalties/K-1 (Sch E)
  ss(p(1, "f1_08[0]"), c["farm_income"]);                 // Line 6  farm income (estimated field)
  // Line 7: unemployment compensation (subform confirmed by field name)
  if (Number(c["unemployment_compensation"] ?? 0) !== 0) {
    tryCheckBox(doc, p(1, "Line7_ReadOrder[0].c1_3[0]"), true);
  }
  ss(p(1, "Line7_ReadOrder[0].f1_11[0]"), c["unemployment_compensation"]);  // Line 7
  ss(p(1, "Line8a_ReadOrder[0].f1_13[0]"), c["net_operating_loss"]);        // Line 8a NOL
  s(p(1, "f1_15[0]"), c["gambling_winnings"]);            // Line 8b gambling winnings
  s(p(1, "f1_16[0]"), c["canceled_debt"]);                // Line 8c cancellation of debt
  // Line 8z: prizes/awards + other misc (subform confirmed by field name)
  if (Number(c["line8z_amount"] ?? 0) !== 0) {
    ts(doc, p(1, "Line8z_ReadOrder[0].f1_35[0]"), String(c["line8z_desc"] ?? "Other income"));
    s(p(1, "f1_36[0]"), c["line8z_amount"]);              // Line 8z amount
  }
  s(p(1, "f1_37[0]"), c["schedule1_line9"]);              // Line 9  total Lines 8a–8z
  s(p(1, "f1_38[0]"), c["schedule1_additional"]);         // Line 10 carry to Form 1040 line 8

  // ── Page 2 ── Part II Adjustments ──────────────────────────────────────────
  // Field order verified via mapFieldPositions.mjs (Y-coordinate anchors):
  //   f2_10 is in "Line19b_CombField" → f2_09 = Line 19a (one row above)
  //   f2_16 is in "Line24a_ReadOrder", f2_27 in "Line24z_ReadOrder"
  //   counting back: f2_12=L20, f2_13=L21; f2_28=L24z amount, f2_29=L25 total, f2_30=L26
  //   Lines 12 and 18 have no AcroForm field in this PDF.
  s(p(2, "f2_03[0]"), c["educator_expenses"]);            // Line 11 educator expenses
  s(p(2, "f2_04[0]"), c["hsa_outside_payroll"]);          // Line 13 HSA deduction
  s(p(2, "f2_05[0]"), c["moving_expenses_military"]);     // Line 14 moving expenses (military)
  s(p(2, "f2_06[0]"), c["se_tax_deduction"]);             // Line 15 deductible part of SE tax
  s(p(2, "f2_07[0]"), c["sep_simple_contributions"]);     // Line 16 SEP/SIMPLE/qualified plan
  s(p(2, "f2_08[0]"), c["se_health_insurance"]);          // Line 17 SE health insurance
  s(p(2, "f2_09[0]"), c["alimony_paid"]);                 // Line 19a alimony paid
  // Line 19b: recipient SSN — CombField accepts 9 digits only (no dashes)
  if (c["alimony_recipient_ssn"]) {
    const ssn19b = String(c["alimony_recipient_ssn"]).replace(/\D/g, "");
    ts(doc, p(2, "Line19b_CombField[0].f2_10[0]"), ssn19b);
  }
  s(p(2, "f2_12[0]"), c["ira_deduction"]);                // Line 20 IRA deduction
  s(p(2, "f2_13[0]"), c["student_loan_interest"]);        // Line 21 student loan interest
  // Line 24z: other adjustments (subform confirmed by field name)
  if (Number(c["other_adjustments_amount"] ?? 0) !== 0) {
    ts(doc, p(2, "Line24z_ReadOrder[0].f2_27[0]"), String(c["other_adjustments_desc"] ?? "Other"));
    s(p(2, "f2_28[0]"), c["other_adjustments_amount"]);   // Line 24z amount
    s(p(2, "f2_29[0]"), c["other_adjustments_amount"]);   // Line 25 sum of Line 24 items
  }
  s(p(2, "f2_30[0]"), c["total_adjustments"]);            // Line 26 total adjustments

  return doc;
}

async function fillScheduleB(c: ComputedValues): Promise<PDFDocument> {
  const doc = await loadPdf("f1040sb.pdf");
  const s = (field: string, val: unknown) =>
    ts(doc, field, typeof val === "string" ? val : fmt(val));

  // Header: name / SSN
  ts(doc, p(1, "f1_01[0]"), String(c["taxpayer_name"] ?? ""));
  ts(doc, p(1, "f1_02[0]"), String(c["taxpayer_ssn"]  ?? ""));

  // ── Part I Interest ─────────────────────────────────────────────────────────
  if (Number(c["taxable_interest"] ?? 0) > 0) {
    // Row 1 payer name (nested in Line1_ReadOrder)
    ts(doc, `topmostSubform[0].Page1[0].Line1_ReadOrder[0].f1_03[0]`, "Various payers");
    s(p(1, "f1_04[0]"), c["taxable_interest"]);   // Row 1 amount
    s(p(1, "f1_33[0]"), c["taxable_interest"]);   // Line 2  total interest
    // Line 4 taxable interest (nested in ReadOrderControl)
    ts(doc, `topmostSubform[0].Page1[0].ReadOrderControl[0].f1_34[0]`,
      fmt(c["taxable_interest"]));
  }

  // ── Part II Ordinary Dividends ──────────────────────────────────────────────
  if (Number(c["ordinary_dividends"] ?? 0) > 0) {
    s(p(1, "f1_35[0]"), "Various payers");        // Row 1 payer name
    s(p(1, "f1_36[0]"), c["ordinary_dividends"]); // Row 1 amount
    s(p(1, "f1_65[0]"), c["ordinary_dividends"]); // Line 6  total ordinary dividends
  }

  // ── Part III Foreign Accounts and Trusts ────────────────────────────────────
  // Line 7a: foreign financial account Yes/No
  const hasForeign = Boolean(c["foreign_financial_account"]);
  tryCheckBox(doc, `topmostSubform[0].Page1[0].TagcorrectingSubform[0].c1_1[0]`, hasForeign);
  tryCheckBox(doc, `topmostSubform[0].Page1[0].TagcorrectingSubform[0].c1_1[1]`, !hasForeign);
  // Line 7b: foreign country name text field
  if (hasForeign && c["foreign_account_country"]) {
    ts(doc, p(1, "f1_66[0]"), String(c["foreign_account_country"]));
  }
  // Line 8: foreign trust Yes/No
  const hasForeignTrust = Boolean(c["foreign_trust"]);
  tryCheckBox(doc, p(1, "c1_3[0]"), hasForeignTrust);
  tryCheckBox(doc, p(1, "c1_3[1]"), !hasForeignTrust);

  return doc;
}

async function fillScheduleC(
  biz: Record<string, unknown>,
  displayName: string,
  taxpayerSSN = ""
): Promise<PDFDocument> {
  const doc = await loadPdf("f1040sc.pdf");
  const s = (field: string, val: unknown) =>
    ts(doc, field, typeof val === "string" ? val : fmt(val));
  const ss = (field: string, val: unknown) =>
    ts(doc, field, typeof val === "string" ? val : fmtSigned(val));

  const gross = Number(biz["gross_revenue"] ?? 0);
  const expenses = Number(biz["expenses"] ?? 0);
  const net = Number(biz["net_profit_loss"] ?? 0);

  // Header
  ts(doc, `topmostSubform[0].Page1[0].f1_1[0]`, displayName);
  ts(doc, `topmostSubform[0].Page1[0].f1_2[0]`, taxpayerSSN);                         // Taxpayer SSN
  ts(doc, `topmostSubform[0].Page1[0].f1_3[0]`, String(biz["naics_code"] ?? ""));     // Line A principal business / NAICS code
  ts(doc, `topmostSubform[0].Page1[0].BComb[0].f1_4[0]`, String(biz["business_name"] ?? ""));
  ts(doc, `topmostSubform[0].Page1[0].DComb[0].f1_6[0]`, String(biz["ein"] ?? ""));   // Line D employer ID (EIN)

  // ── Part I Income ───────────────────────────────────────────────────────────
  s(`topmostSubform[0].Page1[0].f1_10[0]`, gross);  // Line 1  gross receipts
  s(`topmostSubform[0].Page1[0].f1_12[0]`, gross);  // Line 3  gross receipts less returns
  s(`topmostSubform[0].Page1[0].f1_14[0]`, gross);  // Line 5  gross profit
  s(`topmostSubform[0].Page1[0].f1_16[0]`, gross);  // Line 7  gross income

  // ── Part II Expenses ────────────────────────────────────────────────────────
  s(`topmostSubform[0].Page1[0].f1_41[0]`, expenses); // Line 28 total expenses
  ss(`topmostSubform[0].Page1[0].f1_42[0]`, net);     // Line 29 tentative profit
  ss(`topmostSubform[0].Page1[0].f1_45[0]`, net);     // Line 31 net profit or (loss)

  return doc;
}

async function fillSchedule3(c: ComputedValues): Promise<PDFDocument> {
  const doc = await loadPdf("f1040s3.pdf");
  const s = (field: string, val: unknown) =>
    ts(doc, field, typeof val === "string" ? val : fmt(val));

  // Header: name / SSN
  ts(doc, p(1, "f1_01[0]"), String(c["taxpayer_name"] ?? ""));
  ts(doc, p(1, "f1_02[0]"), String(c["taxpayer_ssn"]  ?? ""));

  // ── Part I: Nonrefundable credits ──────────────────────────────────────────
  // Line 2: Child and dependent care credit (Form 2441)
  if (Number(c["child_care_credit"] ?? 0) > 0)
    s(p(1, "f1_04[0]"), c["child_care_credit"]);

  // Line 3: Education credits (Form 8863)
  if (Number(c["education_credit"] ?? 0) > 0)
    s(p(1, "f1_05[0]"), c["education_credit"]);

  // Line 6f: Clean vehicle credit (§30D)
  if (Number(c["ev_credit"] ?? 0) > 0) {
    s(p(1, "f1_14[0]"), c["ev_credit"]);
  }

  // Line 7: Sum of Lines 6a–6z (only EV credit for now)
  const sch3Line7 = Number(c["ev_credit"] ?? 0);
  if (sch3Line7 > 0) s(p(1, "f1_24[0]"), sch3Line7);

  // Line 8: Lines 1 + 2 + 3 + 4 + 5 + 7 → Form 1040 Line 20
  s(p(1, "f1_25[0]"), c["schedule3_line8"]);

  return doc;
}

async function fillSchedule8812(c: ComputedValues): Promise<PDFDocument> {
  const doc = await loadPdf("f1040s8812.pdf");
  const s = (field: string, val: unknown) =>
    ts(doc, field, typeof val === "string" ? val : fmt(val));

  const qualChildren = Number(c["qualifying_children"] ?? 0);
  const otherDepCount = Number(c["other_dependent_count"] ?? 0);
  const agi = Number(c["agi"] ?? 0);
  const ctcThresh = Number(c["ctc_phaseout_threshold"] ?? 200000);
  const ctcPerChild = Number(c["ctc_per_child"] ?? 2000);

  // Header: name / SSN (Schedule 8812 uses f1_1 not f1_01)
  ts(doc, p(1, "f1_1[0]"), String(c["taxpayer_name"] ?? ""));
  ts(doc, p(1, "f1_2[0]"), String(c["taxpayer_ssn"]  ?? ""));

  // ── Page 1 ── Part I: CTC computation ──────────────────────────────────────
  s(p(1, "f1_3[0]"), c["agi"]);                           // Line 1 — AGI

  const line5 = qualChildren * ctcPerChild;
  const line7 = otherDepCount * 500;
  const line8 = line5 + line7;

  s(p(1, "f1_9[0]"), qualChildren);                       // Line 4 — qualifying children count
  s(p(1, "f1_10[0]"), line5);                             // Line 5 — Line 4 × $2,000

  if (otherDepCount > 0) {
    ts(doc, p(1, "Line6ReadOrder[0].f1_11[0]"), String(otherDepCount)); // Line 6 — other dependents
    s(p(1, "f1_12[0]"), line7);                           // Line 7 — Line 6 × $500
  }

  s(p(1, "f1_13[0]"), line8);                             // Line 8 — total max credit before phaseout

  // Lines 9–12: phaseout
  s(p(1, "f1_14[0]"), ctcThresh);                         // Line 9 — phaseout threshold
  const agiExcess = Math.max(0, agi - ctcThresh);
  const line10 = agiExcess > 0 ? Math.ceil(agiExcess / 1000) * 1000 : 0;
  const line11 = Math.min(line8, Math.round(line10 * 0.05));
  const line12 = Math.max(0, line8 - line11);

  if (line10 > 0) s(p(1, "f1_15[0]"), line10);           // Line 10 — excess over threshold
  if (line11 > 0) s(p(1, "f1_16[0]"), line11);           // Line 11 — Line 10 × 5%
  s(p(1, "f1_17[0]"), line12);                            // Line 12 — credit after phaseout

  // Line 12 checkbox: "Is line 12 more than zero?"
  tryCheckBox(doc, p(1, "c1_1[0]"), line12 <= 0);         // No
  tryCheckBox(doc, p(1, "c1_1[1]"), line12 > 0);          // Yes

  if (line12 <= 0) return doc;

  // Line 13: Credit Limit Worksheet A (simplified — income tax before any credits)
  const line13 = Number(c["income_tax_before_credits"] ?? 0);
  const line14 = Math.min(line12, line13);
  s(p(1, "f1_18[0]"), line13);                            // Line 13 — credit limit
  s(p(1, "f1_19[0]"), line14);                            // Line 14 → Form 1040 Line 19

  // ── Page 2 ── Part II-A: ACTC computation ──────────────────────────────────
  const earnedIncome = Number(c["earned_income"] ?? 0);
  const line16a = Math.max(0, line12 - line14);
  const line16b = qualChildren * 1700;
  const line17 = Math.min(line16a, line16b);

  if (line16a > 0) s(p(2, "f2_2[0]"), line16a);          // Line 16a — Line 12 − Line 14
  s(p(2, "f2_3[0]"), line16b);                            // Line 16b — qualifying × $1,700
  if (line17 > 0) s(p(2, "f2_4[0]"), line17);            // Line 17 — min(16a, 16b)
  s(p(2, "f2_5[0]"), earnedIncome);                       // Line 18a — earned income

  // "Is line 16b less than $5,100?" (controls Part II-A vs II-B path)
  const partA = line16b < 5100;
  tryCheckBox(doc, p(2, "c2_2[0]"), !partA);              // No → Part II-B
  tryCheckBox(doc, p(2, "c2_2[1]"), partA);               // Yes → Part II-A

  // Part II-A: "Is earned income more than $2,500?"
  const earnedOver = earnedIncome > 2500;
  tryCheckBox(doc, p(2, "c2_1[0]"), !earnedOver);         // No → ACTC = 0
  tryCheckBox(doc, p(2, "c2_1[1]"), earnedOver);          // Yes → continue

  if (earnedOver) {
    const line19 = Math.max(0, earnedIncome - 2500);
    const line20 = Math.round(line19 * 0.15);
    const line27 = Math.min(line17, line20);
    s(p(2, "f2_8[0]"), line19);                           // Line 19 — earned − $2,500
    s(p(2, "f2_9[0]"), line20);                           // Line 20 — Line 19 × 15%
    if (line27 > 0) s(p(2, "f2_16[0]"), line27);         // Line 27 — ACTC → Form 1040 Line 28
  }

  return doc;
}

async function fillScheduleD(c: ComputedValues): Promise<PDFDocument> {
  const doc = await loadPdf("f1040sd.pdf");
  const ss = (field: string, val: unknown) =>
    ts(doc, field, typeof val === "string" ? val : fmtSigned(val));

  // Header: name / SSN
  ts(doc, `topmostSubform[0].Page1[0].f1_1[0]`, String(c["taxpayer_name"] ?? ""));
  ts(doc, `topmostSubform[0].Page1[0].f1_2[0]`, String(c["taxpayer_ssn"]  ?? ""));

  const stcg = Number(c["stcg"] ?? 0);
  const ltcg = Number(c["ltcg"] ?? 0);
  const netCg = stcg + ltcg;

  // ── Part I Short-term ───────────────────────────────────────────────────────
  if (stcg !== 0) {
    // Row 1a: description, gain/loss (column h)
    ts(doc, `topmostSubform[0].Page1[0].Table_PartI[0].Row1a[0].f1_3[0]`, "Various");
    ss(`topmostSubform[0].Page1[0].Table_PartI[0].Row1a[0].f1_6[0]`, stcg);
  }
  ss(`topmostSubform[0].Page1[0].f1_22[0]`, stcg);  // Line 7  net short-term gain/(loss)

  // ── Part II Long-term ───────────────────────────────────────────────────────
  if (ltcg !== 0) {
    // Row 8a: description, gain/loss (column h)
    ts(doc, `topmostSubform[0].Page1[0].Table_PartII[0].Row8a[0].f1_23[0]`, "Various");
    ss(`topmostSubform[0].Page1[0].Table_PartII[0].Row8a[0].f1_26[0]`, ltcg);
  }
  ss(`topmostSubform[0].Page1[0].f1_42[0]`, ltcg);  // Line 14 net long-term gain/(loss)
  ss(`topmostSubform[0].Page1[0].f1_43[0]`, netCg > 0 ? netCg : 0); // Line 15 carry to 1040

  // ── Part III ────────────────────────────────────────────────────────────────
  ss(`topmostSubform[0].Page2[0].f2_2[0]`, netCg);  // Line 16 combined net gain/(loss)

  return doc;
}

async function fillScheduleSE(
  c: ComputedValues,
  displayName: string
): Promise<PDFDocument> {
  const doc = await loadPdf("f1040sse.pdf");
  const s = (field: string, val: unknown) =>
    ts(doc, field, typeof val === "string" ? val : fmt(val));

  const seProfit = Number(c["schedule_c_profit"] ?? 0);
  const seNet = seProfit * 0.9235;
  const ssBase = 176100; // 2025 SS wage base
  const ssWages = Math.min(Number(c["wages"] ?? 0), ssBase);
  const line9 = Math.max(0, ssBase - ssWages);
  const ssSe = Math.max(0, Math.min(seNet, line9) * 0.124);
  const medSe = seNet * 0.029;
  const seTax = Number(c["se_tax"] ?? 0);
  const seDeduction = Number(c["se_tax_deduction"] ?? 0);

  // Header: name / SSN
  ts(doc, `topmostSubform[0].Page1[0].f1_1[0]`, displayName);
  ts(doc, `topmostSubform[0].Page1[0].f1_2[0]`, String(c["taxpayer_ssn"] ?? ""));

  // ── Part I Long Schedule SE ─────────────────────────────────────────────────
  s(`topmostSubform[0].Page1[0].f1_5[0]`, seProfit);           // Line 2  Sch C net profit
  s(`topmostSubform[0].Page1[0].f1_6[0]`, seProfit);           // Line 3  combine 1a+1b+2
  s(`topmostSubform[0].Page1[0].f1_7[0]`, Math.max(0, seNet)); // Line 4a ×0.9235
  s(`topmostSubform[0].Page1[0].f1_9[0]`, Math.max(0, seNet)); // Line 4c net SE earnings
  s(`topmostSubform[0].Page1[0].f1_12[0]`, Math.max(0, seNet));// Line 6  net SE earnings (min $400 test)
  s(`topmostSubform[0].Page1[0].f1_13[0]`,                     // Line 7  maximum SS wage base
    ssBase.toLocaleString("en-US"));
  // Line 8a: W-2 SS wages (nested path)
  ts(doc, `topmostSubform[0].Page1[0].Line8a_ReadOrder[0].f1_14[0]`,
    Number(c["wages"] ?? 0) > 0 ? fmt(Number(c["wages"])) : "");
  s(`topmostSubform[0].Page1[0].f1_17[0]`, ssWages);           // Line 8d total SS wages
  s(`topmostSubform[0].Page1[0].f1_18[0]`, line9);             // Line 9  remaining room
  s(`topmostSubform[0].Page1[0].f1_19[0]`, ssSe);              // Line 10 SS portion (12.4%)
  s(`topmostSubform[0].Page1[0].f1_20[0]`, medSe);             // Line 11 Medicare (2.9%)
  s(`topmostSubform[0].Page1[0].f1_21[0]`, seTax);             // Line 12 SE tax total
  s(`topmostSubform[0].Page1[0].f1_22[0]`, seDeduction);       // Line 13 deduction (50%)

  return doc;
}
