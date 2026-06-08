import fs from "node:fs";
import path from "node:path";
import { projectPaths } from "../../lib/paths";
import type { ScanRun } from "../scanner/types";

function statusLines(scan: ScanRun): string[] {
  const lines: string[] = [];
  for (const [status, count] of Object.entries(scan.counts)) {
    lines.push(`- ${status}: ${count}`);
  }
  return lines;
}

export function buildCpaPacketMarkdown(scan: ScanRun, aiSummary = ""): string {
  const lines: string[] = [];
  lines.push(`# CPA Packet - Tax Year ${scan.tax_year}`);
  lines.push("");
  if (aiSummary) {
    lines.push(aiSummary.trim());
    lines.push("");
  }
  lines.push("## Status Summary");
  lines.push("");
  lines.push(...statusLines(scan));
  lines.push("");
  lines.push("## Opportunities");
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

  return `${lines.join("\n")}\n`;
}

export function writeCpaPacketReport(scan: ScanRun, aiSummary = ""): string {
  fs.mkdirSync(projectPaths.reports, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const filename = `cpa_packet_${timestamp}.md`;
  const reportPath = path.join(projectPaths.reports, filename);
  fs.writeFileSync(reportPath, buildCpaPacketMarkdown(scan, aiSummary), "utf8");
  return filename;
}
