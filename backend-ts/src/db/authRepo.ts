import crypto from "node:crypto";
import { query, queryOne, execute } from "./client";

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

export async function createUser(email: string, passwordHash: string, displayName = ""): Promise<string> {
  const id = crypto.randomUUID();
  const normalizedEmail = email.toLowerCase().trim();
  const now = nowIso();

  await execute(
    `INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, normalizedEmail, passwordHash, displayName, now, now]
  );

  return id;
}

export async function getUserCount(): Promise<number> {
  const row = await queryOne<{ n: string }>(
    "SELECT COUNT(*)::int as n FROM users"
  );
  return Number(row?.n ?? 0);
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const row = await queryOne<UserRow>(
    "SELECT * FROM users WHERE email = $1 AND is_active = 1",
    [normalizedEmail]
  );
  return row ?? null;
}

export async function getUserById(userId: string): Promise<UserRow | null> {
  const row = await queryOne<UserRow>(
    "SELECT * FROM users WHERE id = $1",
    [userId]
  );
  return row ?? null;
}

export async function revokeToken(jti: string, expiresAt: string): Promise<void> {
  await execute(
    "INSERT INTO revoked_tokens (jti, revoked_at, expires_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
    [jti, nowIso(), expiresAt]
  );
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
  const row = await queryOne<{ jti: string }>(
    "SELECT jti FROM revoked_tokens WHERE jti = $1",
    [jti]
  );
  return Boolean(row);
}
