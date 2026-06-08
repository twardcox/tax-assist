import fs from "node:fs";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { registerErrorHandler } from "./lib/errors";
import { ensureRequiredDirectories, projectPaths } from "./lib/paths";
import { initDb } from "./db/init";
import { registerAuthPlugin } from "./plugins/auth";
import { registerAuthRoutes } from "./routes/auth";
import { registerHealthRoutes } from "./routes/health";
import { registerConfigRoutes } from "./routes/config";
import { registerUserDataRoutes } from "./routes/userData";
import { registerTransactionsRoutes } from "./routes/transactions";
import { registerReconciliationRoutes } from "./routes/reconciliation";
import { registerPlanningRoutes } from "./routes/planning";

export function buildApp() {
  ensureRequiredDirectories();
  initDb();

  const app = Fastify({ logger: true });

  registerErrorHandler(app);

  app.register(registerAuthPlugin);

  app.register(cors, {
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://127.0.0.1:5173"
    ]
  });

  app.register(multipart, {
    limits: {
      fileSize: 20 * 1024 * 1024
    }
  });

  app.register(async (api) => {
    await registerAuthRoutes(api);
    await registerHealthRoutes(api);
    await registerConfigRoutes(api);
    await registerUserDataRoutes(api);
    await registerTransactionsRoutes(api);
    await registerReconciliationRoutes(api);
    await registerPlanningRoutes(api);
  }, { prefix: "/api" });

  if (fs.existsSync(projectPaths.frontendDist)) {
    app.register(fastifyStatic, {
      root: projectPaths.frontendDist,
      prefix: "/"
    });
  }

  return app;
}
