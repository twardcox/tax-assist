import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors";
import { SCENARIOS, runScenario } from "../domain/scenarios/scenarios";

export async function registerScenariosRoutes(app: FastifyInstance): Promise<void> {
  app.get("/scenarios", async () => ({
    scenarios: Object.entries(SCENARIOS).map(([key, value]) => ({ key, description: value.description }))
  }));

  app.post("/scenarios/:key", { preHandler: app.authenticateOptional }, async (request) => {
    const { key } = request.params as { key: string };
    const query = request.query as { tax_year?: string | number };
    const taxYear = Number(query.tax_year ?? 2025);
    const userId = request.currentUser?.id ?? null;

    const result = runScenario(key, taxYear, userId);
    if (!result) {
      throw new AppError(404, `Scenario '${key}' not found`);
    }

    return result;
  });
}
