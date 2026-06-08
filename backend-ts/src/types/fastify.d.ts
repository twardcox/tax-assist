import type { UserRow } from "../db/authRepo";

declare module "fastify" {
  interface FastifyRequest {
    currentUser: UserRow | null;
    token: string | null;
  }

  interface FastifyInstance {
    authenticate: (request: import("fastify").FastifyRequest) => Promise<void>;
    authenticateOptional: (request: import("fastify").FastifyRequest) => Promise<void>;
  }
}
