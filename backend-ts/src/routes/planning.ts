import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { runScan } from "../domain/scanner/scan";

const PlanningQuerySchema = z.object({
  tax_year: z.union([z.string(), z.number()]).optional()
});

type DeadlineEntry = {
  date: "12-31" | "04-15";
  action: string;
  extendable?: boolean;
};

const DEADLINE_MAP: Record<string, DeadlineEntry> = {
  "solo-401k": {
    date: "12-31",
    action: "Establish Solo 401(k) plan with custodian"
  },
  "s-corp-election": {
    date: "12-31",
    action: "Engage attorney to prepare S Corp election paperwork"
  },
  "section-179-expensing": {
    date: "12-31",
    action: "Place qualifying equipment in service"
  },
  "bonus-depreciation": {
    date: "12-31",
    action: "Place qualifying assets in service"
  },
  "business-vehicle-deduction": {
    date: "12-31",
    action: "Purchase and place business vehicle in service"
  },
  "augusta-rule": {
    date: "12-31",
    action: "Hold qualifying home rentals and document payments"
  },
  "capital-gains-harvesting": {
    date: "12-31",
    action: "Execute tax-loss or gains-harvesting trades"
  },
  "annual-gift-tax-exclusion": {
    date: "12-31",
    action: "Make annual exclusion gifts to recipients"
  },
  "clean-vehicle-credit": {
    date: "12-31",
    action: "Purchase qualifying electric vehicle"
  },
  "25c-energy-home-improvement": {
    date: "12-31",
    action: "Complete qualifying home energy improvements"
  },
  "residential-clean-energy-credit": {
    date: "12-31",
    action: "Install solar, wind, or battery storage system"
  },
  "529-to-roth-rollover": {
    date: "12-31",
    action: "Execute 529-to-Roth IRA rollover"
  },
  "opportunity-zone-investment": {
    date: "12-31",
    action: "Make qualifying Opportunity Zone investment"
  },
  "nol-carryforward": {
    date: "12-31",
    action: "Confirm and document net operating loss for the year"
  },
  "self-employed-health-insurance": {
    date: "12-31",
    action: "Pay qualifying health insurance premiums before year-end"
  },
  "qbi-deduction": {
    date: "12-31",
    action: "Review entity structure and income allocation for QBI optimization"
  },
  "state-ev-credit": {
    date: "12-31",
    action: "Purchase qualifying EV in your state before year-end"
  },
  "pte-election": {
    date: "12-31",
    action: "File Pass-Through Entity tax election with your state"
  },
  "state-529-deduction": {
    date: "12-31",
    action: "Make 529 plan contributions to capture state deduction"
  },
  "sep-ira-contribution": {
    date: "04-15",
    action: "Fund SEP-IRA for prior year",
    extendable: true
  },
  "backdoor-roth-ira": {
    date: "04-15",
    action: "Contribute to traditional IRA then convert to Roth"
  },
  "hsa-triple-tax-advantage": {
    date: "04-15",
    action: "Make prior-year HSA contributions up to annual limit"
  },
  "savers-credit": {
    date: "04-15",
    action: "Make qualifying retirement plan contributions"
  },
  "small-employer-retirement-startup-credit": {
    date: "04-15",
    action: "Establish qualifying employer retirement plan",
    extendable: true
  },
  "employer-childcare-credit": {
    date: "12-31",
    action: "Place qualified childcare facility in service or sign resource/referral contract"
  },
  "work-opportunity-tax-credit": {
    date: "12-31",
    action: "File Form 8850 with state workforce agency within 28 days of each qualifying hire"
  },
  "ichra-qsehra": {
    date: "12-31",
    action: "Establish ICHRA or QSEHRA plan document for next plan year"
  },
  "conservation-easement": {
    date: "12-31",
    action: "Record conservation easement deed by December 31"
  },
  qlac: {
    date: "12-31",
    action: "Purchase QLAC contract to exclude from current-year RMD calculation"
  },
  "installment-sale": {
    date: "12-31",
    action: "Close installment sale transaction and record promissory note"
  }
};

const ACTIONABLE_STATUSES = new Set(["eligible_now", "nearly_eligible", "eligible_if_changed"]);

function utcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDeadlineLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function computeUrgency(daysRemaining: number): "overdue" | "critical" | "soon" | "normal" {
  if (daysRemaining < 0) {
    return "overdue";
  }
  if (daysRemaining < 30) {
    return "critical";
  }
  if (daysRemaining < 90) {
    return "soon";
  }
  return "normal";
}

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
    const query = PlanningQuerySchema.parse(request.query ?? {});
    const taxYear = Number(query.tax_year ?? 2025);
    const userId = request.currentUser?.id ?? null;

    const dayMs = 24 * 60 * 60 * 1000;
    const today = utcDateOnly(new Date());
    const todayIso = formatIsoDate(today);

    const dec31 = new Date(Date.UTC(taxYear, 11, 31));
    const apr15 = new Date(Date.UTC(taxYear + 1, 3, 15));

    const daysUntilDec31 = Math.floor((dec31.getTime() - today.getTime()) / dayMs);
    const daysUntilApr15 = Math.floor((apr15.getTime() - today.getTime()) / dayMs);

    const scan = await runScan(taxYear, userId);
    const actions = scan.results
      .filter((result) => ACTIONABLE_STATUSES.has(result.status) && Boolean(DEADLINE_MAP[result.benefit_id]))
      .map((result) => {
        const entry = DEADLINE_MAP[result.benefit_id];
        const deadlineYear = entry.date === "04-15" ? taxYear + 1 : taxYear;
        const [monthText, dayText] = entry.date.split("-");
        const deadline = new Date(Date.UTC(deadlineYear, Number(monthText) - 1, Number(dayText)));
        const daysRemaining = Math.floor((deadline.getTime() - today.getTime()) / dayMs);

        return {
        benefit_id: result.benefit_id,
        benefit_name: result.benefit_name,
        action: entry.action,
        deadline_date: formatIsoDate(deadline),
        deadline_label: formatDeadlineLabel(deadline),
        days_remaining: daysRemaining,
        urgency: computeUrgency(daysRemaining),
        estimated_value: result.estimated_value,
        status: result.status,
        next_steps: result.next_steps,
        extendable: Boolean(entry.extendable)
      };
      })
      .sort((a, b) => a.days_remaining - b.days_remaining);
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
