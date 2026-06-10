import crypto from "node:crypto";
import { getDb } from "./client";

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  is_active: number;
  created_at: string;
  updated_at: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function createUser(email: string, passwordHash: string, displayName = ""): string {
  const db = getDb();
  const id = crypto.randomUUID();
  const normalizedEmail = email.toLowerCase().trim();
  const now = nowIso();

  db.prepare(
    `INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, normalizedEmail, passwordHash, displayName, now, now);

  return id;
}

export function getUserCount(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as n FROM users").get() as { n: number };
  return row.n;
}

export function getUserByEmail(email: string): UserRow | null {
  const db = getDb();
  const normalizedEmail = email.toLowerCase().trim();

  return (
    db
      .prepare("SELECT * FROM users WHERE email = ? AND is_active = 1")
      .get(normalizedEmail) ?? null
  ) as UserRow | null;
}

export function getUserById(userId: string): UserRow | null {
  const db = getDb();
  return (db.prepare("SELECT * FROM users WHERE id = ?").get(userId) ?? null) as UserRow | null;
}

export function revokeToken(jti: string, expiresAt: string): void {
  const db = getDb();
  db.prepare(
    "INSERT OR IGNORE INTO revoked_tokens (jti, revoked_at, expires_at) VALUES (?, ?, ?)"
  ).run(jti, nowIso(), expiresAt);
}

export function isTokenRevoked(jti: string): boolean {
  const db = getDb();
  const row = db.prepare("SELECT jti FROM revoked_tokens WHERE jti = ?").get(jti) as
    | { jti: string }
    | undefined;
  return Boolean(row);
}
