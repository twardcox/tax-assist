import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import yaml from "js-yaml";
import { z } from "zod";
import { env } from "../config/env";
import { AppError } from "../lib/errors";
import { projectPaths } from "../lib/paths";
import { getSectionData, saveSectionData } from "../db/sectionRepo";

const VALID_SECTIONS = new Set([
  "household",
  "income",
  "businesses",
  "real_estate",
  "investments",
  "retirement",
  "healthcare",
  "dependents",
  "goals",
  "documents_index"
]);

const DataBodySchema = z.object({
  data: z.record(z.unknown()).optional(),
  content: z.string().optional()
});

function sectionFilePath(section: string): string {
  return path.join(projectPaths.userData, `${section}.yaml`);
}

function assertSection(section: string): void {
  if (!VALID_SECTIONS.has(section)) {
    throw new AppError(404, `Section '${section}' not found`);
  }
}

function parseYamlContent(content: string): Record<string, unknown> {
  const loaded = yaml.load(content);
  if (loaded == null) {
    return {};
  }
  if (typeof loaded !== "object" || Array.isArray(loaded)) {
    throw new AppError(422, "Invalid YAML: expected mapping object");
  }
  return loaded as Record<string, unknown>;
}

export async function registerUserDataRoutes(app: FastifyInstance): Promise<void> {
  app.get("/user-data", { preHandler: app.authenticateOptional }, async () => {
    return {
      sections: [...VALID_SECTIONS].filter((name) => name !== "documents_index").sort()
    };
  });

  app.get(
    "/user-data/:section",
    { preHandler: app.authenticateOptional },
    async (request) => {
      const section = (request.params as { section: string }).section;
      assertSection(section);

      if (request.currentUser) {
        const data = getSectionData(request.currentUser.id, env.TAX_YEAR, section);
        const content = Object.keys(data).length
          ? yaml.dump(data, { noRefs: true, lineWidth: -1 })
          : "";

        return {
          section,
          content
        };
      }

      const filePath = sectionFilePath(section);
      if (!fs.existsSync(filePath)) {
        throw new AppError(404, `Section '${section}' not found`);
      }

      return {
        section,
        content: fs.readFileSync(filePath, "utf8")
      };
    }
  );

  app.put(
    "/user-data/:section",
    { preHandler: app.authenticateOptional },
    async (request) => {
      const section = (request.params as { section: string }).section;
      if (!VALID_SECTIONS.has(section)) {
        throw new AppError(400, `'${section}' is not an editable section`);
      }

      const body = DataBodySchema.parse(request.body ?? {});

      let data: Record<string, unknown>;
      if (body.data) {
        data = body.data;
      } else if (typeof body.content === "string") {
        try {
          data = parseYamlContent(body.content);
        } catch (error) {
          if (error instanceof AppError) {
            throw error;
          }
          throw new AppError(422, `Invalid YAML: ${(error as Error).message}`);
        }
      } else {
        throw new AppError(422, "Provide either 'data' (JSON) or 'content' (YAML string)");
      }

      if (request.currentUser) {
        saveSectionData(request.currentUser.id, env.TAX_YEAR, section, data);
      } else {
        const filePath = sectionFilePath(section);
        if (!fs.existsSync(filePath)) {
          throw new AppError(404, `Section '${section}' not found`);
        }

        fs.writeFileSync(filePath, yaml.dump(data, { noRefs: true, lineWidth: -1 }), "utf8");
      }

      return {
        section,
        saved: true
      };
    }
  );

  app.get(
    "/user-data/:section/parsed",
    { preHandler: app.authenticateOptional },
    async (request) => {
      const section = (request.params as { section: string }).section;
      assertSection(section);

      if (request.currentUser) {
        const data = getSectionData(request.currentUser.id, env.TAX_YEAR, section);
        return {
          section,
          data
        };
      }

      const filePath = sectionFilePath(section);
      if (!fs.existsSync(filePath)) {
        throw new AppError(404, `Section '${section}' not found`);
      }

      const content = fs.readFileSync(filePath, "utf8");
      let parsed: Record<string, unknown> = {};
      if (content.trim()) {
        parsed = parseYamlContent(content);
      }

      return {
        section,
        data: parsed
      };
    }
  );
}
