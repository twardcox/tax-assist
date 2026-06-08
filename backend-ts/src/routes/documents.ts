import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import yaml from "js-yaml";
import { AppError } from "../lib/errors";
import { projectPaths } from "../lib/paths";
import { addTransaction, fileAlreadyApplied } from "../db/transactionsRepo";
import { applyDotPathToSection } from "../db/sectionRepo";
import { classifyFilename } from "../domain/documents/classifier";
import { extractWithAiBytes } from "../domain/documents/aiExecutor";
import {
  deleteDocumentRecord,
  getDocumentContent,
  getDocumentsForUser,
  saveDocumentExtraction,
  upsertDocument
} from "../db/documentsRepo";

const ALLOWED_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".heic", ".tiff", ".csv"]);

type MultipartLikeFile = {
  filename: string;
  toBuffer: () => Promise<Buffer>;
};

type UploadPayload = {
  filename?: string;
  content?: string;
  category?: string;
};

type ExtractionJobState = {
  status: "running" | "complete" | "error";
  extracted: Record<string, unknown> | null;
  error: string | null;
};

const extractionJobs = new Map<string, ExtractionJobState>();

function toBuffer(value: string | Buffer): Buffer {
  return Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
}

function safeName(name: string): string {
  return name.replace(/[^\w.-]/g, "_").slice(0, 200);
}

function fileId(userId: string, filename: string, content: Buffer): string {
  const digest = crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
  return crypto.createHash("sha256").update(`${userId}:${filename}:${digest}`).digest("hex").slice(0, 12);
}

function normalizeDocument(row: ReturnType<typeof getDocumentsForUser>[number]): Record<string, unknown> {
  return row;
}

