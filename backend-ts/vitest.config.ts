import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

// Local test runs use a dedicated tax_assist_test database so the suite's
// resetTablesForTest() can never truncate real user data in the dev DB
// (found 2026-07-10: npm test was wiping seeded/entered profiles).
// CI keeps its ephemeral service DB. An explicit DATABASE_URL wins over both.
// (No import.meta here — tsc builds this file as CommonJS.)
if (!process.env.CI && !process.env.DATABASE_URL) {
  const repoEnv = [path.resolve("..", ".env"), path.resolve(".env")].find((p) => fs.existsSync(p));
  const parsed = repoEnv ? dotenv.config({ path: repoEnv }).parsed ?? {} : {};
  const base = parsed.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/tax_assist";
  process.env.DATABASE_URL = base.replace(/\/[^/]+$/, "/tax_assist_test");
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"]
  }
});
