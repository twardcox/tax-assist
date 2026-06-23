import { Pool, type PoolClient } from "pg";
import { env } from "../config/env";

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: env.DATABASE_URL,
      allowExitOnIdle: true,
    });
  }
  return _pool;
}

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params);
  return result.rows;
}

export async function queryOne<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | undefined> {
  const result = await getPool().query<T>(sql, params);
  return result.rows[0];
}

export async function execute(
  sql: string,
  params: unknown[] = []
): Promise<number> {
  const result = await getPool().query(sql, params);
  return result.rowCount ?? 0;
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function resetTablesForTest(): Promise<void> {
  const tables = [
    "transactions", "documents", "section_data",
    "household_data", "income_data", "businesses_data", "real_estate_data",
    "investments_data", "retirement_data", "healthcare_data", "dependents_data",
    "goals_data", "households", "revoked_tokens", "users",
  ];
  for (const table of tables) {
    await execute(`DELETE FROM ${table}`);
  }
}
