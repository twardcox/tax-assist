import crypto from "node:crypto";
import { query, queryOne, execute } from "./client";

type TransactionRecord = {
  id?: string;
  user_id: string;
  file_id: string;
  filename: string;
  date: string;
  merchant: string;
  total_amount: number;
  deductible_pct: number;
  deductible_amount: number;
  tax_category: string;
  benefit_ids: string[];
  form_line: string;
  section: string;
  dot_path: string;
  status: string;
  applied_at?: string;
  label: string;
};

type TxRow = {
  id: string;
  user_id: string;
  file_id: string;
  filename: string;
  date: string;
  merchant: string;
  total_amount: number;
  deductible_pct: number;
  deductible_amount: number;
  tax_category: string;
  benefit_ids: string;
  form_line: string;
  section: string;
  dot_path: string;
  status: string;
  applied_at: string;
  label: string;
};

function rowToTxn(row: TxRow): Record<string, unknown> {
  return {
    ...row,
    benefit_ids: JSON.parse(row.benefit_ids || "[]") as string[],
  };
}

export async function addTransaction(record: TransactionRecord): Promise<string> {
  const txId = record.id ?? crypto.randomUUID();
  const appliedAt = record.applied_at ?? new Date().toISOString();

  await execute(
    `INSERT INTO transactions
    (id, user_id, file_id, filename, date, merchant,
     total_amount, deductible_pct, deductible_amount,
     tax_category, benefit_ids, form_line,
     section, dot_path, status, applied_at, label)
    VALUES
    ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
    [
      txId,
      record.user_id,
      record.file_id,
      record.filename,
      record.date,
      record.merchant,
      record.total_amount,
      record.deductible_pct,
      record.deductible_amount,
      record.tax_category,
      JSON.stringify(record.benefit_ids ?? []),
      record.form_line,
      record.section,
      record.dot_path,
      record.status,
      appliedAt,
      record.label,
    ]
  );

  return txId;
}

export async function getTransactions(
  userId: string,
  filters: {
    benefitId?: string;
    taxCategory?: string;
    status?: string;
  }
): Promise<Record<string, unknown>[]> {
  let sql = "SELECT * FROM transactions WHERE user_id = $1";
  const params: unknown[] = [userId];
  let paramIdx = 2;

  if (filters.status) {
    sql += ` AND status = $${paramIdx}`;
    params.push(filters.status);
    paramIdx++;
  }

  if (filters.taxCategory) {
    sql += ` AND tax_category = $${paramIdx}`;
    params.push(filters.taxCategory);
    paramIdx++;
  }

  sql += " ORDER BY applied_at DESC";

  const rows = await query<TxRow>(sql, params);
  let txns = rows.map(rowToTxn);

  if (filters.benefitId) {
    txns = txns.filter((txn) => {
      const benefitIds = (txn.benefit_ids ?? []) as string[];
      return benefitIds.includes(filters.benefitId as string);
    });
  }

  return txns;
}

export async function getSummary(userId: string): Promise<{
  by_category: Array<Record<string, unknown>>;
  total_applied: Record<string, unknown>;
}> {
  const byCategory = await query<Record<string, unknown>>(
    `SELECT tax_category, COUNT(*)::int AS count,
            SUM(deductible_amount)::float AS total_deductible,
            SUM(total_amount)::float AS total_gross
     FROM transactions
     WHERE user_id = $1 AND status = 'applied'
     GROUP BY tax_category
     ORDER BY total_deductible DESC`,
    [userId]
  );

  const totalApplied = await queryOne<Record<string, unknown>>(
    `SELECT COUNT(*)::int AS count, SUM(deductible_amount)::float AS total_deductible
     FROM transactions
     WHERE user_id = $1 AND status = 'applied'`,
    [userId]
  ) ?? { count: 0, total_deductible: 0 };

  return {
    by_category: byCategory,
    total_applied: totalApplied,
  };
}

export async function reverseTransaction(txnId: string, userId: string): Promise<boolean> {
  const affected = await execute(
    "UPDATE transactions SET status = 'reversed' WHERE id = $1 AND user_id = $2",
    [txnId, userId]
  );
  return affected > 0;
}

export async function fileAlreadyApplied(userId: string, fileId: string): Promise<boolean> {
  const row = await queryOne<{ found: number }>(
    "SELECT 1 AS found FROM transactions WHERE user_id = $1 AND file_id = $2 LIMIT 1",
    [userId, fileId]
  );
  return Boolean(row?.found);
}
