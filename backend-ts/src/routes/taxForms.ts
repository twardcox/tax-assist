import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../lib/errors";
import { projectPaths } from "../lib/paths";
import { getFilingDetails, saveFilingDetails, type FilingDetails } from "../db/filingDetailsRepo";
import { computeTaxFigures, buildFormPackage, loadAllUserData } from "../domain/taxForms/index";
import { fillIrsForms, fillSingleIrsForm } from "../domain/taxForms/fillIrsForms";

type JobState = {
  status: "running" | "complete" | "error";
  progress: string;
  zip_path: string | null;
  zip_name: string | null;
  error: string | null;
};

const jobs = new Map<string, JobState>();

const TaxYearQuerySchema = z.object({
  tax_year: z.coerce.number().int().optional()
});

const PreviewQuerySchema = z.object({
  tax_year: z.coerce.number().int().optional(),
  form: z.string().regex(/^[A-Za-z0-9_]+$/).optional()
});

const JobParamsSchema = z.object({
  jobId: z.string().min(1)
});

const FilingDetailsBodySchema = z.object({
  pec_fund_taxpayer: z.boolean().optional(),
  pec_fund_spouse: z.boolean().optional(),
  direct_deposit_routing: z.union([z.string(), z.null()]).optional(),
  direct_deposit_account: z.union([z.string(), z.null()]).optional(),
  direct_deposit_type: z.union([z.string(), z.null()]).optional(),
  allow_third_party: z.boolean().optional(),
  designee_name: z.union([z.string(), z.null()]).optional(),
  designee_phone: z.union([z.string(), z.null()]).optional(),
  designee_pin: z.union([z.string(), z.null()]).optional()
}).strict();

async function buildPreviewPdfBytes(userId: string, taxYear: number): Promise<Uint8Array> {
  const data = loadAllUserData(userId, taxYear);
  const figures = computeTaxFigures(userId, taxYear);
  return fillIrsForms(figures.computed, figures.display_name, taxYear, data);
}

async function runJob(jobId: string, userId: string, taxYear: number): Promise<void> {
  try {
    fs.mkdirSync(path.join(projectPaths.root, "state", "tax_form_packages"), { recursive: true });
    const zipName = `tax_forms_${taxYear}_${jobId.slice(0, 8)}.zip`;
    const zipPath = path.join(projectPaths.root, "state", "tax_form_packages", zipName);
    const zipBytes = await buildFormPackage(userId, taxYear);
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
    const query = TaxYearQuerySchema.parse(request.query ?? {});
    const taxYear = query.tax_year ?? 2025;
    const userId = request.currentUser?.id;
    if (!userId) {
      throw new AppError(401, "Authentication required");
    }
    return getFilingDetails(userId, taxYear);
  });

  app.put("/filing-details", { preHandler: app.authenticate }, async (request) => {
    const query = TaxYearQuerySchema.parse(request.query ?? {});
    const taxYear = query.tax_year ?? 2025;
    const userId = request.currentUser?.id;
    if (!userId) {
      throw new AppError(401, "Authentication required");
    }

    const payload = FilingDetailsBodySchema.parse(request.body ?? {}) as FilingDetails;
    saveFilingDetails(userId, taxYear, payload);
    return { ok: true };
  });

  app.get("/tax-forms/preview-pdf", { preHandler: app.authenticate }, async (request, reply) => {
    const query = PreviewQuerySchema.parse(request.query ?? {});
    const taxYear = query.tax_year ?? 2025;
    const userId = request.currentUser?.id;
    if (!userId) throw new AppError(401, "Authentication required");

    if (query.form) {
      const data = loadAllUserData(userId, taxYear);
      const figures = computeTaxFigures(userId, taxYear);
      const pdfBytes = await fillSingleIrsForm(query.form, figures.computed, figures.display_name, taxYear, data);
      const filename = `${query.form}_${taxYear}.pdf`;
      return reply
        .type("application/pdf")
        .header("Content-Disposition", `inline; filename=${filename}`)
        .send(Buffer.from(pdfBytes));
    }

    const pdfBytes = await buildPreviewPdfBytes(userId, taxYear);
    return reply
      .type("application/pdf")
      .header("Content-Disposition", "inline; filename=form_1040_preview.pdf")
      .send(Buffer.from(pdfBytes));
  });

  app.get("/tax-forms/compute", { preHandler: app.authenticate }, async (request) => {
    const query = TaxYearQuerySchema.parse(request.query ?? {});
    const taxYear = query.tax_year ?? 2025;
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
    const query = TaxYearQuerySchema.parse(request.query ?? {});
    const taxYear = query.tax_year ?? 2025;
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

    queueMicrotask(() => void runJob(jobId, userId, taxYear));

    return { job_id: jobId };
  });

  app.get("/reports/tax-forms/:jobId", async (request) => {
    const { jobId } = JobParamsSchema.parse(request.params ?? {});
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
    const { jobId } = JobParamsSchema.parse(request.params ?? {});
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
