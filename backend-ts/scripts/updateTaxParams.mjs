/**
 * Regenerates src/domain/taxForms/taxParams.generated.ts from PolicyEngine US.
 *
 * PolicyEngine US (https://github.com/PolicyEngine/policyengine-us) maintains
 * machine-readable US tax law parameters as YAML, with citations to the IRC
 * and IRS revenue procedures. This script fetches the specific parameters the
 * TaxCalculator needs, maps them into our TaxParams shape, and writes a
 * checked-in snapshot. Runtime never touches the network.
 *
 * Usage:  node scripts/updateTaxParams.mjs
 * Then:   review the git diff of taxParams.generated.ts, run npm test.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const YEARS = [2024, 2025];
const REPO = "PolicyEngine/policyengine-us";
const PARAMS_ROOT = "policyengine_us/parameters/gov/irs";

const FILING_STATUSES = {
  single: "SINGLE",
  married_filing_jointly: "JOINT",
  married_filing_separately: "SEPARATE",
  head_of_household: "HEAD_OF_HOUSEHOLD",
  qualifying_surviving_spouse: "SURVIVING_SPOUSE",
};

// Every YAML file we need, relative to PARAMS_ROOT.
const FILES = [
  "deductions/standard/amount.yaml",
  "deductions/standard/aged_or_blind/amount.yaml",
  "income/bracket.yaml",
  "capital_gains/thresholds.yaml",
  "payroll/social_security/cap.yaml",
  "credits/ctc/amount/base.yaml",
  "credits/ctc/phase_out/threshold.yaml",
  "investment/net_investment_income_tax/threshold.yaml",
  "income/amt/exemption/amount.yaml",
  "deductions/itemized/salt_and_real_estate/cap.yaml",
  "deductions/itemized/salt_and_real_estate/phase_out/in_effect.yaml",
  "deductions/itemized/salt_and_real_estate/phase_out/threshold.yaml",
  "deductions/itemized/salt_and_real_estate/phase_out/rate.yaml",
];

const OBBBA_FILES = {
  tipsCap: "deductions/tip_income/cap.yaml",
  tipsPhaseStart: "deductions/tip_income/phase_out/start.yaml",
  tipsPhaseRate: "deductions/tip_income/phase_out/rate.yaml",
  overtimeCap: "deductions/overtime_income/cap.yaml",
  overtimePhaseStart: "deductions/overtime_income/phase_out/start.yaml",
  overtimePhaseRate: "deductions/overtime_income/phase_out/rate.yaml",
  carLoanCap: "deductions/auto_loan_interest/cap.yaml",
  carLoanPhaseStart: "deductions/auto_loan_interest/phase_out/start.yaml",
  carLoanPhaseIncrement: "deductions/auto_loan_interest/phase_out/increment.yaml",
  carLoanPhaseStep: "deductions/auto_loan_interest/phase_out/step.yaml",
  seniorAmount: "deductions/senior_deduction/amount.yaml",
  seniorPhaseRateJoint: "deductions/senior_deduction/phase_out_rate/joint.yaml",
  seniorPhaseRateOther: "deductions/senior_deduction/phase_out_rate/other.yaml",
};

// OBBBA (H.R.1, 119th Congress) statutory values, in effect 2025–2028.
// §70201 tips, §70202 overtime, §70203 car-loan interest, §70103 senior.
// Used verbatim when PolicyEngine publishes no parameter path for a value.
const OBBBA_STATUTORY = {
  tips_cap: 25000,
  overtime_cap: { single: 12500, married_filing_jointly: 25000 },
  tips_overtime_phase_threshold: { single: 150000, married_filing_jointly: 300000 },
  tips_overtime_phase_rate: 0.10,
  car_loan_cap: 10000,
  car_loan_phase_threshold: { single: 100000, married_filing_jointly: 200000 },
  car_loan_phase_rate: 0.20,
  senior_amount: 6000,
  senior_phase_threshold: { single: 75000, married_filing_jointly: 150000 },
  senior_phase_rate: 0.06,
};

// PolicyEngine numbers may arrive as "15_750" strings (YAML 1.1 style) or .inf.
function num(raw) {
  if (typeof raw === "number") return raw;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const cleaned = raw.replaceAll("_", "");
    if (cleaned === ".inf" || cleaned === "inf") return Infinity;
    const n = Number(cleaned);
    if (Number.isFinite(n) || n === Infinity) return n;
  }
  throw new Error(`Cannot parse numeric value: ${JSON.stringify(raw)}`);
}

/**
 * PolicyEngine value nodes are either { "<date>": v, ... } directly or
 * { values: { "<date>": v, ... } }. Returns the value in force for the year.
 */
