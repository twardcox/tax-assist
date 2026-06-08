import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors";
import { projectPaths } from "../lib/paths";
import { runScan } from "../domain/scanner/scan";
import { getFilingDetails, saveFilingDetails, type FilingDetails } from "../db/filingDetailsRepo";

type JobState = {
  status: "running" | "complete" | "error";
  progress: string;
  zip_path: string | null;
  zip_name: string | null;
  error: string | null;
};

const jobs = new Map<string, JobState>();

function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildPreviewPdfBytes(userId: string, taxYear: number): Buffer {
  const scan = runScan(taxYear, userId);
  const text = [
    "%PDF-1.4",
    "% Placeholder PDF for tax-forms preview",
    `Tax year: ${taxYear}`,
    `Opportunities: ${scan.total}`,
    "%%EOF"
  ].join("\n");
  return Buffer.from(text, "utf8");
}

function buildComputeSummary(userId: string, taxYear: number) {
  const scan = runScan(taxYear, userId);
  return {
    tax_year: taxYear,
    filing_details: getFilingDetails(userId, taxYear),
    summary: {
      total: scan.total,
      counts: scan.counts
    }
  };
}

function runJob(jobId: string, userId: string, taxYear: number): void {
  try {
    const summary = buildComputeSummary(userId, taxYear);
    fs.mkdirSync(projectPaths.reports, { recursive: true });
    fs.mkdirSync(path.join(projectPaths.root, "state", "tax_form_packages"), { recursive: true });
    const zipName = `tax_forms_${taxYear}_${jobId.slice(0, 8)}.zip`;
    const zipPath = path.join(projectPaths.root, "state", "tax_form_packages", zipName);
    fs.writeFileSync(zipPath, JSON.stringify(summary, null, 2), "utf8");
    jobs.set(jobId, {
      status: "complete",
      progress: "Package generated",
      zip_path: zipPath,
      zip_name: zipName,
      error: null
    });
  } catch (error) {
    jobs.set(jobId, {
      status: "error",
      progress: "Package generation failed",
      zip_path: null,
      zip_name: null,
      error: (error as Error).message
    });
  }
}

export async function registerTaxFormsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/filing-details", { preHandler: app.authenticate }, async (request) => {
    const query = request.query as { tax_year?: string | number };
    const taxYear = toNumber(query.tax_year, 2025);
    const userId = request.currentUser?.id;
    if (!userId) {
      throw new AppError(401, "Authentication required");
    }
    return getFilingDetails(userId, taxYear);
  });

  app.put("/filing-details", { preHandler: app.authenticate }, async (request) => {
    const query = request.query as { tax_year?: string | number };
    const taxYear = toNumber(query.tax_year, 2025);
    const userId = request.currentUser?.id;
    if (!userId) {
      throw new AppError(401, "Authentication required");
    }

    const payload = (request.body ?? {}) as FilingDetails;
    saveFilingDetails(userId, taxYear, payload);
    return { ok: true };
  });

  app.get("/tax-forms/preview-pdf", { preHandler: app.authenticate }, async (request, reply) => {
    const query = request.query as { tax_year?: string | number };
    const taxYear = toNumber(query.tax_year, 2025);
    const userId = request.currentUser?.id;
    if (!userId) {
      throw new AppError(401, "Authentication required");
    }

    const pdfBytes = buildPreviewPdfBytes(userId, taxYear);
    return reply
      .type("application/pdf")
      .header("Content-Disposition", "inline; filename=form_1040_preview.pdf")
      .send(pdfBytes);
  });

  app.get("/tax-forms/compute", { preHandler: app.authenticate }, async (request) => {
    const query = request.query as { tax_year?: string | number };
    const taxYear = toNumber(query.tax_year, 2025);
    const userId = request.currentUser?.id;
    if (!userId) {
      throw new AppError(401, "Authentication required");
    }

    return buildComputeSummary(userId, taxYear);
  });

  app.post("/reports/tax-forms", { preHandler: app.authenticate }, async (request) => {
    const query = request.query as { tax_year?: string | number };
    const taxYear = toNumber(query.tax_year, 2025);
    const userId = request.currentUser?.id;
    if (!userId) {
      throw new AppError(401, "Authentication required to generate tax forms");
    }

    const jobId = crypto.randomUUID();
    jobs.set(jobId, {
      status: "running",
      progress: "Starting...",
      zip_path: null,
      zip_name: null,
      error: null
    });

    queueMicrotask(() => runJob(jobId, userId, taxYear));

    return { job_id: jobId };
  });

  app.get("/reports/tax-forms/:jobId", async (request) => {
    const { jobId } = request.params as { jobId: string };
    const job = jobs.get(jobId);
    if (!job) {
      throw new AppError(404, `Job '${jobId}' not found`);
    }

    return {
      status: job.status,
      progress: job.progress,
      zip_name: job.zip_name,
      error: job.error
    };
  });

  app.get("/reports/tax-forms/:jobId/download", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = jobs.get(jobId);
    if (!job) {
      throw new AppError(404, "Job not found");
    }
    if (job.status !== "complete") {
      throw new AppError(400, `Job status is '${job.status}' — not ready for download`);
    }
    if (!job.zip_path || !fs.existsSync(job.zip_path)) {
      throw new AppError(500, "Package file missing from disk");
    }

    const content = fs.readFileSync(job.zip_path);
    return reply.type("application/zip").header("Content-Disposition", `attachment; filename=${job.zip_name}`).send(content);
  });
}
