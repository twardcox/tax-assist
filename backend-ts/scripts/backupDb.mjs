#!/usr/bin/env node
// Dated pg_dump backup of the UTBIS database (M1 / EP-001).
// Usage: npm run backup:db   (from backend-ts/)
// Output: <repo>/backups/utbis-YYYY-MM-DD-HHmm.dump (custom format, pg_restore-able)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = path.join(repoRoot, ".env");
  const match = fs.readFileSync(envFile, "utf8").match(/^DATABASE_URL=(.+)$/m);
  if (!match) throw new Error("DATABASE_URL not found in environment or .env");
  return match[1].trim();
}

function findPgDump() {
  // ponytail: PATH, then the local PG 18 install; set PG_BIN if yours lives elsewhere
  const candidates = process.env.PG_BIN
    ? [path.join(process.env.PG_BIN, "pg_dump.exe"), path.join(process.env.PG_BIN, "pg_dump")]
    : ["pg_dump", "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe"];
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore" });
      return candidate;
    } catch { /* try next */ }
  }
  throw new Error("pg_dump not found. Add it to PATH or set PG_BIN to your PostgreSQL bin directory.");
}

const databaseUrl = loadDatabaseUrl();
const pgDump = findPgDump();
const backupDir = path.join(repoRoot, "backups");
fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
const outFile = path.join(backupDir, `utbis-${stamp}.dump`);

execFileSync(pgDump, ["--format=custom", `--file=${outFile}`, databaseUrl], { stdio: "inherit" });

const { size } = fs.statSync(outFile);
if (size === 0) {
  fs.rmSync(outFile);
  throw new Error("pg_dump produced an empty file — backup NOT taken.");
}
console.log(`Backup written: ${outFile} (${(size / 1024).toFixed(1)} KiB)`);
console.log("Restore check: pg_restore --clean --create -d postgres <file>  (see user_data/private/README.md)");
