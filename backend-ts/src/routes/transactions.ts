import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../lib/errors";
import { getSummary, getTransactions, reverseTransaction } from "../db/transactionsRepo";

const TransactionsQuerySchema = z.object({
  benefit_id: z.string().optional(),
  tax_category: z.string().optional(),
  status: z.string().optional()
});

const TransactionParamsSchema = z.object({
  txnId: z.string().min(1)
});

export async function registerTransactionsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/transactions", { preHandler: app.authenticateOptional }, async (request) => {
    const user = request.currentUser;
    if (!user) {
      return { transactions: [] };
    }

    const query = TransactionsQuerySchema.parse(request.query ?? {});

    return {
      transactions: getTransactions(user.id, {
        benefitId: query.benefit_id,
        taxCategory: query.tax_category,
        status: query.status
      })
    };
  });

  app.get("/transactions/summary", { preHandler: app.authenticateOptional }, async (request) => {
    const user = request.currentUser;
    if (!user) {
      return {
        by_category: [],
        total_applied: {
          count: 0,
          total_deductible: 0
        }
      };
    }

    return getSummary(user.id);
  });

  app.delete("/transactions/:txnId", { preHandler: app.authenticate }, async (request) => {
    const user = request.currentUser;
    if (!user) {
      throw new AppError(401, "User not found");
    }

    const { txnId } = TransactionParamsSchema.parse(request.params ?? {});
    const reversed = reverseTransaction(txnId, user.id);
    if (!reversed) {
      throw new AppError(404, `Transaction '${txnId}' not found`);
    }

    return {
      reversed: true,
      id: txnId
    };
  });
}
