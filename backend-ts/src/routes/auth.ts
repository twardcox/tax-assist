import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../lib/errors";
import { createUser, getUserByEmail } from "../db/authRepo";
import { createAccessToken, hashPassword, logoutToken, verifyPassword } from "../auth/service";

const REGISTER_MAX_REQUESTS = 5;
const REGISTER_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_MAX_REQUESTS = 10;
const LOGIN_WINDOW_MS = 60 * 1000;

const EmailSchema = z.string().trim().toLowerCase().email().max(254);
const PasswordSchema = z.string().min(8).max(128);
const DisplayNameSchema = z.string().trim().max(120);

type RateLimitBucket = {
  count: number;
  expiresAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

let nextRateLimitCleanupAt = 0;
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60 * 1000;

function enforceRateLimit(key: string, maxRequests: number, windowMs: number): void {
  const now = Date.now();
  if (now >= nextRateLimitCleanupAt) {
    for (const [bucketKey, bucket] of rateLimitBuckets) {
      if (now >= bucket.expiresAt) {
        rateLimitBuckets.delete(bucketKey);
      }
    }
    nextRateLimitCleanupAt = now + RATE_LIMIT_CLEANUP_INTERVAL_MS;
  }

  const bucket = rateLimitBuckets.get(key);

  if (!bucket || now >= bucket.expiresAt) {
    rateLimitBuckets.set(key, { count: 1, expiresAt: now + windowMs });
    return;
  }

  if (bucket.count >= maxRequests) {
    throw new AppError(429, "Too many auth attempts. Please try again later.");
  }

  bucket.count += 1;
}

export function __resetAuthRateLimitForTest(): void {
  rateLimitBuckets.clear();
}

const RegisterBodySchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  display_name: DisplayNameSchema.default("")
}).strict();

const LoginBodySchema = z.object({
  email: EmailSchema,
  password: PasswordSchema
}).strict();

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/register", { config: { unauthenticated: true } }, async (request, reply) => {
    const body = RegisterBodySchema.parse(request.body);
    enforceRateLimit(`register:${request.ip}`, REGISTER_MAX_REQUESTS, REGISTER_WINDOW_MS);

    if (getUserByEmail(body.email)) {
      throw new AppError(409, "Email already registered");
    }

    const userId = createUser(body.email, hashPassword(body.password), body.display_name);
    const token = createAccessToken(userId, body.email);

    return reply.status(201).send({
      token,
      token_type: "bearer",
      user_id: userId
    });
  });

  app.post("/auth/login", { config: { unauthenticated: true } }, async (request) => {
    enforceRateLimit(`login:${request.ip}`, LOGIN_MAX_REQUESTS, LOGIN_WINDOW_MS);
    const body = LoginBodySchema.parse(request.body);
    const user = getUserByEmail(body.email);

    if (!user || !verifyPassword(body.password, user.password_hash)) {
      throw new AppError(401, "Invalid credentials");
    }

    if (!user.is_active) {
      throw new AppError(403, "Account disabled");
    }

    const token = createAccessToken(user.id, user.email);
    return {
      token,
      token_type: "bearer",
      user_id: user.id,
      display_name: user.display_name ?? ""
    };
  });

  app.post("/auth/logout", { preHandler: app.authenticate }, async (request) => {
    if (request.token) {
      logoutToken(request.token);
    }

    return { logged_out: true };
  });

  app.get("/auth/me", { preHandler: app.authenticate }, async (request) => {
    const user = request.currentUser;
    if (!user) {
      throw new AppError(401, "User not found");
    }

    return {
      id: user.id,
      email: user.email,
      display_name: user.display_name ?? ""
    };
  });
}
