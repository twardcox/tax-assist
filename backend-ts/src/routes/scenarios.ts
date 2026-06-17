import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../lib/errors";
import { SCENARIOS, runScenario } from "../domain/scenarios/scenarios";

const ScenarioParamsSchema = z.object({
  key: z.string().min(1)
});

const ScenarioQuerySchema = z.object({
  tax_year: z.union([z.string(), z.number()]).optional(),
  with_ai: z.union([z.string(), z.boolean()]).optional()
});

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

export async function registerScenariosRoutes(app: FastifyInstance): Promise<void> {
  app.get("/scenarios", async () => ({
    scenarios: Object.entries(SCENARIOS).map(([key, value]) => ({ key, description: value.description }))
  }));

  app.post("/scenarios/:key", { preHandler: app.authenticateOptional }, async (request) => {
    const { key } = ScenarioParamsSchema.parse(request.params ?? {});
    const query = ScenarioQuerySchema.parse(request.query ?? {});
    const taxYear = Number(query.tax_year ?? 2025);
    const withAi = parseBoolean(query.with_ai);
    const userId = request.currentUser?.id ?? null;

    const result = await runScenario(key, taxYear, userId, withAi);
    if (!result) {
      throw new AppError(404, `Scenario '${key}' not found`);
    }

    return result;
  });
}
