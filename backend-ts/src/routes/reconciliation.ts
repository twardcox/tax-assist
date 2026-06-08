import type { FastifyInstance } from "fastify";
import { env } from "../config/env";
import { getSectionData } from "../db/sectionRepo";
import { getSummary } from "../db/transactionsRepo";

const FORM_LABELS: Record<string, string> = {
  w2_forms: "W-2",
  form_1099_nec: "1099-NEC",
  form_1099_misc: "1099-MISC",
  form_1099_int: "1099-INT",
  form_1099_div: "1099-DIV",
  form_1099_b: "1099-B",
  form_1099_r: "1099-R",
  form_k1: "K-1",
  form_ssa1099: "SSA-1099",
  form_1098: "1098 (Mortgage)",
  form_1098t: "1098-T (Tuition)",
  form_1098e: "1098-E (Student Loan)"
};

function buildUnprocessedIncomeDocs(documentsIndex: Record<string, unknown>): Array<Record<string, string>> {
  const incomeDocuments =
    (documentsIndex.income_documents as Record<string, unknown> | undefined) ?? {};

  const unprocessed: Array<Record<string, string>> = [];

  for (const [key, entries] of Object.entries(incomeDocuments)) {
    const label = FORM_LABELS[key] ?? key;

    if (Array.isArray(entries)) {
      for (const entry of entries) {
        if (typeof entry !== "object" || entry === null) {
          continue;
        }

        const typedEntry = entry as Record<string, unknown>;
        if (typedEntry.processed) {
          continue;
        }

        const detail =
          (typedEntry.employer as string | undefined) ??
          (typedEntry.institution as string | undefined) ??
          (typedEntry.payer as string | undefined) ??
          (typedEntry.school as string | undefined) ??
          (typedEntry.lender as string | undefined) ??
          "not uploaded";

        unprocessed.push({ form: label, detail });
      }
    } else if (typeof entries === "object" && entries !== null) {
      const typed = entries as Record<string, unknown>;
      if (!typed.processed) {
        unprocessed.push({ form: label, detail: "not uploaded" });
      }
    }
  }

  return unprocessed;
}

export async function registerReconciliationRoutes(app: FastifyInstance): Promise<void> {
  app.get("/reconciliation", { preHandler: app.authenticateOptional }, async (request) => {
    const user = request.currentUser;
    if (!user) {
      return {
        ledger: {
          by_category: [],
          total_applied: {
            count: 0,
            total_deductible: 0
          }
        },
        total_deductible_in_ledger: 0,
        total_transactions: 0,
        unprocessed_income_documents: [],
        ledger_by_category: {}
      };
    }

    const summary = getSummary(user.id);
    const documentsIndex = getSectionData(user.id, env.TAX_YEAR, "documents_index");
    const unprocessedIncomeDocuments = buildUnprocessedIncomeDocs(documentsIndex);

    const ledgerByCategory = Object.fromEntries(
      summary.by_category
        .filter((row) => Number(row.total_deductible ?? 0) !== 0)
        .map((row) => [String(row.tax_category ?? ""), row.total_deductible])
    );

    return {
      ledger: summary,
      ledger_by_category: ledgerByCategory,
      total_deductible_in_ledger: Number(summary.total_applied.total_deductible ?? 0),
      total_transactions: Number(summary.total_applied.count ?? 0),
      unprocessed_income_documents: unprocessedIncomeDocuments
    };
  });
}