function valueAt(node, year) {
  const dates = node && typeof node === "object" && node.values ? node.values : node;
  if (!dates || typeof dates !== "object") {
    throw new Error(`Not a value node: ${JSON.stringify(node).slice(0, 120)}`);
  }
  const cutoff = `${year}-12-31`;
  const applicable = Object.keys(dates)
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && k <= cutoff)
    .sort();
  if (applicable.length === 0) {
    throw new Error(`No value in force for ${year} (keys: ${Object.keys(dates).join(", ")})`);
  }
  return num(dates[applicable[applicable.length - 1]]);
}

function byStatus(node, year, statuses = FILING_STATUSES) {
  const out = {};
  for (const [ours, theirs] of Object.entries(statuses)) {
    if (!(theirs in node)) throw new Error(`Missing filing status ${theirs}`);
    out[ours] = valueAt(node[theirs], year);
  }
  return out;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "tax-assist-param-sync" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function fetchYaml(ref, file) {
  const url = `https://raw.githubusercontent.com/${REPO}/${ref}/${PARAMS_ROOT}/${file}`;
  const res = await fetch(url, { headers: { "User-Agent": "tax-assist-param-sync" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  // JSON_SCHEMA keeps "2025-01-01" keys as strings (core schema turns them
  // into Date objects) and leaves "15_750"/".inf" as strings for num().
  return yaml.load(await res.text(), { schema: yaml.JSON_SCHEMA });
}

async function fetchYamlOptional(ref, file) {
  try {
    return await fetchYaml(ref, file);
  } catch {
    return null;
  }
}

function thresholdByStatus(node, year) {
  return {
    single: valueAt(node.SINGLE, year),
    married_filing_jointly: valueAt(node.JOINT, year),
  };
}

function findPositiveBracket(rateDoc, year) {
  const brackets = Array.isArray(rateDoc?.brackets) ? rateDoc.brackets : [];
  let found = null;
  for (const bracket of brackets) {
    const threshold = valueAt(bracket.threshold, year);
    const rate = valueAt(bracket.rate, year);
    if (rate > 0) found = { threshold, rate };
  }
  return found;
}

function buildObbba(year, docs) {
  const out = structuredClone(OBBBA_STATUTORY);

  if (docs.tipsCap) out.tips_cap = valueAt(docs.tipsCap, year);
  if (docs.overtimeCap) out.overtime_cap = thresholdByStatus(docs.overtimeCap, year);

  if (docs.tipsPhaseStart) {
    out.tips_overtime_phase_threshold = thresholdByStatus(docs.tipsPhaseStart, year);
  } else if (docs.overtimePhaseStart) {
    out.tips_overtime_phase_threshold = thresholdByStatus(docs.overtimePhaseStart, year);
  }

  if (docs.tipsPhaseRate) {
    out.tips_overtime_phase_rate = valueAt(docs.tipsPhaseRate, year);
  } else if (docs.overtimePhaseRate) {
    out.tips_overtime_phase_rate = valueAt(docs.overtimePhaseRate, year);
  }

  if (docs.carLoanCap) out.car_loan_cap = valueAt(docs.carLoanCap, year);
  if (docs.carLoanPhaseStart) {
    out.car_loan_phase_threshold = thresholdByStatus(docs.carLoanPhaseStart, year);
  }
  if (docs.carLoanPhaseIncrement && docs.carLoanPhaseStep) {
    out.car_loan_phase_rate = valueAt(docs.carLoanPhaseStep, year) / valueAt(docs.carLoanPhaseIncrement, year);
  }

  if (docs.seniorAmount) out.senior_amount = valueAt(docs.seniorAmount, year);
  const seniorJoint = docs.seniorPhaseRateJoint ? findPositiveBracket(docs.seniorPhaseRateJoint, year) : null;
  const seniorOther = docs.seniorPhaseRateOther ? findPositiveBracket(docs.seniorPhaseRateOther, year) : null;
  if (seniorJoint) out.senior_phase_threshold.married_filing_jointly = seniorJoint.threshold;
  if (seniorOther) out.senior_phase_threshold.single = seniorOther.threshold;
  if (seniorJoint) {
    out.senior_phase_rate = seniorJoint.rate;
  } else if (seniorOther) {
    out.senior_phase_rate = seniorOther.rate;
  }

  return out;
}

function buildYear(year, docs, obbbaDocs) {
  const [
    stdDeduction, agedOrBlind, bracket, cgThresholds, ssCap,
    ctcBase, ctcPhaseOut, niitThreshold, amtExemption,
    saltCap, saltPhaseInEffect, saltPhaseThreshold, saltPhaseRate,
  ] = docs;

  // Ordinary brackets: thresholds[1..7] are each bracket's UPPER bound per
  // status; rates[1..7] are flat across statuses. Top bracket is .inf → 1e18
  // to preserve the calculator's existing sentinel.
  const brackets = {};
  for (const [ours, theirs] of Object.entries(FILING_STATUSES)) {
    brackets[ours] = [];
    for (let i = 1; i <= 7; i++) {
      const rate = valueAt(bracket.rates[i], year);
      const upperNode = bracket.thresholds[i];
      const upper = valueAt(upperNode[theirs] ?? upperNode, year);
      brackets[ours].push([upper === Infinity ? 1e18 : upper, rate]);
    }
  }

  const ltcg = {};
  for (const [ours, theirs] of Object.entries(FILING_STATUSES)) {
    ltcg[ours] = [valueAt(cgThresholds["1"][theirs], year), valueAt(cgThresholds["2"][theirs], year)];
  }

  const saltInEffect = valueAt(saltPhaseInEffect, year) === true || valueAt(saltPhaseInEffect, year) === 1;

  return {
    standard_deduction: byStatus(stdDeduction, year),
    extra_deduction_65: {
      single: valueAt(agedOrBlind.SINGLE, year),
      married: valueAt(agedOrBlind.JOINT, year),
    },
    brackets,
    ltcg_thresholds: ltcg,
    se_ss_wage_base: valueAt(ssCap, year),
    child_tax_credit: valueAt(ctcBase.brackets[0].amount, year),
    ctc_phaseout: {
      single: valueAt(ctcPhaseOut.SINGLE, year),
      married_filing_jointly: valueAt(ctcPhaseOut.JOINT, year),
    },
    niit_threshold: {
      single: valueAt(niitThreshold.SINGLE, year),
      married_filing_jointly: valueAt(niitThreshold.JOINT, year),
    },
    amt_exemption: {
      single: valueAt(amtExemption.SINGLE, year),
      married_filing_jointly: valueAt(amtExemption.JOINT, year),
    },
    salt_cap: byStatus(saltCap, year),
    salt_phase_threshold: saltInEffect ? valueAt(saltPhaseThreshold.SINGLE, year) : null,
    salt_phase_rate: saltInEffect ? valueAt(saltPhaseRate, year) : null,
    obbba_deductions: year >= 2025 ? buildObbba(year, obbbaDocs) : null,
  };
}

async function main() {
  const head = await fetchJson(`https://api.github.com/repos/${REPO}/commits/main`);
  const ref = head.sha;
  console.log(`PolicyEngine US @ ${ref.slice(0, 12)} (${head.commit.committer.date})`);

  const docs = await Promise.all(FILES.map((f) => fetchYaml(ref, f)));
  const obbbaDocsEntries = await Promise.all(
    Object.entries(OBBBA_FILES).map(async ([key, file]) => [key, await fetchYamlOptional(ref, file)])
  );
  const obbbaDocs = Object.fromEntries(obbbaDocsEntries);

  const params = {};
  for (const year of YEARS) {
    params[year] = buildYear(year, docs, obbbaDocs);
    console.log(`built ${year}`);
  }

  const header = `// GENERATED FILE — DO NOT EDIT BY HAND.
// Regenerate with: node scripts/updateTaxParams.mjs
// Source: https://github.com/${REPO} @ ${ref}
// Generated: ${new Date().toISOString().slice(0, 10)}
// Review the git diff against IRS revenue procedures before committing.
import type { TaxParams } from "./taxParams";

export const TAX_PARAMS: Record<number, TaxParams> = `;

  const out = header + JSON.stringify(params, null, 2) + ";\n";
  const dest = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..", "src", "domain", "taxForms", "taxParams.generated.ts"
  );
  fs.writeFileSync(dest, out);
  console.log(`wrote ${dest}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
