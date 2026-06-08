import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../lib/errors";
import { extractBearerToken, getCurrentUserFromToken } from "../auth/service";

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("currentUser", null);
  app.decorateRequest("token", null);

  app.decorate("authenticate", async (request) => {
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new AppError(401, "Not authenticated");
    }

    const user = getCurrentUserFromToken(token);
    request.currentUser = user;
    request.token = token;
  });

  app.decorate("authenticateOptional", async (request) => {
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      request.currentUser = null;
      request.token = null;
      return;
    }

    try {
      const user = getCurrentUserFromToken(token);
      request.currentUser = user;
      request.token = token;
    } catch {
      request.currentUser = null;
      request.token = null;
    }
  });
};

export const registerAuthPlugin = fp(authPlugin, {
  name: "auth-plugin"
});
