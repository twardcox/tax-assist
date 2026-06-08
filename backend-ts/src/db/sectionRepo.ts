import { getDb } from "./client";

export function saveSectionData(userId: string, taxYear: number, section: string, data: object): void {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO section_data (user_id, tax_year, section, data_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, tax_year, section)
     DO UPDATE SET
       data_json = excluded.data_json,
       updated_at = excluded.updated_at`
  ).run(userId, taxYear, section, JSON.stringify(data), now);
}

export function getSectionData(userId: string, taxYear: number, section: string): Record<string, unknown> {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT data_json FROM section_data WHERE user_id = ? AND tax_year = ? AND section = ?"
    )
    .get(userId, taxYear, section) as { data_json: string } | undefined;

  if (!row) {
    return {};
  }

  try {
    return (JSON.parse(row.data_json) as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}
