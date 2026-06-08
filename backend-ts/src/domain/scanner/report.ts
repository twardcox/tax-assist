import fs from "node:fs";
import path from "node:path";
import { projectPaths } from "../../lib/paths";
import type { ScanRun } from "./types";

export function writeOpportunityReport(scan: ScanRun): void {
  const lines: string[] = [];
  lines.push(`# Opportunity Report - Tax Year ${scan.tax_year}`);
  lines.push("");
  lines.push(`Total opportunities: ${scan.total}`);
  lines.push("");
  lines.push("## Status Counts");
  lines.push("");

  for (const [status, count] of Object.entries(scan.counts)) {
    lines.push(`- ${status}: ${count}`);
  }

  lines.push("");
  lines.push("## Benefits");
  lines.push("");

  for (const result of scan.results) {
    lines.push(`### ${result.benefit_name}`);
    lines.push(`- Status: ${result.status}`);
    lines.push(`- Jurisdiction: ${result.jurisdiction}`);
    lines.push(`- Category: ${result.category}`);
    if (result.estimated_value) {
      lines.push(`- Estimated value: ${result.estimated_value}`);
    }
    lines.push(`- Risk level: ${result.risk_level}`);
    lines.push(`- Notes: ${result.message}`);
    lines.push("");
  }

  fs.mkdirSync(projectPaths.reports, { recursive: true });
  const reportPath = path.join(projectPaths.reports, "opportunity_report.md");
  fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
}
