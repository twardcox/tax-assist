import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../lib/errors";
import { createUser, getUserByEmail } from "../db/authRepo";
import { createAccessToken, hashPassword, logoutToken, verifyPassword } from "../auth/service";

const RegisterBodySchema = z.object({
  email: z.string().email(),
  password: z.string(),
  display_name: z.string().default("")
});

const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/register", { config: { unauthenticated: true } }, async (request, reply) => {
    const body = RegisterBodySchema.parse(request.body);

    if (body.password.length < 8) {
      throw new AppError(422, "Password must be at least 8 characters");
    }

    if (getUserByEmail(body.email)) {
      throw new AppError(409, "Email already registered");
    }

    const userId = createUser(body.email, hashPassword(body.password), body.display_name);
    const token = createAccessToken(userId, body.email.toLowerCase().trim());

    return reply.status(201).send({
      token,
      token_type: "bearer",
      user_id: userId
    });
  });

  app.post("/auth/login", { config: { unauthenticated: true } }, async (request) => {
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
