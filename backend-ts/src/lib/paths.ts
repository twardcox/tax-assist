import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "..");
const isTestEnv = process.env.NODE_ENV === "test";
const dbFileName = isTestEnv ? "transactions.test.db" : "transactions.db";

export const projectPaths = {
  root,
  state: path.join(root, "state"),
  dbPath: path.join(root, "state", dbFileName),
  reports: path.join(root, "reports"),
  userData: path.join(root, "user_data"),
  taxLibrary: path.join(root, "tax_library"),
  rules: path.join(root, "rules"),
  forms: path.join(root, "forms"),
  frontendDist: path.join(root, "frontend", "dist")
};

export function ensureRequiredDirectories(): void {
  fs.mkdirSync(projectPaths.state, { recursive: true });
  fs.mkdirSync(projectPaths.reports, { recursive: true });
}

export function countTaxLibraryBenefits(): number {
  let count = 0;

  function walk(dirPath: string): void {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".yaml")) {
        count += 1;
      }
    }
  }

  if (fs.existsSync(projectPaths.taxLibrary)) {
    walk(projectPaths.taxLibrary);
  }

  return count;
}
