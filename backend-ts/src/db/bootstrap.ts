import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { createUser, getUserByEmail, getUserCount } from "./authRepo";
import { saveSectionData } from "./sectionRepo";
import { hashPassword } from "../auth/service";
import { projectPaths } from "../lib/paths";
import { getDb } from "./client";

const DEFAULT_EMAIL = "admin@localhost";
const DEFAULT_PASSWORD = "changeme123";
const DEFAULT_DISPLAY_NAME = "Admin";
const BOOTSTRAP_TAX_YEAR = 2025;

const SECTION_YAML_MAP: Record<string, string> = {
  household: "household.yaml",
  income: "income.yaml",
  businesses: "businesses.yaml",
  real_estate: "real_estate.yaml",
  investments: "investments.yaml",
  retirement: "retirement.yaml",
  healthcare: "healthcare.yaml",
  dependents: "dependents.yaml",
  goals: "goals.yaml",
  documents_index: "documents_index.yaml"
};

export function bootstrapYamlIfNeeded(): void {
  if (getUserCount() > 0) {
    return;
  }

  console.log("[bootstrap] No users found — importing YAML data into DB for default user…");

  let uid: string;
  try {
    uid = createUser(DEFAULT_EMAIL, hashPassword(DEFAULT_PASSWORD), DEFAULT_DISPLAY_NAME);
  } catch {
    const existing = getUserByEmail(DEFAULT_EMAIL);
    if (!existing) {
      console.error("[bootstrap] ERROR: could not create default user");
      return;
    }
    uid = existing.id;
  }

  const dataDir = projectPaths.userData;
  let imported = 0;

  for (const [section, filename] of Object.entries(SECTION_YAML_MAP)) {
    const filePath = path.join(dataDir, filename);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const data = yaml.load(raw);
      if (data && typeof data === "object" && !Array.isArray(data)) {
        saveSectionData(uid, BOOTSTRAP_TAX_YEAR, section, data as Record<string, unknown>);
        imported += 1;
      }
    } catch (err) {
      console.warn(`[bootstrap] WARNING: could not import ${filename}:`, err);
    }
  }

  try {
    const db = getDb();
    db.prepare("UPDATE transactions SET user_id=? WHERE user_id IS NULL").run(uid);
  } catch (err) {
    console.warn("[bootstrap] WARNING: could not assign orphaned transactions:", err);
  }

  console.log(
    `[bootstrap] Done. Imported ${imported} sections for ${DEFAULT_EMAIL}.\n` +
    `[bootstrap] Default credentials: ${DEFAULT_EMAIL} / ${DEFAULT_PASSWORD}\n` +
    `[bootstrap] IMPORTANT: Change the password after first login!`
  );
}
