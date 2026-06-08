import type { FastifyInstance } from "fastify";

function urgencyCounts(actions: Array<Record<string, unknown>>) {
  const counts = {
    overdue: 0,
    critical: 0,
    soon: 0,
    normal: 0
  };

  for (const action of actions) {
    const urgency = String(action.urgency ?? "normal");
    if (urgency in counts) {
      counts[urgency as keyof typeof counts] += 1;
    }
  }

  return counts;
}

// Interim implementation: preserves route contract shape while scanner/scenario
// domain logic is ported in later milestones.
export async function registerPlanningRoutes(app: FastifyInstance): Promise<void> {
  app.get("/planning/year-end", { preHandler: app.authenticateOptional }, async (request) => {
    const query = request.query as { tax_year?: string | number };
    const taxYear = Number(query.tax_year ?? 2025);

    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);

    const dec31 = new Date(Date.UTC(taxYear, 11, 31));
    const apr15 = new Date(Date.UTC(taxYear + 1, 3, 15));

    const dayMs = 24 * 60 * 60 * 1000;
    const daysUntilDec31 = Math.ceil((dec31.getTime() - today.getTime()) / dayMs);
    const daysUntilApr15 = Math.ceil((apr15.getTime() - today.getTime()) / dayMs);

    const actions: Array<Record<string, unknown>> = [];
    const counts = urgencyCounts(actions);

    return {
      tax_year: taxYear,
      today: todayIso,
      days_until_dec_31: daysUntilDec31,
      days_until_apr_15: daysUntilApr15,
      actions,
      summary: {
        total: actions.length,
        ...counts,
        dec_31_count: actions.filter((a) => String(a.deadline_date ?? "").endsWith("12-31")).length,
        apr_15_count: actions.filter((a) => String(a.deadline_date ?? "").endsWith("04-15")).length
      }
    };
  });
}
