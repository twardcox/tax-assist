import { DatabaseSync } from "node:sqlite";
import { projectPaths } from "../lib/paths";

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!db) {
    db = new DatabaseSync(projectPaths.dbPath);
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec("PRAGMA journal_mode = WAL;");
  }

  return db;
}
