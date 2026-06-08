import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import yaml from "js-yaml";
import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors";
import { projectPaths } from "../lib/paths";

const KNOWN_SOURCES = new Set([
  "federal_register",
  "irs_news",
  "irs_publications",
  "internal_revenue_bulletin",
  "treasury_regulations",
  "congress_legislation",
  "tax_court",
  "state_ca",
  "state_ny",
  "state_il",
  "state_ma",
  "state_nj",
  "state_co",
  "state_or",
  "state_pa",
  "state_oh",
  "state_ga"
]);

let updateRunning = false;

function parseInteger(value: unknown, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
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

export async function registerTaxLawRoutes(app: FastifyInstance): Promise<void> {
  app.get("/tax-law/changes", async (request) => {
    const query = request.query as { limit?: string | number };
    const limit = parseInteger(query.limit, 20);

    if (limit < 1 || limit > 100) {
      throw new AppError(400, "limit must be between 1 and 100");
    }

    const futureDir = path.join(projectPaths.taxLibrary, "future_law");
    if (!fs.existsSync(futureDir)) {
      return { changes: [], total: 0 };
    }

    const allFiles = fs.readdirSync(futureDir)
      .filter((name) => name.endsWith(".yaml"))
      .sort((a, b) => b.localeCompare(a));

    const changes = allFiles.slice(0, limit).flatMap((filename) => {
      try {
        const fullPath = path.join(futureDir, filename);
        const parsed = yaml.load(fs.readFileSync(fullPath, "utf8"));
        const data = parsed && typeof parsed === "object"
          ? (parsed as Record<string, unknown>)
          : {};
        return [{ ...data, filename }];
      } catch {
        return [];
      }
    });

    return {
      changes,
      total: allFiles.length
    };
  });

  app.post("/tax-law/update", async (request) => {
    const query = request.query as {
      source?: string;
      days?: string | number;
      dry_run?: string | boolean;
    };

    const source = query.source;
    const days = parseInteger(query.days, 30);
    const dryRun = parseBoolean(query.dry_run);

    if (source && !KNOWN_SOURCES.has(source)) {
      throw new AppError(400, `Unknown source '${source}'`);
    }
    if (days < 1 || days > 365) {
      throw new AppError(400, "days must be between 1 and 365");
    }

    if (updateRunning) {
      return { status: "already_running", dry_run: dryRun, days, source: source ?? null };
    }

    updateRunning = true;

    queueMicrotask(() => {
      if (process.env.VITEST === "true") {
        updateRunning = false;
        return;
      }

      const args = [path.join(projectPaths.root, "scripts", "update_tax_law.py"), "--days", String(days)];
      if (source) {
        args.push("--source", source);
      }
      if (dryRun) {
        args.push("--dry-run");
      }

      const child = spawn("python", args, {
        cwd: projectPaths.root,
        stdio: "ignore",
        detached: true
      });

      child.on("error", () => {
        updateRunning = false;
      });

      child.on("exit", () => {
        updateRunning = false;
      });

      child.unref();
    });

    return { status: "started", dry_run: dryRun, days, source: source ?? null };
  });

  app.get("/tax-law/status", async () => ({ running: updateRunning }));

  app.get("/tax-law/alert-count", async (request) => {
    const query = request.query as { since_days?: string | number };
    const sinceDays = parseInteger(query.since_days, 30);

    if (sinceDays < 1 || sinceDays > 365) {
      throw new AppError(400, "since_days must be between 1 and 365");
    }

    const futureDir = path.join(projectPaths.taxLibrary, "future_law");
    if (!fs.existsSync(futureDir)) {
      return { count: 0, since_days: sinceDays };
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - sinceDays);
    const cutoffDate = cutoff.toISOString().slice(0, 10);

    const count = fs.readdirSync(futureDir)
      .filter((name) => name.endsWith(".yaml"))
      .filter((name) => name.slice(0, 10) >= cutoffDate)
      .length;

    return { count, since_days: sinceDays };
  });
}
