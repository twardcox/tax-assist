import { getSectionData } from "../../db/sectionRepo";
import { getFilingDetails } from "../../db/filingDetailsRepo";
import { getUserById } from "../../db/authRepo";
import { TaxCalculator, type ComputedValues } from "./taxCalculator";
import { buildSummaryText } from "./summaryText";
import { createZip } from "./zipWriter";
import { fillIrsForms } from "./fillIrsForms";

export type { ComputedValues };
export { TaxCalculator };

export type TaxFigures = {
  tax_year: number;
  display_name: string;
  filing_status: string;
  computed: ComputedValues;
};

const TAX_SECTIONS = [
  "household", "income", "businesses", "real_estate",
  "investments", "retirement", "healthcare", "dependents",
  "goals", "documents_index",
] as const;

export function loadAllUserData(userId: string, taxYear: number): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const section of TAX_SECTIONS) {
    data[section] = getSectionData(userId, taxYear, section);
  }
  return data;
}

export function computeTaxFigures(userId: string, taxYear: number): TaxFigures {
  const data = loadAllUserData(userId, taxYear);
  const user = getUserById(userId);
  const displayName = user?.display_name || user?.email || "";

  const calc = new TaxCalculator(data, taxYear);
  const c = calc.compute();
  const fs = calc.filingStatus();

  c["_fs"] = fs;
  c["p_ctc"] = taxYear === 2024 ? 2000 : 2000;

  c["_need_sch_a"] = !c["using_standard"];
  c["_need_sch_b"] = (Number(c["taxable_interest"]) + Number(c["ordinary_dividends"])) > 0;
  c["_need_sch_c"] = Array.isArray(c["schedule_c_records"]) && (c["schedule_c_records"] as unknown[]).length > 0;
  c["_need_sch_d"] = Number(c["capital_gains_net"]) !== 0 || Number(c["stcg"]) !== 0 || Number(c["ltcg"]) !== 0;
  c["_need_sch_e"] = Array.isArray(c["schedule_e_records"]) && (c["schedule_e_records"] as unknown[]).length > 0;
  c["_need_sch_se"] = Number(c["se_tax"]) > 0;
  c["_need_sch3"] = Number(c["schedule3_line8"]) > 0;
  c["_need_sch8812"] = (Number(c["qualifying_children"]) + Number(c["other_dependent_count"])) > 0;

  return {
    tax_year: taxYear,
    display_name: displayName,
    filing_status: fs.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    computed: c,
  };
}

export async function buildFormPackage(userId: string, taxYear: number): Promise<Buffer> {
  const data = loadAllUserData(userId, taxYear);
  const user = getUserById(userId);
  const displayName = user?.display_name || user?.email || "";

  const calc = new TaxCalculator(data, taxYear);
  const c = calc.compute();
  const fs = calc.filingStatus();
  c["_fs"] = fs;
  c["p_ctc"] = 2000;

  const fd = getFilingDetails(userId, taxYear);
  c["_routing"] = fd.direct_deposit_routing ?? "";
  c["_account"] = fd.direct_deposit_account ?? "";
  c["_dd_type"] = fd.direct_deposit_type ?? "";
  c["_designee_name"] = fd.allow_third_party ? (fd.designee_name ?? "") : "";
  c["_designee_phone"] = fd.allow_third_party ? (fd.designee_phone ?? "") : "";
  c["_designee_pin"] = fd.allow_third_party ? (fd.designee_pin ?? "") : "";

  const summaryText = buildSummaryText(c, data, taxYear, displayName);
  const pdfBytes = await fillIrsForms(c, displayName, taxYear, data);

  const needSchSe = Number(c["se_tax"]) > 0;
  const schCRecords = (c["schedule_c_records"] as Record<string, unknown>[]) ?? [];

  const formsIncluded = ["Form 1040 — U.S. Individual Income Tax Return"];
  if (Number(c["total_adjustments"]) > 0 || Number(c["schedule1_additional"]) !== 0) {
    formsIncluded.push("Schedule 1 — Additional Income and Adjustments");
  }
  if (!c["using_standard"]) {
    formsIncluded.push("Schedule A — Itemized Deductions");
  }
  if ((Number(c["taxable_interest"]) + Number(c["ordinary_dividends"])) > 1500) {
    formsIncluded.push("Schedule B — Interest and Ordinary Dividends");
  }
  if ((Number(c["qualifying_children"]) + Number(c["other_dependent_count"])) > 0) {
    formsIncluded.push("Schedule 8812 — Credits for Qualifying Children and Other Dependents");
  }
  if (Number(c["schedule3_line8"]) > 0) {
    formsIncluded.push("Schedule 3 — Additional Credits and Payments");
  }
  for (const biz of schCRecords) {
    formsIncluded.push(`Schedule C — ${biz["business_name"]}`);
  }
  if (Number(c["capital_gains_net"]) !== 0) {
    formsIncluded.push("Schedule D — Capital Gains and Losses");
  }
  if (Array.isArray(c["schedule_e_records"]) && (c["schedule_e_records"] as unknown[]).length > 0) {
    formsIncluded.push("Schedule E — Supplemental Income and Loss");
  }
  if (needSchSe) {
    formsIncluded.push("Schedule SE — Self-Employment Tax");
  }

  const instructions = buildInstructions(displayName, taxYear, c, formsIncluded);

  const manifest = JSON.stringify(
    {
      tax_year: taxYear,
      display_name: displayName,
      filing_status: fs,
      forms_included: formsIncluded,
      key_figures: {
        agi: c["agi"],
        taxable_income: c["taxable_income"],
        total_tax: c["total_tax"],
        total_payments: c["total_payments"],
        refund: c["refund"],
        amount_owed: c["amount_owed"],
        effective_rate: c["effective_rate"],
        marginal_rate: c["marginal_rate"],
      },
    },
    null,
    2
  );

  return createZip([
    { name: `form_1040_filled_${taxYear}.pdf`, data: Buffer.from(pdfBytes) },
    { name: `00_data_summary_${taxYear}.txt`, data: Buffer.from(summaryText, "utf8") },
    { name: "manifest.json", data: Buffer.from(manifest, "utf8") },
    { name: "INSTRUCTIONS_FOR_CPA.txt", data: Buffer.from(instructions, "utf8") },
  ]);
}

