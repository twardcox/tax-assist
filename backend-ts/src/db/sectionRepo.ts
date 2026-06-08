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

function assignPath(target: Record<string, unknown>, dotPath: string, operation: string, value: unknown): boolean {
  const parts = dotPath.split(".").filter(Boolean);
  if (parts.length === 0) {
    return false;
  }

  let current: unknown = target;
  for (const part of parts.slice(0, -1)) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return false;
    }

    const obj = current as Record<string, unknown>;
    if (!(part in obj) || obj[part] == null || typeof obj[part] !== "object") {
      obj[part] = {};
    }
    current = obj[part];
  }

  const last = parts[parts.length - 1];
  if (!current || typeof current !== "object" || Array.isArray(current)) {
    return false;
  }

  const obj = current as Record<string, unknown>;
  if (operation === "add") {
    obj[last] = Number(obj[last] ?? 0) + Number(value ?? 0);
  } else {
    obj[last] = value;
  }

  return true;
}

export function applyDotPathToSection(
  userId: string,
  taxYear: number,
  section: string,
  dotPath: string,
  operation: string,
  value: unknown
): boolean {
  const data = getSectionData(userId, taxYear, section);
  const updated = { ...data };
  if (!assignPath(updated, dotPath, operation, value)) {
    return false;
  }

  saveSectionData(userId, taxYear, section, updated);
  return true;
}
