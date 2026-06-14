import { getDb } from "./client";
import { saveSectionData } from "./sectionRepo";

const MANAGED_SECTIONS = [
  "household", "income", "businesses", "real_estate",
  "investments", "retirement", "healthcare", "dependents", "goals",
] as const;

/**
 * One-time migration: moves any rows still in the generic section_data table
 * (for managed sections) into the new typed tables.  Safe to call on every
 * startup — rows already in the typed tables are untouched, and moved rows
 * are deleted from section_data so the fallback path never returns stale data.
 */
export function migrateSectionDataIfNeeded(): void {
  const db = getDb();

  for (const section of MANAGED_SECTIONS) {
    type Row = { user_id: string; tax_year: number; data_json: string };
    const rows = db
      .prepare(
        "SELECT user_id, tax_year, data_json FROM section_data WHERE section = ?"
      )
      .all(section) as Row[];

    if (rows.length === 0) continue;

    console.log(`[migrate] Moving ${rows.length} ${section} row(s) from section_data → ${section}_data`);

    const deleteStmt = db.prepare(
      "DELETE FROM section_data WHERE user_id = ? AND tax_year = ? AND section = ?"
    );

    for (const row of rows) {
      let data: Record<string, unknown>;
      try {
        data = (JSON.parse(row.data_json) as Record<string, unknown>) ?? {};
      } catch {
        continue;
      }
      saveSectionData(row.user_id, row.tax_year, section, data);
      deleteStmt.run(row.user_id, row.tax_year, section);
    }
  }

  // Verify section_data only has documents_index (or nothing) left
  const remaining = db
    .prepare("SELECT DISTINCT section FROM section_data")
    .all() as { section: string }[];

  const unexpected = remaining
    .map((r) => r.section)
    .filter((s) => !MANAGED_SECTIONS.includes(s as typeof MANAGED_SECTIONS[number]));

  if (unexpected.length > 0) {
    console.log(`[migrate] section_data retains unmanaged sections: ${unexpected.join(", ")}`);
  }
}

