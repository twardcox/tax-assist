import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors";
import { projectPaths } from "../lib/paths";
import { runScan } from "../domain/scanner/scan";
import { generateScanAiNarrative, type ScanAiMode } from "../domain/scanner/aiAdvisor";
import { writeOpportunityReport } from "../domain/scanner/report";

type JobState = {
  status: "running" | "complete" | "error";
  report_name: string | null;
  error: string | null;
};

const aiJobs = new Map<string, JobState>();

function nowStamp(): string {
  return new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
}

function nowPretty(): string {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

export async function registerScanRoutes(app: FastifyInstance): Promise<void> {
  app.post("/scan", { preHandler: app.authenticateOptional }, async (request) => {
    const query = request.query as { tax_year?: string | number };
    const taxYear = Number(query.tax_year ?? 2025);
    const userId = request.currentUser?.id ?? null;

    const scan = runScan(taxYear, userId);
    if (process.env.VITEST !== "true") {
      writeOpportunityReport(scan);
    }
    return scan;
  });

  app.post("/scan/ai-analysis", { preHandler: app.authenticateOptional }, async (request) => {
    const query = request.query as { tax_year?: string | number; mode?: string };
    const taxYear = Number(query.tax_year ?? 2025);
    const mode = (query.mode ?? "opportunities") as ScanAiMode;
    const userId = request.currentUser?.id ?? null;

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new AppError(503, "ANTHROPIC_API_KEY is not set");
    }

    if (!["opportunities", "gaps", "both"].includes(mode)) {
      throw new AppError(400, "mode must be opportunities, gaps, or both");
    }

    const jobId = crypto.randomUUID();
    aiJobs.set(jobId, { status: "running", report_name: null, error: null });

    queueMicrotask(async () => {
      try {
        const scan = runScan(taxYear, userId);
        const analysis = await generateScanAiNarrative(scan, taxYear, mode);

        const timestamp = nowStamp();
        const reportName = `ai_analysis_${timestamp}.md`;
        const reportPath = path.join(projectPaths.reports, reportName);
        fs.mkdirSync(projectPaths.reports, { recursive: true });
        fs.writeFileSync(
          reportPath,
          `# AI Analysis - Tax Year ${taxYear}\n\n*Generated ${nowPretty()}*\n\n---\n\n${analysis}\n`,
          "utf8"
        );
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
