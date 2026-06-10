import fs from "node:fs";
import path from "node:path";
import { projectPaths } from "../../lib/paths";
import type { ScanResult, ScanRun } from "./types";

function fmtForms(forms: string[]): string {
  return forms.length > 0 ? forms.join(", ") : "—";
}

function eligibleNowSection(results: ScanResult[]): string[] {
  const items = results.filter((r) => r.status === "eligible_now");
  if (items.length === 0) return [];
  const lines: string[] = [
    "## Eligible Now",
    "",
    "| Benefit | Est. Value | Risk | Forms |",
    "|---------|-----------|------|-------|",
  ];
  for (const r of items) {
    lines.push(`| ${r.benefit_name} | ${r.estimated_value || "—"} | ${r.risk_level} | ${fmtForms(r.forms_required)} |`);
  }
  lines.push("");
  return lines;
}

function nearlyEligibleSection(results: ScanResult[]): string[] {
  const items = results.filter((r) => r.status === "nearly_eligible");
  if (items.length === 0) return [];
  const lines: string[] = ["## Nearly Eligible — More Info Needed", ""];
  for (const r of items) {
    lines.push(`### ${r.benefit_name}`, "", r.message, "");
    if (r.missing_facts.length > 0) {
      lines.push("**Missing facts:**");
      for (const f of r.missing_facts) lines.push(`- \`${f}\``);
      lines.push("");
    }
    if (r.next_steps.length > 0) {
      lines.push("**Next steps:**");
      for (const s of r.next_steps) lines.push(`- ${s}`);
      lines.push("");
    }
  }
  return lines;
}

function eligibleIfChangedSection(results: ScanResult[]): string[] {
  const items = results.filter((r) => r.status === "eligible_if_changed");
  if (items.length === 0) return [];
  const lines: string[] = ["## Eligible If Changed", ""];
  for (const r of items) {
    lines.push(`### ${r.benefit_name}`, "", r.message, "");
    if (r.changes_needed.length > 0) {
      lines.push("**Changes needed:**");
      for (const c of r.changes_needed) lines.push(`- ${c}`);
      lines.push("");
    }
  }
  return lines;
}

function futureSection(results: ScanResult[]): string[] {
  const items = results.filter((r) => r.status === "future_opportunity");
  if (items.length === 0) return [];
  const lines: string[] = ["## Future Opportunities", ""];
  for (const r of items) {
    lines.push(`- **${r.benefit_name}** — ${r.message}`);
  }
  lines.push("");
  return lines;
}

function highRiskSection(results: ScanResult[]): string[] {
  const items = results.filter((r) => r.status === "high_risk");
  if (items.length === 0) return [];
  const lines: string[] = ["## High Risk — Attorney Review Required", ""];
  for (const r of items) {
    lines.push(`### ${r.benefit_name}`, "", r.message, "");
  }
  return lines;
}

export function writeOpportunityReport(scan: ScanRun): void {
  const now = new Date().toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });
  const lines: string[] = [
    `# Opportunity Report — Tax Year ${scan.tax_year}`,
    "",
    `_Generated: ${now}_`,
    "",
    "## Summary",
    "",
    `Total benefits evaluated: **${scan.total}**`,
    "",
  ];

  for (const [status, count] of Object.entries(scan.counts)) {
    if (count > 0) lines.push(`- ${status}: ${count}`);
  }
  lines.push("");

  lines.push(...eligibleNowSection(scan.results));
  lines.push(...nearlyEligibleSection(scan.results));
  lines.push(...eligibleIfChangedSection(scan.results));
  lines.push(...futureSection(scan.results));
  lines.push(...highRiskSection(scan.results));

  fs.mkdirSync(projectPaths.reports, { recursive: true });
  const reportPath = path.join(projectPaths.reports, "opportunity_report.md");
  fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
}
