import fs from "node:fs";
import path from "node:path";
import { projectPaths } from "../../lib/paths";
import type { ScanResult, ScanRun } from "../scanner/types";

export type HouseholdSummary = {
  filing_status?: string;
  state?: string;
  estimated_agi?: string | number;
};

function formatValue(v: string | number | null | undefined): string {
  return v != null && v !== "" ? String(v) : "Not provided";
}

function formatForms(forms: string[]): string {
  return forms.length > 0 ? forms.join(", ") : "—";
}

function eligibleNowSection(results: ScanResult[]): string[] {
  const eligible = results.filter((r) => r.status === "eligible_now");
  if (eligible.length === 0) return [];
  const lines: string[] = [
    "## Available Opportunities",
    "",
    "| Benefit | Estimated Value | Risk | Forms |",
    "|---------|----------------|------|-------|",
  ];
  for (const r of eligible) {
    lines.push(
      `| ${r.benefit_name} | ${formatValue(r.estimated_value)} | ${r.risk_level} | ${formatForms(r.forms_required)} |`
    );
  }
  lines.push("");
  return lines;
}

function nearlyEligibleSection(results: ScanResult[]): string[] {
  const nearMiss = results.filter((r) => r.status === "nearly_eligible");
  if (nearMiss.length === 0) return [];
  const lines: string[] = ["## Near-Miss Opportunities — CPA Guidance Needed", ""];
  for (const r of nearMiss) {
    lines.push(`### ${r.benefit_name}`, "", r.message, "");
    if (r.missing_facts.length > 0) {
      lines.push("**Missing:**");
      for (const fact of r.missing_facts) lines.push(`- \`${fact}\``);
      lines.push("");
    }
    if (r.next_steps.length > 0) {
      lines.push("**Next Steps:**");
      for (const step of r.next_steps) lines.push(`- ${step}`);
      lines.push("");
    }
  }
  return lines;
}

function eligibleIfChangedSection(results: ScanResult[]): string[] {
  const ifChanged = results.filter((r) => r.status === "eligible_if_changed");
  if (ifChanged.length === 0) return [];
  const lines: string[] = ["## Proposed Changes — CPA Review Needed", ""];
  for (const r of ifChanged) {
    lines.push(`### ${r.benefit_name}`, "", r.message, "");
    if (r.changes_needed.length > 0) {
      lines.push("**Changes Needed:**");
      for (const change of r.changes_needed) lines.push(`- ${change}`);
      lines.push("");
    }
  }
  return lines;
}

function highRiskSection(results: ScanResult[]): string[] {
  const highRisk = results.filter((r) => r.status === "high_risk");
  if (highRisk.length === 0) return [];
  const lines: string[] = ["## High-Risk Strategies — Attorney Review Required", ""];
  for (const r of highRisk) {
    lines.push(`### ${r.benefit_name}`, "", r.message, "");
  }
  return lines;
}

export function buildCpaPacketMarkdown(
  scan: ScanRun,
  aiSummary = "",
  household: HouseholdSummary = {}
): string {
  const now = new Date().toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });
  const lines: string[] = [
    "# CPA Review Packet",
    "",
    `**Prepared by:** UTBIS  `,
    `**Date:** ${now}  `,
    `**Tax Year:** ${scan.tax_year}  `,
    "",
    "---",
    "",
    "## Taxpayer Facts Summary",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| Filing Status | ${formatValue(household.filing_status)} |`,
    `| State | ${formatValue(household.state)} |`,
    `| Estimated AGI | ${formatValue(household.estimated_agi)} |`,
    `| Tax Year | ${scan.tax_year} |`,
    "",
    "---",
    "",
  ];

  if (aiSummary) {
    lines.push("## AI Planning Summary — For Discussion at CPA Meeting", "", aiSummary.trim(), "", "---", "");
  }

  lines.push(...eligibleNowSection(scan.results));
  lines.push(...nearlyEligibleSection(scan.results));
  lines.push(...eligibleIfChangedSection(scan.results));
  lines.push(...highRiskSection(scan.results));

  lines.push(
    "---",
    "",
    "## Questions for CPA",
    "",
    "1. Please review all `nearly_eligible` items above and confirm which gaps can be closed.",
    "2. Please advise on any `eligible_if_changed` structural changes that make economic sense.",
    "3. Please confirm risk levels and documentation requirements for all claimed deductions.",
    "4. Please review carryforward amounts from prior years.",
    "",
    "---",
    "",
    "_This packet is prepared for CPA review and planning purposes only._",
    ""
  );

  return lines.join("\n");
}

export function writeCpaPacketReport(
  scan: ScanRun,
  aiSummary = "",
  household: HouseholdSummary = {}
): string {
  fs.mkdirSync(projectPaths.reports, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const filename = `cpa_packet_${timestamp}.md`;
  const reportPath = path.join(projectPaths.reports, filename);
  fs.writeFileSync(reportPath, buildCpaPacketMarkdown(scan, aiSummary, household), "utf8");
  return filename;
}
