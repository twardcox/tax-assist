import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors";
import { getSummary, getTransactions, reverseTransaction } from "../db/transactionsRepo";

export async function registerTransactionsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/transactions", { preHandler: app.authenticateOptional }, async (request) => {
    const user = request.currentUser;
    if (!user) {
      return { transactions: [] };
    }

    const query = request.query as {
      benefit_id?: string;
      tax_category?: string;
      status?: string;
    };

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

    const { txnId } = request.params as { txnId: string };
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
