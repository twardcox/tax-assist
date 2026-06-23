import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { AppError } from "../lib/errors";
import { env } from "../config/env";
import {
  getUserById,
  isTokenRevoked,
  revokeToken,
  type UserRow
} from "../db/authRepo";

function resolveJwtSecret(): string {
  if (env.JWT_SECRET_KEY && env.JWT_SECRET_KEY.trim().length > 0) {
    return env.JWT_SECRET_KEY;
  }

  // Keep tests self-contained while preventing insecure defaults in runtime.
  if (env.NODE_ENV === "test") {
    return "test-only-jwt-secret-change-before-shared-use";
  }

  throw new Error("JWT_SECRET_KEY is required outside test mode");
}

// Lazy so scripts that import hashPassword/verifyPassword but never issue
// tokens (e.g. the seed script) don't fail when JWT_SECRET_KEY is absent.
let _secret: string | undefined;
const getSecret = (): string => (_secret ??= resolveJwtSecret());

const ALGORITHM: jwt.Algorithm = "HS256";
const ACCESS_TOKEN_EXPIRE_MINUTES = 60;

export type AuthTokenPayload = {
  sub: string;
  email: string;
  jti: string;
  exp: number;
  iat: number;
};

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, bcrypt.genSaltSync());
}

export function verifyPassword(plain: string, hashed: string): boolean {
  try {
    return bcrypt.compareSync(plain, hashed);
  } catch {
    return false;
  }
}

export function createAccessToken(userId: string, email: string): string {
  const jti = crypto.randomUUID();
  const payload = {
    sub: userId,
    email,
    jti
  };

  return jwt.sign(payload, getSecret(), {
    algorithm: ALGORITHM,
    expiresIn: `${ACCESS_TOKEN_EXPIRE_MINUTES}m`
  });
}

export function decodeRaw(token: string): AuthTokenPayload {
  try {
    return jwt.verify(token, getSecret(), { algorithms: [ALGORITHM] }) as AuthTokenPayload;
  } catch {
    throw new AppError(401, "Invalid or expired token");
  }
}

export function extractBearerToken(authorization?: string): string | null {
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^\s*bearer\s+(\S+)\s*$/i);
  if (!match) {
    return null;
  }

  return match[1] ?? null;
}

export async function getCurrentUserFromToken(token: string): Promise<UserRow> {
  const payload = decodeRaw(token);

  if (await isTokenRevoked(payload.jti)) {
    throw new AppError(401, "Token revoked");
  }

  const user = await getUserById(payload.sub);
  if (!user || !user.is_active) {
    throw new AppError(401, "User not found");
  }

  return user;
}

export async function logoutToken(token: string): Promise<void> {
  try {
    const payload = decodeRaw(token);
    const expiresAt = new Date(payload.exp * 1000).toISOString();
    await revokeToken(payload.jti, expiresAt);
  } catch {
    // ignore invalid token during logout; mirrors Python behavior
  }
}