function applyDotPath(data: Record<string, unknown>, dotPath: string, operation: string, value: unknown): boolean {
  const parts = dotPath.split(".");
  let current: unknown = data;

  try {
    for (const part of parts.slice(0, -1)) {
      if (Array.isArray(current)) {
        current = current[Number(part)];
      } else if (current && typeof current === "object") {
        const obj = current as Record<string, unknown>;
        if (!(part in obj) || obj[part] == null) {
          obj[part] = {};
        }
        current = obj[part];
      } else {
        return false;
      }
    }

    const last = parts[parts.length - 1];
    if (Array.isArray(current)) {
      const index = Number(last);
      while (current.length <= index) {
        current.push(null);
      }
      if (operation === "add") {
        current[index] = Number(current[index] ?? 0) + Number(value ?? 0);
      } else {
        current[index] = value;
      }
      return true;
    }

    if (current && typeof current === "object") {
      const obj = current as Record<string, unknown>;
      if (operation === "add") {
        obj[last] = Number(obj[last] ?? 0) + Number(value ?? 0);
      } else {
        obj[last] = value;
      }
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

async function readUpload(request: FastifyRequest): Promise<{ filename: string; content: Buffer } | null> {
  const body = request.body as UploadPayload | undefined;
  if (body?.filename && body.content != null) {
    return { filename: safeName(body.filename), content: toBuffer(body.content) };
  }

  const multipartRequest = request as FastifyRequest & { file: () => Promise<MultipartLikeFile | undefined> };
  const file = await multipartRequest.file();
  if (!file) {
    return null;
  }
  return { filename: safeName(file.filename), content: await file.toBuffer() };
}

async function runExtraction(jobId: string, userId: string, fileId: string, filename: string, content: Buffer): Promise<void> {
  try {
    const extracted = await extractWithAiBytes(content, filename);
    saveDocumentExtraction(userId, fileId, extracted);
    extractionJobs.set(jobId, { status: "complete", extracted, error: null });
  } catch (error) {
    extractionJobs.set(jobId, { status: "error", extracted: null, error: (error as Error).message });
  }
}

export async function registerDocumentsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/documents/upload", { preHandler: app.authenticateOptional }, async (request) => {
    const uploaded = await readUpload(request);
    if (!uploaded) {
      throw new AppError(400, "No file uploaded");
    }

    const suffix = path.extname(uploaded.filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(suffix)) {
      throw new AppError(400, `File type '${suffix}' not allowed.`);
    }

    const userId = request.currentUser?.id ?? "";
    const id = fileId(userId, uploaded.filename, uploaded.content);
    const info = classifyFilename(uploaded.filename, uploaded.content.length);

    if (request.currentUser) {
      upsertDocument(request.currentUser.id, id, uploaded.filename, uploaded.content, info);
    }

    return {
      file_id: id,
      file: uploaded.filename,
      category: info.category,
      confidence: info.confidence,
      size: uploaded.content.length,
      note: info.note,
      extracted: false,
      uploaded_at: new Date().toISOString()
    };
  });

  app.get("/documents", { preHandler: app.authenticateOptional }, async (request) => {
    if (!request.currentUser) {
      return { files: [] };
    }

    return { files: getDocumentsForUser(request.currentUser.id).map(normalizeDocument) };
  });

  app.delete("/documents/:fileId", { preHandler: app.authenticate }, async (request) => {
    const userId = request.currentUser?.id;
    if (!userId) {
      throw new AppError(401, "Authentication required");
    }

    const { fileId } = request.params as { fileId: string };
    const deleted = deleteDocumentRecord(userId, fileId);
    if (!deleted) {
      throw new AppError(404, `Document '${fileId}' not found`);
    }

    return { deleted: true, file_id: fileId };
  });

  app.post("/documents/:fileId/extract", { preHandler: app.authenticateOptional }, async (request) => {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new AppError(503, "ANTHROPIC_API_KEY is not set");
    }

    const userId = request.currentUser?.id;
    if (!userId) {
      throw new AppError(401, "Authentication required");
    }

    const { fileId } = request.params as { fileId: string };
    const doc = getDocumentContent(userId, fileId);
    if (!doc.content) {
      throw new AppError(404, `Document '${fileId}' not found`);
    }

    const jobId = crypto.randomUUID();
    extractionJobs.set(jobId, { status: "running", extracted: null, error: null });
    queueMicrotask(() => {
      void runExtraction(jobId, userId, fileId, doc.filename, doc.content as Buffer);
    });
    return { job_id: jobId };
  });

  app.get("/documents/extract/:jobId", async (request) => {
    const { jobId } = request.params as { jobId: string };
    const job = extractionJobs.get(jobId);
    if (!job) {
      throw new AppError(404, `Extraction job '${jobId}' not found`);
    }

    return job;
  });

  app.post("/documents/apply", { preHandler: app.authenticateOptional }, async (request) => {
    const body = (request.body ?? {}) as Array<Record<string, unknown>> | { updates?: Array<Record<string, unknown>>; meta?: Record<string, unknown> };
    const updates = Array.isArray(body) ? body : (body.updates ?? []);
    const meta = Array.isArray(body) ? {} : (body.meta ?? {});

    const fileId = String(meta.file_id ?? "");
    const userId = request.currentUser?.id ?? null;
    const deductiblePct = Math.max(0, Math.min(1, Number(meta.deductible_pct ?? 1)));

    if (fileId && userId && fileAlreadyApplied(userId, fileId)) {
      return { applied: [], skipped: updates.map((u) => String(u.label ?? "")), duplicate: true };
    }

    const applied: string[] = [];
    const skipped: string[] = [];

    for (const update of updates) {
      const section = String(update.yaml_file ?? update.section ?? "");
      const dotPath = String(update.dot_path ?? "");
      const operation = String(update.operation ?? "set");
      const rawValue = update.value;
      const label = String(update.label ?? dotPath);

      if (!section || !dotPath || rawValue == null || section.includes("..") || section.includes("/") || section.includes("\\")) {
        skipped.push(label);
        continue;
      }

      const value = operation === "add" && typeof rawValue === "number" && rawValue > 0
        ? Number((rawValue * deductiblePct).toFixed(2))
        : rawValue;

      let success = false;
      if (userId) {
        success = applyDotPathToSection(userId, 2025, section, dotPath, operation, value);
      } else {
        const yamlPath = path.join(projectPaths.userData, `${section}.yaml`);
        if (fs.existsSync(yamlPath)) {
          const data = yaml.load(fs.readFileSync(yamlPath, "utf8")) as Record<string, unknown> | null;
          const mutable = (data && typeof data === "object" && !Array.isArray(data)) ? data : {};
          if (applyDotPath(mutable, dotPath, operation, value)) {
            fs.writeFileSync(yamlPath, yaml.dump(mutable, { noRefs: true, lineWidth: -1 }), "utf8");
            success = true;
          }
        }
      }

      if (success) {
        applied.push(label);
        if (fileId && userId) {
          const totalAmount = typeof rawValue === "number" ? rawValue : 0;
          addTransaction({
            user_id: userId,
            file_id: fileId,
            filename: String(meta.filename ?? ""),
            date: meta.date ? String(meta.date) : "",
            merchant: meta.merchant ? String(meta.merchant) : "",
            total_amount: totalAmount,
            deductible_pct: deductiblePct,
            deductible_amount: Number((totalAmount * deductiblePct).toFixed(2)),
            tax_category: String(meta.tax_category ?? ""),
            benefit_ids: Array.isArray(meta.benefit_ids) ? meta.benefit_ids.map(String) : [],
            form_line: meta.form_line ? String(meta.form_line) : "",
            section,
            dot_path: dotPath,
            status: "applied",
            label
          });
        }
      } else {
        skipped.push(label);
      }
    }

    return { applied, skipped, duplicate: false };
  });
}
