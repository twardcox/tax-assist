import { getDb } from "./client";

const TABLE_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti TEXT PRIMARY KEY,
  revoked_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS section_data (
  user_id TEXT NOT NULL,
  tax_year INTEGER NOT NULL,
  section TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, tax_year, section),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  date TEXT,
  merchant TEXT,
  total_amount REAL NOT NULL DEFAULT 0,
  deductible_pct REAL NOT NULL DEFAULT 1,
  deductible_amount REAL NOT NULL DEFAULT 0,
  tax_category TEXT,
  benefit_ids TEXT NOT NULL DEFAULT '[]',
  form_line TEXT,
  section TEXT,
  dot_path TEXT,
  status TEXT NOT NULL DEFAULT 'applied',
  applied_at TEXT NOT NULL,
  label TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_section_data_user_year ON section_data(user_id, tax_year);
CREATE INDEX IF NOT EXISTS idx_txn_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_txn_status ON transactions(user_id, status);
`;

export function initDb(): void {
  const db = getDb();
  db.exec(TABLE_SCHEMA);
}
