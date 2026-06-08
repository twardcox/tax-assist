import crypto from "node:crypto";
import type { SQLInputValue } from "node:sqlite";
import { getDb } from "./client";

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
    benefit_ids: JSON.parse(row.benefit_ids || "[]") as string[]
  };
}

export function addTransaction(record: TransactionRecord): string {
  const db = getDb();
  const txId = record.id ?? crypto.randomUUID();
  const appliedAt = record.applied_at ?? new Date().toISOString();

  db.prepare(
    `INSERT INTO transactions
    (id, user_id, file_id, filename, date, merchant,
     total_amount, deductible_pct, deductible_amount,
     tax_category, benefit_ids, form_line,
     section, dot_path, status, applied_at, label)
    VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
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
    record.label
  );

  return txId;
}

export function getTransactions(
  userId: string,
  filters: {
    benefitId?: string;
    taxCategory?: string;
    status?: string;
  }
): Record<string, unknown>[] {
  const db = getDb();
  let query = "SELECT * FROM transactions WHERE user_id = ?";
  const params: SQLInputValue[] = [userId];

  if (filters.status) {
    query += " AND status = ?";
    params.push(filters.status);
  }

  if (filters.taxCategory) {
    query += " AND tax_category = ?";
    params.push(filters.taxCategory);
  }

  query += " ORDER BY applied_at DESC";

  const rows = db.prepare(query).all(...params) as TxRow[];
  let txns = rows.map(rowToTxn);

  if (filters.benefitId) {
    txns = txns.filter((txn) => {
      const benefitIds = (txn.benefit_ids ?? []) as string[];
      return benefitIds.includes(filters.benefitId as string);
    });
  }

  return txns;
}

export function getSummary(userId: string): {
  by_category: Array<Record<string, unknown>>;
  total_applied: Record<string, unknown>;
} {
  const db = getDb();

  const byCategory = db
    .prepare(
      `SELECT tax_category, COUNT(*) AS count,
              SUM(deductible_amount) AS total_deductible,
              SUM(total_amount) AS total_gross
       FROM transactions
       WHERE user_id = ? AND status = 'applied'
       GROUP BY tax_category
       ORDER BY total_deductible DESC`
    )
    .all(userId) as Array<Record<string, unknown>>;

  const totalApplied =
    (db
      .prepare(
        `SELECT COUNT(*) AS count, SUM(deductible_amount) AS total_deductible
         FROM transactions
         WHERE user_id = ? AND status = 'applied'`
      )
      .get(userId) as Record<string, unknown> | undefined) ?? {
      count: 0,
      total_deductible: 0
    };

  return {
    by_category: byCategory,
    total_applied: totalApplied
  };
}

export function reverseTransaction(txnId: string, userId: string): boolean {
  const db = getDb();
  const result = db
    .prepare("UPDATE transactions SET status = 'reversed' WHERE id = ? AND user_id = ?")
    .run(txnId, userId);

  return result.changes > 0;
}
