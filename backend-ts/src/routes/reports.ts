import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../lib/errors";
import { projectPaths } from "../lib/paths";
import { runScan } from "../domain/scanner/scan";
import { writeCpaPacketReport, type HouseholdSummary } from "../domain/reports/cpaPacket";
import { getSectionData } from "../db/sectionRepo";

type JobState = {
  status: "running" | "complete" | "error";
  report_name: string | null;
  error: string | null;
};

const cpaJobs = new Map<string, JobState>();

const ReportNameParamsSchema = z.object({
  name: z.string().min(1)
});

const CpaPacketQuerySchema = z.object({
  tax_year: z.union([z.string(), z.number()]).optional(),
  with_ai: z.union([z.string(), z.boolean()]).optional()
});

const JobParamsSchema = z.object({
  jobId: z.string().min(1)
});

function buildAiSummaryPlaceholder(taxYear: number, withAi: boolean): string {
  const label = withAi ? "AI-assisted" : "Standard";
  return `# ${label} Summary\n\nThis TypeScript backend build uses the current scan output to generate a CPA packet for tax year ${taxYear}.`;
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return false;
}

function parseInteger(value: unknown, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function loadHousehold(userId: string | null | undefined, taxYear: number): HouseholdSummary {
  if (!userId) return {};
  try {
    const data = getSectionData(userId, taxYear, "household");
    return {
      filing_status: data.filing_status as string | undefined,
      state: (data.residence as Record<string, unknown> | undefined)?.state as string | undefined,
      estimated_agi: data.estimated_agi as string | number | undefined,
    };
  } catch {
    return {};
  }
}

function runCpaPacket(jobId: string, taxYear: number, withAi: boolean, userId?: string | null): void {
  try {
    const scan = runScan(taxYear, userId ?? null);
    const aiSummary = buildAiSummaryPlaceholder(taxYear, withAi);
    const household = loadHousehold(userId, taxYear);
    const reportName = writeCpaPacketReport(scan, aiSummary, household);
    cpaJobs.set(jobId, { status: "complete", report_name: reportName, error: null });
  } catch (error) {
    cpaJobs.set(jobId, {
      status: "error",
      report_name: null,
      error: (error as Error).message
    });
  }
}

export async function registerReportsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/reports", async () => {
    if (!fs.existsSync(projectPaths.reports)) {
      return { reports: [] };
    }

    const reports = fs.readdirSync(projectPaths.reports)
      .filter((name) => name.endsWith(".md"))
      .map((name) => {
        const fullPath = path.join(projectPaths.reports, name);
        const stat = fs.statSync(fullPath);
        return { name, size: stat.size, mtime: stat.mtimeMs };
      })
      .filter((report) => report.size > 0)
      .sort((a, b) => b.mtime - a.mtime);

    return { reports };
  });

  app.get("/reports/:name", async (request) => {
    const { name } = ReportNameParamsSchema.parse(request.params ?? {});
    if (name.includes("..") || name.includes("/") || name.includes("\\")) {
      throw new AppError(400, "Invalid report name");
    }

    const reportPath = path.join(projectPaths.reports, name);
    if (!fs.existsSync(reportPath) || path.extname(name) !== ".md") {
      throw new AppError(404, `Report '${name}' not found`);
    }

    return { name, content: fs.readFileSync(reportPath, "utf8") };
  });

  app.post("/reports/cpa-packet", { preHandler: app.authenticateOptional }, async (request) => {
    const query = CpaPacketQuerySchema.parse(request.query ?? {});
    const taxYear = parseInteger(query.tax_year, 2025);
    const withAi = parseBoolean(query.with_ai);
    const userId = request.currentUser?.id ?? null;

    const jobId = crypto.randomUUID();
    cpaJobs.set(jobId, { status: "running", report_name: null, error: null });

    queueMicrotask(() => runCpaPacket(jobId, taxYear, withAi, userId));

    return { job_id: jobId };
  });

  app.get("/reports/cpa-packet/:jobId", async (request) => {
    const { jobId } = JobParamsSchema.parse(request.params ?? {});
    const job = cpaJobs.get(jobId);
    if (!job) {
      throw new AppError(404, `Job '${jobId}' not found`);
    }
    return job;
  });
}
