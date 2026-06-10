import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors";
import { projectPaths } from "../lib/paths";
import { getFilingDetails, saveFilingDetails, type FilingDetails } from "../db/filingDetailsRepo";
import { computeTaxFigures, buildFormPackage } from "../domain/taxForms/index";

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
  const figures = computeTaxFigures(userId, taxYear);
  const c = figures.computed;
  const n = (key: string) => Math.round(Number(c[key] ?? 0)).toLocaleString("en-US");
  const text = [
    "%PDF-1.4",
    `% Form 1040 Preview — Tax Year ${taxYear}`,
    `% ${figures.display_name} — ${figures.filing_status}`,
    `%`,
    `% AGI:             $${n("agi")}`,
    `% Taxable Income:  $${n("taxable_income")}`,
    `% Total Tax:       $${n("total_tax")}`,
    `% Total Payments:  $${n("total_payments")}`,
    Number(c["refund"]) > 0
      ? `% REFUND:          $${n("refund")}`
      : `% AMOUNT OWED:     $${n("amount_owed")}`,
    `% Effective Rate:  ${Number(c["effective_rate"] ?? 0).toFixed(1)}%`,
    `% Marginal Rate:   ${Number(c["marginal_rate"] ?? 0).toFixed(1)}%`,
    `%`,
    `% NOTE: This is a data preview. Download the full package for the`,
    `% complete tax data summary and CPA instructions.`,
    "%%EOF",
  ].join("\n");
  return Buffer.from(text, "utf8");
}

function runJob(jobId: string, userId: string, taxYear: number): void {
  try {
    fs.mkdirSync(path.join(projectPaths.root, "state", "tax_form_packages"), { recursive: true });
    const zipName = `tax_forms_${taxYear}_${jobId.slice(0, 8)}.zip`;
    const zipPath = path.join(projectPaths.root, "state", "tax_form_packages", zipName);
    const zipBytes = buildFormPackage(userId, taxYear);
    fs.writeFileSync(zipPath, zipBytes);
    jobs.set(jobId, {
      status: "complete",
      progress: "Package generated",
      zip_path: zipPath,
      zip_name: zipName,
      error: null,
    });
  } catch (error) {
    jobs.set(jobId, {
      status: "error",
      progress: "Package generation failed",
      zip_path: null,
      zip_name: null,
      error: (error as Error).message,
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

    const figures = computeTaxFigures(userId, taxYear);
    return {
      ...figures,
      filing_details: getFilingDetails(userId, taxYear),
      summary: { counts: {} },
    };
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
