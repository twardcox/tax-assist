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

const SECRET = env.JWT_SECRET_KEY ?? "dev-secret-change-me-in-production-32ch";
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

  return jwt.sign(payload, SECRET, {
    algorithm: ALGORITHM,
    expiresIn: `${ACCESS_TOKEN_EXPIRE_MINUTES}m`
  });
}

export function decodeRaw(token: string): AuthTokenPayload {
  try {
    return jwt.verify(token, SECRET, { algorithms: [ALGORITHM] }) as AuthTokenPayload;
  } catch {
    throw new AppError(401, "Invalid or expired token");
  }
}

export function extractBearerToken(authorization?: string): string | null {
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export function getCurrentUserFromToken(token: string): UserRow {
  const payload = decodeRaw(token);

  if (isTokenRevoked(payload.jti)) {
    throw new AppError(401, "Token revoked");
  }

  const user = getUserById(payload.sub);
  if (!user || !user.is_active) {
    throw new AppError(401, "User not found");
  }

  return user;
}

export function logoutToken(token: string): void {
  try {
    const payload = decodeRaw(token);
    const expiresAt = new Date(payload.exp * 1000).toISOString();
    revokeToken(payload.jti, expiresAt);
  } catch {
    // ignore invalid token during logout; mirrors Python behavior
  }
}
