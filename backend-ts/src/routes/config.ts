import type { FastifyInstance } from "fastify";
import { env } from "../config/env";
import { countTaxLibraryBenefits } from "../lib/paths";

export async function registerConfigRoutes(app: FastifyInstance): Promise<void> {
  app.get("/config", async () => {
    return {
      ai_available: Boolean(env.ANTHROPIC_API_KEY),
      tax_year: env.TAX_YEAR,
      benefit_count: countTaxLibraryBenefits()
    };
  });
}