function buildInstructions(
  displayName: string,
  taxYear: number,
  c: ComputedValues,
  forms: string[]
): string {
  const now = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const formList = forms.map((f) => `  • ${f}`).join("\n");
  const refund = Number(c["refund"] ?? 0);
  const owed = Number(c["amount_owed"] ?? 0);
  const resultLine = refund > 0
    ? `REFUND:         $${Math.round(refund).toLocaleString("en-US")}`
    : `AMOUNT DUE:     $${Math.round(owed).toLocaleString("en-US")}`;

  return `UTBIS — TAX FORM PACKAGE INSTRUCTIONS FOR CPA
================================================================================
Client:    ${displayName}
Tax Year:  ${taxYear}
Generated: ${now}

PACKAGE CONTENTS
----------------
  00_data_summary_${taxYear}.txt
      Primary deliverable. Contains all computed tax figures organized
      by form line number. Read this first.

${formList}
      Forms needed based on taxpayer data.
      Note: Fill official IRS PDFs from irs.gov using the figures in the summary.

  manifest.json
      Machine-readable summary of key computed figures.

  INSTRUCTIONS_FOR_CPA.txt
      This file.

SUMMARY OF KEY FIGURES
-----------------------
  Filing Status:      ${(c["_fs"] as string || "").replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
  AGI:               $${Math.round(Number(c["agi"] ?? 0)).toLocaleString("en-US").padStart(12)}
  Taxable Income:    $${Math.round(Number(c["taxable_income"] ?? 0)).toLocaleString("en-US").padStart(12)}
  Total Tax:         $${Math.round(Number(c["total_tax"] ?? 0)).toLocaleString("en-US").padStart(12)}
  Total Payments:    $${Math.round(Number(c["total_payments"] ?? 0)).toLocaleString("en-US").padStart(12)}
  ${resultLine}
  Effective Rate:     ${Number(c["effective_rate"] ?? 0).toFixed(1)}%
  Marginal Rate:      ${Number(c["marginal_rate"] ?? 0).toFixed(1)}%

IMPORTANT NOTES
---------------
1. The data-summary file is computer-generated from taxpayer input. All figures
   must be reconciled against official source documents (W-2s, 1099s, K-1s,
   brokerage statements).

2. Official IRS forms must be downloaded from irs.gov and completed manually
   using the figures in 00_data_summary_${taxYear}.txt.

3. Items flagged [CPA REVIEW] in the summary require professional judgment
   before filing.

4. This package covers FEDERAL returns only. Prepare state returns separately
   using the federal AGI as the starting point.

5. Do not file these forms without CPA review and client signature.

CONTACT / QUESTIONS
-------------------
Generated by: UTBIS — Universal Tax Benefit Intelligence System
================================================================================
`;
}
