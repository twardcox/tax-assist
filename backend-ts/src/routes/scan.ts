import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { env } from "../config/env";
import { AppError } from "../lib/errors";
import { projectPaths } from "../lib/paths";
import { runScan } from "../domain/scanner/scan";
import { writeOpportunityReport } from "../domain/scanner/report";

type JobState = {
  status: "running" | "complete" | "error";
  report_name: string | null;
  error: string | null;
};

const aiJobs = new Map<string, JobState>();

function buildLocalAiReportMarkdown(taxYear: number, mode: string) {
  const scan = runScan(taxYear);
  const counts = Object.entries(scan.counts)
    .map(([status, count]) => `- ${status}: ${count}`)
    .join("\n");

  return [
    `# AI Analysis - Tax Year ${taxYear}`,
    "",
    `Mode: ${mode}`,
    "",
    "This interim TypeScript backend build does not yet include full LLM analysis parity.",
    "The summary below is generated from current scan outputs and preserves report workflow compatibility.",
    "",
    "## Status Summary",
    "",
    counts,
    ""
  ].join("\n");
}

export async function registerScanRoutes(app: FastifyInstance): Promise<void> {
  app.post("/scan", { preHandler: app.authenticateOptional }, async (request) => {
    const query = request.query as { tax_year?: string | number };
    const taxYear = Number(query.tax_year ?? 2025);

    const scan = runScan(taxYear);
    if (process.env.VITEST !== "true") {
      writeOpportunityReport(scan);
    }
    return scan;
  });

  app.post("/scan/ai-analysis", { preHandler: app.authenticateOptional }, async (request) => {
    const query = request.query as { tax_year?: string | number; mode?: string };
    const taxYear = Number(query.tax_year ?? 2025);
    const mode = query.mode ?? "opportunities";

    if (!env.ANTHROPIC_API_KEY) {
      throw new AppError(503, "ANTHROPIC_API_KEY is not set");
    }

    const jobId = crypto.randomUUID();
    aiJobs.set(jobId, { status: "running", report_name: null, error: null });

    queueMicrotask(() => {
      try {
        const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
        const reportName = `ai_analysis_${timestamp}.md`;
        const reportPath = path.join(projectPaths.reports, reportName);
        fs.mkdirSync(projectPaths.reports, { recursive: true });
        fs.writeFileSync(reportPath, buildLocalAiReportMarkdown(taxYear, mode), "utf8");
        aiJobs.set(jobId, { status: "complete", report_name: reportName, error: null });
      } catch (error) {
        aiJobs.set(jobId, {
          status: "error",
          report_name: null,
          error: (error as Error).message
        });
      }
    });

    return { job_id: jobId };
  });

  app.get("/scan/ai-analysis/:jobId", async (request) => {
    const { jobId } = request.params as { jobId: string };
    const job = aiJobs.get(jobId);
    if (!job) {
      throw new AppError(404, `Job '${jobId}' not found`);
    }
    return job;
  });
}
